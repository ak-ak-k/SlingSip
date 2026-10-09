import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', workers: 1, fullyParallel: false,
  timeout: 30_000, expect: { timeout: 7000 }, reporter: 'list',
  outputDir: '../test-results/landing',
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 },
    headless: true, channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 20_000 },
});
