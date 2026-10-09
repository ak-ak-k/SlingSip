import { electron } from './helpers/existing-user-electron.mjs';
import {ambientPose,connectionDistance,expectBottleVisible,expectWebVisible} from './helpers/companion-visuals.mjs';
import { test, expect } from '@playwright/test';
import { CharacterState, canTransition } from '../src/app/features/companion/animation/character.model.ts';
import { advanceSwing, bottleSample, deliveryPose, settleSample, swingLayout, swingSample } from '../src/app/features/companion/animation/swing-motion.ts';
import { SWING_CONFIG } from '../src/app/features/companion/animation/swing-config.ts';

test('Swing states allow complete success and later flows without walking or invalid shortcuts', () => {
  for (const flow of [
    ['hidden', 'swinging-in', 'arriving', 'reminder', 'success', 'delivering-bottle', 'swinging-out-right', 'hidden'],
    ['hidden', 'swinging-in', 'arriving', 'reminder', 'waiting', 'swinging-back-left', 'hidden', 'swinging-in'],
  ]) for (let i = 1; i < flow.length; i++) expect(canTransition(flow[i - 1], flow[i])).toBe(true);
  for (const [a, b] of [['hidden', 'success'], ['reminder', 'swinging-out-right'], ['success', 'reminder'], ['waiting', 'swinging-in']]) expect(canTransition(a, b)).toBe(false);
  for (const state of Object.values(CharacterState)) expect(canTransition(state, state)).toBe(false);
});

test('Swing timing and trajectory are independent of 30, 60 and 144 Hz, including stalls', () => {
  const layout = swingLayout(1920, 1032);
  for (const fps of [30, 60, 144]) {
    let elapsed = 0;
    for (let frame = 0; frame < fps; frame++) elapsed = advanceSwing(elapsed, 1000 / fps, 2300);
    expect(elapsed).toBeCloseTo(1000, 7);
    expect(swingSample(layout, 'entry', elapsed / 2300).x).toBeCloseTo(swingSample(layout, 'entry', 1000 / 2300).x, 7);
  }
  expect(advanceSwing(0, 9000, 2300)).toBe(2300);
  expect(advanceSwing(100, -1, 2300)).toBe(100);
});

test('Responsive arcs enter left, dip, rise and exit either edge; entry web length stays fixed', () => {
  for (const [w, h] of [[1366, 720], [1920, 1032], [2560, 1392]]) for (const scale of [1, 1.25, 1.5]) {
    const layout = swingLayout(w / scale, h / scale);
    const samples = Array.from({ length: 101 }, (_, i) => swingSample(layout, 'entry', i / 100));
    // Position is the raised hand, not the left edge of the art box.
    expect(samples[0].x + layout.characterWidth * (1 - SWING_CONFIG.gripXRatio)).toBeLessThan(0);
    expect(samples.at(-1).x).toBeCloseTo(layout.reminder.x, 7);
    expect(samples.at(-1).y).toBeCloseTo(layout.reminder.y, 7);
    expect(Math.max(...samples.map(p => p.y))).toBeGreaterThan(layout.reminder.y);
    const length = Math.hypot(samples[0].x - samples[0].anchor.x, samples[0].y - samples[0].anchor.y);
    for (const [i, p] of samples.entries()) {
      expect(Math.hypot(p.x - p.anchor.x, p.y - p.anchor.y)).toBeCloseTo(length, 7);
      expect(Math.abs(p.rotation)).toBeLessThanOrEqual(SWING_CONFIG.rotationMaxDegrees);
      expect(p.anchor.y).toBeLessThan(0);
      expect(p.y + layout.characterHeight * (1 - SWING_CONFIG.gripYRatio)).toBeLessThanOrEqual(layout.height - SWING_CONFIG.edgePadding + .001);
      if (i) expect(p.x).toBeGreaterThanOrEqual(samples[i - 1].x);
    }
    for (const phase of ['right', 'left']) {
      const start = swingSample(layout, phase, 0), end = swingSample(layout, phase, 1);
      expect(start.x).toBe(layout.reminder.x); expect(start.y).toBe(layout.reminder.y);
      if (phase === 'right') expect(end.x).toBeGreaterThan(layout.width + layout.characterWidth);
      else expect(end.x).toBeLessThan(-layout.characterWidth);
    }
  }
});

