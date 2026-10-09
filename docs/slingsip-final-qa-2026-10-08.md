# SlingSip final QA — 8 October 2026

**READY FOR DEMO WITH ONE KNOWN TEST-HARNESS LIMITATION**

User-performed **MANUAL PHYSICAL QA passed** on an unlocked Windows desktop. There is **no confirmed production click-through defect**. The production build, security checks and core flows passed. The automated native pointer regression remains flaky because of Windows cursor/target-ownership interference; its failed results are preserved as a test-harness limitation.

Local Windows QA after onboarding completion. No features, dashboard/onboarding redesign, production source changes or deployment. Native runs used separate temporary profiles and named startup registrations; normal user data and the running user application were left alone.

1. **Systems tested.** All 22 groups in the supplied brief are mapped in the [coverage checklist](slingsip-final-qa-2026-10-08-checklist.md). Coverage includes startup, completed-profile restoration, X/background/reopen, single instance, real tray restart, Drank/double-submit, Later/Ignore/retries, pause/resume, settings/startup, history/streaks/midnight, goal completion, tray/quit, approved companion visuals/assets, work-area positioning, onboarding, development reloads, performance, security and builds. The [validation record](slingsip-final-qa-2026-10-08-validation.json) contains every case's latest result, original failures, hashes and cleanup evidence.

2. **Bugs found.** No confirmed production functional defect was found in this campaign. QA found an existing-user development test booting into fresh-user onboarding, a retry cancellation observation crossing an ordinary daily reminder boundary, and screenshot capture during the intentional 90 ms pose crossfade. The full pointer run also encountered a caller/helper version mismatch after the guarded helper was updated while that run was active.

3. **Bugs fixed.** Existing-user fixtures now seed an absent isolated completed profile through one shared helper. The Later/Ignore test waits for native dashboard visibility and uses the existing settings API to put normal working hours outside the manual retry observation; its geometry, timing, cancellation and intake assertions remain. Persistence/goal fixtures explicitly verify completed profile restoration and frozen 4000/4000 history with a current 2000 goal. Captures wait for finite fades while leaving infinite idle animation running. Every physical Click call now supplies the isolated process PID; the helper verifies cursor position and native window ownership before injection. No assertion was removed or skipped.

4. **Tests passed.** The full existing suite ran once: **108 passed, 3 failed, 0 skipped**, across 111 cases in 21 files, in 28.0 minutes. A focused rerun of those three cases finished with **2 passed, 1 failed, 0 skipped** in 3.0 minutes. Two further physical-test attempts after unlocked-desktop confirmation each finished with **0 passed, 1 failed, 0 skipped** (22.2 s and 20.7 s). Latest unique outcomes remain **110 passed, 1 failed, 0 skipped**. This is a full run plus targeted reruns, not a newly clean full-suite run. The two corrected cases cover real development HMR/main/preload/PNG refresh and native Later/Ignore/cancel/return flows.

   Passing functional evidence includes:
   - Immediate, capped, once-only water intake despite rapid Drank submission; approved happy/bottle/+water display and right exit.
   - Later and Ignore exit left, retain one return reservation, reuse the native window, and cancel unnecessary retries after drinking, pause, OFF, explicit hide or midnight.
   - Actual tray relaunch from idle, active reminder and paused states; old owner exits, saved profile/preferences/water/history restore, onboarding stays completed, and duplicate launches reuse one instance.
   - A normal daily reminder while the dashboard is closed; tray reopening restores canonical state.
   - Saved settings, configured glass sizes, future-only scheduling, temporary pause, persistent OFF and isolated Windows startup ON/OFF registration.
   - Frozen past goals, deduplicated history, incomplete/missing-day streaks, multi-day reopening and controlled running-midnight rollover.
   - Production 100% completion: remaining zero, goal-complete tray, no next normal slot or new prompt, and completion preserved across full relaunch.
   - All eight onboarding cases, including profile creation/completion/restart, replay/reset without erasing water/history, tour dismissal/keyboard/missing targets and current image loading.

   **MANUAL PHYSICAL QA evidence.** The user explicitly reported the following checks passed on an unlocked Windows desktop. This is user-performed manual evidence, recorded separately from automated results; it does not mark the automated regression as passed.

   | Manual check | Result |
   | --- | --- |
   | Transparent overlay regions pass clicks through | PASS — user verified |
   | Chrome and VS Code remain clickable behind the companion | PASS — user verified |
   | Drank it is clickable | PASS — user verified |
   | Remind me later is clickable | PASS — user verified |
   | Dashboard X → tray → reopen works | PASS — user verified |
   | Restart SlingSip preserves profile, settings and water | PASS — user verified |
   | No duplicate tray, window or application process appears | PASS — user verified |

