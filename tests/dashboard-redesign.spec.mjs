import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { cadenceLabel, countdownLabel, historyLabel, nextBreakView, clockLabel } from '../src/app/features/dashboard/overview-format.ts';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';
import { historyEntry, previousDay } from '../shared/hydration-history.ts';
import { HydrationRuntime } from '../electron/hydration-runtime.ts';

test('Dashboard labels use local days and ceil the actual deadline without a seconds loop', () => {
  const now = new Date(2026, 9, 6, 11).getTime();
  expect(countdownLabel(new Date(now + 61000).toISOString(), now)).toBe('In 2 min');
  expect(countdownLabel(new Date(now + 3660000).toISOString(), now)).toBe('In 1h 1m');
  expect(countdownLabel(new Date(now - 1000).toISOString(), now)).toBe('Due shortly');
  expect(historyLabel('2026-10-06', '2026-10-06')).toBe('Today');
  expect(historyLabel('2026-10-05', '2026-10-06')).toBe('Yesterday');
  expect(historyLabel('2025-12-31', '2026-01-01')).toBe('Yesterday');
  const after = ms => new Date(now + ms).toISOString(), first = after(0);
  expect(cadenceLabel([first, after(3600000)])).toBe('Gentle reminders every 1 hour.');
  expect(cadenceLabel([first, after(288000)])).toBe('Gentle reminders about every 5 minutes.');
  expect(cadenceLabel([first, after(600)])).toBe('Gentle reminders less than a minute apart.');
});

test('Next break reflects goal, OFF, pause, hidden retry, active and exhausted scheduling', () => {
  const next = new Date(2026, 9, 6, 12).toISOString(), now = new Date(2026, 9, 6, 11).getTime();
  const snapshot = { hydration: { currentWater: 0, dailyGoal: 2000 }, hydrationState: { settings: DEFAULT_HYDRATION_SETTINGS },
    scheduler: { remindersEnabled: true, remindersPaused: false, reminderActive: false, nextReminderAt: next, workingHoursActive: true }, reminderRetry: { pending: false, retryAt: null } };
  expect(nextBreakView(null, now).value).toBe('Unavailable');
  expect(nextBreakView(snapshot, now)).toEqual({ value: clockLabel(next), detail: 'In 1h' });
  snapshot.reminderRetry = { pending: true, retryAt: new Date(now + 5 * 60000).toISOString() };
  expect(nextBreakView(snapshot, now).detail).toBe('In 5 min · SlingSip swings back');
  snapshot.scheduler.remindersPaused = true; expect(nextBreakView(snapshot, now).value).toBe('Paused');
  snapshot.scheduler.remindersEnabled = false; expect(nextBreakView(snapshot, now).value).toBe('Reminders off');
  snapshot.hydration.currentWater = 2400; expect(nextBreakView(snapshot, now).value).toBe('Goal complete');
  snapshot.hydration.currentWater = 0; snapshot.scheduler.remindersEnabled = true; snapshot.scheduler.remindersPaused = false;
  snapshot.reminderRetry.pending = false; snapshot.scheduler.reminderActive = true;
  expect(nextBreakView(snapshot, now).value).toBe('Reminder active');
  snapshot.scheduler.reminderActive = false; snapshot.scheduler.nextReminderAt = null;
  expect(nextBreakView(snapshot, now).value).toBe('No upcoming break');
  snapshot.scheduler.workingHoursActive = false;
  expect(nextBreakView(snapshot, now)).toEqual({ value: 'Outside working hours', detail: 'Your routine: 10:00–18:00' });
});

