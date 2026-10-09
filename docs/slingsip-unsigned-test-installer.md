# SlingSip 1.0.0 unsigned test installer

**BUILT — manual installed-app acceptance pending.** Created locally on 9 October 2026 for friends/manual testing. Nothing was installed, uploaded or published by this task.

## Installer and build

- Installer: `release/test-unsigned/SlingSip-Setup-1.0.0-x64.exe`.
- Windows x64 NSIS, per-user, one-click; normal installer and uninstaller.
- Product, shortcut and uninstall labels include **Unsigned Test**. Executable remains `SlingSip.exe`.
- Build command: `npm run package:win:test-unsigned`. Angular/Electron build, NSIS compilation and post-build checks passed.
- Both application and installer returned Authenticode **NotSigned**, with no signer Subject. Windows can show Unknown publisher/SmartScreen for this deliberately unsigned build.
- `README-UNSIGNED-TEST.txt` accompanies the installer; `UNSIGNED-TEST.txt` is also installed under resources.
- Builder generated an isolated `.exe.blockmap`. It is not needed for manual installation. **No latest.yml or other updater channel metadata, and no packaged app-update.yml, were generated.**
- Exact artifact sizes, checksums and verification results are in [slingsip-unsigned-test-installer-validation.json](slingsip-unsigned-test-installer-validation.json) and `release/test-unsigned/unsigned-test-build.json`.

Repeat on this build machine with its already verified tool overrides:

```powershell
$unsignedTestTools = Join-Path (Get-Location) '.cache/v1-build-tools'
$env:ELECTRON_BUILDER_7ZIP_PATH = Join-Path $unsignedTestTools '7za.exe'
$env:ELECTRON_BUILDER_NSIS_DIR = Join-Path $unsignedTestTools 'nsis'
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = Join-Path $unsignedTestTools 'nsis-resources'
$env:ELECTRON_BUILDER_CACHE = Join-Path (Get-Location) '.cache/v1-electron-builder'
npm run package:win:test-unsigned
```

No signing variables are required. This separate command strips CSC/publisher/certificate-selection variables from its own process and explicitly disables signing. Tool paths are build-machine configuration, not packaged resources. A fresh clone must provision the official verified tools or use a functioning default builder cache, as described in [Windows signing onboarding](windows-code-signing.md#build-machine-tools).

## Separation from production

The signed `package:win` command, `scripts/package-windows.mjs`, `scripts/windows-package-config.mjs`, signing verifier and `release.config.json` were left unchanged. Signed release builds still require the actual publisher/certificate, force signing and enforce post-build Authenticode/updater identity verification. `release/stable` was not created or modified.

The new mode uses `scripts/windows-unsigned-test-config.mjs` and `scripts/package-windows-test-unsigned.mjs`:

| Setting | Unsigned test build |
| --- | --- |
| Output | `release/test-unsigned` |
| Build staging | `.cache/slingsip-test-unsigned-packaging` |
| Windows app ID | `com.slingsip.desktop.testunsigned` |
| Packaged name / per-user install folder | `slingsip-desktop-companion-test-unsigned` |
| Product / shortcut label | `SlingSip (Unsigned Test)` |
| Signing | Disabled; no fake certificate/publisher |
| Publishing | `publish: 'never'` and `publish: null` |
| Packaged updater policy | `enabled: false`, `publisherName: ""`, `channel: "test-unsigned"` |
| Real updater backend | Disabled by the existing production availability gate |
| User/session data | Existing normal `%APPDATA%\Mizu` |
| Uninstall data deletion | `deleteAppDataOnUninstall: false` |

The test package name matters: a separate app ID alone would still select the production one-click install folder. Both install identity and folder are separate, using the builder's [standard NSIS configuration](https://www.electron.build/v26/docs/nsis/). This does not isolate saved user data: hydration, history, profile, settings and preferences intentionally remain in the normal directory. The existing single-instance lock remains in force.

No application code, dashboard, onboarding, hydration/scheduler/history/settings logic, startup behavior, tray actions or IPC changed. Normal restart works through the existing lifecycle and does not install updates. The version was already **1.0.0** when this task started; no version/author/lockfile change was made here. Existing user changes and the running preview app were preserved.

## Verification performed

- Type checking passed.
- Production Angular/Electron build passed.
- **11 packaging/signing tests passed**, zero failed/skipped/flaky. Tests use the installed builder schema and real install-directory selection, the existing updater gate, and the normal app-identity helper.
- Actual packaged policy has updates disabled and no publisher. Even an accidentally present feed is rejected by the existing gate in regression coverage.
- Real application/installer Authenticode negative checks passed: both are unsigned as intended.
- Product metadata and packaged version are 1.0.0; labels identify the test distribution.
- Packaged main/preload bytes match the current build. Production signing files, trusted updater implementation/config and pre-existing screenshot changes match the before-task hashes.
- Archive scan checked **4,783 files**: no GitHub credential/private-key pattern matches and no user-data, environment or certificate/key files. No signing credentials are embedded.
- `release/` remains ignored by Git; no installer/build artifact was added to the index.
- No installed-app/physical-pointer pass is claimed here. The prior native pointer harness limitation remains unchanged.

## Manual install checklist

1. Quit the running preview/other SlingSip through **tray → Quit SlingSip** before installing or launching the test build. Closing dashboard X only hides the dashboard. Because both builds share the profile/lock, a running old instance can otherwise receive the new launch.
2. Run the installer. Confirm the installer/shortcut/Installed Apps entry says **SlingSip (Unsigned Test)** and launches the dashboard. Signing warnings identify this unsigned distribution.
3. For fresh onboarding, use a fresh Windows user/VM. Complete setup, enter a name and routine, and confirm the dashboard. Existing users should retain their saved data; do not erase history to replay onboarding. Profile → Replay welcome tour replays only the tour.
4. Record water, view History and Settings, then use **Restart SlingSip**. Confirm the name, water, history and settings remain present, with one tray/owner and one window pair.
5. Wait for a scheduled companion reminder. Confirm swing-in, clickable **Drank it**, immediate hydration update, bottle success and right exit. On another reminder, confirm **Remind me later**, left exit and the later return.
6. Confirm transparent areas pass clicks to applications behind the overlay. Confirm dashboard X leaves the tray active, then use **Open SlingSip** to reopen it.
7. In Settings → About & Updates, confirm updates are unavailable and check/download/install cannot use the production feed.
8. Use **Quit SlingSip** and confirm the test tray/window/process exits. Optionally uninstall the test build and confirm `%APPDATA%\Mizu` remains. If you enabled Windows startup for this build, disable it before removing its executable.

For manual sharing, send the installer and its unsigned-test README through your chosen private channel; this task sends nothing. The blockmap, unpacked folder and build report are not needed to install. Never upload this unsigned installer/blockmap to the signed GitHub stable release channel. Future test builds require manual installation.