5. **Tests failed.** The remaining case is “Native swing regression: transparent overlay, native hydration clicks, secure IPC, reuse, and recovery” in `tests/phase-one.spec.mjs`. The new first attempt reported expected isolated PID **5880**, target owner PID **19332** at **1603,475**; **no input injected**. PID 19332 was absent at post-run inspection, so its identity has not been established. A read-only probe subsequently found the isolated native window owning that target. The next unchanged regression still failed: during final cursor restoration it requested **1256,725** but observed **1250,754**. Native event diagnostics also show the cursor leaving the bubble target during the case. The restoration failure masks the original caught error; this is not evidence that the remaining assertions passed. These attempts and the probe are recorded in the validation record. Production and physical-test source were unchanged.

   Historical blocked attempt: isolated PID **18900**, native owner **16880 (LockApp.exe)**. Its refusal, the original full-run helper mismatch and all prior results remain recorded. Desktop names and a successful point-in-time probe cannot substitute for successful native-click assertions. No assertion was removed or skipped.

   **Known test-harness limitation:** the automated native pointer regression remains flaky and its latest result is failed. Manual physical click-through passed independently. This does not establish a production click-through defect or a passing result for every assertion in the broader automated regression.

6. **Remaining known issues.** Windows cursor/target-ownership interference remains one documented test-harness limitation. The listed manual physical checks passed; no confirmed production click-through defect or other critical production issue was identified. Physical multi-monitor 125/150% Windows scaling, actual sign-in, prolonged sleep/lock and an all-day memory soak remain additional manual coverage limits. Automated native content sizes/page zoom and DIP geometry do not certify those physical environments. Existing primary-monitor, tiny-work-area, supplied PNG quality, secure desktop/fullscreen and repository-path-dependent startup limits remain.

7. **Build status.** `npm run typecheck` and `npm run build` passed with exit code 0. The build includes Angular production output and esbuild Electron main/preload output. Initial renderer size is 258.21 kB raw / 70.27 kB estimated transfer. No application build error or actionable build warning was found. PowerShell's native-stderr decoration in the saved log wraps esbuild's ordinary successful output. No installer/release pipeline was added.

8. **Security findings.** Native preferences retain `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`. Renderers receive narrow typed preload operations, with no raw IPC, filesystem, require or unrestricted Electron access. Main validates the known native sender, main frame, local URL and role. Navigation/new windows/webviews/permissions are denied; production CSP is strict and production development triggers/counters/lab are rejected. Both `npm audit --omit=dev --json` and the full `npm audit --json` reported **zero known vulnerabilities**; the latter also covers Electron/tooling declared as development dependencies. This is a focused code/runtime review, not a penetration test. The pointer guard uses Microsoft's [WindowFromPoint](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-windowfrompoint), [GetAncestor](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getancestor) and [GetWindowThreadProcessId](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid) to identify the native target before sending input.

9. **Performance findings.** The [isolated observation](slingsip-final-qa-2026-10-08-performance.json) completed six drink cycles with no renderer errors/warnings, an empty stderr log and a clean owned-process exit. Each hidden cycle removed its mascot, browser animation and cursor interval. Hidden samples registered no new RAF callbacks; hanging idle used one browser animation and one cursor interval, with no ongoing JS movement RAF. Source review confirms finite motion cleanup, listener/observer destruction, asset-promise caching and motion updates outside Angular.

   | State | Sample | CPU, summed process metrics | Private memory | Companion heap | New RAF calls |
   | --- | --- | --- | --- | --- | --- |
   | Hidden / dashboard open | 5 s | 2.17% | 173.79 MB | 3.97 MB | 0 |
   | Hidden / dashboard closed | 8 s | 0.064% | 105.08 MB | 4.00 MB | 0 |
   | Visible / hanging idle | 5 s | 13.02% | 169.70 MB | 5.54 MB | 0 |
   | Hidden / after six cycles | 8 s | 0.042% | 177.58 MB | 4.91 MB | 0 |

   Collected heap rose from 4.46 to 4.88 MB between the first and sixth cycles (about 0.42 MB). This short sample verifies owner cleanup; it cannot establish long-term memory stability. Existing Windows software rendering increases visible CPU cost. Existing low-power/reduced-motion behavior is preserved. Shared working sets are included in the JSON and should not be treated as unique physical memory.

