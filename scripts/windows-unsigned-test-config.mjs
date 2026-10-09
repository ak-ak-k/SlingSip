import { releasePolicy, windowsPackageConfig } from './windows-package-config.mjs';

export const UNSIGNED_TEST_DIRECTORY = 'release/test-unsigned';
export const UNSIGNED_TEST_STAGING = '.cache/slingsip-test-unsigned-packaging';
export const UNSIGNED_TEST_NAME = 'SlingSip (Unsigned Test)';

/** A separate, explicitly non-updating distribution. Never used by package:win. */
export function unsignedTestPolicy() {
  return { ...releasePolicy({ preview: true }), channel: 'test-unsigned', distribution: 'unsigned-test' };
}

export function unsignedTestPackageConfig() {
  const preview = windowsPackageConfig({ preview: true });
  return {
    ...preview,
    appId: 'com.slingsip.desktop.testunsigned',
    productName: UNSIGNED_TEST_NAME,
    directories: { ...preview.directories, output: UNSIGNED_TEST_DIRECTORY },
    // The package name also controls the one-click install directory. A separate
    // appId alone would still install into the production package's directory.
    extraMetadata: { name: 'slingsip-desktop-companion-test-unsigned', productName: UNSIGNED_TEST_NAME,
      description: 'SlingSip unsigned test distribution for friends and manual testing. Automatic updates are disabled.' },
    extraResources: [
      { from: `${UNSIGNED_TEST_STAGING}/slingsip-update-policy.json`, to: 'slingsip-update-policy.json' },
      { from: 'docs/unsigned-test-distribution.txt', to: 'UNSIGNED-TEST.txt' },
    ],
    win: { ...preview.win, executableName: 'SlingSip', icon: `${UNSIGNED_TEST_STAGING}/slingsip.ico` },
    nsis: { ...preview.nsis, shortcutName: UNSIGNED_TEST_NAME,
      uninstallDisplayName: 'SlingSip ${version} (Unsigned Test)' },
  };
}

/** Prevent ambient signing variables from affecting this explicitly unsigned build. */
export function unsignedTestEnvironment(environment) {
  const result = { ...environment };
  for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD',
    'SLINGSIP_WINDOWS_PUBLISHER', 'SLINGSIP_WINDOWS_CERTIFICATE_SHA1']) delete result[key];
  return result;
}
