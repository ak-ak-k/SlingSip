# SlingSip focused onboarding QA

Reviewed locally on 8 October 2026. All 17 requested onboarding checks pass. Type checking and the production build pass; 11 unique focused tests have passing evidence. This is the onboarding QA checkpoint, separate from the next main Final QA phase.

## Bugs found and fixed

No new functional onboarding bug was reproduced. The README implied that deferred setup returned only after restarting the application. Incomplete setup actually returns whenever a new dashboard renderer opens, including closing and reopening the dashboard in the same tray session. The documentation now states that behavior precisely.

One existing reminder regression initially failed its exact-position assertion: the bubble's horizontal position changed from 1548 to 1462.796875, while width, height and vertical position remained identical. The targeted rerun passed every original assertion, including exact geometry, retry cancellation and live personalized text. Application behavior and the assertion remain unchanged. Placement diagnostics were added to the test; the passing run recorded identical dashboard, overlay and work-area bounds on entry and retry. The initial failure's cause was not established and remains a main Final QA follow-up.

## Small polish

- Setup labels: **Welcome**, **Your name**, **Your routine**, **Meet SlingSip**.
- Dashboard-tour mascot frame: **68 × 78 px → 85 × 97.5 px**, a 25% increase with proportions and the existing artwork retained.
- Spotlight border: **1 → 1.5 px**; glow: **20 → 26 px**, with a subtle 24% cyan tint. Placement and backdrop behavior are unchanged.
- Final microcopy: **Keep moving. Keep sipping.**

There are no new features, dependencies, assets, dashboard layout changes, hydration changes or onboarding-flow changes.

## Verification

| # | Requested check | Result and evidence |
| --- | --- | --- |
| 1 | Fresh/reset users only | Fresh and incomplete profiles show Welcome. Completed profiles bypass it after relaunch. Reset restores Welcome on a subsequent dashboard launch. |
| 2 | Completion persistence | Final **Start my day** writes `hasCompletedOnboarding: true` to the canonical version-1 profile. Tour Skip/Finish/Escape alone does not write completion. A real disk-write failure retains false and succeeds after recovery. |
| 3 | Name survives restart | Saved names restore after full Electron shutdown/relaunch and real production tray restart. |
| 4 | Stable creation/member-since | The entire profile, including `createdAt`, matches after relaunch; the displayed Member since value also matches. Editing and reset preserve the date. |
| 5 | Existing settings service | Routine saves through the existing hydration settings API and validator. A seeded 750 ml survives changing goal/glass to 2400/300; unrelated settings and archived history remain. |
| 6 | Replay preserves records | Repeated replay compares progress, history, streaks, settings, preferences and startup. `hydration.json` is byte-identical before/after replay. |
| 7 | Replay tour only | Replay from History returns to Overview and opens only the six-step tour. Skip, Finish and Escape return directly to the dashboard, without setup/Ready. |
| 8 | Reset preserves records | Cancel leaves completion true; confirm changes only completion to false. Hydration file bytes and canonical hydration/history/streak/settings remain unchanged. |
| 9 | Deterministic defer/skip | Set up later/Escape expose the current dashboard without creating a fresh profile or completing setup. Closing/reopening returns Welcome. Continue setup resumes at Welcome with any saved name/current routine. Initial tour Skip/Escape goes to Ready; only its final CTA completes setup. |
| 10 | Profile edit updates UI/text | Edit updates greeting, chip, initials and active personalized reminder text. Goal-completion text uses the saved name. |
| 11 | Missing targets | Removing the next-break target produces a bounded explanation without a spotlight or crash; Skip still works. |
| 12 | Dismissal cleanup | Skip/Finish/Escape remove the tour component, spotlight, shade and modal dialog. Dashboard becomes interactive; no backdrop remains. |
| 13 | Keyboard/Escape | Enter submits name and advances the tour, Back works, Tab remains within the modal, Escape dismisses, and profile dismissal restores chip focus. |
| 14 | Images load | All five supplied onboarding PNGs decode at their original dimensions via production relative URLs, with no failed onboarding asset requests. Built copies match source hashes. Logo fallback also works. |
| 15 | Current mascot only | Native screenshots, image URLs and requests use the supplied SlingSip artwork. Live hero/companion renderers use the approved PNG pipeline; no guardian/temporary-body asset request appears. Dormant historical assets were not deleted. |
| 16 | Electron restart | Onboarding completion/profile restore through real tray relaunch. Incomplete autostart opens setup; completed autostart remains quiet in the tray until dashboard is reopened. |
| 17 | No duplicate state | One canonical `user-profile.json` has exactly the version-1 profile fields. No additional profile/onboarding file or localStorage profile exists. Real relaunch/single-instance checks retain one window pair. |

Minimum 760 × 560 and 1366 × 768, 1920 × 1080, 2560 × 1440 native content sizes pass. Page zoom covers 125% and 150%, including the minimum window at 150%. Reduced-motion checks and post-dismissal RAF cleanup pass. The approved images remain byte-identical; 18 protected logic, persistence, IPC and lifecycle files match the task baseline.

## Test record

- Eight onboarding tests: **8 passed, 0 failed, 0 skipped**.
- Focused reminder/restart regressions: **2 passed, 1 failed**, the transient placement result described above.
- Targeted reminder follow-up: **1 passed, 0 failed, 0 skipped**, with all original assertions retained.
- TypeScript and production Angular/Electron build: **passed**.

See the [machine-readable record](slingsip-onboarding-qa-validation.json), [refreshed native screenshots](previews/onboarding/index.html) and [original implementation checkpoint](slingsip-onboarding.md). Tests use isolated temporary profiles; the normal running user instance and normal user data are left alone.

## Files changed

Production:

- `src/app/features/onboarding/onboarding.component.ts` — four step labels.
- `src/app/features/onboarding/onboarding.component.html` — final microcopy.
- `src/app/features/onboarding/dashboard-tour.component.scss` — tooltip mascot size and spotlight emphasis.

QA/documentation:

- `tests/onboarding.spec.mjs` — stronger persistence, membership, replay/reset, file preservation, keyboard/dismissal, asset and fresh-deferral coverage; one new focused test.
- `tests/hydration-interaction.spec.mjs` — placement diagnostic attachment only; assertions retained.
- `README.md`, `docs/slingsip-onboarding.md` — clarify dashboard-session deferral and link this checkpoint.
- This report, `docs/slingsip-onboarding-qa-validation.json` and `docs/previews/onboarding/index.html`.
- Thirteen existing PNG screenshots in `docs/previews/onboarding/` refreshed from native Electron.

## Remaining issues

No known functional onboarding issue remains from these checks. The intermittent reminder placement result needs observation in the next main Final QA run. The earlier physical Windows pointer/click-through check still has a Win32 5 input-desktop access failure, documented in the [preceding Final QA report](slingsip-final-qa.md); it was not rerun or weakened here.

Page zoom is a scaling proxy, not a physical multi-monitor/DPI certification. Screen-reader and physical keyboard/pointer review remain manual checks. At very small viewports, the existing tour can overlap a large highlighted target when adjacent space is unavailable; the tooltip stays inside the viewport. This behavior was retained.

Local onboarding QA ends here. No deployment or next-phase Final QA was performed.
