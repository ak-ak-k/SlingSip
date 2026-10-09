import { _electron } from '@playwright/test';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function seedExistingUserProfile(profile) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(profile)) throw new Error('Unsafe test profile name.');
  const directory = path.join(tmpdir(), 'mizu-overlay-tests', profile), file = path.join(directory, 'user-profile.json');
  try { await access(file); }
  catch {
    await mkdir(directory, { recursive:true });
    await writeFile(file, JSON.stringify({ schemaVersion:1, profile:{ displayName:'Test User', createdAt:'2026-10-01T10:00:00.000Z', hasCompletedOnboarding:true } }), { flag:'wx' });
  }
}

/** Existing regression flows explicitly launch an already-onboarded local user.
 * Fresh-user acceptance tests import Playwright's original Electron launcher.
 * This helper never touches normal app data or hydration/settings fixtures. */
export const electron = {
  async launch(options) {
    const args = [...(options.args ?? [])];
    if (args.includes('--companion-test')) {
      let profile = args.find(arg => arg.startsWith('--companion-test-profile='))?.split('=')[1];
      if (!profile) { profile = 'regression-' + randomUUID(); args.push('--companion-test-profile=' + profile); }
      await seedExistingUserProfile(profile);
    }
    return _electron.launch({ ...options, args });
  },
};
