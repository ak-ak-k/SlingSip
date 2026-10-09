import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { configureAppIdentity, WINDOW_TITLE } from '../electron/app-identity.ts';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';
import { historyEntry, previousDay } from '../shared/hydration-history.ts';

test('Brand identity keeps legacy data/session directories and isolates test profiles', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'slingsip identity '));
  try {
    const legacy = path.join(root, 'Mizu'), testProfile = path.join(root, 'isolated-test');
    await mkdir(legacy); const saved = '{"schemaVersion":2,"currentWaterMl":1250}';
    await writeFile(path.join(legacy, 'hydration.json'), saved);
    const paths = { appData: root, userData: path.join(root, 'old-default'), sessionData: path.join(root, 'old-default') };
    let name;
    const application = {
      getPath: key => paths[key],
      setName: value => { name = value; paths.userData = path.join(root, value); paths.sessionData = paths.userData; },
      setPath: (key, value) => { expect(existsSync(value)).toBe(true); paths[key] = value; },
    };
    configureAppIdentity(application);
    expect(name).toBe('SlingSip'); expect(paths.userData).toBe(legacy); expect(paths.sessionData).toBe(legacy);
    expect(existsSync(path.join(root, 'SlingSip'))).toBe(false);
    expect(await readFile(path.join(legacy, 'hydration.json'), 'utf8')).toBe(saved);
    configureAppIdentity(application, testProfile);
    expect(paths.userData).toBe(testProfile); expect(paths.sessionData).toBe(testProfile);
    expect(await readFile(path.join(legacy, 'hydration.json'), 'utf8')).toBe(saved);
  } finally {
    // Verify the exact generated temp directory before recursive cleanup on Windows.
    expect(path.dirname(root)).toBe(path.resolve(tmpdir()));
    expect(path.basename(root)).toMatch(/^slingsip identity /);
    await rm(root, { recursive: true, force: true });
  }
});

async function launch(profile) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test', `--companion-test-profile=${profile}`], env, chromiumSandbox: true });
  try {
    await expect.poll(() => app.windows().filter(page => /#\/(dashboard|companion)$/.test(page.url())).length, { timeout: 60000 }).toBe(2);
    const dashboard = app.windows().find(page => page.url().endsWith('#/dashboard'));
    await expect(dashboard.getByTestId('dashboard')).toBeVisible();
    return { app, dashboard, overlay: app.windows().find(page => page.url().endsWith('#/companion')) };
  } catch (error) { await app.close(); throw error; }
}

async function expectCurrentBrand(page) {
  expect(await page.locator('body').innerText()).not.toMatch(/mizu/i);
  expect(await page.locator('[aria-label]').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')).join(' '))).not.toMatch(/mizu/i);
  await expect(page).toHaveTitle(WINDOW_TITLE);
}

test('SlingSip loads existing v2 water, settings, history and streaks across a native restart', async ({}, testInfo) => {
  const profile = `branding-${randomUUID()}`, directory = path.join(tmpdir(), 'mizu-overlay-tests', profile);
  const today = localDateKey(new Date()), yesterday = previousDay(today), before = previousDay(yesterday);
  const fixture = { schemaVersion: 2, date: today, currentWaterMl: 1250,
    settings: { ...DEFAULT_HYDRATION_SETTINGS, launchAtStartup: true },
    history: [historyEntry(before, 1800, 900), historyEntry(yesterday, 2400, 2400)] };
  await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, 'hydration.json'), JSON.stringify(fixture));
  let run = await launch(profile);
  try {
    for (let launchNumber = 0; launchNumber < 2; launchNumber++) {
      const identity = await run.app.evaluate(({ app, BrowserWindow }) => ({ name: app.getName(), userData: app.getPath('userData'), sessionData: app.getPath('sessionData'), titles: BrowserWindow.getAllWindows().map(window => window.getTitle()) }));
      expect(identity).toEqual({ name: 'SlingSip', userData: directory, sessionData: directory, titles: [WINDOW_TITLE, WINDOW_TITLE] });
      const snapshot = await run.dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
      expect(snapshot.hydrationState).toMatchObject(fixture);
      expect(snapshot.streaks).toMatchObject({ currentStreak: 1, bestStreak: 1 });
      await expect(run.dashboard.getByTestId('dashboard-water')).toHaveText('1250 / 2000 ml');
      await expect(run.dashboard.locator('.brand')).toHaveText('SlingSip.');
      await expect(run.dashboard.locator('.brand-caption')).toHaveText('Swing in.Sip up.Keep going.');
      await expect(run.dashboard.locator('.hero h1')).toHaveText('Stay hydrated.Keep moving.');
      expect(await run.dashboard.locator('.brand img').evaluate(img => img.complete && img.naturalWidth === 64)).toBe(true);
      expect(await run.dashboard.locator('link[rel="icon"]').getAttribute('href')).toBe('slingsip-logo.svg');
      expect(await run.app.evaluate(() => ({ open: globalThis.__slingSipTestTray.menu.getMenuItemById('open').label, quit: globalThis.__slingSipTestTray.menu.getMenuItemById('quit').label }))).toEqual({ open: 'Open SlingSip', quit: 'Quit SlingSip' });
      for (const route of ['History', 'Settings', 'Overview']) {
        await run.dashboard.getByRole('link', { name: route, exact: true }).click();
        await expectCurrentBrand(run.dashboard);
      }
      if (!launchNumber) { await run.app.close(); run = await launch(profile); }
    }
    expect(JSON.parse(await readFile(path.join(directory, 'hydration.json'), 'utf8'))).toMatchObject(fixture);
    await run.dashboard.getByTestId('open-companion').click();
    await expect(run.overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    await expect(run.overlay.locator('.bubble-eyebrow')).toHaveText('SLINGSIP • WATER BREAK');
    await expect(run.overlay.getByRole('heading', {name:'Drink 250 ml',exact:true})).toBeVisible();
    await expect(run.overlay.locator('.message')).toHaveText('Time to hydrate. Your sidekick is here.');
    expect(await run.overlay.locator('.bubble-eyebrow img').evaluate(img => img.complete && img.naturalWidth === 64)).toBe(true);
    await expectCurrentBrand(run.overlay);
    for (const name of ['Drank it', 'Remind me later', 'Open dashboard']) {
      const hitsBubble = await run.overlay.getByRole('button', { name }).evaluate(button => {
        const bounds = button.getBoundingClientRect();
        return document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest('[data-overlay-interactive]') === button.closest('[data-overlay-interactive]');
      });
      expect(hitsBubble).toBe(true);
    }
    await run.overlay.screenshot({ path: testInfo.outputPath('slingsip-reminder.png'), omitBackground: true });
    await run.overlay.getByRole('button', { name: 'Remind me later' }).click();
    await expect(run.overlay.getByRole('heading', { name: 'Okay, I’ll swing back.' })).toBeVisible();
    await expect(run.overlay.locator('.message')).toHaveText('I’ll check on you again in 10 seconds.');
    await run.overlay.screenshot({ path: testInfo.outputPath('slingsip-later.png'), omitBackground: true });
  } finally { await run.app.close(); }
});
