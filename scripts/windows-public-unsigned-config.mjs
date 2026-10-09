import { readFileSync } from 'node:fs';
import { releasePolicy, windowsPackageConfig } from './windows-package-config.mjs';

export const PUBLIC_UNSIGNED_DIRECTORY = 'release/public-unsigned';
export const PUBLIC_UNSIGNED_STAGING = '.cache/slingsip-public-unsigned-packaging';

export function assertPublicUnsignedV1(packageVersion, lockVersion, lockRootVersion) {
  if ([packageVersion, lockVersion, lockRootVersion].some(value => value !== '1.0.0')) {
    throw new Error('The final public unsigned V1 build requires package.json and both lockfile versions to be exactly 1.0.0.');
  }
}

export function publicUnsignedPolicy() {
  return { ...releasePolicy({ preview: true }), channel: 'public-unsigned', distribution: 'unsigned-public' };
}

/** Normal SlingSip install identity; updates and signing are disabled only for this separate mode. */
export function publicUnsignedPackageConfig() {
  const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assertPublicUnsignedV1(metadata.version, lock.version, lock.packages?.['']?.version);
  const base = windowsPackageConfig({ preview: true });
  return {
    ...base,
    directories: { ...base.directories, output: PUBLIC_UNSIGNED_DIRECTORY },
    extraResources: [
      { from: `${PUBLIC_UNSIGNED_STAGING}/slingsip-update-policy.json`, to: 'slingsip-update-policy.json' },
      { from: 'docs/slingsip-public-unsigned-release-notes.txt', to: 'README-UNSIGNED.txt' },
    ],
    win: { ...base.win, icon: `${PUBLIC_UNSIGNED_STAGING}/slingsip.ico` },
    // Standard NSIS wizard permits launch/cancel verification before installation.
    // The canonical appId/package name and existing install-location discovery remain intact.
    nsis: { ...base.nsis, oneClick: false, selectPerMachineByDefault: false,
      allowElevation: false, shortcutName: 'SlingSip', uninstallDisplayName: 'SlingSip ${version}',
      differentialPackage: false },
  };
}

export function publicUnsignedEnvironment(environment) {
  const result = { ...environment };
  for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD',
    'SLINGSIP_WINDOWS_PUBLISHER', 'SLINGSIP_WINDOWS_CERTIFICATE_SHA1']) delete result[key];
  return result;
}
