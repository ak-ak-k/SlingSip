# Windows code-signing onboarding

Maintainer guide — 9 October 2026. **Preparation complete; signed V1 acceptance is pending.**
Canonical version remains **0.1.0**. No certificate identity has been selected, no credentials created, no signing attempted, no tag/release/upload performed. Do not distribute the existing unsigned diagnostic installer.

## Signing path and publisher trust

`npm run package:win` builds Angular/Electron, then `scripts/package-windows.mjs` invokes electron-builder **26.15.3**, x64 NSIS, with `publish: 'never'`. Release configuration stays public GitHub **ak-ak-k/slingsip**, stable/latest.

- `release.config.json.publisherName` remains deliberately empty. Supply `SLINGSIP_WINDOWS_PUBLISHER` from the actual certificate's **complete Subject**, not a guessed personal name or just its common name. The environment takes precedence; the public subject may alternatively be reviewed into that JSON field.
- Release builds require this identity and one explicit certificate source. `forceCodeSigning: true` and `win.signExecutable: true` remain mandatory.
- The corrected v26 setting is **`win.signtoolOptions.publisherName`**. Previously the project used `win.publisherName`, which is outside the installed v26 schema. The unsigned dry run could not expose that release-only configuration defect because it intentionally had no publisher.
- Store selection supplies `win.signtoolOptions.certificateSha1` and `certificateSubjectName` together. The latter is the same full publisher subject; the thumbprint selects one certificate.
- Builder creates `resources/app-update.yml` from that signer setting. The separate public `slingsip-update-policy.json` uses the same identity. After signing, packaging automatically checks both executable signatures and these generated resources; a mismatch fails packaging.
- No custom signer, custom updater verifier, signing bypass or private values in packaged configuration. Unsigned `package:dir` previews explicitly disable executable signing and updates, even if signing variables happen to be present.

The installed updater checks the public policy/feed and uses electron-updater's Authenticode publisher verification. A failed publisher/signature verification rejects the download instead of making it installable. Missing/mismatched publisher metadata disables the backend. **Restart SlingSip** still uses the existing normal restart service; **Restart & Update** still uses the updater's explicit install handoff. Application source/development runs cannot consume production releases.

