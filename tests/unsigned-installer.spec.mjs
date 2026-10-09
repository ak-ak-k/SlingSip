import { test, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateConfiguration } from 'app-builder-lib/out/util/config/config.js';
import { AppInfo } from 'app-builder-lib/out/appInfo.js';
import { getWindowsInstallationDirName } from 'app-builder-lib/out/targets/targetUtil.js';
import { windowsPackageConfig, releasePolicy } from '../scripts/windows-package-config.mjs';
import { updateAvailability } from '../electron/update-backend.ts';
import { configureAppIdentity } from '../electron/app-identity.ts';
import { unsignedTestPackageConfig, unsignedTestPolicy, unsignedTestEnvironment } from '../scripts/windows-unsigned-test-config.mjs';

test('Unsigned NSIS mode validates with the installed builder and isolates installation identity', async () => {
  const config = unsignedTestPackageConfig();
  await validateConfiguration(config);
  const metadata = JSON.parse(await readFile('package.json', 'utf8'));
  const testApp = new AppInfo({ config, metadata: { ...metadata, ...config.extraMetadata } }, undefined, config.win);
  const signedConfig = windowsPackageConfig({ publisherName: 'CN=Public Metadata Test Fixture' });
  const signedApp = new AppInfo({ config: signedConfig, metadata }, undefined, signedConfig.win);
  expect(config.directories.output).toBe('release/test-unsigned');
  expect(config.appId).not.toBe(signedConfig.appId);
  expect(getWindowsInstallationDirName(testApp, false)).not.toBe(getWindowsInstallationDirName(signedApp, false));
  expect(testApp.productFilename).toBe('SlingSip');
  expect(config.productName).toBe('SlingSip (Unsigned Test)');
  expect(config.nsis).toMatchObject({ oneClick: true, perMachine: false, deleteAppDataOnUninstall: false,
    shortcutName: 'SlingSip (Unsigned Test)', artifactName: 'SlingSip-Setup-${version}-${arch}.${ext}' });
  expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
  expect(config.publish).toBeNull();
  expect(config.win.signExecutable).toBe(false);
  expect(config.win.signtoolOptions).toBeUndefined();
  expect(config.forceCodeSigning).toBe(false);
});

test('Unsigned test resources disable the real updater even if a feed file is accidentally present', async () => {
  const directory = path.resolve('.cache/unsigned-installer-policy-' + randomUUID());
  await mkdir(directory, { recursive: true });
  const policy = unsignedTestPolicy();
  expect(policy).toMatchObject({ enabled: false, publisherName: '', channel: 'test-unsigned', distribution: 'unsigned-test' });
  await writeFile(path.join(directory, 'slingsip-update-policy.json'), JSON.stringify(policy));
  expect(updateAvailability(true, 'win32', directory)).toContain('unavailable');
  await writeFile(path.join(directory, 'app-update.yml'), 'provider: github\nowner: ak-ak-k\nrepo: slingsip\nchannel: latest\npublisherName: CN=Must Never Be Used\n');
  expect(updateAvailability(true, 'win32', directory)).toContain('unavailable');
});

test('The signed release mode still fails without identity and mandates signing with verification', () => {
  expect(() => releasePolicy({ publisherName: '' })).toThrow('exact signing certificate subject');
  const config = windowsPackageConfig({ publisherName: 'CN=Public Metadata Test Fixture' });
  expect(config.directories.output).toBe('release/stable');
  expect(config.forceCodeSigning).toBe(true);
  expect(config.win.signExecutable).toBe(true);
  expect(config.win.verifyUpdateCodeSignature).toBe(true);
  expect(config.win.signtoolOptions.publisherName).toBe('CN=Public Metadata Test Fixture');
  expect(config.publish).toMatchObject([{ provider: 'github', owner: 'ak-ak-k', repo: 'slingsip' }]);
});

test('Unsigned packaging strips signing variables while keeping build-tool overrides and caller environment intact', () => {
  const source = { CSC_LINK: 'unused-fixture.pfx', CSC_KEY_PASSWORD: 'unused-fixture', WIN_CSC_LINK: 'unused-fixture.pfx',
    WIN_CSC_KEY_PASSWORD: 'unused-fixture', SLINGSIP_WINDOWS_PUBLISHER: 'must-not-be-used', SLINGSIP_WINDOWS_CERTIFICATE_SHA1: 'must-not-be-used',
    ELECTRON_BUILDER_NSIS_DIR: 'build-tools/nsis' };
  const clean = unsignedTestEnvironment(source);
  expect(clean).toEqual({ ELECTRON_BUILDER_NSIS_DIR: 'build-tools/nsis' });
  expect(source.CSC_LINK).toBe('unused-fixture.pfx');
});

test('Package/install identity does not change the normal data directory or Chromium session path', async () => {
  const appData = path.resolve('.cache/unsigned-installer-data-' + randomUUID());
  const paths = new Map([['appData', appData]]);
  let name;
  configureAppIdentity({ getPath: key => paths.get(key), setPath: (key, value) => paths.set(key, value), setName: value => name = value });
  expect(name).toBe('SlingSip');
  expect(paths.get('userData')).toBe(path.join(appData, 'Mizu'));
  expect(paths.get('sessionData')).toBe(path.join(appData, 'Mizu'));
});
