import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { HydrationSession } from '../shared/hydration.ts';
import { reminderTiming } from '../shared/reminder-policy.ts';

test('Session water increases by one glass, deduplicates reminders, and caps at the goal', () => {
  const session = new HydrationSession();
  expect(session.snapshot()).toEqual({ currentWater: 0, glassSize: 250, dailyGoal: 2000 });
  for (let reminder = 1; reminder <= 8; reminder++) {
    expect(session.recordGlass(reminder)).toBe(250);
    expect(session.recordGlass(reminder)).toBe(0);
    expect(session.snapshot().currentWater).toBe(reminder * 250);
  }
  expect(session.recordGlass(9)).toBe(0);
  expect(session.snapshot().currentWater).toBe(2000);
});

test('Hydration restores the underlying saved daily record on restart', () => {
  const previous = new HydrationSession();
  previous.recordGlass(1);
  expect(previous.snapshot().currentWater).toBe(250);
  expect(new HydrationSession(previous.persisted()).snapshot().currentWater).toBe(250);
});

test('Production retries use five minutes; development uses ten seconds', () => {
  expect(reminderTiming(false)).toEqual({ retryIntervalMs: 300000, successDisplayMs: 2000 });
  expect(reminderTiming(true)).toEqual({ retryIntervalMs: 10000, successDisplayMs: 2000 });
});

async function launch() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test'], env, chromiumSandbox: true });
  await expect.poll(() => app.windows().filter((page) => /#\/(dashboard|companion)$/.test(page.url())).length, { timeout: 60000 }).toBe(2);
  const dashboard = app.windows().find((page) => page.url().endsWith('#/dashboard'));
  const overlay = app.windows().find((page) => page.url().endsWith('#/companion'));
  return { app, dashboard, overlay };
}

async function reloadRenderer(app) {
  // Hash routing rewrites the file URL to a directory. Reload the actual HTML entry.
  await app.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().endsWith('#/companion'));
    const entry = new URL('index.html', window.webContents.getURL());
    entry.hash = '/companion';
    await window.webContents.loadURL(entry.toString());
  });
}

