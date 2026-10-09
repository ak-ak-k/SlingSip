import { _electron, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HYDRATION_SETTINGS } from '../../shared/hydration-settings.ts';

// Run after the existing desktop production build. Uses only an isolated test profile.
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = fileURLToPath(new URL('../artwork/', import.meta.url));
const profile = 'landing-capture-' + randomUUID();
const directory = path.join(tmpdir(), 'mizu-overlay-tests', profile);
const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const today = dateKey(new Date());
const history = [1, 2].map(days => { const date = new Date(); date.setDate(date.getDate() - days);
  return { date: dateKey(date), goalMl: 2000, consumedMl: 2000, percentage: 100, completed: true }; });
await mkdir(directory, { recursive: true });
await mkdir(output, { recursive: true });
await writeFile(path.join(directory, 'user-profile.json'), JSON.stringify({ schemaVersion: 1, profile: {
  displayName: 'Alex', createdAt: '2026-10-01T10:00:00.000Z', hasCompletedOnboarding: true,
} }));
await writeFile(path.join(directory, 'hydration.json'), JSON.stringify({ schemaVersion: 2, date: today,
  currentWaterMl: 500, settings: { ...DEFAULT_HYDRATION_SETTINGS, workingStart: '00:00', workingEnd: '23:59' },
  history,
}));
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
const app = await _electron.launch({ cwd: root, args: ['.', '--companion-test', '--companion-test-production', `--companion-test-profile=${profile}`], env, chromiumSandbox: true });
try {
  await expect.poll(() => app.windows().some(page => page.url().endsWith('#/dashboard')), { timeout: 60_000 }).toBe(true);
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.webContents.getURL().endsWith('#/dashboard')) window.setContentSize(1440, 1000);
      if (window.webContents.getURL().endsWith('#/dashboard')) window.showInactive();
      else window.hide();
    }
  });
  const dashboard = app.windows().find(page => page.url().endsWith('#/dashboard'));
  for (const water of [500, 1000, 1500]) {
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText(`${water} / 2000 ml`);
    await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    await expect(dashboard.getByTestId('toggle-overlay')).toHaveCount(0);
    await dashboard.evaluate(() => document.fonts.ready);
    await dashboard.screenshot({ path: path.join(output, `dashboard-${water}.png`), animations: 'disabled' });
    if (water < 1500) for (let glass = 0; glass < 2; glass++) await dashboard.getByTestId('drink-water').click();
  }
  console.log('Captured the production dashboard at 500, 1000 and 1500 ml using isolated sample data.');
} finally { await app.close(); }
