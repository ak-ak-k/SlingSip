import electronBuilder from 'electron-builder';
import asar from '@electron/asar';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareWindowsIcon } from './prepare-windows-icon.mjs';
import { readWindowsSignatures } from './verify-windows-release.mjs';
import { UNSIGNED_TEST_DIRECTORY, UNSIGNED_TEST_STAGING, unsignedTestEnvironment,
  unsignedTestPackageConfig, unsignedTestPolicy } from './windows-unsigned-test-config.mjs';

if (process.argv.length > 2) throw new Error('This command takes no arguments and only builds an unsigned test installer.');
if (process.platform !== 'win32') throw new Error('Build and verify this unsigned Windows test installer on Windows.');
const environment = unsignedTestEnvironment(process.env);
for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
const config = unsignedTestPackageConfig();
const policy = unsignedTestPolicy();
await mkdir(UNSIGNED_TEST_STAGING, { recursive: true });
await writeFile(`${UNSIGNED_TEST_STAGING}/slingsip-update-policy.json`, JSON.stringify(policy, null, 2) + '\n');
await prepareWindowsIcon(`${UNSIGNED_TEST_STAGING}/slingsip.ico`);
const { build, Platform, Arch } = electronBuilder;
await build({ config, targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), publish: 'never' });

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const installer = path.join(UNSIGNED_TEST_DIRECTORY, `SlingSip-Setup-${version}-x64.exe`);
const application = path.join(UNSIGNED_TEST_DIRECTORY, 'win-unpacked/SlingSip.exe');
const resources = path.join(UNSIGNED_TEST_DIRECTORY, 'win-unpacked/resources');
const packagedPolicy = JSON.parse(await readFile(path.join(resources, 'slingsip-update-policy.json'), 'utf8'));
assert.deepEqual(packagedPolicy, policy, 'The unsigned installer must retain its disabled, isolated update policy.');
assert.equal(policy.enabled, false);
assert.equal(policy.publisherName, '');
const publicFeeds = (await readdir(UNSIGNED_TEST_DIRECTORY)).filter(file => /\.ya?ml$/i.test(file) && file !== 'builder-effective-config.yaml');
assert.deepEqual(publicFeeds, [], 'No updater channel metadata may be generated for the unsigned installer.');
assert.equal((await readdir(resources)).includes('app-update.yml'), false, 'The unsigned app must not contain an updater feed.');
const packagedVersion = JSON.parse(asar.extractFile(path.join(resources, 'app.asar'), 'package.json').toString('utf8')).version;
assert.equal(packagedVersion, version);
const signatures = await readWindowsSignatures(application, installer);
for (const signature of signatures) {
  assert.equal(signature.Status, 'NotSigned', 'This distribution must be explicitly unsigned.');
  assert.equal(signature.Subject, null, 'There must be no invented signing publisher.');
}
await copyFile('docs/unsigned-test-distribution.txt', path.join(UNSIGNED_TEST_DIRECTORY, 'README-UNSIGNED-TEST.txt'));
const installerSHA256 = createHash('sha256').update(await readFile(installer)).digest('hex');
await writeFile(path.join(UNSIGNED_TEST_DIRECTORY, 'unsigned-test-build.json'), JSON.stringify({
  distribution: 'unsigned-test', version, installer: path.basename(installer), installerSHA256,
  updatesEnabled: false, updateFeedGenerated: false, publisherName: '', signatures,
  builtAt: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`PASS: unsigned test installer created: ${path.resolve(installer)}`);
console.log('Automatic updates are disabled. Do not upload this build to the signed stable release channel.');