test('Later and Ignore exit left, hide natively, return once on the same window, and cancel cleanly', async ({}, testInfo) => {
  const { app, dashboard, overlay } = await launch();
  const errors = []; overlay.on('pageerror', e => errors.push(e.message));
  try {
    // Compare placement after native startup; isolate manual retry assertions
    // from an unrelated normal hourly slot firing during the long scenario.
    await expect.poll(() => app.evaluate(({BrowserWindow}) => {
      const window=BrowserWindow.getAllWindows().find(win=>win.webContents.getURL().endsWith('#/dashboard'));
      return window?.isVisible() && !window.isMinimized();
    })).toBe(true);
    await dashboard.evaluate(async () => {
      const settings=await window.desktopCompanion.getHydrationSettings();
      await window.desktopCompanion.updateHydrationSettings({...settings,workingStart:'00:00',workingEnd:'00:01'});
    });
    const character = overlay.getByTestId('character');
    const id = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#/companion')).id);
    await overlay.evaluate(() => {
      window.__raf = 0; const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => { window.__raf++; return raf(cb); };
      // Capture the one-second ignore message at render time; slow assertion
      // backoff can otherwise skip Waiting and observe only the hidden exit.
      window.__ignoredMessages = [];
      new MutationObserver(() => {
        const character = document.querySelector('[data-testid="character"]');
        const heading = document.querySelector('#overlay-heading');
        const bubble = document.querySelector('.speech-bubble');
        if (character?.dataset.state === 'waiting' && heading?.textContent === 'Still waiting... 💧'
          && bubble?.getClientRects().length && getComputedStyle(bubble).opacity !== '0') {
          window.__ignoredMessages.push(heading.textContent);
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-state'] });
    });
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(character).toHaveAttribute('data-state', 'reminder');
    await expect.poll(() => overlay.locator('.speech-bubble').evaluate(el => el.getAnimations().every(a => a.playState === 'finished'))).toBe(true);
    const box = await overlay.locator('.speech-bubble').boundingBox();
    const initialPlacement = await dashboard.evaluate(async () => {
      const state=await window.desktopCompanion.getSnapshot();
      return {dashboard:state.dashboardBounds,workArea:state.display.workArea,overlay:state.overlay.bounds};
    });
    await overlay.getByRole('button', { name: 'Remind me later' }).click();
    await expect(overlay.getByRole('heading', { name: "Okay, I’ll swing back." })).toBeVisible();
    await expect(overlay.locator('.message')).toHaveText("I’ll check on you again in 10 seconds.");
    await overlay.screenshot({ path: testInfo.outputPath('later.png'), omitBackground: true });
    await expect(character).toHaveAttribute('data-state', 'swinging-back-left');
    await expect(character).toHaveAttribute('data-direction', 'left');
    await expect(character).toHaveAttribute('data-state', 'hidden');
    let snapshot = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(snapshot.overlay).toMatchObject({ visible: false, interactive: false });
    expect(snapshot.reminderRetry.pending).toBe(true); expect(snapshot.scheduler.reminderActive).toBe(true);
    const raf = await overlay.evaluate(() => window.__raf);
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(await overlay.evaluate(() => window.__raf)).toBe(raf);
    await expect(dashboard.getByTestId('toggle-overlay')).toBeDisabled();
    await expect(character).toHaveAttribute('data-state', 'swinging-in', { timeout: 15000 });
    await expect(character).toHaveAttribute('data-state', 'reminder');
    await expect.poll(() => overlay.locator('.speech-bubble').evaluate(el => el.getAnimations().every(a => a.playState === 'finished'))).toBe(true);
    const retryPlacement = await dashboard.evaluate(async () => {
      const state=await window.desktopCompanion.getSnapshot();
      return {dashboard:state.dashboardBounds,workArea:state.display.workArea,overlay:state.overlay.bounds};
    });
    await testInfo.attach('reminder-placement-context',{body:JSON.stringify({initialPlacement,retryPlacement},null,2),contentType:'application/json'});
    expect(await overlay.locator('.speech-bubble').boundingBox()).toEqual(box);
    expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).reminderRetry.count).toBe(1);
    await expect(overlay.locator('.message')).toHaveText('Hydration check, Test User.');
    await dashboard.evaluate(() => window.desktopCompanion.updateDisplayName('Aditya'));
    await expect(overlay.locator('.message')).toHaveText('Hydration check, Aditya.');
    // The original ignore interval remains 10 seconds in development.
    await expect.poll(() => overlay.evaluate(() => window.__ignoredMessages), { timeout: 15000 }).toContain('Still waiting... 💧');
    await expect(character).toHaveAttribute('data-state', 'swinging-back-left');
    await expect(character).toHaveAttribute('data-state', 'hidden');
    await expect(character).toHaveAttribute('data-state', 'swinging-in', { timeout: 15000 });
    await expect(character).toHaveAttribute('data-state', 'reminder');
    await overlay.getByTestId('drank-it').click();
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
    expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).reminderRetry.pending).toBe(false);
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(character).toHaveAttribute('data-state', 'reminder');
    await overlay.getByRole('button', { name: 'Remind me later' }).click();
    await expect(character).toHaveAttribute('data-state', 'hidden');
    await dashboard.getByTestId('cancel-overlay').click();
    snapshot = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(snapshot.reminderRetry.pending).toBe(false);
    await testInfo.attach('cancelled-retry-context',{body:JSON.stringify({observedAt:new Date().toISOString(),snapshot},null,2),contentType:'application/json'});
    await new Promise(resolve => setTimeout(resolve, 11000));
    await expect(character).toHaveAttribute('data-state', 'hidden');
    await reloadRenderer(app);
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(character).toHaveAttribute('data-state', 'reminder');
    await expect(overlay.getByTestId('hydration-progress')).toHaveText('250 / 2000 ml');
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#/companion')).id)).toBe(id);
    expect(await overlay.locator('app-companion-character').count()).toBe(1);
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test('Secure intake IPC rejects stale/invalid requests, credits once, and renders goal completion at 100%', async () => {
  const { app, dashboard, overlay } = await launch();
  try {
    const wrongRole = await dashboard.evaluate(async () => {
      try { await window.desktopCompanion.recordWater(1); return ''; } catch (error) { return error.message; }
    });
    expect(wrongRole).toContain('not available to the requesting frame');
    const wrongRetryRole = await dashboard.evaluate(async () => {
      try { await window.desktopCompanion.suspendReminder(0); return ''; } catch (error) { return error.message; }
    });
    expect(wrongRetryRole).toContain('not available to the requesting frame');
    for (const revision of [-1, '250', null, 1.5]) {
      const error = await overlay.evaluate(async (revision) => {
        try { await window.desktopCompanion.recordWater(revision); return ''; } catch (error) { return error.message; }
      }, revision);
      expect(error).toContain('valid reminder revision');
      const retryError = await overlay.evaluate(async revision => {
        try { await window.desktopCompanion.suspendReminder(revision); return ''; } catch (error) { return error.message; }
      }, revision);
      expect(retryError).toContain('valid reminder revision');
    }
    const hidden = await overlay.evaluate(async () => {
      try { await window.desktopCompanion.recordWater(0); return ''; } catch (error) { return error.message; }
    });
    expect(hidden).toContain('no longer active');
    for (let glass = 1; glass <= 7; glass++) {
      const state = await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(true));
      const result = await overlay.evaluate(async (revision) => {
        return Promise.all(Array.from({ length: 4 }, () => window.desktopCompanion.recordWater(revision)));
      }, state.overlay.visibilityRevision);
      expect(result.map((item) => item.addedWater)).toEqual([250, 0, 0, 0]);
      await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
      await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'hidden');
    }
    const stale = await overlay.evaluate(async () => {
      const state = await window.desktopCompanion.getSnapshot();
      try { await window.desktopCompanion.recordWater(state.overlay.visibilityRevision - 1); return ''; } catch (error) { return error.message; }
    });
    expect(stale).toContain('no longer active');
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    await overlay.getByTestId('drank-it').click();
    await expect(overlay.getByRole('heading', { name: 'Daily goal complete! 💧' })).toBeVisible();
    await expect(overlay.getByTestId('hydration-progress')).toHaveText('2000 / 2000 ml');
    await expect(overlay.locator('.message')).toHaveText('Nice work, Test User! Your daily water goal is reached.');
    await expect(overlay.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2000');
    expect(await overlay.locator('.water-track > span').evaluate((element) => element.style.width)).toBe('100%');
    await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
    await dashboard.getByTestId('toggle-overlay').click();
    // Success lasts 450 ms; the default eventual 1 s polling can skip it
    // after an entry variant. Keep the exact state assertion and sample faster.
    await expect.poll(() => overlay.getByTestId('character').getAttribute('data-state'), { intervals: [50] }).toBe('success');
    await expect(overlay.getByRole('heading', { name: 'Daily goal complete! 💧' })).toBeVisible();
    await expect(overlay.getByTestId('drank-it')).toBeHidden();
    expect(await dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).hydration.currentWater)).toBe(2000);
  } finally { await app.close(); }
});
