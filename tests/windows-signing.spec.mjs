import { test, expect } from '@playwright/test';
import { validateConfiguration } from 'app-builder-lib/out/util/config/config.js';
import { WindowsSignToolManager } from 'app-builder-lib/out/codeSign/windowsSignToolManager.js';
import { releasePolicy, windowsPackageConfig } from '../scripts/windows-package-config.mjs';
import { assertPublisherSubject, windowsSigningEnvironment, validateWindowsSignatures } from '../scripts/windows-signing.mjs';
import { validateReleaseMetadata } from '../scripts/verify-windows-release.mjs';

// Synthetic public metadata only. No certificate, private key, PFX or signing credential is created.
const publisher = 'CN=Signing Test Fixture, O=Test Fixture, C=IN';
const thumbprint = '1234567890ABCDEF1234567890ABCDEF12345678';
const projectedSignatures = () => ['application.exe', 'installer.exe'].map(Path => ({
  Path, Subject: publisher, Issuer: 'CN=Metadata Fixture Issuer', Thumbprint: thumbprint,
  Status: 'Valid', StatusMessage: 'Synthetic metadata projection for acceptance-policy tests only',
}));

test('Release publisher rejects missing identity, display names and unfilled placeholders', () => {
  for (const value of [undefined, '', '   ', 'Display Name', '<EXACT CERTIFICATE SUBJECT>', 'CN=<SUBJECT>', 'CN=Name\nO=Org']) {
    expect(() => assertPublisherSubject(value)).toThrow();
  }
  expect(assertPublisherSubject(publisher)).toBe(publisher);
  expect(() => releasePolicy({ publisherName: '' })).toThrow('exact signing certificate subject');
});

test('PFX credentials stay in environment and ambiguous or absent certificate sources fail closed', () => {
  const environment = { SLINGSIP_WINDOWS_PUBLISHER: publisher, CSC_LINK: 'outside-repository.pfx', CSC_KEY_PASSWORD: 'fixture-password-not-a-credential' };
  expect(windowsSigningEnvironment(environment)).toEqual({ publisherName: publisher, certificateSha1: undefined });
  expect(windowsSigningEnvironment({ WIN_CSC_LINK: 'outside-repository.pfx', WIN_CSC_KEY_PASSWORD: '' })).toEqual({ publisherName: undefined, certificateSha1: undefined });
  expect(windowsSigningEnvironment({ CSC_LINK: 'passwordless-outside-repository.pfx' })).toEqual({ publisherName: undefined, certificateSha1: undefined });
  for (const invalid of [{}, { ...environment, WIN_CSC_LINK: 'other.pfx' },
    { ...environment, WIN_CSC_KEY_PASSWORD: 'ambiguous' }, { ...environment, SLINGSIP_WINDOWS_CERTIFICATE_SHA1: thumbprint }]) {
    expect(() => windowsSigningEnvironment(invalid)).toThrow();
  }
  const config = windowsPackageConfig(windowsSigningEnvironment(environment));
  expect(JSON.stringify(config)).not.toContain(environment.CSC_LINK);
  expect(JSON.stringify(config)).not.toContain(environment.CSC_KEY_PASSWORD);
});

test('Windows store selection uses the installed builder schema and its real publisher resolver', async () => {
  const options = windowsSigningEnvironment({ SLINGSIP_WINDOWS_PUBLISHER: publisher, SLINGSIP_WINDOWS_CERTIFICATE_SHA1: thumbprint.toLowerCase() });
  const config = windowsPackageConfig(options);
  await validateConfiguration(config);
  expect(config.forceCodeSigning).toBe(true);
  expect(config.win.signExecutable).toBe(true);
  expect(config.win.signtoolOptions).toEqual({ publisherName: publisher, certificateSha1: thumbprint, certificateSubjectName: publisher });
  // Exercises the actual v26 consumer: top-level win.publisherName would be ignored here.
  const signer = new WindowsSignToolManager({ platformSpecificBuildOptions: config.win });
  expect(await signer.computedPublisherName.value).toEqual([publisher]);
  expect(() => windowsSigningEnvironment({ SLINGSIP_WINDOWS_CERTIFICATE_SHA1: 'not-a-thumbprint' })).toThrow('40-digit');
  expect(() => windowsSigningEnvironment({ SLINGSIP_WINDOWS_CERTIFICATE_SHA1: thumbprint, CSC_KEY_PASSWORD: '' })).toThrow('Choose');
});

test('Previews ignore signing inputs, disable signing explicitly and never enable updates', async () => {
  const options = windowsSigningEnvironment({ SLINGSIP_WINDOWS_CERTIFICATE_SHA1: 'invalid', CSC_LINK: 'must-not-be-used.pfx' }, { preview: true });
  const config = windowsPackageConfig({ preview: true, ...options });
  await validateConfiguration(config);
  expect(config.win.signExecutable).toBe(false);
  expect(config.win.signtoolOptions).toBeUndefined();
  expect(config.forceCodeSigning).toBe(false);
  expect(config.publish).toBeNull();
  expect(releasePolicy({ preview: true }).enabled).toBe(false);
});

test('Release acceptance rejects unsigned, untrusted, wrong publisher and mismatched signer projections', () => {
  expect(() => validateWindowsSignatures(projectedSignatures(), publisher, thumbprint)).not.toThrow();
  for (const patch of [{ Status: 'NotSigned' }, { Status: 'HashMismatch' }, { Status: 'NotTrusted' },
    { Subject: 'CN=Wrong Publisher' }, { Subject: 'Signing Test Fixture' },
    { Thumbprint: 'A'.repeat(40) }, { Thumbprint: null }, { Issuer: null }]) {
    const values = projectedSignatures(); values[1] = { ...values[1], ...patch };
    expect(() => validateWindowsSignatures(values, publisher)).toThrow();
  }
  expect(() => validateWindowsSignatures(projectedSignatures(), publisher, 'A'.repeat(40))).toThrow('selected');
  expect(() => validateWindowsSignatures(projectedSignatures().slice(0, 1), publisher)).toThrow('Both');
});

test('Release acceptance requires the same verified publisher in policy and generated updater YAML', () => {
  const policy = releasePolicy({ publisherName: publisher });
  const feed = { provider: 'github', owner: 'ak-ak-k', repo: 'slingsip', channel: 'latest', publisherName: [publisher] };
  expect(() => validateReleaseMetadata(policy, feed, policy)).not.toThrow();
  for (const patch of [{ publisherName: undefined }, { publisherName: ['CN=Other'] }, { publisherName: [publisher, 'CN=Other'] },
    { token: 'forbidden-metadata-fixture' }, { private: true }, { requestHeaders: {} },
    { repo: 'other' }, { url: 'https://example.invalid' }, { protocol: 'http' }, { channel: 'beta' }]) {
    expect(() => validateReleaseMetadata(policy, { ...feed, ...patch }, policy)).toThrow('app-update.yml');
  }
  expect(() => validateReleaseMetadata({ ...policy, publisherName: 'CN=Other' }, feed, policy)).toThrow('policy');
  expect(() => validateReleaseMetadata({ ...policy, enabled: false }, feed, policy)).toThrow('policy');
});
