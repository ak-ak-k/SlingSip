import electronBuilder from 'electron-builder';
import { mkdir, writeFile } from 'node:fs/promises';
import { releasePolicy, windowsPackageConfig, PACKAGING_DIRECTORY } from './windows-package-config.mjs';
import { prepareWindowsIcon } from './prepare-windows-icon.mjs';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--preview')) throw new Error('Only --preview is accepted. This script never publishes artifacts.');
const options = { preview: args.includes('--preview'), publisherName: process.env.SLINGSIP_WINDOWS_PUBLISHER };
const policy = releasePolicy(options);
const config = windowsPackageConfig(options);
await mkdir(PACKAGING_DIRECTORY, { recursive: true });
await writeFile(`${PACKAGING_DIRECTORY}/slingsip-update-policy.json`, JSON.stringify(policy, null, 2) + '\n');
await prepareWindowsIcon(`${PACKAGING_DIRECTORY}/slingsip.ico`);
const { build, Platform, Arch } = electronBuilder;
await build({ config, targets: Platform.WINDOWS.createTarget([options.preview ? 'dir' : 'nsis'], Arch.x64), publish: 'never' });
