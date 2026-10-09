import electronBuilder from 'electron-builder';
import asar from '@electron/asar';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareWindowsIcon } from './prepare-windows-icon.mjs';
import { readWindowsSignatures } from './verify-windows-release.mjs';
import { PUBLIC_UNSIGNED_DIRECTORY, PUBLIC_UNSIGNED_STAGING, publicUnsignedEnvironment,
  publicUnsignedPackageConfig, publicUnsignedPolicy } from './windows-public-unsigned-config.mjs';

if (process.argv.length > 2) throw new Error('No arguments accepted; this command builds the final public unsigned SlingSip V1 installer.');
if (process.platform !== 'win32') throw new Error('Build and verify the public unsigned Windows installer on Windows.');
const environment = publicUnsignedEnvironment(process.env);
for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
const config = publicUnsignedPackageConfig();
const policy = publicUnsignedPolicy();
await mkdir(PUBLIC_UNSIGNED_STAGING, { recursive: true });
await writeFile(`${PUBLIC_UNSIGNED_STAGING}/slingsip-update-policy.json`, JSON.stringify(policy, null, 2) + '\n');
await prepareWindowsIcon(`${PUBLIC_UNSIGNED_STAGING}/slingsip.ico`);
const { build, Platform, Arch } = electronBuilder;
await build({ config, targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), publish: 'never' });

const installer = path.join(PUBLIC_UNSIGNED_DIRECTORY, 'SlingSip-Setup-1.0.0-x64.exe');
const application = path.join(PUBLIC_UNSIGNED_DIRECTORY, 'win-unpacked/SlingSip.exe');
const resources = path.join(PUBLIC_UNSIGNED_DIRECTORY, 'win-unpacked/resources');
assert.deepEqual(JSON.parse(await readFile(path.join(resources, 'slingsip-update-policy.json'), 'utf8')), policy);
assert.equal(policy.enabled, false);
assert.equal(policy.publisherName, '');
const updaterArtifacts = (await readdir(PUBLIC_UNSIGNED_DIRECTORY)).filter(file =>
  (/\.ya?ml$/i.test(file) && !/^builder-(?:debug|effective-config)\.ya?ml$/i.test(file)) || /\.blockmap$/i.test(file));
assert.deepEqual(updaterArtifacts, [], 'Public unsigned builds must not generate updater channel metadata or blockmaps.');
assert.equal((await readdir(resources)).includes('app-update.yml'), false);

const archive = path.join(resources, 'app.asar');
const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
assert.equal(metadata.version, '1.0.0');
assert.equal(metadata.productName, 'SlingSip');
assert.equal(metadata.name, 'slingsip-desktop-companion');
const entries = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''));
const forbiddenFiles = entries.filter(file => /(?:^|\/)(?:\.env(?:\.|$)|(?:hydration|user-profile|companion-preferences)\.json$)|\.(?:pfx|p12|pem|key|cer|crt)$/i.test(file));
assert.deepEqual(forbiddenFiles, [], 'No environment, user-data or certificate/key files may be packaged.');
const forbiddenContent = [/Unsigned Test/i, /this preview or incomplete release build/i, /slingsip-desktop-companion-test-unsigned/i, /com\.slingsip\.desktop\.testunsigned/i,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, /\bgithub_pat_[A-Za-z0-9_]{50,}\b/, /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/];
let filesScanned = 0;
for (const file of entries) {
  const nativePath = path.normalize(file);
  const stat = asar.statFile(archive, nativePath);
  if (stat.files || stat.link) continue;
  const contents = asar.extractFile(archive, nativePath).toString('utf8');
  filesScanned++;
  assert.equal(forbiddenContent.some(pattern => pattern.test(contents)), false, `Test label or credential pattern in packaged file: ${file}`);
}
const signatures = await readWindowsSignatures(application, installer);
for (const signature of signatures) {
  assert.equal(signature.Status, 'NotSigned');
  assert.equal(signature.Subject, null, 'No invented signing publisher is permitted.');
}
await copyFile('docs/slingsip-public-unsigned-release-notes.txt', path.join(PUBLIC_UNSIGNED_DIRECTORY, 'README-UNSIGNED.txt'));
const installerBytes = await readFile(installer);
const installerSHA256 = createHash('sha256').update(installerBytes).digest('hex');
await writeFile(path.join(PUBLIC_UNSIGNED_DIRECTORY, 'SHA256SUMS.txt'), `${installerSHA256}  ${path.basename(installer)}\n`);
await writeFile(path.join(PUBLIC_UNSIGNED_DIRECTORY, 'public-unsigned-build.json'), JSON.stringify({
  distribution: 'unsigned-public', version: metadata.version, productName: metadata.productName, appId: config.appId,
  installer: path.basename(installer), installerBytes: installerBytes.length, installerSHA256,
  updatesEnabled: false, updateMetadataGenerated: false, unsignedTestLabelsFound: false,
  credentialPatternsFound: false, certificateFilesFound: false, archiveFilesScanned: filesScanned,
  signatures, builtAt: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`PASS: public unsigned SlingSip 1.0.0 installer: ${path.resolve(installer)}`);
console.log(`Size: ${installerBytes.length} bytes. Updates disabled. No publishing performed.`);
