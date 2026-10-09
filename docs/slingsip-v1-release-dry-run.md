# SlingSip V1 release readiness dry run

Recorded **9 October 2026**, Asia/Calcutta. **NOT READY FOR PUBLIC v1.0.0**: version stamping, signing and signed installed-app acceptance remain pending.

The production build, unpacked Windows application, native lifecycle smoke test and an unsigned NSIS compilation passed. No application feature, UI redesign, production code change, version bump, Git commit/tag, upload, installation or GitHub release was performed.

## Results

| Check | Result |
| --- | --- |
| Canonical version | **0.1.0**, consistent in package.json, both lockfile version fields, packaged package.json, native runtime and UI. V1 must be stamped 1.0.0. |
| Type checking | Passed, npm run typecheck. |
| Angular/Electron production build | Passed, npm run build. |
| Normal unpacked Windows packaging | Passed, update-disabled node scripts/package-windows.mjs --preview. |
| Signed release path | Correctly refused to build with an empty signing publisher. A signed installer was not produced. |
| Unsigned NSIS diagnostic | Passed after the build-tool cache workaround below. Compilation only; installer not executed. |
| Updater/restart regressions | **13 passed, 0 failed, 0 skipped** against this build. |
| Packaged app starts / dashboard opens | Passed using the unchanged packaged executable and an isolated profile. |
| Native tray / close-to-tray / reopen | Passed through the real native tray menu callbacks. |
| Companion / Drank it / bottle | Passed; the fixture's water increased from 600 to 900 ml. |
| Packaged normal restart | Passed: old process exited; one replacement tray/window pair; name, createdAt, onboarding, water, archived history, settings and companion preferences preserved. |
| Full quit | Passed; the replacement main process exited. |
| Production gates | Packaged app ignored test flags and a development renderer URL; file renderer, sandbox and isolation stayed enabled; no Dev tray label or test backend appeared. |
| Packaged-file inspection | Required bundles/dependencies present, matching current build bytes; no user-data/environment/signing files or source maps; no GitHub-token/private-key credential patterns detected. |
| Git exclusions | release/, dist/, .cache/ ignored; no files in those directories tracked. |

Detailed results, artifact hashes and test timestamps: [validation record](slingsip-v1-release-dry-run-validation.json). Native captures: [packaged-app gallery](previews/v1-dry-run/index.html).

## Version and artifacts

The canonical source is package.json.version; Electron exposes app.getVersion() to the existing snapshot/UI. No separate production version string needs editing. Use:

```powershell
npm version 1.0.0 --no-git-tag-version
```

This synchronizes package.json and package-lock.json without creating a tag. It was **not run** during this dry run.

Windows format: **x64, per-user, one-click NSIS installation**, stable app ID com.slingsip.desktop, product **SlingSip**. The reliable update path is an installed NSIS application; the unpacked executable alone is not a distribution package.

Generated locally:

| Path | Purpose |
| --- | --- |
| release/preview/win-unpacked/SlingSip.exe | Unsigned, update-disabled packaged application used for the native smoke test; requires its sibling resources. |
| release/dry-run-unsigned/SlingSip-Setup-0.1.0-x64.exe | Unsigned diagnostic NSIS installer, **NotSigned**; not for public upload. |
| release/dry-run-unsigned/SlingSip-Setup-0.1.0-x64.exe.blockmap | Diagnostic installer blockmap; not for public upload. |

There is **no release/stable/ signed output and no generated latest.yml** in this diagnostic run. Both preview policies deliberately disable updates, with no app-update.yml. Preview and diagnostic installer inputs have byte-identical app.asar archives.

The real signed V1 build must eventually produce these **three GitHub release assets**:

1. release/stable/SlingSip-Setup-1.0.0-x64.exe
2. release/stable/SlingSip-Setup-1.0.0-x64.exe.blockmap
3. release/stable/latest.yml

Those V1 names are expected outputs, **not files produced in this run**. Upload them together after acceptance. Keep the unpacked directory, builder logs/config, internal app-update.yml, policy JSON and signing material out of release uploads.

## Provider, security and persistence

