import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';

async function launch(profile) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test', `--companion-test-profile=${profile}`], env, chromiumSandbox: true });
  await expect.poll(() => app.windows().filter((page) => /#\/(dashboard|companion)$/.test(page.url())).length, { timeout: 60000 }).toBe(2);
  const dashboard = app.windows().find((page) => page.url().endsWith('#/dashboard'));
  const overlay = app.windows().find((page) => page.url().endsWith('#/companion'));
  await expect(dashboard.getByTestId('dashboard')).toBeVisible();
  return { app, dashboard, overlay };
}

async function closeApplication(app) {
  let timer;
  try {
    await Promise.race([
      app.close(),
      new Promise((resolve) => { timer = setTimeout(() => { app.process().kill(); resolve(); }, 10000); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function drink(dashboard, overlay, expectedWater) {
  await dashboard.getByTestId('toggle-overlay').click();
  await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
  await overlay.getByTestId('drank-it').click();
  await expect(dashboard.getByTestId('dashboard-water')).toHaveText(`${expectedWater} / 2000 ml`);
  await expect(overlay.getByTestId('hydration-progress')).toHaveText(`${expectedWater} / 2000 ml`);
  await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
}

test('Persist 500 ml, restart, synchronize 750 ml, validate secure settings, and cancel slots at goal', async () => {
  const profile = `persistence-${randomUUID()}`;
  let run = await launch(profile);
  try {
    await expect(run.dashboard.getByTestId('dashboard-water')).toHaveText('0 / 2000 ml');
    await drink(run.dashboard, run.overlay, 250);
    await drink(run.dashboard, run.overlay, 500);
    const storagePath = await run.app.evaluate(({ app }) => `${app.getPath('userData')}/hydration.json`);
    const saved = JSON.parse(await readFile(storagePath, 'utf8'));
    expect(saved.currentWaterMl).toBe(500);
    expect(saved.date).toBe(localDateKey(new Date()));
    expect(saved.settings).toEqual(DEFAULT_HYDRATION_SETTINGS);
    expect(Number.isFinite(Date.parse(saved.lastDrinkAt))).toBe(true);
    expect(Number.isFinite(Date.parse(saved.lastReminderAt))).toBe(true);
    await closeApplication(run.app);
    run = await launch(profile);
    await expect(run.dashboard.getByTestId('dashboard-water')).toHaveText('500 / 2000 ml');
    await expect(run.overlay.getByTestId('character')).toHaveAttribute('data-state', 'hidden');
    expect(await run.dashboard.evaluate(() => window.desktopCompanion.getHydrationSettings())).toEqual(DEFAULT_HYDRATION_SETTINGS);
    expect((await run.dashboard.evaluate(() => window.desktopCompanion.getNextReminder())).todaySchedule).toHaveLength(8);
    await drink(run.dashboard, run.overlay, 750);

    const wrongRole = await run.overlay.evaluate(async () => {
      try { await window.desktopCompanion.updateHydrationSettings(await window.desktopCompanion.getHydrationSettings()); return ''; }
      catch (error) { return error.message; }
    });
    expect(wrongRole).toContain('not available to the requesting frame');
    const invalid = await run.dashboard.evaluate(async () => {
      try { await window.desktopCompanion.updateHydrationSettings({ ...await window.desktopCompanion.getHydrationSettings(), workingStart: '25:00' }); return ''; }
      catch (error) { return error.message; }
    });
    expect(invalid).toContain('HH:mm');
    const changed = await run.dashboard.evaluate(async () => window.desktopCompanion.updateHydrationSettings({
      ...await window.desktopCompanion.getHydrationSettings(), dailyGoalMl: 1000, retryIntervalMinutes: 7,
    }));
    expect(changed.scheduler.todaySchedule).toHaveLength(4);
    await expect(run.overlay.getByTestId('hydration-progress')).toHaveText('750 / 1000 ml');
    await run.dashboard.evaluate(() => Promise.all(Array.from({ length: 12 }, () => window.desktopCompanion.triggerDevelopmentReminder())));
    await expect(run.overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    expect(run.app.windows()).toHaveLength(2);
    await run.overlay.getByTestId('drank-it').evaluate((button) => { button.click(); button.click(); });
    await expect(run.dashboard.getByTestId('dashboard-water')).toHaveText('1000 / 1000 ml');
    await expect(run.overlay.getByTestId('hydration-progress')).toHaveText('1000 / 1000 ml');
    await expect(run.dashboard.getByTestId('next-reminder')).toHaveText('Goal complete');
    expect((await run.dashboard.evaluate(() => window.desktopCompanion.getNextReminder())).nextReminderAt).toBeNull();
    expect(JSON.parse(await readFile(storagePath, 'utf8')).currentWaterMl).toBe(1000);
  } finally { await closeApplication(run.app); }
});

test('A real daily slot triggers after dashboard closes and keeps a single native companion', async () => {
  const { app, dashboard, overlay } = await launch(`autotrigger-${randomUUID()}`);
  try {
    const companionId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().endsWith('#/companion')).id);
    // Inject the clock only into this isolated test process. Production has no clock override.
    await app.evaluate(({ app }) => {
      const SystemDate = Date;
      const justBeforeStart = new SystemDate(); justBeforeStart.setHours(9, 59, 55, 0);
      const offset = justBeforeStart.getTime() - SystemDate.now();
      globalThis.Date = class extends SystemDate {
        constructor(...args) { if (args.length) super(...args); else super(SystemDate.now() + offset); }
        static now() { return SystemDate.now() + offset; }
      };
      app.emit('browser-window-focus');
    });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().endsWith('#/dashboard')).close());
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder', { timeout: 15000 });
    expect(app.windows()).toHaveLength(1);
    const state = await overlay.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(state.dashboardOpen).toBe(false);
    expect(state.scheduler.reminderActive).toBe(true);
    expect(state.overlay.visible).toBe(true);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id)).toBe(companionId);
    await overlay.getByTestId('drank-it').click();
    await expect(overlay.getByTestId('hydration-progress')).toHaveText('250 / 2000 ml');
    await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
    await overlay.evaluate(() => window.desktopCompanion.openDashboard());
    await expect.poll(() => app.windows().length).toBe(2);
    const reopened = app.windows().find((page) => page.url().endsWith('#/dashboard'));
    await expect(reopened.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
  } finally { await closeApplication(app); }
});

test('Electron storage recovers corruption, resets yesterday, and survives an unavailable store', async () => {
  for (const fixture of ['corrupt', 'yesterday', 'unavailable']) {
    const profile = `recovery-${randomUUID()}`;
    const directory = path.join(tmpdir(), 'mizu-overlay-tests', profile);
    await mkdir(directory, { recursive: true });
    const userProfile={displayName:'QA Recovery',createdAt:'2026-10-01T10:00:00.000Z',hasCompletedOnboarding:true};
    const profileFile=JSON.stringify({schemaVersion:1,profile:userProfile});
    await writeFile(path.join(directory,'user-profile.json'),profileFile);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (fixture === 'unavailable') await mkdir(path.join(directory, 'hydration.json'));
    else await writeFile(path.join(directory, 'hydration.json'), fixture === 'corrupt' ? '{invalid JSON' : JSON.stringify({
      date: localDateKey(yesterday), currentWaterMl: 1500,
      settings: { ...DEFAULT_HYDRATION_SETTINGS, dailyGoalMl: 2400, glassSizeMl: 300 },
    }));
    const { app, dashboard } = await launch(profile);
    try {
      await expect(dashboard.getByTestId('dashboard-water')).toHaveText(`0 / ${fixture === 'yesterday' ? 2400 : 2000} ml`);
      const state = await dashboard.evaluate(() => window.desktopCompanion.getHydrationState());
      expect(state.date).toBe(localDateKey(new Date()));
      expect(state.currentWaterMl).toBe(0);
      expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).userProfile).toEqual(userProfile);
      expect(await readFile(path.join(directory,'user-profile.json'),'utf8')).toBe(profileFile);
      await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
      expect((await dashboard.evaluate(() => window.desktopCompanion.getNextReminder())).todaySchedule).toHaveLength(8);
      if (fixture === 'unavailable') {
        await expect(dashboard.getByRole('alert')).toContainText('Progress could not be saved locally');
        expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).storageError).toBeTruthy();
        await dashboard.getByRole('link', { name: 'Settings', exact: true }).click();
        await dashboard.getByTestId('daily-goal').fill('2400');
        await dashboard.getByTestId('save-settings').click();
        await expect(dashboard.getByRole('alert')).toContainText('Progress could not be saved locally');
        await expect(dashboard.getByTestId('settings-saved')).toHaveCount(0);
        expect((await dashboard.evaluate(() => window.desktopCompanion.getHydrationState())).settings.dailyGoalMl).toBe(2400);
      } else expect(JSON.parse(await readFile(path.join(directory, 'hydration.json'), 'utf8')).currentWaterMl).toBe(0);
    } finally { await closeApplication(app); }
  }
});
