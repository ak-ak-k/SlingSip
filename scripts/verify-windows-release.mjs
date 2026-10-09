import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
import { releasePolicy } from './windows-package-config.mjs';
import { validateWindowsSignatures } from './windows-signing.mjs';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
// Fixed PowerShell code: paths arrive as environment data, never command interpolation.
// Inline commands also work on hosts that disable .ps1 files; no execution-policy changes.
const authenticodeCommand = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$signatures = @(foreach ($artifactPath in @($env:SLINGSIP_VERIFY_APPLICATION, $env:SLINGSIP_VERIFY_INSTALLER)) {
  if (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) { throw "Release artifact is missing: $artifactPath" }
  $signature = Get-AuthenticodeSignature -LiteralPath $artifactPath
  [pscustomobject]@{
    Path = $signature.Path
    Subject = $signature.SignerCertificate.Subject
    Issuer = $signature.SignerCertificate.Issuer
    Thumbprint = $signature.SignerCertificate.Thumbprint
    Status = $signature.Status.ToString()
    StatusMessage = $signature.StatusMessage
  }
})
ConvertTo-Json -InputObject $signatures -Depth 3
`;

export async function readWindowsSignatures(applicationPath, installerPath) {
  if (process.platform !== 'win32') throw new Error('Release Authenticode verification requires Windows.');
  const environment = { ...process.env };
  for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD']) delete environment[key];
  environment.SLINGSIP_VERIFY_APPLICATION = path.resolve(applicationPath);
  environment.SLINGSIP_VERIFY_INSTALLER = path.resolve(installerPath);
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', authenticodeCommand],
  { windowsHide: true, env: environment, timeout: 60_000, encoding: 'utf8' });
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
}

/** Fail closed if the generated updater trusts anything other than the verified signer. */
export function validateReleaseMetadata(policy, feed, expected) {
  if (!policy || policy.schemaVersion !== 1 || policy.enabled !== true || policy.channel !== 'stable'
    || ['provider', 'owner', 'repo', 'publisherName'].some(key => policy[key] !== expected[key])) {
    throw new Error('Packaged update policy does not match the verified release identity.');
  }
  const publishers = Array.isArray(feed?.publisherName) ? feed.publisherName : [feed?.publisherName];
  if (!feed || ['provider', 'owner', 'repo'].some(key => feed[key] !== expected[key])
    || publishers.length !== 1 || publishers[0] !== expected.publisherName
    || feed.private === true || ['token', 'requestHeaders', 'url'].some(key => key in feed)
    || feed.host != null && feed.host !== 'github.com' || feed.protocol != null && feed.protocol !== 'https'
    || feed.channel != null && feed.channel !== 'latest') {
    throw new Error('Generated app-update.yml does not trust exactly the verified release publisher/provider.');
  }
}

export async function verifyWindowsRelease({ publisherName = process.env.SLINGSIP_WINDOWS_PUBLISHER,
  certificateSha1 = process.env.SLINGSIP_WINDOWS_CERTIFICATE_SHA1 } = {}) {
  const expected = releasePolicy({ publisherName });
  const { version } = JSON.parse(await readFile(path.join(projectDirectory, 'package.json'), 'utf8'));
  const directory = path.join(projectDirectory, 'release/stable');
  const signatures = await readWindowsSignatures(path.join(directory, 'win-unpacked/SlingSip.exe'),
    path.join(directory, `SlingSip-Setup-${version}-x64.exe`));
  // Print public evidence even when acceptance fails (e.g. NotSigned or incorrect publisher).
  console.log(JSON.stringify(signatures, null, 2));
  validateWindowsSignatures(signatures, expected.publisherName, certificateSha1);
  const resources = path.join(directory, 'win-unpacked/resources');
  const policy = JSON.parse(await readFile(path.join(resources, 'slingsip-update-policy.json'), 'utf8'));
  const feed = yaml.load(await readFile(path.join(resources, 'app-update.yml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
  validateReleaseMetadata(policy, feed, expected);
  console.log('PASS: application and installer Authenticode signatures are Valid; publisher and updater identities match.');
  return signatures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error('No arguments accepted; verifies release/stable for the canonical package version.');
  await verifyWindowsRelease();
}