test('Arrival brakes smoothly, recoils and preserves body and web continuity into either exit', () => {
  const layout = swingLayout(1920, 1032), entry = swingSample(layout, 'entry', 1);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  expect(distance(entry, swingSample(layout, 'entry', .9999))).toBeLessThan(distance(swingSample(layout, 'entry', .5), swingSample(layout, 'entry', .4999)) / 100);
  expect(settleSample(layout, entry, 0)).toEqual(entry);
  const settled = settleSample(layout, entry, 1);
  for (const key of ['rotation', 'scarf', 'frontLeg', 'rearLeg', 'arm', 'head']) expect(settled[key]).toBeCloseTo(0, 10);
  expect(settleSample(layout, entry, .25).y).toBeGreaterThan(settled.y);
  expect(settleSample(layout, entry, .75).y).toBeLessThan(settled.y);
  for (const phase of ['left', 'right']) {
    const first = swingSample(layout, phase, 0, settled);
    expect(first.x).toBe(settled.x); expect(first.y).toBe(settled.y);
    expect(first.rotation).toBe(settled.rotation);
    expect(first.releasedWeb).toEqual({ anchor: settled.anchor, opacity: 1 });
    expect(first.anchor).toEqual({ x: first.x, y: first.y });
    const halfway = swingSample(layout, phase, SWING_CONFIG.webCastRatio / 2, settled);
    expect(halfway.releasedWeb.opacity).toBeCloseTo(.5, 10);
    const cast = swingSample(layout, phase, SWING_CONFIG.webCastRatio, settled);
    expect(cast.releasedWeb).toBeUndefined(); expect(cast.anchor.y).toBeLessThan(0);
    const moving = swingSample(layout, phase, .5, settled);
    expect(Math.abs(moving.frontLeg)).toBeGreaterThan(5);
    expect(Math.abs(moving.rearLeg)).toBeGreaterThan(5);
    expect(Math.abs(moving.scarf)).toBeGreaterThan(10);
  }
});

test('Bottle stays on the animated hand and lowers within desktop bounds during a short delivery', () => {
  expect(SWING_CONFIG.bottleDurationMs).toBeGreaterThanOrEqual(800);
  expect(SWING_CONFIG.bottleDurationMs).toBeLessThanOrEqual(1500);
  for (const [w, h] of [[1366, 720], [1920, 1032], [2560, 1392]]) for (const scale of [1, 1.25, 1.5]) {
    const layout = swingLayout(w / scale, h / scale);
    const resting = settleSample(layout, swingSample(layout, 'entry', 1), 1);
    const first = bottleSample(layout, resting, 0), middle = bottleSample(layout, deliveryPose(resting, .5), .5);
    expect(first.x).toBe(first.start.x); expect(first.y).toBe(first.start.y); expect(first.opacity).toBe(0);
    expect(middle.y).toBeGreaterThan(middle.start.y); expect(middle.x).toBeLessThan(middle.start.x);
    for (let i = 0; i <= 100; i++) {
      const p = bottleSample(layout, deliveryPose(resting, i / 100), i / 100);
      expect(p.y + p.size).toBeLessThanOrEqual(layout.height - SWING_CONFIG.edgePadding + .001);
    }
    expect(bottleSample(layout, resting, 1).opacity).toBe(0);
    expect(bottleSample(layout, resting, null).visible).toBe(false);
  }
  // A 90 degree body turn moves the free hand around the raised grip, rather than detaching the web.
  const layout = swingLayout(1920, 1032), base = settleSample(layout, swingSample(layout, 'entry', 1), 1);
  const normal = bottleSample(layout, base, .5).start, rotated = bottleSample(layout, { ...base, rotation: 90 }, .5).start;
  expect(rotated.x - base.x).toBeCloseTo(-(normal.y - base.y), 7);
  expect(rotated.y - base.y).toBeCloseTo(normal.x - base.x, 7);
  expect(bottleSample(layout, { ...base, arm: 20 }, .5).start).not.toEqual(normal);
});

