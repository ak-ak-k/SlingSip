import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const output = fileURLToPath(new URL('../../docs/previews/landing/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.route('https://api.github.com/repos/ak-ak-k/slingsip/releases/latest', route =>
  route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
const errors = []; page.on('pageerror', error => errors.push(error.message));
const capture = name => page.screenshot({ path: path.join(output, name + '.png') });
async function scene(selector, offset = 0) {
  const top = await page.locator(selector).evaluate(element => element.getBoundingClientRect().top + scrollY);
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top + offset);
  await page.waitForTimeout(1000);
}
try {
  await page.goto('http://127.0.0.1:5173/'); await page.waitForTimeout(2800);
  await capture('01-hero-desktop');
  await scene('.how-section', 300); await capture('02-reminder-desktop');
  await page.locator('#demo-drank').click(); await page.waitForTimeout(650); await capture('03-bottle-success');
  await scene('.how-section', 2160); await capture('04-progress-story');
  await scene('.dashboard-section', 200); await capture('05-real-dashboard');
  await scene('.features-section', 40); await capture('06-details');
  await scene('.tray-section', 150); await page.locator('.tray-open').click();
  // Let reopening settle before targeting X; otherwise automation can scroll to
  // its temporary position during the shrink/expand animation.
  await expect.poll(() => page.locator('.tray-window').evaluate(element =>
    new DOMMatrix(getComputedStyle(element).transform).a)).toBe(1);
  await page.locator('.window-close').click(); await page.waitForTimeout(900);
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state', 'closed');
  await expect(page.locator('.tray-reminder')).toBeVisible();
  await capture('07-close-to-tray');
  await scene('.future-section', 60); await capture('08-future-v2');
  await scene('.download-section', 40); await capture('09-download');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173/'); await page.waitForTimeout(2800); await capture('10-hero-mobile');
  await scene('.future-section', 80); await capture('11-future-mobile');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:5173/'); await scene('.how-section', 300); await capture('12-reduced-motion-mobile');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Captured 12 production landing-page views with no page errors. Release-unavailable fallback was simulated for screenshots.');
} finally { await browser.close(); }
