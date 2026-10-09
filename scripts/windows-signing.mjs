/** Signing credentials are consumed by electron-builder, never copied into packaged resources. */
export function assertPublisherSubject(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Set SLINGSIP_WINDOWS_PUBLISHER or release.config.json publisherName to the exact signing certificate subject before building a release.');
  }
  const subject = value.trim();
  if (!/(?:^|,\s*)CN=\S/.test(subject) || /[\r\n<>]/.test(subject)) {
    throw new Error('Publisher must be the complete Subject read from the actual signing certificate, including CN=; display names and placeholders are not accepted.');
  }
  return subject;
}

export function certificateThumbprint(value) {
  if (value == null || value === '') return undefined;
  const thumbprint = value.replace(/\s/g, '').toUpperCase();
  if (!/^[0-9A-F]{40}$/.test(thumbprint)) throw new Error('SLINGSIP_WINDOWS_CERTIFICATE_SHA1 must be the certificate\'s 40-digit SHA-1 thumbprint.');
  return thumbprint;
}

/** One explicit source: PFX via standard builder variables, or a Windows-store thumbprint. */
export function windowsSigningEnvironment(environment = process.env, { preview = false } = {}) {
  if (preview) return {};
  const certificateSha1 = certificateThumbprint(environment.SLINGSIP_WINDOWS_CERTIFICATE_SHA1);
  const fileSources = ['CSC_LINK', 'WIN_CSC_LINK'].filter(key => environment[key]?.trim());
  const passwordKeys = ['CSC_KEY_PASSWORD', 'WIN_CSC_KEY_PASSWORD'];
  if (certificateSha1) {
    if (fileSources.length || passwordKeys.some(key => environment[key] != null)) {
      throw new Error('Choose certificate-store signing OR PFX signing; clear CSC_LINK/WIN_CSC_LINK and their password variables for store signing.');
    }
  } else {
    if (fileSources.length !== 1) throw new Error('Supply exactly one of CSC_LINK/WIN_CSC_LINK for PFX signing, or SLINGSIP_WINDOWS_CERTIFICATE_SHA1 for Windows certificate-store signing.');
    // Preserve builder's passwordless-PFX support. An encrypted PFX without its
    // password still fails in builder; forceCodeSigning and Authenticode remain mandatory.
    if (fileSources[0] === 'CSC_LINK' && environment.WIN_CSC_KEY_PASSWORD != null) {
      throw new Error('Clear WIN_CSC_KEY_PASSWORD when selecting CSC_LINK to avoid overriding its password.');
    }
  }
  return { publisherName: environment.SLINGSIP_WINDOWS_PUBLISHER, certificateSha1 };
}

/** Public Authenticode projections only; no certificate/key export or custom signing. */
export function validateWindowsSignatures(signatures, publisherName, expectedThumbprint) {
  const publisher = assertPublisherSubject(publisherName);
  const selectedThumbprint = certificateThumbprint(expectedThumbprint);
  if (!Array.isArray(signatures) || signatures.length !== 2) throw new Error('Both application and installer signatures must be verified.');
  for (const signature of signatures) {
    if (signature.Status !== 'Valid') throw new Error(`Authenticode must be Valid for ${signature.Path}; received ${signature.Status}.`);
    if (signature.Subject !== publisher) throw new Error(`Signer Subject does not exactly match the configured publisher for ${signature.Path}.`);
    const actualThumbprint = certificateThumbprint(signature.Thumbprint);
    if (!actualThumbprint || !signature.Issuer) throw new Error('Signer certificate information is incomplete.');
    if (selectedThumbprint && actualThumbprint !== selectedThumbprint) throw new Error('Signer thumbprint does not match the selected Windows-store certificate.');
  }
  if (signatures[0].Thumbprint.toUpperCase() !== signatures[1].Thumbprint.toUpperCase()) {
    throw new Error('Application and installer must use the same signing certificate.');
  }
}
