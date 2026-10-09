# SlingSip final QA coverage — 8 October 2026

Scope: existing application functionality after onboarding completion; no product features, redesign, deployment or publishing. Final outcomes are recorded in the [current report](slingsip-final-qa-2026-10-08.md) and [validation record](slingsip-final-qa-2026-10-08-validation.json).

Recommendation: **READY FOR DEMO WITH ONE KNOWN TEST-HARNESS LIMITATION**. Automated outcomes remain **110 unique cases passed, 1 failed, 0 skipped**. The native pointer regression remains flaky due to Windows cursor/target-ownership interference; its failed results are preserved. Separately, the user reports **MANUAL PHYSICAL QA passed** for transparent pass-through, Chrome/VS Code behind the companion, Drank it, Later, dashboard X/tray/reopen, restart preservation and absence of duplicates. There is no confirmed production click-through defect. Production builds, security checks and core flows passed.

| Brief section | System | Evidence |
| --- | --- | --- |
| 1 | Startup | Native branding, onboarding, Phase 1/6 and restart tests; source review of lock-before-initialization and one scheduler/tray owner. |
| 2 | Dashboard X/background/reopen | Native daily-slot background test, production acceptance case, Phase 6 tray reopening; canonical state survives view destruction. |
| 3 | Restart | Actual production tray restart from idle, active reminder and paused states, restoring profile/data/settings/startup. |
| 4 | Single instance | Native second launch with the same profile exits and reuses one dashboard/companion pair; main lock and tray construction reviewed. |
| 5 | Drank it | Production rapid double submission, secure revisioned intake, approved happy/bottle states, immediate credit and right exit. |
| 6 | Later | Native left exit/one return and controlled-clock retry timing, replacement, reservation and drink cancellation. |
| 7 | Ignore | Native disappointed pose, left exit, one retry, later drink and explicit cancellation. |
| 8 | Pause/resume | Native settings/tray and controlled-clock scheduler: pending return cancelled, data preserved, resume chooses future slots. |
| 9 | Settings | Native goal/glass/hours/retry/enabled controls, validation, persistence and isolated Windows Run-entry ON/OFF checks. |
| 10 | History | Native seeded 4000/4000 archive with current 2000 goal; migration/duplicate prevention and frozen-goal fixtures. |
| 11 | Streaks | Current/best, missing/incomplete days, in-progress today and multi-day closed-app restoration fixtures; native completed-day restart. |
| 12 | Daily reset/midnight | Running controlled-clock scheduler/runtime rollovers; native yesterday restoration preserves profile bytes and completion. System time is not changed. |
| 13 | Goal complete | Production UI 100%, capped intake, no next slot, goal-complete tray, full relaunch and no further normal prompt. |
| 14 | Tray | Native Open/drink/pause/resume/progress/next/settings/restart/quit actions and live snapshot-driven labels. |
| 15 | Quit | Native tray Quit/old-owner exits; cleanup source and fake-clock zero-timer assertions. |
| 16 | Companion visuals/input | Approved PNG source hashes/alpha, current fallback, bounded hand webs/bottle, exits and hidden cleanup passed. User-performed manual physical click-through/actions passed; automated Windows pointer regression remains a documented flaky harness limitation. |
| 17 | Displays/scaling | Native 760/1366/1920/2560 content sizes and 125/150% page zoom; 100/125/150% DIP/work-area geometry, taskbar offsets and negative origins. Physical multi-monitor certification remains manual. |
| 18 | Performance | Finite RAF/idle/probe/observer ownership and cache review; isolated six-cycle hidden/background CPU, memory and work observation. |
| 19 | Security | Native renderer preferences, no raw APIs, trusted main-frame/role validation, strict production CSP and rejected production dev actions; production and complete dependency audits each report zero known vulnerabilities. |
| 20 | Dev leftovers | Current 168-text-file marker inventory; active PNG path separated from historical Three/SVG/WebM utilities, test tooling and compatibility identifiers. |
| 21 | Builds | App/Electron type checking, Angular production build and esbuild Electron main/preload build. |
| 22 | Handoff | Ten requested report items, exact test outcomes, known limits and readiness recommendation. Local review only. |

The original onboarding-specific checkpoint is in [focused onboarding QA](slingsip-onboarding-qa.md). This campaign runs the complete existing suite, including those onboarding checks.
