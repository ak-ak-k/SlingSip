# SlingSip 1.0.0 public unsigned Windows build

**BUILT LOCALLY; installer launch verified. Nothing published.** Verified on 9 October 2026. A full installation and installed-app acceptance pass remain manual.

## Build and artifacts

```powershell
npm run package:win:public-unsigned
```

- Installer: `release/public-unsigned/SlingSip-Setup-1.0.0-x64.exe`.
- Size: **111,772,527 bytes (106.59 MiB)**.
- SHA-256: `33e65b9cb439ca0ab97a89b6f3f62718f8a581ea9fdf3143c03d54ff82027443`.
- Windows x64 NSIS, standard assisted setup wizard, per-user selected by default.
- Product/executable/shortcut: **SlingSip** / `SlingSip.exe` / **SlingSip**.
- Uninstall display name: **SlingSip 1.0.0**. App ID: `com.slingsip.desktop`; package identity: `slingsip-desktop-companion`.
- Same SlingSip logo/icon as the existing build. No new artwork or UI redesign. The disabled-update message now says **Updates are unavailable in this build.**, removing the misleading preview label without changing updater logic.

The installer is deliberately unsigned. Windows may display Unknown Publisher / SmartScreen. No signing certificate or publisher identity was invented. The included [release notes](slingsip-public-unsigned-release-notes.txt) direct users to **https://github.com/ak-ak-k/slingsip** and explain manual updates.

The only required future GitHub Release asset is **`SlingSip-Setup-1.0.0-x64.exe`** from the directory above. Optionally upload the accompanying `README-UNSIGNED.txt` and `SHA256SUMS.txt`. Do not upload `win-unpacked/` or `public-unsigned-build.json`; they are local review material. No release, tag, upload or publication was performed.

For this machine's existing verified builder-tool cache, use these process-only overrides if needed before the build command:

```powershell
$publicUnsignedTools = Join-Path (Get-Location) '.cache/v1-build-tools'
$env:ELECTRON_BUILDER_7ZIP_PATH = Join-Path $publicUnsignedTools '7za.exe'
$env:ELECTRON_BUILDER_NSIS_DIR = Join-Path $publicUnsignedTools 'nsis'
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = Join-Path $publicUnsignedTools 'nsis-resources'
$env:ELECTRON_BUILDER_CACHE = Join-Path (Get-Location) '.cache/v1-electron-builder'
npm run package:win:public-unsigned
```

A fresh machine needs functioning official builder tools; see [build-machine tools](windows-code-signing.md#build-machine-tools). The public unsigned command does not need signing setup.

## Isolation and persistence

`scripts/windows-public-unsigned-config.mjs` and `scripts/package-windows-public-unsigned.mjs` provide a separate explicit packaging mode. Package and both lockfile versions must equal **1.0.0**. Output and staging are separate from signed/test builds. Signing inputs are removed from this build process, signing is disabled, and publishing is `never`.

The packaged policy is `enabled: false`, `channel: public-unsigned`, `distribution: unsigned-public`, with an empty publisher. The existing main-process updater gate rejects it even if an update feed is accidentally present. No `latest.yml`, other updater channel YAML, `.blockmap` or packaged `app-update.yml` was generated. Future versions of this unsigned distribution require manual download/install. Normal **Restart SlingSip** remains independent of update installation.

The canonical app ID is retained so the final public installer uses the normal identity, including the builder's normal NSIS GUID and existing-install-location discovery. A new per-user installation uses `%LOCALAPPDATA%\Programs\SlingSip`; an existing installation with the same identity retains its recorded location. These are the builder's [standard NSIS behaviors](https://www.electron.build/v26/docs/nsis/).

Application/session data remain in **`%APPDATA%\Mizu`**, the existing compatibility location selected before Electron readiness and single-instance locking. The installer keeps `deleteAppDataOnUninstall: false`. No data/registry/schema migration was introduced. Onboarding, profile, hydration, history, settings, scheduler, tray, startup, restart, companion and close-to-tray code are unchanged.

The previously installed **Unsigned Test** build has a separate installer identity/shortcut but shares normal user data and the single-instance lock. Quit it through its tray before launching the final build. Its old shortcut/uninstall entry is not renamed automatically; remove that earlier installation manually if desired. Disable its startup entry before removing its executable, then enable startup from the final app if wanted. The final installer and its application payload contain no **Unsigned Test** labels.

The signed `package:win` command, configuration, signing checks, trusted updater policy/conditions and `release.config.json` were left unchanged. They still enforce genuine signing credentials, the configured publisher and Authenticode verification. Only the disabled-status sentence in the updater backend changed. No signed stable artifacts were generated.

## Verification

- Type checking and production Angular/Electron builds passed.
- NSIS compilation and all post-build package assertions passed.
- **17 packaging/signing/updater gate tests passed**, zero failed/skipped/flaky, including five new public-mode tests, the existing unsigned-test/signing regressions and the existing trusted-feed regression. No screenshot-writing tests were rerun.
- Package/lockfile/app metadata version is **1.0.0**. Native product metadata says **SlingSip**. Final payload scan found no test distribution labels.
- Application and installer Authenticode results are **NotSigned**, with no signer Subject.
- Scans of 4,783 archive files plus the external unpacked payload found no GitHub token/private-key patterns or environment/certificate/key files. Main/preload bytes match the current build. These are file/pattern checks, not a claim to identify arbitrary unknown secret formats.
- Installer opened as **SlingSip Setup**, with **SlingSip 1.0.0** and standard installation options. Native Win32 inspection verified its first screen, then Cancel was selected before installation. Exit code 1 is expected for cancellation. Existing app processes remained running.
- An initial UI Automation attempt could not discover the intentionally hidden setup window and timed out; native window inspection resolved this harness issue. This was not an installer launch failure. No installation or full installed-app flow is claimed.
- Signed packaging files, prior test packaging files, lockfile and other production source match their before-task hashes. The sole production change is the disabled-update sentence, verified by restoring that sentence in memory and matching the original file hash. The `release/` directory remains Git-ignored.
- Earlier manual physical click-through QA remains applicable background evidence. The known automated native pointer regression limitation was not rerun or marked passed.

Exact checksums and validation outcomes: [validation record](slingsip-public-unsigned-v1-validation.json). Local build diagnostics are in `release/public-unsigned/public-unsigned-build.json`; native launch evidence is in `.cache/public-unsigned-installer-launch.json`.

## Manual installed-app checklist

1. Quit all running SlingSip variants through their tray menus. Install the final EXE and confirm the shortcut and Installed Apps entry use the normal SlingSip name/icon.
2. Open the app. Existing users should retain name, member-since, water, history and settings. For fresh onboarding, use a fresh Windows user/VM; do not erase history to rehearse setup. Profile replay/reset actions retain existing hydration data.
3. Record water, inspect History/Settings, then **Restart SlingSip**. Confirm saved values return with only one tray/owner and one window pair.
4. Wait for a scheduled reminder. Check swing-in, **Drank it**, immediate water credit, bottle success and right exit. On another reminder, check **Remind me later**, left exit and the reserved return.
5. Check transparent click-through and reminder buttons, dashboard X to tray, tray **Open SlingSip**, and full **Quit SlingSip**.
6. Confirm About & Updates reports updates unavailable and cannot check/download/install from the signed release feed. Future unsigned releases are installed manually.
7. If using Windows startup, select it from the final installation and verify the next login. Optionally uninstall and confirm `%APPDATA%\Mizu` is retained.
