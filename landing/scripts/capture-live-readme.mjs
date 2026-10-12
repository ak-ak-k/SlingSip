import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Capture the deployed product story, never a localhost or release-data fixture.
const website = 'https://sling-sip.vercel.app/';
const output = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
const temporary = fileURLToPath(new URL('../../test-results/live-readme/', import.meta.url));
await mkdir(output, { recursive: true });
await mkdir(temporary, { recursive: true });
const browser = await chromium.launch({ headless: true,
  channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  reducedMotion: 'no-preference', colorScheme: 'dark' });
const page = await context.newPage();
const report = { website, capturedAt: new Date().toISOString(), viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1, mockedRequests: false, pageErrors: [], consoleErrors: [], failedAssets: [], screenshots: [] };
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
page.on('response', response => {
  if (response.url().includes('/assets/') && response.status() >= 400) report.failedAssets.push({ url: response.url(), status: response.status() });
});

async function ready() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visible = [...document.images].filter(image => {
      const box = image.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
    });
    await Promise.all(visible.map(image => image.decode()));
  });
}

async function scroll(selector, offset = 0) {
  const top = await page.locator(selector).evaluate(element => element.getBoundingClientRect().top + scrollY);
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top + offset);
  await page.waitForTimeout(1600);
  await ready();
}

async function capture(name, description) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(output, filename), type: 'png', fullPage: false, scale: 'css' });
  const buffer = await readFile(path.join(output, filename));
  const geometry = await page.evaluate(() => ({
    scrollY, title: document.title, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    visibleHeadings: [...document.querySelectorAll('h1,h2,h3')].map(heading => {
      const box = heading.getBoundingClientRect();
      return { text: heading.textContent.trim(), top: box.top, bottom: box.bottom,
        visible: heading.checkVisibility({ opacityProperty: true, visibilityProperty: true }) };
    }).filter(heading => heading.visible && heading.bottom > 94 && heading.top < innerHeight),
  }));
  const image = { path: `docs/screenshots/${filename}`, description, width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20), bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'), ...geometry };
  report.screenshots.push(image);
  console.log(JSON.stringify(image));
}

try {
  const response = await page.goto(website, { waitUntil: 'load', timeout: 45000 });
  if (response.status() !== 200 || new URL(page.url()).origin !== new URL(website).origin) throw new Error('Live website did not load normally.');
  // Cosmetic capture-only chrome suppression; page content/assets stay untouched.
  await page.addStyleTag({ content: 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}*{cursor:none!important}' });
  await ready();
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => !/Checking|Finding/.test(document.querySelector('#release-status')?.textContent ?? ''), null, { timeout: 10000 });
  await expect(page.locator('.traveler')).toBeVisible();
  await expect(page.locator('h1')).toContainText('Stay hydrated.');
  await capture('slingsip-hero', 'Live hero after its entrance has settled.');

  await scroll('.how-section', 300);
  await expect(page.locator('#demo-reminder')).toBeVisible();
  await expect(page.locator('#demo-drank')).toBeVisible();
  await capture('slingsip-how-it-works', 'Live reminder and three-step reminder/sip/progress story.');

  // Use the site's real reduced-motion variant for sharp dashboard text: its
  // normal clipped depth layers can double text edges in a still frame.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveClass(/reduced-motion/);
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await page.waitForTimeout(500);
  // Frame the actual dashboard rather than clipping its tall section heading.
  await scroll('.dashboard-preview', -130);
  await expect(page.locator('.dashboard-screen')).toBeVisible();
  await expect.poll(() => page.locator('.dashboard-preview').evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(130);
  await capture('slingsip-dashboard', 'Live dashboard in the supported reduced-motion view, with no overlapping depth layers.');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).not.toHaveClass(/reduced-motion/);
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  await scroll('.future-section', -20);
  await expect(page.locator('.future-badge')).toHaveText('COMING IN V2');
  await expect(page.locator('.future-badge')).toBeVisible();
  await capture('slingsip-features-v2', 'Live V2 concepts, explicitly labelled as future work.');

  await scroll('.download-section', 40);
  await expect(page.locator('.finale-cta')).toBeVisible();
  await expect(page.locator('#download-unsigned')).toBeVisible();
  report.releaseStatus = await page.locator('#release-status').textContent();
  await capture('slingsip-download', 'Live download finale with its real unsigned notice and release status.');

  if (report.pageErrors.length || report.consoleErrors.length || report.failedAssets.length) throw new Error('Live browser errors or missing assets found; inspect the local capture report.');
} finally {
  await writeFile(path.join(temporary, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
  await context.close();
  await browser.close();
}
console.log('Captured five live 1920x1080 PNGs. Inspect each before committing. No video or mocked responses used.');
