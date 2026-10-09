# SlingSip final QA

Local Windows QA, 7 October 2026. No deployment, installer, release, showcase, updater or product redesign was performed. Normal `%APPDATA%/Mizu` data and startup registration were not modified; native checks used isolated profiles and temporary named Run entries.

Final recommendation and complete-suite results: **NOT READY for demo sign-off: current Windows click-through remains unverified**.

1. **Systems audited.** Angular routing/forms/dashboard, Electron lifecycle and window ownership, contextBridge/IPC, approved PNG renderer, trajectories/web/bottle, hydration, scheduler/retries, persistence/midnight/history/streaks, settings/preferences, tray/background/startup, restart/dev reloads, asset loading, display geometry, input and runtime work. The [pre-fix inventory](slingsip-final-qa-inventory.json) records 148 text files; the [system checklist](slingsip-final-qa-checklist.md) was created before fixes.

2. **Bugs found.** Production accepted development test-counter calls. Normal successful reminder completion also awaited that counter, so simply securing the handler would strand the successful overlay; optional counter errors already had the same effect. Production CSP permitted development-server connections. Missing PNGs had loader diagnostics without a clear development console path. A QA screenshot captured Settings during its existing 300 ms entrance fade. The Windows physical-input regression remained an investigation item.

3. **Bugs fixed.** Both counter operations now reject production callers. Successful completion calls the counter only in development and completes its revision-conditional hide even when optional telemetry fails. Loopback HTTP/WebSocket CSP permissions are confined to the development index. Missing-asset paths log once per distinct failure in Angular development builds. Canonical intake, scheduler, persistence schema, startup identifiers, IPC contract, trajectories and dashboard design were preserved.

4. **Visual issues fixed/reviewed.** The screenshot tool now waits for route content and finite page transitions. No product layout change was needed. Approved artwork remains shared by hero, companion and lab; full-body failure uses an available approved pose or the logo, never another mascot. Missing bottle/head artwork is omitted without changing water feedback. Current screenshots are in the [QA gallery](previews/final-qa/index.html). Existing source images are small and some limbs are cropped at the source; QA does not invent replacement artwork. Responsive evidence covers minimum 760×560 and 1366×768, 1920×1080, 2560×1440. Work-area fixtures cover 100/125/150% scaling, taskbar offsets and negative origins; these are geometry checks, not three physical-monitor trials.