test('Manual Open companion respects single reminder, pause, OFF and goal without changing automatic hours', async () => {
  const now = new Date(2026, 9, 6, 9), state = { date: localDateKey(now), currentWaterMl: 0, settings: DEFAULT_HYDRATION_SETTINGS };
  let visible = false, shows = 0;
  const windows = { quitting: false, visibilityRevision: 0, companion: { isVisible: () => visible },
    async setCompanionVisible(value) { visible = value; if (value) { shows++; this.visibilityRevision++; } } };
  const clock = { now: () => now, setTimeout: () => 0, clearTimeout: () => {} };
  const runtime = new HydrationRuntime(windows, { error: null, load: () => state, save: () => {} }, false, () => {}, clock);
  try {
    await runtime.trigger(false); expect(shows).toBe(0);
    await runtime.trigger(false, true); expect(shows).toBe(1);
    await runtime.trigger(false, true); expect(shows).toBe(1);
    await runtime.finishReminder(); runtime.setPaused(true);
    await runtime.trigger(false, true); expect(shows).toBe(1);
    runtime.setPaused(false); runtime.updateSettings({ ...DEFAULT_HYDRATION_SETTINGS, remindersEnabled: false });
    await runtime.trigger(false, true); expect(shows).toBe(1);
    runtime.updateSettings({ ...DEFAULT_HYDRATION_SETTINGS });
    for (let i = 0; i < 8; i++) runtime.quickAdd();
    await runtime.trigger(false, true); expect(shows).toBe(1);
  } finally { runtime.stop(); }
});

async function launch(profile) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test', `--companion-test-profile=${profile}`], env, chromiumSandbox: true });
  try { await expect.poll(() => app.windows().filter(p => /#\/(dashboard|companion)$/.test(p.url())).length, { timeout: 60000 }).toBe(2); }
  catch (error) { await app.close(); throw error; }
  return { app, dashboard: app.windows().find(p => p.url().endsWith('#/dashboard')), overlay: app.windows().find(p => p.url().endsWith('#/companion')) };
}

test('Dashboard actions share canonical intake, prompt credits, tray state, pause and final-glass clamping', async () => {
  const profile = `dashboard-actions-${randomUUID()}`, { app, dashboard, overlay } = await launch(profile);
  try {
    await dashboard.evaluate(() => window.desktopCompanion.updateHydrationSettings({ dailyGoalMl: 1000, glassSizeMl: 300, workingStart: '23:00', workingEnd: '23:59', retryIntervalMinutes: 5, remindersEnabled: true, launchAtStartup: false }));
    await expect(dashboard.getByTestId('drink-water')).toHaveText('Drink +300 ml');
    await dashboard.getByTestId('drink-water').evaluate(button => { button.click(); button.click(); });
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('300 / 1000 ml');
    await expect(overlay.getByTestId('hydration-progress')).toHaveText('300 / 1000 ml');
    await dashboard.getByTestId('quick-drink').click();
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('600 / 1000 ml');
    await dashboard.getByTestId('pause-reminders').click();
    await expect(dashboard.getByTestId('next-reminder')).toHaveText('Paused');
    await expect(dashboard.getByTestId('open-companion')).toBeDisabled();
    expect(await overlay.evaluate(() => window.desktopCompanion.getNextReminder())).toMatchObject({ remindersPaused: true, remindersEnabled: true });
    expect(await app.evaluate(() => globalThis.__slingSipTestTray.menu.getMenuItemById('pause').label)).toContain('Resume');
    await dashboard.getByTestId('pause-reminders').click();
    await dashboard.getByTestId('open-companion').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    const token = await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visibilityRevision);
    await dashboard.getByTestId('drink-water').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'success');
    expect(await overlay.evaluate(revision => window.desktopCompanion.recordDrink(revision), token)).toMatchObject({ addedWater: 0 });
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('900 / 1000 ml');
    await expect.poll(() => overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
    await dashboard.getByTestId('drink-water').click();
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('1000 / 1000 ml');
    await expect(dashboard.getByTestId('progress-percent')).toHaveText('100%');
    await expect(dashboard.getByTestId('remaining-water')).toHaveText('0ml');
    await expect(dashboard.getByTestId('next-reminder')).toHaveText('Goal complete');
    await expect(dashboard.getByTestId('drink-water')).toBeDisabled();
    await expect(dashboard.getByTestId(`preview-${localDateKey(new Date())}`)).toContainText('1000 / 1000 ml');
    const persisted = JSON.parse(await readFile(path.join(tmpdir(), 'mizu-overlay-tests', profile, 'hydration.json'), 'utf8'));
    expect(persisted).toMatchObject({ currentWaterMl: 1000, settings: { dailyGoalMl: 1000, glassSizeMl: 300 } });
  } finally { await app.close(); }
});

test('New dashboard commands reject companion roles and malformed pause without exposing Node', async () => {
  const { app, dashboard, overlay } = await launch(`dashboard-security-${randomUUID()}`);
  try {
    const denied = await overlay.evaluate(async () => {
      const results = [];
      for (const action of [() => window.desktopCompanion.recordDrink(), () => window.desktopCompanion.setRemindersPaused(true), () => window.desktopCompanion.openCompanion()]) {
        try { await action(); results.push('allowed'); } catch (error) { results.push(error.message); }
      }
      return results;
    });
    expect(denied).toHaveLength(3); for (const message of denied) expect(message).toContain('not available to the requesting frame');
    expect(await dashboard.evaluate(async () => { try { await window.desktopCompanion.setRemindersPaused('yes'); return ''; } catch (error) { return error.message; } })).toContain('must be a boolean');
    expect(await dashboard.evaluate(() => typeof window.require)).toBe('undefined');
    expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).scheduler.remindersPaused).toBe(false);
  } finally { await app.close(); }
});

