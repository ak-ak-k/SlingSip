import { test, expect } from '@playwright/test';
import { sampleSwing } from '../src/swing-path.ts';

async function prepare(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }));
  await page.route('https://api.github.com/repos/ak-ak-k/slingsip/releases/latest', route => route.fulfill({ status: 404, body: '{}' }));
  await page.goto('/');
}
async function scene(page, selector, offset = 0) {
  const y = await page.locator(selector).evaluate(element => element.getBoundingClientRect().top + scrollY);
  await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y + offset);
}
const active = '.rig-pose.rig-active';

test('Swing sampling curves below the chord, speeds through the middle and keeps restrained rotation', () => {
  const from = { x: 0, y: 0 }, to = { x: 600, y: 0 };
  expect(sampleSwing(from, to, 0, 100).x).toBe(0);
  expect(sampleSwing(from, to, 1, 100).x).toBe(600);
  expect(sampleSwing(from, to, .5, 100).y).toBeCloseTo(100);
  const apexDistance = sampleSwing(from, to, .1, 100).x;
  const bottomDistance = sampleSwing(from, to, .5, 100).x - sampleSwing(from, to, .4, 100).x;
  expect(bottomDistance).toBeGreaterThan(apexDistance * 3);
  for (const value of [.1, .3, .6, .9]) expect(Math.abs(sampleSwing(from, to, value, 100).rotation)).toBeLessThanOrEqual(12);
});