release.config.json is correctly set to public GitHub Releases, owner **ak-ak-k**, repository **slingsip**, stable channel. The [repository is publicly accessible](https://github.com/ak-ak-k/slingsip), and the local origin matches it without a credential in the origin URL.

The real updater uses latest, excludes prereleases/downgrades, and validates the actual packaged feed/publisher against trusted policy. Source/development runs cannot instantiate the real backend; the explicitly opted-in test backend cannot install anything. Packaged test flags also cannot activate that backend. All packaging entry points use publish: 'never'.

GitHub-token format and private-key scans covered **4,783 archive files and 75 external package files**. The NSIS diagnostic uses the same archive. No matches or user-data/environment/signing files were found. The public provider needs no client token; future upload credentials belong only in the maintainer/CI environment.

Normal userData and sessionData remain **%APPDATA%\Mizu**, selected before the instance lock. hydration.json contains water, routine settings and history; user-profile.json contains the profile/onboarding record; companion-preferences.json holds reminder visual/audio preferences. These are outside both app.asar and replaceable installed binaries. History-derived streak behavior and schemas are unchanged.

**Restart SlingSip** persists, cleans up, then calls app.relaunch()/app.exit(). **Restart & Update** independently persists and calls the updater's quitAndInstall(false, true); active reminders block installation. Ordinary quit/restart does not install a downloaded update. Current regressions exercise this separation, reminder guarding and save/failure handling; the packaged smoke actually exercised normal restart.

The normal user's three data-file hashes and Mizu startup entry hash were unchanged by the packaged smoke. Tests used separate fixtures. No Windows startup registration was migrated.

## Packaged smoke method and its limits

The original release/preview/win-unpacked/SlingSip.exe and resources were launched, with **no binary/asar edits**. An external localhost inspector paused execution at the first line and set appData/userData/sessionData to a temporary workspace profile before readiness. It observed native Tray menus without altering their callbacks. UI actions used the production preload and renderer. This uses Electron's [documented main-process inspector](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process).

After normal relaunch, the new process was paused and isolated again before running. The production single-instance lock and lifecycle stayed active. The seeded profile/history/settings survived. The harness then exercised real tray Quit and checked process exit.

This verifies the **unpacked packaged application**, not NSIS installation, Windows shell shortcuts, SmartScreen, signature trust or a real downloaded update. The installer was not run against the normal account. The previous physical native pointer regression remains a documented flaky harness limitation; it was not rerun or relabelled. Prior user-reported manual physical QA is retained in the [Final QA report](slingsip-final-qa-2026-10-08.md).

## Windows build-tool cache finding

Default NSIS preparation failed with **EPERM during an extracted tool directory rename**. A workspace-local cache alone did not fix it. It affected both the 7zip and NSIS toolsets, not SlingSip application code.

The diagnostic succeeded using electron-builder's supported environment overrides and official, checksum-verified tools. The verified local paths are:

```powershell
$v1Tools = Join-Path (Get-Location) '.cache/v1-build-tools'
$env:ELECTRON_BUILDER_7ZIP_PATH = Join-Path $v1Tools '7za.exe'
$env:ELECTRON_BUILDER_NSIS_DIR = Join-Path $v1Tools 'nsis'
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = Join-Path $v1Tools 'nsis-resources'
$env:ELECTRON_BUILDER_CACHE = Join-Path (Get-Location) '.cache/v1-electron-builder'
```

They are build-process-only overrides, not environment configuration embedded in the app. Production signing/provider gates were not weakened. On a fresh machine, provision these same official toolsets or resolve the cache rename issue before building; the ignored .cache tools are not included in a clone.

Verified archive SHA-256 values, pinned by the installed builder:

- 7zip 7zip-win-x64.tar.gz: be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3
- NSIS nsis-3.0.4.1.7z: 9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa
- NSIS resources nsis-resources-3.4.1.7z: 593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103

## Required before public V1

1. Stamp **1.0.0** and rebuild/retest; review and commit the intended updater/release changes. The working tree currently contains uncommitted/untracked updater work. The eventual tag must point to the exact released source.
2. Provision a real Windows signing certificate/private key and its exact public publisher subject. publisherName is currently empty; no signing credentials are configured and no current-user code-signing certificate was found. Do not invent a subject or distribute an unsigned diagnostic.
3. Retain the verified build-tool overrides on this machine, or fix/provision the build-tool cache on a fresh build environment.
4. Build the **signed** NSIS package, verify installer/application signatures and app-update.yml publisher/provider, then validate latest.yml hashes/version/filename.
5. On an isolated Windows user/VM, actually install signed V1 and verify first-run onboarding, profile, reminder actions, tray/background behavior, close/reopen, quit, normal restart, startup preference and existing data preservation. Signed installed-to-higher-version update acceptance remains pending.

The missing package author field produces a builder metadata warning. Fill it with the intended public author identity before public packaging; no identity was invented during this dry run.

## Exact real V1 commands — run later

From the project root, after securing signing credentials and resolving/provisioning the tool paths:

```powershell
npm ci
npm version 1.0.0 --no-git-tag-version
npm run typecheck
npm run build
npx playwright test tests/updater.spec.mjs tests/restart.spec.mjs
```

Run the existing core Final QA checks against the stamped build too; keep the known native pointer result separate. Set the exact certificate subject and provision signing credentials through the trusted build environment:

```powershell
$env:SLINGSIP_WINDOWS_PUBLISHER = '<EXACT FULL CERTIFICATE SUBJECT>'
$env:CSC_LINK = '<SECURE PATH TO THE SIGNING PFX>'
# Provision CSC_KEY_PASSWORD from your local/CI secret store; never commit or print it.
# On this machine, also set the verified tool overrides shown above.
npm run package:win

Get-AuthenticodeSignature -LiteralPath 'release/stable/win-unpacked/SlingSip.exe'
Get-AuthenticodeSignature -LiteralPath 'release/stable/SlingSip-Setup-1.0.0-x64.exe'
Get-Content -LiteralPath 'release/stable/win-unpacked/resources/app-update.yml'
Get-Content -LiteralPath 'release/stable/latest.yml'
```

Both signature statuses must be **Valid** with the intended publisher. Metadata must select the approved public provider and exact publisher; latest.yml must describe 1.0.0 and the signed installer/hash. This build command generates local artifacts only.

After signed installed acceptance, review/commit the release source/version and push that commit. Only with **separate publication authorization**, create/push the tag and upload the three artifacts:

```powershell
# Ensure HEAD is the reviewed, tested release commit before tagging.
git push origin HEAD
git tag -a v1.0.0 -m 'SlingSip 1.0.0'
git push origin v1.0.0

gh release create v1.0.0 `
  'release/stable/SlingSip-Setup-1.0.0-x64.exe' `
  'release/stable/SlingSip-Setup-1.0.0-x64.exe.blockmap' `
  'release/stable/latest.yml' `
  --repo ak-ak-k/slingsip --verify-tag --title 'SlingSip 1.0.0' --generate-notes --draft

# Review the draft and all assets before making the stable release public.
gh release edit v1.0.0 --repo ak-ak-k/slingsip --draft=false --prerelease=false --latest
```

These tag/upload/release commands were **not executed**. GitHub CLI authentication is maintainer-only; no upload token belongs in the distributed application. See the [official release CLI](https://cli.github.com/manual/gh_release_create) and [stable updater documentation](https://www.electron.build/v26/docs/features/auto-update/).
