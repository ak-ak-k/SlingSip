import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import electronPath from 'electron';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { historyEntry } from '../shared/hydration-history.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';

async function launch(profile, flags = []) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test', `--companion-test-profile=${profile}`, ...flags], env, chromiumSandbox: true });
  let stderr = '';
  app.process().stderr.on('data', (data) => { stderr += data; });
  try {
    await expect.poll(() => app.windows().filter((page) => /#\/(dashboard|companion)$/.test(page.url())).length, { timeout: 60000 }).toBe(flags.includes('--autostart') ? 1 : 2);
  } catch (error) {
    console.error('Electron launch diagnosis:', app.windows().map((page) => page.url()), stderr);
    await close(app); throw error;
  }
  return { app, dashboard: app.windows().find((page) => page.url().endsWith('#/dashboard')), overlay: app.windows().find((page) => page.url().endsWith('#/companion')) };
}
async function close(app) {
  let timer;
  try { await Promise.race([app.close(), new Promise((resolve) => { timer = setTimeout(() => { app.process().kill(); resolve(); }, 10000); })]); }
  finally { clearTimeout(timer); }
}
async function menu(app, id) {
  await app.evaluate((_, id) => {
    const item = globalThis.__slingSipTestTray.menu.getMenuItemById(id);
    if (!item?.enabled) throw new Error(`Menu item ${id} is unavailable`);
    item.click(item, undefined, {});
  }, id);
}
async function menuState(app) {
  return app.evaluate(() => ({ exists: !!globalThis.__slingSipTestTray.tray && !globalThis.__slingSipTestTray.tray.isDestroyed(),
    items: Object.fromEntries(globalThis.__slingSipTestTray.menu.items.filter((item) => item.id).map((item) => [item.id, { label: item.label, enabled: item.enabled }])) }));
}
async function settingsPage(dashboard) {
  await dashboard.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(dashboard.getByTestId('settings-page')).toBeVisible();
}

test('Settings routes, inline validation, saved routine, retained tray, quick-add, active success, pause and OFF', async ({}, testInfo) => {
  const profile = `phase6-${randomUUID()}`; let run = await launch(profile);
  const errors = []; for (const page of run.app.windows()) page.on('pageerror', (error) => errors.push(error.message));
  try {
    const { app, overlay } = run; let dashboard = run.dashboard;
    expect((await menuState(app)).exists).toBe(true);
    await app.evaluate(() => { globalThis.__phase6TrayIdentity = globalThis.__slingSipTestTray.tray; });
    await settingsPage(dashboard);
    await dashboard.getByTestId('daily-goal').fill('100');
    await expect(dashboard.locator('#goal-hint')).toContainText('500 to 5000');
    await expect(dashboard.getByTestId('save-settings')).toBeDisabled();
    await dashboard.getByTestId('daily-goal').fill('2400');
    await dashboard.getByTestId('glass-size').fill('300');
    await dashboard.getByTestId('retry-minutes').fill('10');
    await dashboard.getByTestId('save-settings').click();
    await expect(dashboard.getByTestId('settings-saved')).toBeVisible();
    expect(await dashboard.evaluate(() => window.desktopCompanion.getHydrationSettings())).toMatchObject({ dailyGoalMl: 2400, glassSizeMl: 300, retryIntervalMinutes: 10 });
    expect((await menuState(app)).items.drink.label).toBe('Drink +300 ml');
    await dashboard.screenshot({ path: testInfo.outputPath('settings.png') });
    await dashboard.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('0 / 2400 ml');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().includes('#/dashboard')).close());
    await expect.poll(() => app.windows().length).toBe(1);
    await menu(app, 'drink'); await menu(app, 'drink');
    await expect(overlay.getByTestId('hydration-progress')).toHaveText('600 / 2400 ml');
    await menu(app, 'open');
    await expect.poll(() => app.windows().length).toBe(2);
    dashboard = app.windows().find((page) => page.url().endsWith('#/dashboard'));
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('600 / 2400 ml');
    await menu(app, 'open'); await menu(app, 'open');
    expect(app.windows()).toHaveLength(2);
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    const revision = await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visibilityRevision);
    await menu(app, 'drink');
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'success');
    expect(await overlay.evaluate((revision) => window.desktopCompanion.recordDrink(revision), revision)).toMatchObject({ addedWater: 0 });
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('900 / 2400 ml');
    await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    await overlay.getByRole('button', { name: 'Remind me later', exact: true }).click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'waiting');
    await menu(app, 'pause');
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'hidden');
    expect(await overlay.evaluate(() => window.desktopCompanion.getNextReminder())).toMatchObject({ remindersPaused: true, remindersEnabled: true, nextReminderAt: null });
    await menu(app, 'pause');
    expect(await overlay.evaluate(() => window.desktopCompanion.getNextReminder())).toMatchObject({ remindersPaused: false });
    await menu(app, 'settings');
    await expect(dashboard.getByTestId('settings-page')).toBeVisible();
    await dashboard.getByTestId('reminders-enabled').uncheck(); await dashboard.getByTestId('save-settings').click();
    expect((await menuState(app)).items.pause).toEqual({ enabled: false, label: 'Reminders off in Settings' });
    await menu(app, 'drink');
    await expect(overlay.getByTestId('hydration-progress')).toHaveText('1200 / 2400 ml');
    await dashboard.getByRole('link', { name: 'History', exact: true }).click();
    await expect(dashboard.getByTestId('history-page')).toBeVisible();
    await expect(dashboard.getByTestId(`history-${localDateKey(new Date())}`)).toContainText('1200 / 2400 ml');
    await dashboard.screenshot({ path: testInfo.outputPath('history.png') });
    expect(await app.evaluate(() => globalThis.__phase6TrayIdentity === globalThis.__slingSipTestTray.tray)).toBe(true);
    expect(errors).toEqual([]);
    const persisted = JSON.parse(await readFile(path.join(tmpdir(), 'mizu-overlay-tests', profile, 'hydration.json'), 'utf8'));
    expect(persisted).toMatchObject({ schemaVersion: 2, currentWaterMl: 1200, settings: { remindersEnabled: false } });
    await close(app); run = await launch(profile);
    expect(await run.overlay.evaluate(() => window.desktopCompanion.getNextReminder())).toMatchObject({ remindersEnabled: false, remindersPaused: false, nextReminderAt: null });
    await expect(run.dashboard.getByTestId('dashboard-water')).toHaveText('1200 / 2400 ml');
    await settingsPage(run.dashboard); await run.dashboard.getByTestId('reminders-enabled').check();
    await run.dashboard.getByTestId('save-settings').click();
    expect((await menuState(run.app)).items.pause.enabled).toBe(true);
  } finally { await close(run.app); }
});