test('Hero headline reveals while the mascot is still traveling', async ({ page }) => {
  await page.route('https://api.github.com/**', route => route.fulfill({ status: 404, body: '{}' }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.headline-line>span')).opacity) > .2
    && document.querySelector('.traveler').dataset.motion === 'travel', null, { timeout: 2500 });
});

test('Settled mascot has independent torso/head/scarf motion and a time-based blink without root bouncing', async ({ page }) => {
  await prepare(page); await page.waitForTimeout(2300);
  await expect(page.locator('.character-rig')).toBeVisible();
  const root = await page.locator('.traveler').getAttribute('style');
  const joints = () => page.locator(`${active} [data-joint]`).evaluateAll(elements => Object.fromEntries(elements.map(element => [element.dataset.joint, element.style.transform])));
  const first = await joints(); await page.waitForTimeout(450); const second = await joints();
  expect(second.torso).not.toBe(first.torso); expect(second.head).not.toBe(first.head); expect(second.scarf).not.toBe(first.scarf);
  expect(second.head).not.toBe(second.scarf);
  expect(await page.locator('.traveler').getAttribute('style')).toBe(root);
  // A blink is shorter than Playwright's eventual-assertion polling interval.
  // Observe both edges instead of occasionally sampling past the entire blink.
  const blink = await page.evaluate(() => new Promise(resolve => {
    const rig = document.querySelector('.character-rig'); let closed = rig.dataset.blink === 'closed';
    const timer = setTimeout(() => { observer.disconnect(); resolve({ closed, reopened: false }); }, 6500);
    const observer = new MutationObserver(() => {
      closed ||= rig.dataset.blink === 'closed';
      if (closed && rig.dataset.blink === 'open') { clearTimeout(timer); observer.disconnect(); resolve({ closed, reopened: true }); }
    });
    observer.observe(rig, { attributes: true, attributeFilter: ['data-blink'] });
  }));
  expect(blink).toEqual({ closed: true, reopened: true });
});

test('Dynamic web follows the actual animated hand including pointer and joint transforms', async ({ page }) => {
  await prepare(page); await page.waitForTimeout(2300); await page.mouse.move(1250, 180); await page.waitForTimeout(350);
  const distance = await page.evaluate(() => {
    const joint = document.querySelector('.rig-pose[data-rig-pose="swing"] .rig-grip');
    const hand = new DOMPoint(859, 144).matrixTransform(joint.getScreenCTM());
    const coordinates = document.querySelector('.active-web').getAttribute('d').match(/^M([\d.-]+),([\d.-]+)/);
    return Math.hypot(hand.x - Number(coordinates[1]), hand.y - Number(coordinates[2]));
  });
  expect(distance).toBeLessThan(2);
  await scene(page, '.how-section', 300); await page.waitForTimeout(900);
  const strand = await page.locator('.active-web').getAttribute('d');
  expect(strand).toContain('Q'); await expect(page.locator('.old-web')).toHaveAttribute('d', '');
});

test('Bottle remains readable, reacts with the mascot, then morphs to progress after delivery', async ({ page }) => {
  await prepare(page); await scene(page, '.how-section', 300);
  // Measure inside the browser from the actual click. Chained protocol calls
  // and sleeps can add enough overhead to miss a deliberately short delivery.
  await page.evaluate(() => {
    window.__deliveryReview = new Promise(resolve => {
      document.querySelector('#demo-drank').addEventListener('click', () => {
        const bottle = document.querySelector('.delivery-bottle');
        const began = performance.now(), transforms = new Set();
        let firstVisible = -1, happy = false;
        function frame(time) {
          const visible = bottle.style.visibility !== 'hidden' && Number(bottle.style.opacity) > .1;
          happy ||= document.querySelector('.traveler').dataset.pose === 'happy';
          if (visible) { if (firstVisible < 0) firstVisible = time; transforms.add(bottle.style.transform); }
          if ((firstVisible >= 0 && !visible) || time - began > 4000) {
            resolve({ visibleMs: firstVisible < 0 ? 0 : time - firstVisible, changes: transforms.size, happy });
          } else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }, { once: true });
    });
  });
  await page.locator('#demo-drank').click();
  const delivery = await page.evaluate(() => window.__deliveryReview);
  expect(delivery.happy).toBe(true);
  expect(delivery.visibleMs).toBeGreaterThanOrEqual(950);
  expect(delivery.visibleMs).toBeLessThan(1800);
  expect(delivery.changes).toBeGreaterThan(2);
  await expect(page.locator('.delivery-bottle')).toBeHidden();
  await scene(page, '.how-section', 1850);
  await expect(page.locator('#demo-progress')).toBeVisible();
  await expect(page.locator('[data-story-percent]')).toHaveText('50%');
  await expect(page.locator('.traveler')).toHaveAttribute('data-pose', 'point');
});

test('Hidden page pauses all character joints; reduced-motion recreation removes life and duplicate rigs', async ({ page }) => {
  await prepare(page); await page.waitForTimeout(2300);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const snapshot = await page.locator('.rig-life').getAttribute('style');
  const head = await page.locator(`${active} .rig-head`).getAttribute('style');
  await page.waitForTimeout(300);
  expect(await page.locator('.rig-life').getAttribute('style')).toBe(snapshot);
  expect(await page.locator(`${active} .rig-head`).getAttribute('style')).toBe(head);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.traveler')).toHaveAttribute('data-pose', 'swing');
  await expect(page.locator(active)).toHaveCount(1);
  await expect.poll(() => page.locator(`${active} .rig-head`).getAttribute('style')).not.toBe(head);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.character-rig')).toHaveCount(1); await expect(page.locator('.dashboard-live')).toHaveCount(1);
  const reducedHead = await page.locator(`${active} .rig-head`).getAttribute('style');
  await page.waitForTimeout(300); expect(await page.locator(`${active} .rig-head`).getAttribute('style')).toBe(reducedHead);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.character-rig')).toHaveCount(1); await expect(page.locator('.pin-spacer')).toHaveCount(1);
});

test('Low-power hardware throttles character life while preserving the same poses', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  await page.route('https://api.github.com/**', route => route.fulfill({ status: 404, body: '{}' }));
  await page.goto('/'); await page.waitForTimeout(2300);
  await expect(page.locator('.character-rig')).toHaveClass(/rig-low-power/);
  const updates = await page.evaluate(async () => {
    let count = 0; const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.querySelector('.rig-active .rig-torso'), { attributes: true, attributeFilter: ['style'] });
    await new Promise(resolve => setTimeout(resolve, 1000)); observer.disconnect(); return count;
  });
  expect(updates).toBeGreaterThan(5); expect(updates).toBeLessThanOrEqual(36);
});

test('Dashboard counters/ring animate using sample values and unavailable releases do not invent a version', async ({ page }) => {
  await prepare(page);
  await expect(page.locator('.release-version').first()).toHaveText('Version on GitHub');
  await expect(page.locator('body')).not.toContainText('GitLab');
  await expect(page.getByRole('heading', { name: /releases/i })).toHaveCount(0);
  await scene(page, '.dashboard-section', 150);
  await expect(page.locator('.dashboard-live-streak')).toHaveText('2');
  await expect(page.locator('.dashboard-live-water')).toHaveText(/(?:500|1000|1500) \/ 2000 ml/);
  const value = await page.locator('.dashboard-live-percent').textContent();
  expect(['25%', '50%', '75%']).toContain(value);
  const offset = Number(await page.locator('.dashboard-live-ring').getAttribute('stroke-dashoffset'));
  expect(offset).toBeGreaterThanOrEqual(25); expect(offset).toBeLessThanOrEqual(75);
});
