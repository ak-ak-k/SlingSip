import { chromium, expect } from '@playwright/test';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const baseURL = process.env.LANDING_PREVIEW_URL || 'http://127.0.0.1:5173';
const output = fileURLToPath(new URL('../../docs/previews/landing-motion/', import.meta.url));
const temporary = fileURLToPath(new URL('../../test-results/landing-motion-video/', import.meta.url));
await mkdir(output, { recursive: true }); await mkdir(temporary, { recursive: true });
const browser = await chromium.launch({ headless: true,
  channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
const errors = [];
async function prepare(page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://api.github.com/repos/ak-ak-k/slingsip/releases/latest', route =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto(baseURL);
}
try {
  // Sample separately from video encoding. This is local headless evidence,
  // not a guarantee of 60 FPS on every physical machine.
  const probe = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await prepare(probe); await probe.waitForTimeout(2300);
  const measure = target => probe.evaluate(target => new Promise(resolve => {
    const intervals = []; let previous = 0;
    const start = scrollY;
    function frame(time) {
      if (previous) intervals.push(time - previous); previous = time;
      if (target !== null) scrollTo({ top: start + (target - start) * intervals.length / 120, behavior: 'instant' });
      if (intervals.length < 120) requestAnimationFrame(frame);
      else {
        const sorted = [...intervals].sort((a, b) => a - b);
        resolve({ samples: intervals.length, medianFrameMs: sorted[60], p95FrameMs: sorted[114],
          over33ms: intervals.filter(value => value > 33.5).length,
          hardwareConcurrency: navigator.hardwareConcurrency, userAgent: navigator.userAgent,
          cachedPosesAtEnd: document.querySelectorAll('[data-raster-ready]').length });
      }
    }
    requestAnimationFrame(frame);
  }), target);
  const performance = { scenario: 'Headless browser RAF intervals, no video encoding; not a physical-device certification.',
    initialIdle: await measure(null) };
  await probe.waitForTimeout(1500);
  performance.warmedIdle = await measure(null);
  const dashboardY = await probe.locator('.dashboard-section').evaluate(element => element.getBoundingClientRect().top + scrollY);
  performance.scrollJourney = await measure(dashboardY);
  await probe.close();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: temporary, size: { width: 1440, height: 1000 } } });
  const page = await context.newPage(); const video = page.video();
  const capture = name => page.screenshot({ path: path.join(output, name + '.png') });
  async function scroll(selector, offset = 0, duration = 900) {
    const target = await page.locator(selector).evaluate(element => element.getBoundingClientRect().top + scrollY);
    await page.evaluate(({ target, duration }) => new Promise(resolve => {
      const start = scrollY, began = performance.now();
      function frame(time) {
        const t = Math.min(1, (time - began) / duration), eased = t * t * (3 - 2 * t);
        window.scrollTo({ top: start + (target - start) * eased, behavior: 'instant' });
        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    }), { target: target + offset, duration });
    await page.waitForTimeout(650);
  }
  await prepare(page); await page.waitForTimeout(2400); await capture('01-layered-hero');
  await page.mouse.move(1260, 210); await page.waitForTimeout(350);
  await scroll('.how-section', 300, 1300); await capture('02-attentive-reminder');
  await page.locator('#demo-drank').click(); await page.waitForTimeout(650); await capture('03-bottle-reaction');
  await expect(page.locator('.delivery-bottle')).toBeHidden();
  await scroll('.how-section', 2100); await expect(page.locator('[data-story-percent]')).toHaveText('50%'); await capture('04-progress');
  await scroll('.dashboard-section', 100, 1100); await capture('05-dashboard-depth');
  await scroll('.features-section', 80); await scroll('.tray-section', 150); await capture('06-relaxed-tray');
  await scroll('.future-section', 60); await capture('07-future');
  await scroll('.download-section', 50); await capture('08-finale');
  await context.close();
  await copyFile(await video.path(), path.join(output, 'motion-review.webm'));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await prepare(mobile); await mobile.waitForTimeout(900); await mobile.screenshot({ path: path.join(output, '09-mobile-reduced.png') }); await mobile.close();
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(output, 'capture.json'), JSON.stringify({ capturedAt: new Date().toISOString(), source: baseURL,
    pageErrors: errors, githubResponse: 'Intentionally mocked 404; no fake release metadata or installer download.', performance,
    video: 'motion-review.webm', screenshots: 9 }, null, 2) + '\n');
  console.log(JSON.stringify({ screenshots: 9, video: path.join(output, 'motion-review.webm'), errors, performance }));
} finally { await browser.close(); }