test('History migrates and renders live today, historical goals, streaks and restart without duplicates', async ({}, testInfo) => {
  const profile = `history-ui-${randomUUID()}`; const directory = path.join(tmpdir(), 'mizu-overlay-tests', profile);
  await mkdir(directory, { recursive: true });
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const twoDays = new Date(); twoDays.setDate(today.getDate() - 2);
  await writeFile(path.join(directory, 'hydration.json'), JSON.stringify({ date: localDateKey(yesterday), currentWaterMl: 2000,
    settings: DEFAULT_HYDRATION_SETTINGS, history: [historyEntry(localDateKey(twoDays), 2400, 2400)] }));
  let run = await launch(profile);
  try {
    await run.dashboard.getByRole('link', { name: 'History', exact: true }).click();
    await expect(run.dashboard.getByTestId('current-streak')).toHaveText('2');
    await expect(run.dashboard.getByTestId('best-streak')).toHaveText('2');
    await expect(run.dashboard.getByTestId(`history-${localDateKey(twoDays)}`)).toContainText('2400 / 2400 ml');
    await menu(run.app, 'drink');
    await expect(run.dashboard.getByTestId(`history-${localDateKey(today)}`)).toContainText('250 / 2000 ml');
    await settingsPage(run.dashboard); await run.dashboard.getByTestId('daily-goal').fill('2400');
    await run.dashboard.getByTestId('save-settings').click();
    await run.dashboard.getByRole('link', { name: 'History', exact: true }).click();
    await expect(run.dashboard.getByTestId(`history-${localDateKey(today)}`)).toContainText('250 / 2400 ml');
    await expect(run.dashboard.getByTestId(`history-${localDateKey(yesterday)}`)).toContainText('2000 / 2000 ml');
    await run.dashboard.screenshot({ path: testInfo.outputPath('history-streaks.png') });
    await close(run.app); run = await launch(profile);
    const state = await run.dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(state.history.map((entry) => entry.date)).toEqual([localDateKey(today), localDateKey(yesterday), localDateKey(twoDays)]);
    expect(state.streaks).toMatchObject({ currentStreak: 2, bestStreak: 2 });
  } finally { await close(run.app); }
});

