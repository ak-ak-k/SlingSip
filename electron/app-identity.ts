import { type App } from 'electron';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const PRODUCT_NAME = 'SlingSip';
export const WINDOW_TITLE = 'SlingSip — Desktop Hydration Companion';

/** Keep the pre-branding profile and Chromium session, including the instance lock. */
export function configureAppIdentity(application: Pick<App, 'getPath' | 'setPath' | 'setName'>, testProfile?: string): void {
  // This directory is a compatibility identifier, not the visible product name.
  const directory = testProfile ?? path.join(application.getPath('appData'), 'Mizu');
  mkdirSync(directory, { recursive: true });
  application.setName(PRODUCT_NAME);
  application.setPath('userData', directory);
  application.setPath('sessionData', directory);
}
