import { test, expect } from '@playwright/test';

const api = 'https://api.github.com/repos/ak-ak-k/slingsip/releases/latest';
const release = { draft: false, prerelease: false, tag_name: 'v1.0.0', assets: [{ name: 'SlingSip-Setup-1.0.0-x64.exe',
  browser_download_url: 'https://github.com/ak-ak-k/slingsip/releases/download/v1.0.0/SlingSip-Setup-1.0.0-x64.exe' }] };
async function routeRelease(page, body = release, status = 200) {
  await page.route(api, route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
}
async function scrollTo(page, selector, offset = 0) {
  const y = await page.locator(selector).evaluate(element => element.getBoundingClientRect().top + scrollY);
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y + offset);
}

test('Production page uses approved assets, safe download metadata and the real dashboard without desktop APIs', async ({ page }) => {
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/assets/') && response.status() >= 400) failedAssets.push(response.url()); });
  await routeRelease(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stay hydrated. Keep moving.' })).toBeVisible();
  await expect(page.locator('.download-link').first()).toHaveAttribute('href', release.assets[0].browser_download_url);
  await expect(page.locator('#download-unsigned')).toContainText('currently unsigned');
  await expect(page.locator('.future-badge')).toHaveText('COMING IN V2');
  await expect(page.locator('.future-card>span')).toHaveCount(4);
  await expect(page.locator('.traveler')).toHaveCount(1);
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  for (const selector of ['.dashboard-section', '.features-section', '.tray-section', '.future-section', '.download-section']) await scrollTo(page, selector);
  await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(image => !image.loading || image.loading !== 'lazy' || image.complete).every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  const boundary = await page.evaluate(() => ({ desktop: typeof window.desktopCompanion, require: typeof window.require }));
  expect(boundary).toEqual({ desktop: 'undefined', require: 'undefined' });
  expect(errors).toEqual([]); expect(failedAssets).toEqual([]);
});

test('Pinned story supports manual Drank it, bottle delivery, scroll progress, reverse travel and clean web retraction', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await routeRelease(page); await page.goto('/');
  await scrollTo(page, '.how-section', 300);
  await expect(page.locator('.how-section')).toHaveAttribute('data-demo-phase', '0');
  await page.locator('#demo-drank').click();
  await expect(page.locator('[data-reminder-title]')).toHaveText('Nice! One glass closer.');
  await expect(page.locator('.delivery-bottle')).toBeVisible();
  await expect(page.locator('.water-feedback')).toBeVisible();
  await expect(page.locator('.delivery-bottle')).toBeHidden({ timeout: 4000 });
  const how = await page.locator('.how-section').evaluate(element => ({ top:element.getBoundingClientRect().top+scrollY, height:innerHeight }));
  await page.evaluate(({ top, height }) => window.scrollTo({ top:top+height*2.16, behavior:'instant' }),how);
  await expect(page.locator('.how-section')).toHaveAttribute('data-demo-phase','2');
  await expect(page.locator('#demo-progress')).toBeVisible();
  await expect(page.locator('[data-story-percent]')).toHaveText('50%');
  await expect(page.locator('#demo-reminder')).toHaveAttribute('aria-hidden','true');
  const traveler = await page.locator('.traveler').elementHandle();
  await scrollTo(page,'.future-section',100);
  await scrollTo(page,'.how-section',100);
  await expect(page.locator('.how-section')).toHaveAttribute('data-demo-phase','0');
  expect(await traveler.evaluate(node=>node===document.querySelector('.traveler'))).toBe(true);
  await page.locator('#demo-later').click();
  await expect(page.locator('[data-reminder-title]')).toHaveText('Okay, I’ll swing back.');
  await expect.poll(()=>page.locator('.old-web').getAttribute('d')).toBe('');
  expect(errors).toEqual([]);
});

test('Tray preview closes and reopens through keyboard without leaving inaccessible controls', async ({ page }) => {
  await routeRelease(page); await page.goto('/');
  await scrollTo(page,'.tray-section',80);
  await page.getByRole('button',{name:'Reopen the demo SlingSip dashboard'}).click();
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state','open');
  await page.getByRole('button',{name:'Close the demo dashboard to tray'}).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state','closed');
  await expect(page.locator('.tray-window')).toHaveAttribute('inert','');
  await expect(page.locator('.tray-open')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state','open');
  await expect(page.locator('.tray-window')).not.toHaveAttribute('inert','');
});

test('Tray pointer close stays in its scene after reopening settles', async ({ page }) => {
  await routeRelease(page); await page.goto('/');
  await scrollTo(page,'.tray-section',150);
  await page.getByRole('button',{name:'Reopen the demo SlingSip dashboard'}).click();
  await expect.poll(() => page.locator('.tray-window').evaluate(element =>
    new DOMMatrix(getComputedStyle(element).transform).a)).toBe(1);
  const before = await page.evaluate(() => scrollY);
  await page.getByRole('button',{name:'Close the demo dashboard to tray'}).click();
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state','closed');
  await expect(page.locator('.tray-reminder')).toBeVisible();
  await page.waitForTimeout(600);
  expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(3);
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state','closed');
});

test('Reduced motion keeps all content and manual demonstrations usable with no pinned cinema or cursor parallax', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' }); await routeRelease(page); await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/reduced-motion/);
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await scrollTo(page,'.how-section',200);
  await expect(page.locator('#demo-reminder')).toBeVisible(); await expect(page.locator('#demo-progress')).toBeVisible();
  await page.locator('#demo-drank').click(); await expect(page.locator('[data-reminder-title]')).toHaveText('Nice! One glass closer.');
  await expect(page.locator('.delivery-bottle')).toBeHidden();
  await scrollTo(page,'.tray-section',50);
  await page.getByRole('button',{name:'Close the demo dashboard to tray'}).click();
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state','closed');
  await page.getByRole('button',{name:'Reopen the demo SlingSip dashboard'}).click();
  await expect(page.locator('.desktop-demo')).toHaveAttribute('data-tray-state','open');
  const before = await page.locator('.traveler-parallax').getAttribute('style');
  await page.mouse.move(100,100); await page.mouse.move(900,600);
  expect(await page.locator('.traveler-parallax').getAttribute('style')).toBe(before);
  await expect(page.locator('.future-card')).toHaveCount(4);
});

