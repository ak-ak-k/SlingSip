import electronBuilder from 'electron-builder';
import { mkdir, writeFile } from 'node:fs/promises';
import { releasePolicy, windowsPackageConfig, PACKAGING_DIRECTORY } from './windows-package-config.mjs';
import { prepareWindowsIcon } from './prepare-windows-icon.mjs';
import { windowsSigningEnvironment } from './windows-signing.mjs';
import { verifyWindowsRelease } from './verify-windows-release.mjs';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--preview')) throw new Error('Only --preview is accepted. This script never publishes artifacts.');
const preview = args.includes('--preview');
// Validate publisher first, before consuming credentials or preparing build outputs.
releasePolicy({ preview, publisherName: process.env.SLINGSIP_WINDOWS_PUBLISHER });
const options = { preview, ...windowsSigningEnvironment(process.env, { preview }) };
const policy = releasePolicy(options);
const config = windowsPackageConfig(options);
await mkdir(PACKAGING_DIRECTORY, { recursive: true });
await writeFile(`${PACKAGING_DIRECTORY}/slingsip-update-policy.json`, JSON.stringify(policy, null, 2) + '\n');
await prepareWindowsIcon(`${PACKAGING_DIRECTORY}/slingsip.ico`);
const { build, Platform, Arch } = electronBuilder;
await build({ config, targets: Platform.WINDOWS.createTarget([options.preview ? 'dir' : 'nsis'], Arch.x64), publish: 'never' });
if (!preview) await verifyWindowsRelease({ publisherName: policy.publisherName, certificateSha1: options.certificateSha1 });
