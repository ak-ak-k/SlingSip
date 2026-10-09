import electronUpdater, { type UpdateCheckResult, type UpdateInfo } from 'electron-updater';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { type UpdateBackend, type UpdateEvent } from './update-service';

/** Only trusted packaged resources determine the feed and signer; never renderer parameters. */
export function updateAvailability(packaged: boolean, platform: string, resourcesPath: string): string | null {
  if (!packaged) return 'Automatic updates are available in the installed Windows app. Development and local source runs cannot install updates.';
  if (platform !== 'win32') return 'Automatic updates are currently available on Windows.';
  try {
    const policy: unknown = JSON.parse(readFileSync(path.join(resourcesPath, 'slingsip-update-policy.json'), 'utf8'));
    if (!policy || typeof policy !== 'object') throw new Error('Missing policy');
    const value = policy as Record<string, unknown>;
    if (value['schemaVersion'] !== 1 || value['enabled'] !== true || value['provider'] !== 'github'
      || value['owner'] !== 'ak-ak-k' || value['repo'] !== 'slingsip' || value['channel'] !== 'stable'
      || typeof value['publisherName'] !== 'string' || !value['publisherName'].trim()
      || !existsSync(path.join(resourcesPath, 'app-update.yml'))) throw new Error('Incomplete policy');
    // The upstream NSIS verifier skips verification if this YAML omits publisherName.
    // Fail closed before contacting a mismatched or secret-bearing provider.
    const rawFeed = yaml.load(readFileSync(path.join(resourcesPath, 'app-update.yml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
    if (!rawFeed || typeof rawFeed !== 'object' || Array.isArray(rawFeed)) throw new Error('Invalid feed');
    const feed = rawFeed as Record<string, unknown>;
    const publishers = Array.isArray(feed['publisherName']) ? feed['publisherName'] : [feed['publisherName']];
    if (feed['provider'] !== value['provider'] || feed['owner'] !== value['owner'] || feed['repo'] !== value['repo']
      || publishers.length !== 1 || publishers[0] !== value['publisherName']
      || feed['private'] === true || 'token' in feed || 'requestHeaders' in feed || 'url' in feed
      || feed['host'] != null && feed['host'] !== 'github.com'
      || feed['protocol'] != null && feed['protocol'] !== 'https'
      || feed['channel'] != null && feed['channel'] !== 'latest') throw new Error('Untrusted feed or signer');
    return null;
  } catch { return 'Updates are unavailable in this preview or incomplete release build.'; }
}

export function createElectronUpdateBackend(): UpdateBackend {
  // electron-updater is CommonJS; use its default module object in the ESM main bundle.
  const updater = electronUpdater.autoUpdater;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.autoRunAppAfterInstall = true;
  updater.channel = 'latest';
  // Setting channel can enable downgrades: reset this afterwards.
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.forceDevUpdateConfig = false;
  updater.disableWebInstaller = true;
  let result: UpdateCheckResult | null = null;
  const listeners = new Set<(event: UpdateEvent) => void>();
  const emit = (event: UpdateEvent) => { for (const listener of listeners) listener(event); };
  const available = (info: UpdateInfo) =>
    emit({ type: 'available', version: info.version, releaseName: info.releaseName,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : info.releaseNotes?.map(note => note.note).join('\n') });
  const notAvailable = () => emit({ type: 'not-available' });
  const progress = (info: { percent: number }) => emit({ type: 'progress', percent: info.percent });
  const downloaded = (info: { version: string }) => emit({ type: 'downloaded', version: info.version });
  // Retain an error listener during asynchronous shutdown; no errors escape into hydration.
  const error = () => emit({ type: 'error' });
  updater.on('update-available', available); updater.on('update-not-available', notAvailable);
  updater.on('download-progress', progress); updater.on('update-downloaded', downloaded); updater.on('error', error);
  return {
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    check: async () => { result = await updater.checkForUpdates(); if (!result) emit({ type: 'error' }); },
    download: async () => { await updater.downloadUpdate(result?.cancellationToken); },
    install: () => updater.quitAndInstall(false, true),
    cancel: () => {
      listeners.clear(); result?.cancellationToken?.cancel();
      updater.removeListener('update-available', available); updater.removeListener('update-not-available', notAvailable);
      updater.removeListener('download-progress', progress); updater.removeListener('update-downloaded', downloaded);
    },
  };
}
