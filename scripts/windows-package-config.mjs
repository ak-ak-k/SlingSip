import { readFileSync } from 'node:fs';
import path from 'node:path';

export const WINDOWS_APP_ID = 'com.slingsip.desktop';
export const PACKAGING_DIRECTORY = '.cache/slingsip-packaging';

/** Release-build guard only. Electron/updater still own semantic version validation/comparison. */
export function assertStableReleaseVersion(version) {
  if (version.split('+')[0].includes('-')) throw new Error('The stable Windows release pipeline cannot build beta/nightly/prerelease versions.');
}

/** Only public release identity belongs in this file. Signing secrets remain build-environment-only. */
export function releasePolicy({ preview = false, publisherName } = {}) {
  const config = JSON.parse(readFileSync(new URL('../release.config.json', import.meta.url), 'utf8'));
  if (Object.keys(config).some(key => !['provider', 'owner', 'repo', 'channel', 'publisherName'].includes(key))
    || config.provider !== 'github' || config.owner !== 'ak-ak-k' || config.repo !== 'slingsip' || config.channel !== 'stable') {
    throw new Error('Release configuration must use the approved public GitHub stable provider; URLs and tokens are not accepted.');
  }
  const publisher = (publisherName ?? config.publisherName).trim();
  if (!preview) assertStableReleaseVersion(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  if (!preview && !publisher) throw new Error('Set SLINGSIP_WINDOWS_PUBLISHER or release.config.json publisherName to the exact signing certificate subject before building a release.');
  return { schemaVersion: 1, enabled: !preview, provider: config.provider, owner: config.owner, repo: config.repo,
    channel: 'stable', publisherName: preview ? '' : publisher };
}

export function windowsPackageConfig(options = {}) {
  const policy = releasePolicy(options);
  return {
    appId: WINDOWS_APP_ID,
    productName: 'SlingSip',
    asar: true,
    npmRebuild: false,
    electronDist: path.resolve('node_modules/electron/dist'),
    directories: { output: policy.enabled ? 'release/stable' : 'release/preview' },
    files: ['dist/electron/main.mjs', 'dist/electron/preload.cjs', 'dist/renderer/browser/**/*', 'package.json', '!**/*.map'],
    extraResources: [{ from: `${PACKAGING_DIRECTORY}/slingsip-update-policy.json`, to: 'slingsip-update-policy.json' }],
    forceCodeSigning: policy.enabled,
    publish: policy.enabled ? [{ provider: 'github', owner: policy.owner, repo: policy.repo, private: false,
      channel: 'latest', releaseType: 'release' }] : null,
    generateUpdatesFilesForAllChannels: false,
    win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: `${PACKAGING_DIRECTORY}/slingsip.ico`,
      verifyUpdateCodeSignature: true, ...(policy.enabled ? { publisherName: policy.publisherName } : {}) },
    nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false,
      artifactName: 'SlingSip-Setup-${version}-${arch}.${ext}' },
  };
}