test('Changing reduced-motion preference tears down and restores pinning without duplicate characters', async ({ page }) => {
  await routeRelease(page); await page.goto('/');
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  await expect(page.locator('.traveler')).toHaveCount(1);
  await expect(page.locator('#download-unsigned')).toBeAttached();
});

for (const width of [390,768,1366]) test(`The ${width}px layout fits the viewport and keeps navigation/download accessible`, async ({ page }) => {
  await page.setViewportSize({width,height:844}); await routeRelease(page); await page.goto('/');
  await expect(page.locator('.site-header')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  for (const selector of ['.how-section','.dashboard-section','.features-section','.tray-section','.future-section','.download-section']) {
    await scrollTo(page,selector,80);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  }
  await expect(page.locator('.finale-cta')).toBeVisible();
  const box = await page.locator('.finale-cta').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.querySelector('.site-header').getBoundingClientRect().right)).toBeLessThanOrEqual(width);
});

for (const [name, body, status] of [
  ['unpublished repository',{},404],
  ['rate limit',{},403],
  ['prerelease',{...release,prerelease:true},200],
  ['foreign download URL',{...release,assets:[{...release.assets[0],browser_download_url:'https://example.org/SlingSip-Setup-1.0.0-x64.exe'}]},200],
  ['missing x64 installer',{...release,assets:[]},200],
]) test(`Download gracefully falls back for ${name}`, async ({ page }) => {
  await routeRelease(page,body,status); await page.goto('/');
  await expect(page.locator('#release-status')).toContainText('opens official GitHub Releases');
  for(const link of await page.locator('.download-link').all()) await expect(link).toHaveAttribute('href','https://github.com/ak-ak-k/slingsip/releases');
});

test('Release request timeout and missing artwork do not prevent using the page', async ({ page }) => {
  await page.route(api,()=>{});
  await page.route('**/assets/ask.png',route=>route.fulfill({status:404,body:''}));
  await page.goto('/');
  await expect(page.locator('#release-status')).toContainText('opens official GitHub Releases',{timeout:7000});
  await scrollTo(page,'.how-section',200);
  await page.locator('#demo-drank').click();
  await expect(page.locator('[data-reminder-title]')).toHaveText('Nice! One glass closer.');
  await expect(page.locator('.traveler-art')).toBeVisible();
});

test('Without JavaScript the content, future labels, and release links remain available', async ({ browser }) => {
  const context=await browser.newContext({javaScriptEnabled:false}); const page=await context.newPage();
  try { await page.goto('http://127.0.0.1:5173/');
    await expect(page.locator('h1')).toBeVisible(); await expect(page.locator('.future-badge')).toHaveText('COMING IN V2');
    await expect(page.locator('.noscript-note')).toBeAttached();
    await expect(page.locator('.finale-cta')).toHaveAttribute('href','https://github.com/ak-ak-k/slingsip/releases');
    expect(await page.locator('.story-pin').evaluate(element=>getComputedStyle(element).position)).not.toBe('fixed');
  } finally { await context.close(); }
});

test('Desktop cursor motion is bounded and suspends on hidden-page visibility events', async ({ page }) => {
  await routeRelease(page); await page.goto('/');
  await page.mouse.move(1435,10);
  const offset = () => page.locator('.traveler-parallax').evaluate(element => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform); return {x:matrix.m41,y:matrix.m42};
  });
  await expect.poll(async () => (await offset()).x).toBeGreaterThan(9);
  const bounded = await offset(); expect(bounded.x).toBeLessThanOrEqual(10.05); expect(Math.abs(bounded.y)).toBeLessThanOrEqual(8.05);
  await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); });
  const before = await page.locator('.traveler-parallax').getAttribute('style');
  await page.mouse.move(5,990); await page.waitForTimeout(150);
  expect(await page.locator('.traveler-parallax').getAttribute('style')).toBe(before);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => (await offset()).x).toBeLessThan(-9);
});

test('Download click opens the validated official installer URL without fetching a real binary in the test', async ({ page, context }) => {
  await routeRelease(page);
  await context.route('https://github.com/ak-ak-k/slingsip/releases/download/**', route =>
    route.fulfill({status:200,contentType:'text/plain',body:'Navigation fixture. No installer downloaded.'}));
  await page.goto('/');
  await expect(page.locator('.download-link').first()).toHaveAttribute('data-download-state','ready');
  const popupPromise = context.waitForEvent('page');
  await page.locator('.download-link').first().click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(release.assets[0].browser_download_url);
  await popup.close();
});
