import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { UpdateService, UPDATE_STARTUP_DELAY_MS, UPDATE_CHECK_INTERVAL_MS } from '../electron/update-service.ts';
import { UpdateTestDriver } from '../electron/update-test-driver.ts';
import { updateAvailability } from '../electron/update-backend.ts';
import { windowsPackageConfig, releasePolicy, assertStableReleaseVersion } from '../scripts/windows-package-config.mjs';
import { electron } from './helpers/existing-user-electron.mjs';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';
import { historyEntry, previousDay } from '../shared/hydration-history.ts';

function fixture(overrides = {}) {
  const backend = new UpdateTestDriver();
  let saved = 0, changed = 0;
  const service = new UpdateService({ currentVersion: '1.0.0', backend, changed: () => changed++,
    persist: () => saved++, canInstall: () => true, automaticChecking: false, ...overrides });
  return { service, backend, saved: () => saved, changed: () => changed };
}

test('Updates follow a deterministic manual check/download/verified-ready flow without implicit installation', async () => {
  const f = fixture();
  expect(f.service.snapshot()).toMatchObject({ status: 'idle', currentVersion: '1.0.0', channel: 'stable' });
  f.service.install(); expect(f.backend.installCount).toBe(0);
  await f.service.check(); expect(f.service.snapshot()).toMatchObject({ status: 'available', availableVersion: '2.0.0' });
  const download = f.service.download();
  await f.service.download(); expect(f.backend.downloadCount).toBe(1);
  f.backend.emit({ type: 'progress', percent: 64.8 }); expect(f.service.snapshot().downloadProgress).toBe(64);
  f.backend.emit({ type: 'progress', percent: Number.NaN }); expect(f.service.snapshot().downloadProgress).toBe(64);
  f.backend.emit({ type: 'downloaded', version: '9.0.0' }); expect(f.service.snapshot().status).toBe('downloading');
  f.backend.emit({ type: 'downloaded', version: '2.0.0' }); await download;
  expect(f.service.snapshot()).toMatchObject({ status: 'downloaded', downloadProgress: 100, installing: false });
  await f.service.check(); expect(f.backend.checkCount).toBe(1);
  expect(f.backend.installCount).toBe(0); f.service.install(); f.service.install();
  expect(f.saved()).toBe(1); expect(f.backend.installCount).toBe(1);
  f.service.stop();
});

test('Updater failures are recoverable; active reminders and failed persistence never start installation', async () => {
  let active = true, failSave = false, saved = 0;
  const f = fixture({ canInstall: () => !active, persist: () => { if (failSave) throw Error('disk'); saved++; } });
  f.backend.result = 'error'; await f.service.check();
  expect(f.service.snapshot()).toMatchObject({ status: 'error', failureStage: 'check' });
  f.backend.result = 'available'; await f.service.check();
  const failed = f.service.download(); f.backend.emit({ type: 'error' }); await failed;
  expect(f.service.snapshot()).toMatchObject({ status: 'error', failureStage: 'download' });
  const retried = f.service.download(); f.backend.emit({ type: 'downloaded', version: '2.0.0' }); await retried;
  f.service.install(); expect(f.backend.installCount).toBe(0); expect(saved).toBe(0);
  expect(f.service.snapshot().errorMessage).toContain('water break');
  active = false; failSave = true; f.service.install(); expect(f.backend.installCount).toBe(0);
  expect(f.service.snapshot().errorMessage).toContain('could not be saved');
  failSave = false; f.backend.installFails = true; f.service.install();
  expect(f.service.snapshot()).toMatchObject({ status: 'downloaded', installing: false, failureStage: 'install' });
  f.backend.installFails = false; f.service.install(); expect(f.service.snapshot().installing).toBe(true);
  f.service.stop();
});

