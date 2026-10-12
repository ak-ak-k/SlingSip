import { test, expect } from '@playwright/test';

const api = 'https://api.github.com/repos/ak-ak-k/slingsip/releases/latest';
const fallback = 'https://github.com/ak-ak-k/slingsip/releases';
// Match GitHub's real canonical repository casing, not just our lowercase link.
const installer = 'https://github.com/ak-ak-k/SlingSip/releases/download/v1.0.0/SlingSip-Setup-1.0.0-x64.exe';
const asset = { name: 'SlingSip-Setup-1.0.0-x64.exe', browser_download_url: installer };
const release = { draft: false, prerelease: false, tag_name: 'v1.0.0', assets: [asset] };

for (const width of [320, 390, 1440]) test(`Both download CTAs share one request and direct navigation at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 1000 });
  let requests = 0, respond;
  const pending = new Promise(resolve => { respond = resolve; });
  await page.route(api, async route => {
    requests++;
    await pending;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(release) });
  });
  await context.route(installer, route => route.fulfill({ contentType: 'text/plain', body: 'Navigation fixture; no binary downloaded.' }));
  await page.goto('/');
  const links = page.locator('.download-link');
  await expect(links).toHaveCount(2);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('data-download-state', 'loading');
    await expect(link).toHaveAttribute('href', fallback);
  }
  await expect(page.locator('.release-version')).toHaveText(['Version on GitHub', 'Version on GitHub']);
  respond();
  await expect(page.locator('#release-status')).toHaveAttribute('data-download-state', 'ready');
  await expect(page.locator('.release-version')).toHaveText(['v1.0.0', 'v1.0.0']);
  for (const link of await links.all()) {
    await expect(link).toHaveText('Download SlingSip for Windows');
    await expect(link).toHaveAttribute('href', installer);
    await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const popupPromise = context.waitForEvent('page');
    await link.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(installer);
    await popup.close();
  }
  expect(requests).toBe(1);
  await expect(page.locator('#download-unsigned')).toContainText('Unknown Publisher or SmartScreen');
});

for (const [name, body] of [
  ['draft', { ...release, draft: true }],
  ['foreign owner', { ...release, assets: [{ ...asset, browser_download_url: installer.replace('ak-ak-k/', 'another-owner/') }] }],
  ['foreign repository', { ...release, assets: [{ ...asset, browser_download_url: installer.replace('/SlingSip/', '/SlingSip-fork/') }] }],
  ['lookalike host', { ...release, assets: [{ ...asset, browser_download_url: installer.replace('github.com/', 'github.com.example.org/') }] }],
  ['URL credentials', { ...release, assets: [{ ...asset, browser_download_url: installer.replace('github.com/', 'user@github.com/') }] }],
  ['URL query', { ...release, assets: [{ ...asset, browser_download_url: `${installer}?redirect=elsewhere` }] }],
  ['insecure URL', { ...release, assets: [{ ...asset, browser_download_url: installer.replace('https:', 'http:') }] }],
  ['mismatched asset version', { ...release, tag_name: 'v1.0.1' }],
  ['malformed assets', { ...release, assets: [null, 42, {}, { name: 'not-an-installer.zip' }] }],
  ['null response', null],
]) test(`Untrusted ${name} metadata never becomes a download or version`, async ({ page }) => {
  await page.route(api, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }));
  await page.goto('/');
  await expect(page.locator('#release-status')).toHaveAttribute('data-download-state', 'fallback');
  for (const link of await page.locator('.download-link').all()) {
    await expect(link).toHaveAttribute('href', fallback);
    await expect(link).toHaveAttribute('data-download-state', 'fallback');
  }
  await expect(page.locator('.release-version')).toHaveText(['Version on GitHub', 'Version on GitHub']);
});

test('A later stable version is resolved dynamically and malformed unrelated assets are skipped', async ({ page }) => {
  const version = '1.0.1';
  const url = installer.replaceAll('1.0.0', version);
  await page.route(api, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    ...release, tag_name: `v${version}`, assets: [null, {}, { name: `SlingSip-Setup-${version}-x64.exe`, browser_download_url: url }],
  }) }));
  await page.goto('/');
  await expect(page.locator('.release-version')).toHaveText([`v${version}`, `v${version}`]);
  for (const link of await page.locator('.download-link').all()) await expect(link).toHaveAttribute('href', url);
});

test('Fallback remains clickable and malformed JSON finishes loading', async ({ page, context }) => {
  await page.route(api, route => route.fulfill({ contentType: 'application/json', body: '{invalid' }));
  await context.route(fallback, route => route.fulfill({ contentType: 'text/plain', body: 'Official release page fixture.' }));
  await page.goto('/');
  await expect(page.locator('#release-status')).toHaveAttribute('data-download-state', 'fallback');
  await expect(page.locator('.release-version')).toHaveText(['Version on GitHub', 'Version on GitHub']);
  const popupPromise = context.waitForEvent('page');
  await page.locator('.download-link').first().click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(fallback);
  await popup.close();
});