test('Dashboard layouts, real history and schedule, keyboard and reduced motion at desktop and compact sizes', async ({}, testInfo) => {
  const profile = `dashboard-layout-${randomUUID()}`, directory = path.join(tmpdir(), 'mizu-overlay-tests', profile);
  const today = localDateKey(new Date()), yesterday = previousDay(today), before = previousDay(yesterday);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'hydration.json'), JSON.stringify({ schemaVersion: 2, date: today, currentWaterMl: 1250, settings: DEFAULT_HYDRATION_SETTINGS,
    history: [historyEntry(yesterday, 2400, 2400), historyEntry(before, 1800, 900)] }));
  const { app, dashboard, overlay } = await launch(profile), errors = [];
  dashboard.on('pageerror', e => errors.push(e.message));
  try {
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('1250 / 2000 ml');
    await expect(dashboard.getByTestId('progress-percent')).toHaveText('63%');
    await expect(dashboard.getByTestId(`preview-${yesterday}`)).toContainText('Yesterday');
    await expect(dashboard.getByTestId(`preview-${yesterday}`)).toContainText('2400 / 2400 ml');
    const slots = await dashboard.getByTestId('daily-schedule').locator('time').evaluateAll(items => items.map(item => item.dateTime));
    const schedule = await dashboard.evaluate(async () => (await window.desktopCompanion.getNextReminder()).todaySchedule);
    expect(slots.length).toBeGreaterThan(0); for (const slot of slots) expect(schedule).toContain(slot);
    await expect(dashboard.getByTestId('slingsip-hero-mascot')).toHaveAttribute('data-asset-key','idle');
    const image=dashboard.locator('.hero-art image');
    await expect(image).toHaveAttribute('href','assets/companion/slingsip/poses/idle.png');
    expect(await image.evaluate(async node=>{const image=new Image();image.src=node.getAttribute('href');await image.decode();return image.naturalWidth;})).toBe(173);
    const tokens=['--slingsip-bg','--slingsip-surface','--slingsip-surface-2','--slingsip-border','--slingsip-text','--slingsip-text-muted','--slingsip-accent-primary','--slingsip-accent-secondary','--slingsip-glow-primary','--slingsip-glow-secondary'];
    const palette=page=>page.evaluate(tokens=>Object.fromEntries(tokens.map(key=>[key,getComputedStyle(document.documentElement).getPropertyValue(key).trim()])),tokens);
    expect(await palette(overlay)).toEqual(await palette(dashboard));
    for(const value of Object.values(await palette(dashboard)))expect(value).not.toBe('');
    expect(await dashboard.locator('.hero-art').evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
    await dashboard.evaluate(() => { window.__dashboardRaf = 0; const request = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = callback => { window.__dashboardRaf++; return request(callback); }; });
    await dashboard.waitForTimeout(500);
    expect(await dashboard.evaluate(() => window.__dashboardRaf)).toBe(0);
    const layouts = [];
    for (const [width, height] of [[1366, 768], [1920, 1080], [2560, 1440], [760, 560]]) {
      await app.evaluate(({ BrowserWindow }, size) => {
        const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('#/dashboard'));
        win.setContentSize(size[0], size[1]);
      }, [width, height]);
      await expect.poll(() => dashboard.evaluate(() => innerWidth)).toBe(width);
      const bounds = await dashboard.evaluate(() => {
        const main = document.querySelector('.main-content'), grid = document.querySelector('.overview-grid');
        const cards = [...grid.children].map(card => { const rect = card.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, overflow: card.scrollWidth - card.clientWidth }; });
        const brand = document.querySelector('.brand'), wordmark = brand.querySelector('span').getBoundingClientRect(), sidebar = document.querySelector('.sidebar').getBoundingClientRect();
        return { width: innerWidth, height: innerHeight, overflow: main.scrollWidth - main.clientWidth, bodyOverflow: document.body.scrollWidth - innerWidth, brandOverflow: brand.scrollWidth - brand.clientWidth, wordmarkRight: wordmark.right, sidebarRight: sidebar.right, cards };
      });
      expect(bounds.overflow).toBeLessThanOrEqual(1); expect(bounds.bodyOverflow).toBeLessThanOrEqual(1);
      expect(bounds.brandOverflow).toBeLessThanOrEqual(1); expect(bounds.wordmarkRight).toBeLessThanOrEqual(bounds.sidebarRight);
      for (const card of bounds.cards) { expect(card.width).toBeGreaterThan(100); expect(card.overflow).toBeLessThanOrEqual(1); }
      for (let i = 0; i < bounds.cards.length; i++) for (let j = i + 1; j < bounds.cards.length; j++) {
        const a = bounds.cards[i], b = bounds.cards[j];
        expect(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1).toBe(true);
      }
      const artBounds=await dashboard.getByTestId('slingsip-hero-mascot').evaluate(node=>{const a=node.getBoundingClientRect(),b=node.closest('.hero-art').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1&&a.top>=b.top&&a.bottom<=b.bottom+1;});
      expect(artBounds).toBe(true);
      layouts.push(bounds);
      await dashboard.locator('.main-content').evaluate(element => element.scrollTop = 0);
      await dashboard.screenshot({ path: testInfo.outputPath(`overview-${width}.png`) });
      if (width === 1920) {
        await dashboard.locator('app-desktop-integration').scrollIntoViewIfNeeded();
        await dashboard.screenshot({ path: testInfo.outputPath('overview-lower-1920.png') });
      }
    }
    await dashboard.getByTestId('drink-water').focus(); await dashboard.keyboard.press('Tab');
    expect(await dashboard.evaluate(() => document.activeElement?.tagName)).toBe('A');
    await dashboard.emulateMedia({ reducedMotion: 'reduce' });
    await dashboard.getByRole('link', { name: 'History', exact: true }).click();
    await expect(dashboard.getByTestId('history-page')).toBeVisible();
    expect(await dashboard.locator('.main-content').evaluate(element => element.scrollTop)).toBe(0);
    await expect(dashboard.getByTestId(`history-${yesterday}`)).toContainText('2400 / 2400 ml');
    await dashboard.screenshot({ path: testInfo.outputPath('history-compact.png') });
    await dashboard.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(dashboard.getByTestId('settings-page')).toBeVisible();
    expect(await dashboard.locator('.main-content').evaluate(element => element.scrollTop)).toBe(0);
    await dashboard.getByTestId('daily-goal').fill('100');
    await expect(dashboard.getByTestId('save-settings')).toBeDisabled();
    await expect(dashboard.getByTestId('daily-goal')).toHaveAttribute('aria-invalid', 'true');
    await dashboard.screenshot({ path: testInfo.outputPath('settings-compact.png') });
    for (const [width, height] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
      await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('#/dashboard')).setContentSize(size[0], size[1]), [width, height]);
      await expect.poll(() => dashboard.evaluate(() => innerWidth)).toBe(width);
      for (const route of ['History', 'Settings']) {
        await dashboard.getByRole('link', { name: route, exact: true }).click();
        const overflow = await dashboard.locator('.main-content').evaluate(element => element.scrollWidth - element.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        await dashboard.screenshot({ path: testInfo.outputPath(`${route.toLowerCase()}-${width}.png`) });
      }
    }
    expect(await dashboard.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    expect(await overlay.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
    expect(errors).toEqual([]);
    await testInfo.attach('layout-measurements', { body: JSON.stringify(layouts, null, 2), contentType: 'application/json' });
  } finally { await app.close(); }
});