10. **Final recommendation: READY FOR DEMO WITH ONE KNOWN TEST-HARNESS LIMITATION.** Production build, security and core flows passed; the user's explicit manual physical QA verifies click-through, clickable reminder actions, background reopening, restart preservation and absence of duplicates on the tested desktop. There is no confirmed production click-through defect. The automated native pointer regression remains flaky and failed in its latest recorded run. Its assertions, failures and counts are retained; manual evidence provides the physical demo sign-off without claiming an automated pass.

**Files changed in this campaign**

| File | Change |
| --- | --- |
| `scripts/qa-desktop.mjs` | Completed-user fixture, separate dated report/screenshot output options, finite-fade capture wait. |
| `tests/helpers/existing-user-electron.mjs` | Reusable seed for absent isolated completed profiles; existing files are preserved. |
| `tests/development-refresh.spec.mjs` | Seed completed isolated profile before the real development supervisor starts. |
| `tests/hydration-interaction.spec.mjs` | Native visibility precondition, isolated manual-retry settings and diagnostic attachment. |
| `tests/hydration-persistence.spec.mjs` | Explicit completed-profile fixtures and byte-preservation assertions during recovery/day restoration. |
| `tests/final-qa.spec.mjs` | Frozen 4000/4000 history/current 2000 goal, completed profile, streak/100%/relaunch assertions. |
| `tests/phase-one.spec.mjs` | Consistent isolated PID for every physical click; existing input assertions retained. |
| `tests/windows-pointer.cs` | Test-only native target/cursor guard before SendInput; no desktop switching. |
| `README.md`, `docs/slingsip-final-qa-2026-10-08*`, `docs/previews/final-qa-2026-10-08/*` | Current checkpoint, inventory, coverage, results, performance and five native screenshots. |

SHA-256 comparison confirms all **153 baselined production source/asset files** under `src/`, `electron/`, `shared/` and `public/` are unchanged. The baseline contains 193 source/tool/asset files total; its extension filter omitted C#, so the C# helper is explicitly recorded as changed without inventing an original hash. Package/dependency identities were not changed.

The [marker inventory](slingsip-final-qa-2026-10-08-inventory.json) covers 168 text files / 220 matches. Matches are classified as gated development/test tooling, historical offline graphics, HTML input placeholders and intentional `Mizu` data/session/startup compatibility identifiers. Historical Three/SVG/WebM/temporary assets remain disconnected from active companion/dashboard/lab views. No active old mascot, new production debug UI or unguarded production development request was found. Original briefs and [7 October QA](slingsip-final-qa.md) remain historical material.

**Local screenshots and additional manual coverage**

The [native gallery](previews/final-qa-2026-10-08/index.html) contains Overview, History, Settings, settled reminder and successful bottle delivery. Transparency is retained in the overlay PNGs. Native/layout tests cover compact 760 px content, 1366/1920/2560 widths, 125/150% page zoom, all three DIP scale fixtures, taskbar offsets and negative origins; screenshots here use the observed primary display at 1920×1080 / 100%.

- The manual physical checks listed above are complete according to the user. The retained `tests/phase-one.spec.mjs` regression remains open as a test-harness limitation; resolving its interference is separate from this qualified demo sign-off.
- Use actual Windows 100/125/150% scaling and the intended recording monitor(s); review dashboard/tour usability, work-area placement, web hand attachment, bubble and bottle clipping.
- For additional physical coverage, review rapid double Drank, left Later/Ignore, pending retry cancellation and right success exit; existing automated core-flow coverage passed.
- Verify quiet startup at a real sign-in and reconciliation after prolonged sleep/unlock. Quit the isolated test application and confirm no owned process remains.

Cleanup after the earlier physical attempts and read-only probe found **zero isolated Electron processes and zero isolated Mizu-Test startup entries**; the user's pre-existing application remained running. This manual sign-off update changes documentation and validation records only. No automated test was rerun, no failed result was relabeled as passed, and production/test source is unchanged. Local work stops here. Nothing was deployed or published.