test('Automatic checks are delayed, occasional and cancelled; disabled builds never touch the backend', async () => {
  let now = Date.parse('2026-10-09T06:00:00Z'), id = 0;
  const tasks = new Map();
  const clock = { now: () => new Date(now), setTimeout: (callback, delay) => { tasks.set(++id, { callback, at: now + delay }); return id; }, clearTimeout: key => tasks.delete(key) };
  const advance = async delay => { now += delay; for (const [key, task] of [...tasks]) if (task.at <= now) { tasks.delete(key); task.callback(); } await Promise.resolve(); };
  const f = fixture({ automaticChecking: true, clock }); f.backend.result = 'not-available';
  f.service.start(); f.service.start(); expect(tasks.size).toBe(1);
  await advance(UPDATE_STARTUP_DELAY_MS - 1); expect(f.backend.checkCount).toBe(0);
  await advance(1); expect(f.backend.checkCount).toBe(1); expect(f.service.snapshot().status).toBe('not-available');
  await advance(UPDATE_CHECK_INTERVAL_MS); expect(f.backend.checkCount).toBe(2);
  f.service.stop(); expect(tasks.size).toBe(0);
  await advance(UPDATE_CHECK_INTERVAL_MS); expect(f.backend.checkCount).toBe(2);
  const disabled = new UpdateService({ currentVersion: '1.0.0', disabledReason: 'Source run', changed: () => {}, persist: () => { throw Error('must not save'); }, canInstall: () => true, clock });
  disabled.start(); await disabled.check(); await disabled.download(); disabled.install();
  expect(disabled.snapshot()).toMatchObject({ enabled: false, automaticChecking: false, status: 'idle' }); expect(tasks.size).toBe(0);
  disabled.stop();
});

test('Packaging uses one stable public NSIS identity, requires signing and keeps previews update-disabled', async () => {
  expect(() => releasePolicy({ publisherName: '' })).toThrow('signing certificate');
  const config = windowsPackageConfig({ publisherName: 'CN=Test Publisher, O=Test Organisation, C=IN' });
  expect(config).toMatchObject({ appId: 'com.slingsip.desktop', forceCodeSigning: true, asar: true,
    win: { verifyUpdateCodeSignature: true, signtoolOptions: { publisherName: 'CN=Test Publisher, O=Test Organisation, C=IN' } },
    nsis: { deleteAppDataOnUninstall: false }, publish: [{ provider: 'github', owner: 'ak-ak-k', repo: 'slingsip', private: false, channel: 'latest' }] });
  expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
  expect(() => assertStableReleaseVersion('2.0.0-beta.1')).toThrow('prerelease');
  expect(() => assertStableReleaseVersion('1.0.0+build-beta')).not.toThrow();
  const preview = windowsPackageConfig({ preview: true }); expect(preview.publish).toBeNull(); expect(preview.forceCodeSigning).toBe(false);
  const directory = path.resolve('.cache/update-policy-tests-' + randomUUID()); await mkdir(directory, { recursive: true });
  const publisher = 'CN=Test Publisher, O=Test Organisation, C=IN'; // Public metadata fixture, never a signing credential.
  const feed = `provider: github\nowner: ak-ak-k\nrepo: slingsip\nchannel: latest\npublisherName: ${publisher}\n`;
  await writeFile(path.join(directory, 'app-update.yml'), feed);
  await writeFile(path.join(directory, 'slingsip-update-policy.json'), JSON.stringify(releasePolicy({ preview: true })));
  expect(updateAvailability(true, 'win32', directory)).toContain('unavailable');
  await writeFile(path.join(directory, 'slingsip-update-policy.json'), JSON.stringify(releasePolicy({ publisherName: publisher })));
  expect(updateAvailability(true, 'win32', directory)).toBeNull();
  for (const invalidFeed of [feed.replace(`publisherName: ${publisher}`, ''), feed.replace('Test Publisher', 'Wrong Publisher'),
    feed.replace('repo: slingsip', 'repo: unexpected'), feed + 'token: forbidden-fixture\n', feed + 'protocol: http\n', feed.replace('channel: latest', 'channel: beta')]) {
    await writeFile(path.join(directory, 'app-update.yml'), invalidFeed);
    expect(updateAvailability(true, 'win32', directory)).toContain('unavailable');
  }
  expect(updateAvailability(false, 'win32', directory)).toContain('cannot install');
  expect(updateAvailability(true, 'darwin', directory)).toContain('Windows');
  const source = await readFile('scripts/package-windows.mjs', 'utf8'); expect(source).toContain("publish: 'never'");
});

