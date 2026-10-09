# Final QA inventory and checklist

Created before production fixes. Scope: existing features only; no redesign, backend, showcase, deployment, updater or installer. The source inventory records 148 source, template, style, script and test files with hashes, imports, exports and development markers. Generated geometry/frame manifests are data; historical renderers are distinguished from the active PNG path.

| System / brief sections | Implementation | Checks and evidence to collect |
| --- | --- | --- |
| Angular startup/routing (A, B, Y) | `app.config.ts`, `app.routes.ts`, DesktopService, hash routing, role guards | Native dashboard/overlay initialization, revisioned snapshots, route restrictions, no runtime errors. |
| Electron lifecycle (B–E, T, U) | main, DesktopWindows, tray, identity, WindowsStartup | One owner; quiet autostart; close/reopen dashboard; one tray/window pair; clean Quit; startup ON/OFF on isolated Run entry. |
| Restart/development (E, AE) | RestartController, dev supervisor, build scripts | Persist-before-cleanup, idle/active/paused restart, old process exits, same profile restores, no stale child; HMR, asset refresh and compile failure. |
| Hydration (F, G, S) | HydrationSession, HydrationRuntime, HydrationService | Defaults, cap, exact one-glass double-submit, tray/dashboard canonical intake, goal completion. |
| Scheduling/retry (F, H–K) | ReminderScheduler, main retry, renderer interaction | Eight start-inclusive/end-exclusive slots, future selection, one timer/reservation, Later/Ignore return, pause/OFF/drink/midnight/quit cancellation. |
| Storage/reset/history/streak (M–Q) | HydrationStorage, preference storage, shared history/date rules | Missing/corrupt normalization; 750 ml quit/reopen; frozen goals; midnight while running; missing-day streaks; no duplicate dates. |
| Settings (L) | Settings and preference forms; main validation/startup synchronization | Invalid values, Save semantics, live 2400/300 update, no intake loss, correct labels, Windows preference remains. |
| Mascot/assets/animation (V–X) | approved PNG loader, shared static artwork, PNG renderer, motion driver, web/bottle choreography | All URLs; one identity; neutral logo fallback; no broken images; all current variants/states; measured hand sockets; no old mascot runtime. |
| Visual/display/input (Y–AA) | shared theme, grid/sidebar, work-area layout, input service | Overview/History/Settings; minimum width; 1366/1920/2560; 100/125/150% geometry; taskbar/negative-origin; bubble/painted clicks and transparent pass-through. |
| Performance/background (AB) | finite outside-Angular RAF, paused browser idle, input probe, main clock recheck | Hidden zero motion/probe work; dashboard closed scheduling; repeated cycles/listener cleanup; practical CPU/RAM samples, no unbounded trend. |
| Errors/security/leftovers (AC–AF) | storage/error paths, narrow contextBridge, sender/role/frame checks, CSP | Asset/store/tray failure; no raw Node/IPC; dev controls and test counters blocked in production; no repeated normal-flow errors; classify legacy/offline references. |
| Existing suite/build (AG, AH) | Playwright, typecheck, Angular/esbuild | Complete existing suite plus focused regressions for confirmed defects. Built local Angular/Electron output only; no packaging/release identity exists. |
| Five required final flows (AI–AM) | native renderer/main integration and deterministic main clock fixtures | Drink/background/restart; Later/return/drink; pause/no-show/resume; goal/restart/suppression; new-day archive/reset/schedule. Each needs explicit evidence before a readiness recommendation. |

Initial issues to investigate, not yet treated as fixed:

- Production completion calls a test-counter API; the related IPC handlers are not development-gated. Gating must not interrupt normal completion/hiding.
- Native Windows pointer test previously failed with OS-helper errors and cursor movement; retain real pointer assertions and isolate environment interference.
- Quiet-autostart tray reopening had a transient timeout in the preceding full run; inspect first-paint/window creation and run it again.
- Missing PNG diagnostics are retained in loader signals but do not currently log a clear development asset path.
- Main window startup/shutdown, renderer timer cancellation and repeated-cycle memory behavior need targeted review beyond a startup screenshot.

Status and the final checklist outcomes will be recorded in `slingsip-final-qa.md` and `slingsip-final-qa-validation.json` after testing/fixes. This inventory is the pre-fix checkpoint, not a readiness claim.

## Final outcomes

The initial inventory above is preserved. Final verification ran all 99 tests: 98 passed and the physical Windows pointer case failed; its unchanged targeted retry also failed with input-desktop access denied (Win32 5). Type checking and local production builds passed. All five hydration acceptance flows have passing native/controlled-clock evidence. The critical current click-through check remains unverified, so the recommendation is **NOT READY** for demo sign-off.

| Checklist group | Outcome |
| --- | --- |
| Startup, single-instance, close/reopen, Quit | Native checks passed; owned QA processes closed. |
| Restart and development | Idle/active/paused real restarts and HMR/main/preload/asset refresh checks passed. |
| Hydration, settings, scheduling, retry | Canonical intake/clamp/rapid double-submit, saved settings, Later/Ignore and cancellation checks passed. |
| Storage, midnight, history, streak | Native storage recovery/restore and running controlled-clock rollover checks passed. |
| Tray and startup | Dynamic canonical tray actions, real isolated ON/OFF registration and quiet autostart passed; OS tray-failure injection and real sign-in remain manual. |
| Mascot, assets, motion and visual layout | Approved PNG/fallback, web/bottle, layout and scaling-geometry checks passed. Fresh settled captures reviewed; supplied image resolution/crops remain limitations. |
| Click-through | BLOCKED verification: pointer helper cannot access the input desktop in current native runs; assertions retained. |
| Performance | Short six-cycle observation passed; hidden RAF/probe/animation counts zero. Longer soak remains manual. |
| Security and development leftovers | Counter/CSP fixes passed regression tests; raw APIs unavailable; retained historical assets/identifiers classified. Production dependency audit reported zero known vulnerabilities. |
| Build and packaging | Angular/esbuild local production outputs passed. No installer pipeline exists; none was added. |

See [final report](slingsip-final-qa.md), [exact validation results](slingsip-final-qa-validation.json), [performance record](slingsip-final-qa-performance.json) and [screenshots](previews/final-qa/index.html).