test('Native swing success logs immediately, delivers a bottle, exits right, stops RAF and reuses the window', async ({}, testInfo) => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test'], env, chromiumSandbox: true });
  const errors = []; app.on('window', p => p.on('pageerror', e => errors.push(e.message)));
  try {
    await expect.poll(() => app.windows().filter(p => /#\/(dashboard|companion)$/.test(p.url())).length, { timeout: 60000 }).toBe(2);
    const dashboard = app.windows().find(p => p.url().endsWith('#/dashboard'));
    const overlay = app.windows().find(p => p.url().endsWith('#/companion'));
    const character = overlay.getByTestId('character');
    const id = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#/companion')).id);
    await overlay.evaluate(() => {
      window.__frames = []; window.__rafRequests = 0;
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => { window.__rafRequests++; return request(cb); };
      const c = document.querySelector('[data-testid="character"]');
      new MutationObserver(() => window.__frames.push({ state: c.dataset.state, x: Number(c.dataset.x), y: Number(c.dataset.y) })).observe(c, { attributes: true, attributeFilter: ['data-state', 'data-x'] });
    });
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(character).toHaveAttribute('data-state', 'swinging-in');
    await expectWebVisible(overlay);
    await expect(overlay.locator('.speech-bubble')).toBeHidden();
    await overlay.screenshot({ path: testInfo.outputPath('swing-in.png'), omitBackground: true });
    await expect(character).toHaveAttribute('data-state', 'reminder');
    const boxes = await Promise.all([character.boundingBox(), overlay.locator('.speech-bubble').boundingBox()]);
    expect(boxes[1].y + boxes[1].height).toBeLessThan(boxes[0].y);
    await overlay.screenshot({ path: testInfo.outputPath('reminder.png'), omitBackground: true });
    const rafIdle = await overlay.evaluate(() => window.__rafRequests);
    const idleBefore = await ambientPose(overlay);
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(await ambientPose(overlay)).not.toBe(idleBefore);
    expect(await overlay.evaluate(() => window.__rafRequests)).toBe(rafIdle);
    const gripConnection = await connectionDistance(overlay,'grip');
    expect(gripConnection).toBeLessThan(.1);
    await dashboard.evaluate(() => Promise.all(Array.from({ length: 4 }, () => window.desktopCompanion.setOverlayVisible(true))));
    expect(await overlay.locator('app-companion-character').count()).toBe(1);
    await overlay.getByTestId('drank-it').evaluate(button => { button.click(); button.click(); });
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await expect(overlay.getByRole('heading', { name: 'Great choice!' })).toBeVisible();
    await expect(overlay.locator('.speech-bubble .message')).toHaveText('+ 250 ml');
    await expect(character).toHaveAttribute('data-state', 'delivering-bottle');
    await expectBottleVisible(overlay);
    const bottleConnection = await connectionDistance(overlay,'bottle');
    expect(bottleConnection).toBeLessThan(.1);
    await overlay.screenshot({ path: testInfo.outputPath('bottle-delivery.png'), omitBackground: true });
    await expect(character).toHaveAttribute('data-state', 'swinging-out-right');
    await expect(character).toHaveAttribute('data-direction', 'right');
    await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).overlay.visible)).toBe(false);
    await expect(character).toHaveAttribute('data-state', 'hidden');
    const frames = await overlay.evaluate(() => window.__frames);
    // Layout projection can emit hidden coordinates before entry. Check the complete ordered flow,
    // including its final hide, instead of globally deduplicating the two hidden boundaries.
    const flow=frames.slice(frames.findIndex(frame=>frame.state==='swinging-in')).map(frame=>frame.state).filter((state,index,states)=>index===0||state!==states[index-1]);
    expect(flow).toEqual(['swinging-in', 'arriving', 'reminder', 'success', 'delivering-bottle', 'swinging-out-right', 'hidden']);
    const firstEntry = frames.find(p => p.state === 'swinging-in');
    expect(firstEntry.x < 0 || firstEntry.y < 0).toBe(true);
    expect(frames.filter(p => p.state === 'swinging-out-right').at(-1).x).toBeGreaterThan(await overlay.evaluate(() => innerWidth));
    const rafHidden = await overlay.evaluate(() => window.__rafRequests);
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(await overlay.evaluate(() => window.__rafRequests)).toBe(rafHidden);
    await expect(overlay.getByTestId('swing-web')).toHaveCount(0);
    await expect(overlay.getByTestId('companion-bottle')).toHaveCount(0);
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(character).toHaveAttribute('data-state', 'swinging-in');
    await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
    await expect(character).toHaveAttribute('data-state', 'hidden');
    // Cancelling during delivery must remove its web/bottle and prevent a delayed right exit.
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(character).toHaveAttribute('data-state', 'reminder');
    await overlay.getByTestId('drank-it').click();
    await expect(character).toHaveAttribute('data-state', 'delivering-bottle');
    await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
    await expect(character).toHaveAttribute('data-state', 'hidden');
    const cancelledRaf = await overlay.evaluate(() => window.__rafRequests);
    await new Promise(resolve => setTimeout(resolve, SWING_CONFIG.bottleDurationMs + SWING_CONFIG.successExitDurationMs));
    expect(await overlay.evaluate(() => window.__rafRequests)).toBe(cancelledRaf);
    await expect(overlay.getByTestId('companion-bottle')).toHaveCount(0);
    await expect(overlay.getByTestId('swing-web')).toHaveCount(0);
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('500 / 2000 ml');
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#/companion')).id)).toBe(id);
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test('Reduced motion keeps the reminder usable without travel or ambient frame loops', async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test'], env, chromiumSandbox: true });
  try {
    await expect.poll(() => app.windows().filter(p => /#\/(dashboard|companion)$/.test(p.url())).length, { timeout: 60000 }).toBe(2);
    const dashboard = app.windows().find(p => p.url().endsWith('#/dashboard'));
    const overlay = app.windows().find(p => p.url().endsWith('#/companion'));
    await overlay.emulateMedia({ reducedMotion: 'reduce' });
    await overlay.evaluate(() => {
      window.__rafRequests = 0;
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => { window.__rafRequests++; return request(cb); };
      window.__renderedStates = [];
      const character = document.querySelector('[data-testid="character"]');
      new MutationObserver(() => window.__renderedStates.push({ state: character.dataset.state,
        x: Number(character.dataset.x), y: Number(character.dataset.y) })).observe(character, { attributes: true, attributeFilter: ['data-state'] });
    });
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    const three = await overlay.getByTestId('character').getAttribute('data-renderer') === 'three-webgl';
    if (!three) expect(await overlay.locator('.mascot').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    else expect(await overlay.getByTestId('companion-3d').evaluate(el => getComputedStyle(el).animationDuration)).toBe('0.26s');
    expect(await overlay.locator('.speech-bubble').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    expect(await overlay.locator('.character-visual').evaluate(el => getComputedStyle(el).animationDuration)).toBe('0.26s');
    // Allow the finite 260 ms appearance and two native hit-target probes to settle.
    // Angular may request a render once when the new painted target claims native input.
    await overlay.waitForTimeout(500);
    const idleFrames = await overlay.evaluate(() => window.__rafRequests);
    await overlay.waitForTimeout(300);
    expect(await overlay.evaluate(() => window.__rafRequests)).toBe(idleFrames);
    await overlay.getByTestId('drank-it').evaluate(button => button.click());
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'hidden');
    const viewport = await overlay.evaluate(async () => {
      const snapshot = await window.desktopCompanion.getSnapshot(), area = snapshot.overlay.bounds ?? snapshot.display.workArea;
      const dashboard = snapshot.dashboardBounds;
      return { width: innerWidth, height: innerHeight, dashboard: dashboard ? {
        x: (dashboard.x - area.x) * innerWidth / area.width, y: (dashboard.y - area.y) * innerHeight / area.height,
        width: dashboard.width * innerWidth / area.width, height: dashboard.height * innerHeight / area.height,
      } : null };
    });
    const resting = swingLayout(viewport.width, viewport.height, viewport.dashboard).reminder;
    // Angular can render a transitional state label while awaiting the next resolved phase.
    // Its position must already be the endpoint: reduced motion must not traverse the desktop.
    for (const pose of await overlay.evaluate(() => window.__renderedStates)) {
      if (['swinging-in', 'arriving', 'reminder', 'success', 'delivering-bottle'].includes(pose.state)) {
        expect(pose.x).toBeCloseTo(resting.x, 7); expect(pose.y).toBeCloseTo(resting.y, 7);
      } else if (pose.state === 'swinging-out-right') { expect(pose.x).toBeCloseTo(resting.x, 7); expect(pose.y).toBeCloseTo(resting.y, 7); }
    }
    const hiddenFrames = await overlay.evaluate(() => window.__rafRequests);
    await overlay.waitForTimeout(300);
    expect(await overlay.evaluate(() => window.__rafRequests)).toBe(hiddenFrames);
    await expect(overlay.getByTestId('companion-bottle')).toHaveCount(0);
    // Turning reduced motion on during an entry completes that phase without cancelling the reminder.
    await overlay.emulateMedia({ reducedMotion: 'no-preference' });
    await dashboard.getByTestId('toggle-overlay').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'swinging-in');
    await overlay.emulateMedia({ reducedMotion: 'reduce' });
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'reminder');
    expect(Number(await overlay.getByTestId('character').getAttribute('data-x'))).toBeCloseTo(resting.x, 7);
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await overlay.getByRole('button', { name: 'Remind me later', exact: true }).evaluate(button => button.click());
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state', 'hidden');
    await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).reminderRetry.pending)).toBe(true);
    await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
  } finally { await app.close(); }
});