This prepares the supported v26 configuration, not proof that a particular vendor token will work. Consult [v26 signing options](https://www.electron.build/v26/docs/api/app-builder-lib.interface.windowssigntoolconfiguration/) and [v26 signing environment variables](https://www.electron.build/v26/docs/features/code-signing/). Keep this project's pinned API; unversioned v27 documentation uses a different schema.

## Choose one certificate source

Run these instructions only after obtaining the real certificate. Do not export a hardware private key into a PFX simply to follow option A.

| Variable | PFX/file | Windows store / hardware |
| --- | --- | --- |
| `SLINGSIP_WINDOWS_PUBLISHER` | Complete Subject read from PFX | Complete Subject read from selected store certificate |
| `CSC_LINK` | Secure local PFX/P12 path outside the repository | Unset |
| `CSC_KEY_PASSWORD` | Password supplied through secret store or secure prompt | Unset |
| `SLINGSIP_WINDOWS_CERTIFICATE_SHA1` | Unset | Actual certificate's 40-digit thumbprint |
| `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` | Supported builder aliases; use one matching pair, not two file sources | Unset |

The certificate thumbprint is a public certificate identifier, not the signature digest algorithm. PFX passwords and base64 PFX values are secrets. The wrapper never serializes file paths/passwords from CSC variables into its public policy or builder config. Builder reads credentials directly from its process environment.

### A. PFX / certificate file

Use a PFX/P12 that the issuer permits and that contains the code-signing certificate/private key. Keep it outside the workspace. Read public identity without importing/exporting a key:

```powershell
foreach ($signingVariable in @('WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD', 'SLINGSIP_WINDOWS_CERTIFICATE_SHA1')) {
    Remove-Item -LiteralPath "Env:$signingVariable" -ErrorAction SilentlyContinue
}
$signingFile = (Resolve-Path -LiteralPath (Read-Host 'Absolute path to the real signing PFX/P12')).Path
$signingPassword = Read-Host 'PFX password' -AsSecureString
try {
    $signingData = Get-PfxData -FilePath $signingFile -Password $signingPassword
    $signingLeaves = @($signingData.EndEntityCertificates)
    if ($signingLeaves.Count -ne 1) { throw 'Identify the intended code-signing leaf certificate before proceeding.' }
    $signingLeaves[0] | Select-Object Subject, Issuer, Thumbprint, NotAfter

    $env:SLINGSIP_WINDOWS_PUBLISHER = $signingLeaves[0].Subject
    $env:CSC_LINK = $signingFile
    # Required by builder; plaintext exists only in this build process environment.
    $env:CSC_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $signingPassword).Password
} finally {
    $signingPassword.Dispose()
    Remove-Variable signingPassword, signingData, signingLeaves -ErrorAction SilentlyContinue
}
```

Never print the resulting environment or place a password inline in shell history. For CI, inject the same values from the CI secret store. A missing/empty password is compatible only with a genuinely passwordless PFX; encrypted certificates fail signing without the correct password. Signature requirements remain identical.

Microsoft documents [Get-PfxData](https://learn.microsoft.com/en-us/powershell/module/pki/get-pfxdata?view=windowsserver2025-ps); only the selected public fields above should be captured.

### B. Windows certificate store / hardware token

Install the issuer's supported middleware/CSP/KSP and make the real certificate and accessible signing key available to the Windows build account. Connect/unlock the token as its vendor requires. Inspect public certificates:

```powershell
foreach ($signingVariable in @('CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD')) {
    Remove-Item -LiteralPath "Env:$signingVariable" -ErrorAction SilentlyContinue
}
Get-ChildItem -Path Cert:\CurrentUser\My,Cert:\LocalMachine\My -CodeSigningCert |
    Select-Object Subject, Issuer, Thumbprint, HasPrivateKey, NotAfter

$signingThumbprint = (Read-Host 'Thumbprint of the actual signing certificate').Replace(' ', '').ToUpperInvariant()
$signingCandidates = @(Get-ChildItem -Path Cert:\CurrentUser\My,Cert:\LocalMachine\My -CodeSigningCert |
    Where-Object { $_.Thumbprint -eq $signingThumbprint })
if ($signingCandidates.Count -ne 1) { throw 'Select one unambiguous certificate/store entry.' }
$signingCandidates[0] | Select-Object Subject, Issuer, Thumbprint, HasPrivateKey, NotAfter
$env:SLINGSIP_WINDOWS_PUBLISHER = $signingCandidates[0].Subject
$env:SLINGSIP_WINDOWS_CERTIFICATE_SHA1 = $signingCandidates[0].Thumbprint
Remove-Variable signingCandidates, signingThumbprint
```

Clear CSC_LINK, CSC_KEY_PASSWORD and WIN_CSC aliases before using this option. The wrapper rejects mixed sources rather than silently selecting a different key. Builder uses its built-in SignTool store lookup, including current-user/local-machine store detection; no custom signing callback. The selected full subject also constrains that lookup.

Hardware support depends on the vendor exposing a key usable by SignTool to the build account. PIN prompts, device access, provider compatibility, permission and unattended signing must be validated with the real device. A non-exportable key without a compatible Windows provider is not proven compatible. This preparation does not implement Azure/cloud signing or claim arbitrary HSM support. See [Windows signing in v26](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/).

## Public author metadata — still to fill

The intended public author name is unknown. **package.json currently has no author field.** The explicit placeholder is:

```json
"author": {
  "name": "<YOUR INTENDED PUBLIC AUTHOR NAME>",
  "url": "https://github.com/ak-ak-k"
}
```

Replace the placeholder in `package.json.author.name`, or choose a reviewed public handle, before public packaging; synchronize the lockfile with npm. Never use the code-signing subject as a guessed author/company. README's Author section also remains to fill. No invented author value has been written to package metadata.

After filling the real public author field, run `npm install --package-lock-only --ignore-scripts` and review package/lockfile changes before the release build.

## Build and verify — future execution only

Obtain the certificate, read its exact Subject, choose one environment setup above, fill author metadata, and obtain authorization for the actual V1 stamp. Then run from the project root:

```powershell
try {
    npm version 1.0.0 --no-git-tag-version
    if ($LASTEXITCODE -ne 0) { throw 'Version stamp failed' }
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Type checking failed' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    npx playwright test tests/updater.spec.mjs tests/restart.spec.mjs tests/windows-signing.spec.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Release regressions failed' }

    # Apply the verified build-tool overrides below on the affected build machine.
    npm run package:win
    if ($LASTEXITCODE -ne 0) { throw 'Signing/packaging/verification failed' }
    node scripts/verify-windows-release.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Release acceptance failed' }
} finally {
    foreach ($signingVariable in @('CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD',
        'SLINGSIP_WINDOWS_PUBLISHER', 'SLINGSIP_WINDOWS_CERTIFICATE_SHA1')) {
        Remove-Item -LiteralPath "Env:$signingVariable" -ErrorAction SilentlyContinue
    }
    Remove-Variable signingFile -ErrorAction SilentlyContinue
}
```

Keep this build session private and close it after cleanup. Clear credentials in this same manner if aborting before entering the build block. Do not use machine-wide environment variables or `setx`. The explicit verifier can later use a reviewed public `release.config.json.publisherName` after the environment has been cleared.

The verifier uses Windows [Get-AuthenticodeSignature](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-authenticodesignature?view=powershell-7.5) with literal paths. It runs fixed inline PowerShell with paths passed as data, no shell interpolation or execution-policy changes, strips CSC credentials from that child, and projects only **Subject, Issuer, Thumbprint, Status, StatusMessage, Path**. It requires **Status = Valid** for both artifacts, exact Subject equality, the same signing certificate, and the configured store thumbprint when present. It then verifies the packaged updater policy/YAML against that identity. It never outputs private-key material.

After stamping, these paths are verified:

- `release/stable/win-unpacked/SlingSip.exe`
- `release/stable/SlingSip-Setup-1.0.0-x64.exe`

The standalone command uses the canonical package version automatically; it does not assume 1.0.0 while this repository remains 0.1.0. Optional public-only capture during the authorized build: `node scripts/verify-windows-release.mjs > .cache/windows-signature-verification.json`, followed by checking `$LASTEXITCODE`.

## Build-machine tools

The dry run found EPERM during builder tool-cache renames. Preserve these supported, machine-local overrides when needed; do not put them in package resources:

```powershell
$v1Tools = Join-Path (Get-Location) '.cache/v1-build-tools'
$env:ELECTRON_BUILDER_7ZIP_PATH = Join-Path $v1Tools '7za.exe'
$env:ELECTRON_BUILDER_NSIS_DIR = Join-Path $v1Tools 'nsis'
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = Join-Path $v1Tools 'nsis-resources'
$env:ELECTRON_BUILDER_CACHE = Join-Path (Get-Location) '.cache/v1-electron-builder'
```

These ignored tools are not present in a fresh clone. Provision the official pinned electron-builder-binaries tools and verify archive hashes, or repair the cache before building. Verified SHA-256:

| Tool archive | SHA-256 |
| --- | --- |
| `7zip-win-x64.tar.gz` | `be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3` |
| `nsis-3.0.4.1.7z` | `9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa` |
| `nsis-resources-3.4.1.7z` | `593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103` |

The [dry-run report](slingsip-v1-release-dry-run.md) retains the original evidence. No dependency upgrade or tool-path embedding was made here.

## Never commit

No tracked PFX/P12/PEM/key/CER/CRT files were found before changing ignore rules; there are no intentional public certificate fixtures needing an exception. .gitignore now covers these extensions, `signing/`, `certificates/`, `secrets/`, `.env`/`.env.*` and the existing build/release directories. If a future public trust fixture is deliberately required, review a narrow path exception; never exempt signing bundles/private keys. Ignore rules are not protection against `git add -f` or a secret already tracked.

Never commit passwords, token PINs, private keys, certificate bundles, base64 credentials, environment dumps or GitHub upload tokens. Public Subject/Issuer/Thumbprint and provider identity are safe release metadata. Avoid verbose signing logs that may contain sensitive tool arguments.

## After valid signatures — future release only

1. Inspect `latest.yml`: version **1.0.0**, exact installer filename and SHA-512/size match the final signed installer. Inspect the blockmap and retain signature evidence.
2. Install on an isolated Windows user/VM. Check onboarding/profile, data/history/settings preservation, reminders/Drank it/bottle/Later, one tray/owner, X-to-tray/reopen, normal restart, startup preference and full quit. Normal storage remains `%APPDATA%\Mizu` outside replaceable binaries.
3. Validate a real installed-to-higher-version signed update and a rejected invalid/untrusted publisher update on an isolated fixture/feed. That acceptance requires real compatible assets and remains pending. Do not publish a V2 or artificial public test release.
4. Review and commit the exact intended release source. Only after authorization create/push the reviewed tag and a draft:

```powershell
git tag v1.0.0
git push origin v1.0.0
gh release create v1.0.0 'release/stable/SlingSip-Setup-1.0.0-x64.exe' `
  'release/stable/SlingSip-Setup-1.0.0-x64.exe.blockmap' `
  'release/stable/latest.yml' `
  --repo ak-ak-k/slingsip --verify-tag --title 'SlingSip 1.0.0' --generate-notes --draft
# Review the draft, its source tag, signatures and all three assets before publication.
gh release edit v1.0.0 --repo ak-ak-k/slingsip --draft=false --prerelease=false --latest
```

Only the signed **installer**, matching **.exe.blockmap** and **latest.yml** are eventual update uploads. Do not upload win-unpacked, certificates, source maps, caches or the unsigned diagnostic. GitHub CLI authentication belongs to the maintainer, never the app. See [official release CLI](https://cli.github.com/manual/gh_release_create).

## Current blockers

Real certificate/full Subject, key/provider access, public author metadata, authorized 1.0.0 stamp, trusted signature/timestamp acceptance, isolated signed install and real update acceptance remain pending. Build-tool cache provisioning remains machine-specific. The known native Windows pointer regression remains a separate flaky test-harness limitation; no new claim of its passing is made.

Preparation verification is recorded separately in [windows-code-signing-validation.json](windows-code-signing-validation.json). Hydration, onboarding, UI, animation, storage schemas and restart/updater application behavior were not changed.