5. **Performance findings.** No motion change was required. A short isolated production run measured zero hidden companion RAF calls, cursor intervals, running animations or mascot nodes. Six successful cycles removed visual owners each time; GC-sampled companion heap rose from about 4.43 to 4.80 MB, which does not establish all-day leak freedom. Approximate aggregate Electron process samples:

   | State | Sample | CPU | Private memory |
   | --- | --- | --- | --- |
   | Hidden, dashboard open | 5 s | 1.42% | 172 MB |
   | Hidden, dashboard closed | 8 s | 0.01% | 109 MB |
   | Hanging idle visible | 5 s | 9.10% | 165 MB |
   | Hidden after six drinks | 8 s | 0.42% | 176 MB |

   Visible software rendering costs more CPU; existing Low power animations and reduced motion remain available. Idle uses browser animation without a JavaScript movement RAF loop; one visible cursor probe is removed on hide. Measurements are short, machine-dependent observations; summed working sets in the [raw performance record](slingsip-final-qa-performance.json) can double-count shared pages. [Electron process metrics](https://www.electronjs.org/docs/latest/api/structures/process-metric) describe the sampled fields. There were no runtime errors, warnings or stderr in this observation run.

6. **Security/IPC findings.** Context isolation, sandboxing, disabled Node integration, role/main-frame/trusted-local-URL validation, blocked external navigation/windows/permissions and main-only storage were retained. Renderers expose no raw `ipcRenderer`, `require`, `fs` or Electron internals. Development counters now reject production as well as development triggers/lab controls. Production CSP has `connect-src 'self'`; development alone permits local Angular HMR. `npm audit --omit=dev --json` reported zero known production dependency vulnerabilities at this checkpoint. This is not an independent penetration test. Configuration was reviewed against [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

7. **Tests run.** **Complete existing suite plus four focused/additional cases: **98 passed, 1 failed, 0 skipped** in 19.4 minutes. The one physical-pointer case failed before native clicks with an input-desktop access denial and failed again on the unchanged targeted retry. All five required hydration flows have passing evidence below**. Type checking passed. Focused tests reproduce the production counter defect before the fix and verify production double-submit/goal suppression/background reopening after it; an optional-telemetry failure test verifies hiding continues. Real tray restart coverage now includes idle and paused sessions in addition to active reminders. Physical pointer assertions are retained, with added requested/actual-position and input-desktop diagnostics. [Machine-readable validation](slingsip-final-qa-validation.json) records exact commands, cases and unresolved failures.

   | Required flow | Evidence | Result |
   | --- | --- | --- |
   | Drink → background reminder → restart saved progress | Native hydration persistence/background-slot tests; production completion test; real idle/active restart tests | PASS |
   | Later → one return → Drank once | Native Later/Ignore test plus main retry timing/reservation/cancellation fixtures | PASS |
   | Pause → no appearance → resume future slot | Main controlled-clock pause/OFF fixture; native Settings/tray test | PASS |
   | 100% → restart completion → no further prompt | Production final-QA native test and goal-cancellation scheduler fixtures | PASS |
   | Live midnight → archive/streak/reset/new schedule | Controlled-clock running HydrationRuntime/scheduler fixtures and deterministic history/streak checks | PASS |

   These rows combine native UI integration and controlled-clock main-process evidence; they do not claim every action occurred in one recording or at real midnight.

8. **Build status.** The complete-suite command rebuilt Angular production output and esbuild Electron main/preload successfully. Local Electron launched that output. The repository has no installer/package release pipeline to verify; no installer was introduced. Updated development CSP/HMR behavior is exercised by the real dev-workflow test. Type checking used the app and Electron tsconfigs.

9. **Known limitations.** **Current physical click-through is unverified: `SetCursorPos` failed and the same helper reported `Input desktop unavailable (Win32 5); thread desktop: Default`. The immediate pre-run read-only probe succeeded, but both native runs could not obtain input-desktop access. This blocks the test and does not establish an application click-through defect; its exact cause remains unresolved**. Physical 125/150% monitor changes, real Windows sign-in, prolonged sleep/lock and an all-day memory soak remain manual checks. Actual ON/OFF registration and quiet `--autostart` launch are separate automated checks, not a real sign-in test. The overlay uses the primary monitor; tiny work areas, secure desktop/UAC and exclusive fullscreen have existing limits. Software rendering trades GPU compatibility for CPU cost. Startup relies on repository/build/executable paths. History is a local JSON archive without retention limits. Pause is session-only and resets normally on restart. No persisted first-close hint feature exists. Tray creation failure is guarded in code and exposes an unavailable status; OS tray failure was not forced during this run. Older Three.js/SVG/WebM/temporary-frame utilities and their offline tests remain historical, disconnected from runtime. `Mizu` remains intentionally in legacy data/session/startup identifiers, isolated test paths and original briefs/reports.

10. **Non-blocking polish ideas.** Supply higher-resolution, uncropped approved PNG frames; choose the existing low-power setting for constrained demo machines; perform a longer unattended memory/CPU observation. These were not implemented as new features.

11. **Before recording the portfolio demo.** ****Blocking sign-off:** rerun the retained native pointer test on an unlocked recording desktop with the physical mouse idle, and verify blank-area pass-through and painted/button clicks. It must pass before the demo is signed off**. Use the manual checklist below on the recording desktop. The approved supplied artwork's quality limits should be visible in the review rather than hidden by a readiness claim.

12. **Recommendation.** **NOT READY for demo sign-off: current Windows click-through remains unverified**. QA does not equate a successful build or a historical pointer pass with verification of current critical desktop interactions.

## Changed files

| Files | Change |
| --- | --- |
| `electron/desktop-ipc.ts` | Production gate for existing development counter channels; API contract retained. |
| `src/app/core/services/desktop.service.ts` | Separate normal successful hiding from optional development telemetry. |
| `src/index.html`, `src/index.development.html`, `angular.json` | Strict production connections and separate development CSP/index. |
| `src/app/features/companion/animation/slingsip-asset-loader.service.ts` | Development-only missing PNG path diagnostics. |
| `tests/final-qa.spec.mjs`, `tests/restart.spec.mjs` | Focused production regression/optional failure; idle/paused real restart coverage. |
| `tests/phase-one.spec.mjs`, `tests/windows-pointer.cs` | Retained physical assertions with cursor/input-desktop diagnostics. |
| `scripts/qa-desktop.mjs` | Isolated performance/cycle observations and settled page captures; `--capture-only` avoids repeating the benchmark. |
| `README.md`, `docs/slingsip-final-qa*`, `docs/previews/final-qa/*` | Inventory, checklist, outcome/evidence and screenshots. |

## Manual checklist for the recording desktop

- Build/run with `npm start`; confirm one tray, one dashboard and one companion owner. Launch again and confirm reuse.
- Record water, close dashboard using X, reopen from tray and verify the same progress. Try Restart while idle and during a reminder; confirm old process exits, one tray remains and water is unchanged by the restart itself.
- Use Drank it twice rapidly: one configured glass, visible bottle/+water, exit right. Later: exit left, one return, then one drink. Pause cancels the pending return; resume selects a future slot. Test persistent reminders OFF separately.
- With an unlocked, idle desktop, click Chrome, VS Code and desktop icons through blank/transparent artwork margins. Click Drank it, Later and painted character normally. Confirm hidden companion never blocks input.
- Review Overview, History and Settings at the recording resolution and actual OS scaling; move the taskbar/display as applicable. Check bubble text, alpha margins, bottle web, hero and logo.
- Complete the goal and restart: 100%, zero remaining and no automatic prompt. Use isolated clock fixtures for midnight; do not modify the real user's archive or system date.
- Toggle Launch with Windows using normal settings only if desired; verify quiet startup at a real sign-in and reopen through the tray. Quit and confirm no owned Electron process remains.

Stop after local review. No publishing was performed.
