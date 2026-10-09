import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateConfiguration } from 'app-builder-lib/out/util/config/config.js';
import { AppInfo } from 'app-builder-lib/out/appInfo.js';
import { windowsPackageConfig, releasePolicy, WINDOWS_APP_ID } from '../scripts/windows-package-config.mjs';
import { updateAvailability } from '../electron/update-backend.ts';
import { publicUnsignedPackageConfig, publicUnsignedPolicy, publicUnsignedEnvironment, assertPublicUnsignedV1 } from '../scripts/windows-public-unsigned-config.mjs';

test('Final public unsigned V1 rejects any package/lockfile version other than 1.0.0', () => {
  expect(() => assertPublicUnsignedV1('1.0.0', '1.0.0', '1.0.0')).not.toThrow();
  for (const values of [['0.1.0', '1.0.0', '1.0.0'], ['1.0.0', '0.1.0', '1.0.0'], ['1.0.0', '1.0.0', undefined], ['1.0.0-beta.1', '1.0.0', '1.0.0']]) {
    expect(() => assertPublicUnsignedV1(...values)).toThrow('exactly 1.0.0');
  }
});

test('Public unsigned package keeps canonical SlingSip identity and native labels with the real builder schema', async () => {
  const config = publicUnsignedPackageConfig();
  await validateConfiguration(config);
  const metadata = JSON.parse(await readFile('package.json', 'utf8'));
  const info = new AppInfo({ config, metadata }, undefined, config.win);
  expect(config.appId).toBe(WINDOWS_APP_ID);
  expect(config.appId).toBe(windowsPackageConfig({ publisherName: 'CN=Public Metadata Fixture' }).appId);
  expect(info.productName).toBe('SlingSip');
  expect(info.productFilename).toBe('SlingSip');
  expect(info.name).toBe('slingsip-desktop-companion');
  expect(config.directories.output).toBe('release/public-unsigned');
  expect(config.nsis).toMatchObject({ oneClick: false, perMachine: false, shortcutName: 'SlingSip',
    uninstallDisplayName: 'SlingSip ${version}', deleteAppDataOnUninstall: false, differentialPackage: false,
    artifactName: 'SlingSip-Setup-${version}-${arch}.${ext}' });
  expect(config.forceCodeSigning).toBe(false);
  expect(config.win.signExecutable).toBe(false);
  expect(config.win.signtoolOptions).toBeUndefined();
  expect(config.publish).toBeNull();
  expect(JSON.stringify(config)).not.toMatch(/Unsigned Test|test-unsigned/);
});

test('Packaged public unsigned resources cannot activate the real production update backend', async () => {
  const directory = path.resolve('.cache/public-unsigned-policy-' + randomUUID());
  await mkdir(directory, { recursive: true });
  const policy = publicUnsignedPolicy();
  expect(policy).toMatchObject({ enabled: false, publisherName: '', channel: 'public-unsigned', distribution: 'unsigned-public' });
  await writeFile(path.join(directory, 'slingsip-update-policy.json'), JSON.stringify(policy));
  expect(updateAvailability(true, 'win32', directory)).toBe('Updates are unavailable in this build.');
  await writeFile(path.join(directory, 'app-update.yml'), 'provider: github\nowner: ak-ak-k\nrepo: slingsip\npublisherName: CN=Never Used\n');
  expect(updateAvailability(true, 'win32', directory)).toContain('unavailable');
});

test('Public unsigned environment strips signing inputs without affecting caller secrets or build-tool overrides', () => {
  const source = { CSC_LINK: 'unused.pfx', CSC_KEY_PASSWORD: 'unused-fixture', WIN_CSC_LINK: 'unused.pfx',
    WIN_CSC_KEY_PASSWORD: 'unused-fixture', SLINGSIP_WINDOWS_PUBLISHER: 'unused-fixture',
    SLINGSIP_WINDOWS_CERTIFICATE_SHA1: 'unused-fixture', ELECTRON_BUILDER_NSIS_DIR: 'tool-cache/nsis' };
  expect(publicUnsignedEnvironment(source)).toEqual({ ELECTRON_BUILDER_NSIS_DIR: 'tool-cache/nsis' });
  expect(source.CSC_LINK).toBe('unused.pfx');
});

test('Signed production packaging remains independent and requires genuine signer identity', () => {
  expect(() => releasePolicy({ publisherName: '' })).toThrow('exact signing certificate subject');
  const signed = windowsPackageConfig({ publisherName: 'CN=Public Metadata Fixture' });
  expect(signed.directories.output).toBe('release/stable');
  expect(signed.forceCodeSigning).toBe(true);
  expect(signed.win.signExecutable).toBe(true);
  expect(signed.win.verifyUpdateCodeSignature).toBe(true);
  expect(signed.win.signtoolOptions.publisherName).toBe('CN=Public Metadata Fixture');
});