test('Windows startup ON/OFF verifies an isolated OS registration with a spaced path', async () => {
  test.skip(process.platform !== 'win32', 'Windows login items');
  const profile = `startup-${randomUUID()}`; const { app, dashboard } = await launch(profile, ['--companion-test-login-items']);
  try {
    await settingsPage(dashboard);
    await dashboard.getByTestId('launch-startup').check(); await dashboard.getByTestId('save-settings').click();
    await expect(dashboard.getByTestId('startup-status')).toHaveText('Windows startup: enabled');
    expect(await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).toMatchObject({ startup: { supported: true, enabled: true, error: null }, hydrationState: { settings: { launchAtStartup: true } } });
    const command = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', `Mizu-Test-${profile}`], { encoding: 'utf8', windowsHide: true });
    expect(command).toContain('--autostart'); expect(command).toContain(`"${process.cwd()}"`);
    expect(command).not.toContain('\\"');
    await dashboard.getByTestId('launch-startup').uncheck(); await dashboard.getByTestId('save-settings').click();
    await expect(dashboard.getByTestId('startup-status')).toHaveText('Windows startup: off');
    expect(() => execFileSync('reg.exe', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', `Mizu-Test-${profile}`], { stdio: 'pipe', windowsHide: true })).toThrow();
  } finally {
    // Only this test's uniquely named registration can be removed here.
    await app.evaluate(({ app }, profile) => app.setLoginItemSettings({ name: `Mizu-Test-${profile}`, openAtLogin: false }), profile).catch(() => {});
    await close(app);
  }
});

test('Autostart stays quiet; tray Settings reopens once; pause resets after restart; tray Quit exits cleanly', async () => {
  const profile = `quiet-${randomUUID()}`; let run = await launch(profile, ['--autostart']);
  let childProcess = run.app.process();
  try {
    expect(await run.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => window.isVisible()))).toEqual([false]);
    expect(await run.app.evaluate(({ app }) => app.isHardwareAccelerationEnabled())).toBe(process.platform !== 'win32');
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
    const duplicate = spawn(electronPath, ['.', '--companion-test', `--companion-test-profile=${profile}`, '--autostart'], { env, windowsHide: true });
    await new Promise((resolve, reject) => { duplicate.once('error', reject); duplicate.once('exit', resolve); });
    expect(duplicate.exitCode).toBe(0);
    expect(run.app.windows()).toHaveLength(1);
    await menu(run.app, 'settings'); await expect.poll(() => run.app.windows().length).toBe(2);
    run.dashboard = run.app.windows().find((page) => page.url().includes('#/dashboard'));
    await expect(run.dashboard.getByTestId('settings-page')).toBeVisible();
    await menu(run.app, 'pause');
    expect(await run.overlay.evaluate(() => window.desktopCompanion.getNextReminder())).toMatchObject({ remindersPaused: true });
    await close(run.app); run = await launch(profile);
    childProcess = run.app.process();
    expect(await run.overlay.evaluate(() => window.desktopCompanion.getNextReminder())).toMatchObject({ remindersPaused: false });
    await run.app.evaluate(({ app }) => {
      app.once('will-quit', () => { if (!globalThis.__slingSipTestTray.tray.isDestroyed()) throw new Error('Tray leaked on quit'); });
    });
    const exited = new Promise((resolve) => childProcess.once('exit', resolve));
    await menu(run.app, 'quit'); await exited;
    expect(childProcess.exitCode).toBe(0);
  } finally { if (childProcess.exitCode === null) await close(run.app); }
});