const env = () => { const value = { ...process.env }; delete value.ELECTRON_RUN_AS_NODE; delete value.ELECTRON_RENDERER_URL; return value; };
async function launch(profile, simulation = false) {
  const app = await electron.launch({ args: ['.', '--companion-test', `--companion-test-profile=${profile}`, '--companion-test-production', ...(simulation ? ['--companion-test-updater'] : [])], env: env(), chromiumSandbox: true });
  await expect.poll(() => app.windows().filter(page => /#\/(dashboard|companion)$/.test(page.url())).length, { timeout: 60000 }).toBe(2);
  return { app, dashboard: app.windows().find(page => page.url().endsWith('#/dashboard')), overlay: app.windows().find(page => page.url().endsWith('#/companion')) };
}
async function screenshots(page, name) {
  await mkdir('docs/previews/updates', { recursive: true });
  await page.getByTestId(name.includes('header') ? 'update-chip' : 'about-updates').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/previews/updates/${name}.png`, animations: 'disabled' });
}

test('Normal source production UI uses the actual version and cannot activate the real updater or simulation', async () => {
  const { app, dashboard, overlay } = await launch('updater-disabled-' + randomUUID());
  try {
    const state = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(state.updates).toMatchObject({ enabled: false, automaticChecking: false, currentVersion: state.appVersion });
    await expect(dashboard.getByTestId('update-chip')).toHaveCount(0);
    await dashboard.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(dashboard.getByTestId('update-current-version')).toHaveText(`Version ${state.appVersion}`);
    await expect(dashboard.getByTestId('check-for-updates')).toBeDisabled();
    expect(await app.evaluate(() => '__slingSipTestUpdater' in globalThis)).toBe(false);
    const response = await overlay.evaluate(async () => { try { await window.desktopCompanion.checkForUpdates(); return 'allowed'; } catch (error) { return error.message; } });
    expect(response).toContain('requesting frame');
    await dashboard.evaluate(async () => { await window.desktopCompanion.downloadUpdate(); await window.desktopCompanion.restartAndUpdate(); });
    expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).updates.status).toBe('idle');
    await screenshots(dashboard, '01-local-about');
  } finally { await app.close(); }
});

test('Secure simulated update UI shows real event progress, deferral, ready tray state and reminder-safe install without changing stored water/profile/history', async () => {
  const profile = 'updater-flow-' + randomUUID(), directory = path.join(tmpdir(), 'mizu-overlay-tests', profile);
  const settings = { ...DEFAULT_HYDRATION_SETTINGS }, history = [historyEntry(previousDay(localDateKey(new Date())), 2000, 2000)];
  await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, 'hydration.json'), JSON.stringify({ schemaVersion: 2, date: localDateKey(new Date()), currentWaterMl: 500, settings, history }));
  let { app, dashboard, overlay } = await launch(profile, true);
  try {
    const original = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    await dashboard.getByRole('link', { name: 'Settings', exact: true }).click();
    await dashboard.getByTestId('check-for-updates').click();
    await expect(dashboard.getByTestId('update-chip')).toContainText('v2.0.0');
    await expect(dashboard.getByTestId('download-update')).toBeVisible();
    await screenshots(dashboard, '02-available');
    await dashboard.getByTestId('update-later').click(); await expect(dashboard.getByTestId('download-update')).toHaveCount(0);
    await dashboard.getByTestId('update-chip').click(); await expect(dashboard.getByTestId('download-update')).toBeVisible();
    await dashboard.getByTestId('download-update').click();
    await app.evaluate(() => globalThis.__slingSipTestUpdater.emit({ type: 'progress', percent: 64 }));
    await expect(dashboard.getByTestId('update-progress')).toHaveText('64%'); await expect(dashboard.getByTestId('update-chip')).toContainText('64%');
    await screenshots(dashboard, '03-downloading');
    // Hydration is still usable while download is pending.
    await dashboard.getByRole('link', { name: 'Overview', exact: true }).click();
    await dashboard.getByTestId('open-companion').click(); await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    await overlay.getByTestId('drank-it').click(); await expect(dashboard.getByTestId('dashboard-water')).toHaveText('750 / 2000 ml');
    await expect.poll(async () => (await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    await app.evaluate(() => globalThis.__slingSipTestUpdater.emit({ type: 'downloaded', version: '2.0.0' }));
    await expect(dashboard.getByTestId('update-chip')).toHaveText('Update ready · Restart');
    expect(await app.evaluate(() => globalThis.__slingSipTestTray.menu.getMenuItemById('restart-update').label)).toContain('Restart & Update');
    expect(await app.evaluate(() => globalThis.__slingSipTestUpdater.installCount)).toBe(0);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('#/dashboard')).setContentSize(760, 660));
    await dashboard.getByTestId('update-chip').scrollIntoViewIfNeeded();
    const bounds = await dashboard.getByTestId('update-chip').boundingBox(); const width = await dashboard.evaluate(() => innerWidth);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width); await screenshots(dashboard, '04-ready-header-minimum');
    await dashboard.getByTestId('open-companion').click(); await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    await dashboard.getByTestId('update-chip').click(); await expect(dashboard.getByTestId('restart-and-update')).toBeDisabled();
    await dashboard.evaluate(() => window.desktopCompanion.restartAndUpdate());
    expect(await app.evaluate(() => globalThis.__slingSipTestUpdater.installCount)).toBe(0);
    await overlay.getByRole('button', { name: 'Remind me later', exact: true }).click();
    await expect.poll(async () => (await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    await expect(dashboard.getByTestId('restart-and-update')).toBeEnabled();
    await screenshots(dashboard, '05-ready');
    // A failed installer handoff must keep the session, timer and windows usable.
    await app.evaluate(() => { globalThis.__slingSipTestUpdater.installFails = true; });
    await dashboard.getByTestId('restart-and-update').click(); await expect(dashboard.getByTestId('update-error')).toContainText('kept open');
    expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).reminderRetry.pending).toBe(true);
    const saved = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(saved.userProfile).toEqual(original.userProfile); expect(saved.hydrationState.history).toEqual(original.hydrationState.history); expect(saved.hydrationState.settings).toEqual(settings);
    expect(JSON.parse(await readFile(path.join(directory, 'hydration.json'), 'utf8')).currentWaterMl).toBe(750);
    await app.close(); ({ app, dashboard, overlay } = await launch(profile));
    const restored = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(restored.hydration.currentWater).toBe(750); expect(restored.history).toEqual(saved.history); expect(restored.userProfile).toEqual(original.userProfile);
    expect(restored.hydrationState.settings).toEqual(settings); expect(restored.reminderRetry.pending).toBe(false); expect(restored.tray.available).toBe(true);
  } finally { await app.close(); }
});

test('A failed update check is non-disruptive and release notes are inert text', async () => {
  const { app, dashboard } = await launch('updater-errors-' + randomUUID(), true);
  try {
    await dashboard.getByRole('link', { name: 'Settings', exact: true }).click();
    await app.evaluate(() => { globalThis.__slingSipTestUpdater.result = 'error'; });
    await dashboard.getByTestId('check-for-updates').click(); await expect(dashboard.getByTestId('update-error')).toContainText('try again');
    await expect(dashboard.getByTestId('update-chip')).toHaveCount(0); await screenshots(dashboard, '06-check-error');
    await app.evaluate(() => { const driver = globalThis.__slingSipTestUpdater; driver.check = async () => driver.emit({ type: 'available', version: '2.0.0', releaseNotes: '<img src=x onerror="window.unsafeUpdateNotes=true">' }); });
    await dashboard.getByTestId('check-for-updates').click();
    await expect(dashboard.getByTestId('update-panel')).toContainText('<img src=x');
    await expect(dashboard.getByTestId('update-panel').locator('img')).toHaveCount(0);
    expect(await dashboard.evaluate(() => window.unsafeUpdateNotes)).toBeUndefined();
    await dashboard.getByRole('link', { name: 'Overview', exact: true }).click(); await dashboard.getByTestId('drink-water').click();
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
  } finally { await app.close(); }
});
