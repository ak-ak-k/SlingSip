import { defineConfig } from '@playwright/test';
const port = Number(process.env.LANDING_TEST_PORT || 5173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', workers: 1, fullyParallel: false,
  timeout: 30_000, expect: { timeout: 7000 }, reporter: 'list',
  outputDir: '../test-results/landing',
  use: { baseURL, viewport: { width: 1440, height: 1000 },
    headless: true, channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `npm run preview -- --port ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 20_000 },
});
