# Phase 7B — Final Mizu dashboard redesign

> Historical report from before the SlingSip brand migration. Old names, copy and screenshots describe that phase. See the [current branding report](slingsip-branding.md) for the current product and compatibility identifiers.

Overview, History and Settings now share Mizu's dark navy, mint and teal design. The Overview uses canonical main-process snapshots throughout. The original guardian appears as a small static hero illustration. The supplied text brief was the approved visual target; no separate mockup was provided.

## 1. Files created

| File | Purpose |
| --- | --- |
| `src/dashboard-theme.scss` | Dashboard-scoped colors, cards, buttons, progress bars and entrance motion. |
| `src/app/shared/ui-icon.component.ts` | Small inline SVG icon component; no icon library or font download. |
| `src/app/features/dashboard/overview-state.service.ts` | Overview-only presentation signals and a disposable minute clock. |
| `src/app/features/dashboard/overview-format.ts` | Local date labels, deadline formatting and next-break status. |
| `src/app/features/dashboard/overview-card.scss` | Shared card host sizing. |
| `src/app/features/dashboard/overview-hero.component.ts`, `.scss` | Headline, actual local date and decorative guardian. |
| `src/app/features/dashboard/today-progress.component.ts`, `.html`, `.scss` | Accessible SVG ring, actual water and canonical Drink CTA. |
| `src/app/features/dashboard/remaining-water.component.ts` | Remaining water card. |
| `src/app/features/dashboard/next-break.component.ts` | Actual deadline/countdown and non-scheduled states. |
| `src/app/features/dashboard/reminder-status.component.ts` | Actual enabled/paused preference and generated cadence. |
| `src/app/features/dashboard/streak-card.component.ts` | Current and best streak. |
| `src/app/features/dashboard/quick-actions.component.ts` | Drink, Pause/Resume, Open companion and Settings. |
| `src/app/features/dashboard/daily-schedule.component.ts` | A short preview of generated slots. |
| `src/app/features/dashboard/history-preview.component.ts` | Up to three real saved/live days. |
| `src/app/features/dashboard/desktop-integration.component.ts` | Actual visibility, input, display and next-break information. |
| `public/assets/character/companion-guardian.svg` | 3.8 KB static copy of the original companion's SVG artwork. |
| `tests/dashboard-redesign.spec.mjs` | Six focused presentation, native action, security and responsive tests. |
| `docs/phase-7b.md` | This implementation and review report. |

Review screenshots: [Overview](previews/phase-7b/overview.png), [lower Overview cards](previews/phase-7b/overview-lower.png), [History](previews/phase-7b/history.png), [Settings](previews/phase-7b/settings.png). These four PNGs are also newly created review artifacts. Their water/history are isolated test fixtures rendered through the real app; application code contains no mockup intake, dates, streaks or reminder times.

## 2. Files modified

| File | Change |
| --- | --- |
| `src/styles.scss` | Imports the theme; existing transparent root and reduced-motion rule remain. |
| `src/app/features/dashboard/dashboard-shell.component.ts`, `.html`, `.scss` | Sidebar, connection badge, responsive shell and scroll reset on navigation. |
| `src/app/features/dashboard/dashboard.component.ts`, `.html`, `.scss` | Small Overview orchestrator, responsive grid and development-only controls. |
| `src/app/features/dashboard/ritual-page.scss` | Shared History/Settings page typography and spacing. |
| `src/app/features/history/history.component.html`, `.scss` | Theme, badges, mint bars and unavailable-state text. |
| `src/app/features/settings/settings.component.html`, `.scss` | Five grouped sections and responsive fields. |
| `src/app/core/services/desktop.service.ts` | Guarded dashboard quick-add, session pause and manual companion actions. |
| `src/app/core/services/hydration.service.ts` | Existing drink entry point also accepts a dashboard drink without a reminder token. |
| `shared/desktop-contract.ts` | Typed, limited dashboard commands. |
| `electron/preload.ts` | Exposes those specific commands through the existing bridge. |
| `electron/desktop-ipc.ts` | Dashboard-role authorization and delegation to existing main actions. |
| `electron/hydration-runtime.ts` | Explicit manual opening can occur outside automatic working hours, while retaining enabled, pause, goal and overlap guards. |
| `README.md` | Phase status, dashboard usage, validation and report link. |
| `tests/hydration-interaction.spec.mjs` | Captures the one-second ignored-reminder message at DOM render time, preventing assertion polling from skipping it. |

`SettingsComponent` form/state logic and `HistoryComponent` date, pagination and streak logic are unchanged. Shared hydration/history math, scheduler calculation, persistence, native window management and the companion animation files were not rewritten.

## 3. Dashboard component architecture

```text
DashboardShell → router outlet → DashboardComponent
                                  ├─ OverviewState (scoped to this page)
                                  ├─ OverviewHero
                                  ├─ TodayProgress / RemainingWater / NextBreak
                                  ├─ ReminderStatus / StreakCard / QuickActions
                                  ├─ DailySchedule / HistoryPreview
                                  └─ DesktopIntegration

Main HydrationRuntime → revisioned DesktopSnapshot → DesktopService
                                                   → HydrationService + OverviewState
Dashboard Drink → HydrationService.drink()
                → bridge.recordDrink() → existing main quickAdd()/recordDrink()
```

Every card uses OnPush change detection and signal derivations. Overview owns one minute interval for countdown text and refreshes on window focus; navigation disposes both. SVG ring transitions run only when the value changes. The static guardian does not instantiate the swing engine, a sprite player or a video player. The dashboard requests no continuous animation frames.

The new IPC surface contains only dashboard Drink, boolean session pause and manual Open companion. Main retains role/origin/frame validation and selects the glass amount. A drink credits an active reminder through the same path as the tray, so companion confirmation cannot credit it again. A hidden retry is satisfied by the same existing quick-add path. Concurrent UI clicks are guarded by the existing busy signal.

## 4. Design tokens/colors

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#0b1118` | Charcoal/navy canvas. |
| `--surface` | `#121c25` | Card foundation. |
| `--surface-raised` | `#192731` | Raised navy surfaces. |
| `--line` | `#ffffff12` | Thin borders and dividers. |
| `--text` | `#edf7f4` | Main text. |
| `--muted` | `#9cafb7` | Supporting text. |
| `--mint` | `#8ce8ca` | Selection, CTA and progress. |
| `--cyan` | `#83d2dd` | Secondary icon accents. |
| `--coral` | `#ee8490` | Streak icon, missed-goal badge and errors. |
| `--glow` | `#8ce8ca14` | Soft mint icon tint. |

Tokens live beneath `.dashboard`, leaving the transparent native companion palette intact. Cards use translucent gradients, 1px borders, 18px radii and restrained shadows. Spacing follows approximately 8/12/18/24/32/48px steps. Typography uses the installed Segoe UI Variable/Segoe UI/system stack; no remote fonts. Focus rings remain mint and visible. Supporting text has strong contrast against the dark surfaces.

## 5. Overview layout

The 214px sidebar contains the logo, required two-line tagline, three icon links, selected mint outline/glow, the small-habits note, actual app version and Quit. The top bar shows route context and actual bridge/snapshot connection status.

The hero pairs the specified headline/copy with the original navy/coral/mint guardian, a hanging web and subtle static teal trails. The twelve-column content grid places the large progress card beside Remaining Water and Next Water Break; Reminder Status, Current Streak and Quick Actions follow. The lower row pairs Your Daily Ritual with History Preview, followed by Desktop Integration.

The ring has a visible rounded percentage plus actual milliliters, a semantic progressbar and equivalent spoken amount. Its stroke uses clamped HydrationService progress; it animates only on change. Water changes are announced politely. Both Drink buttons use the same action and dynamic glass label. Development-only test triggers live in a separate collapsible area and retain the earlier test IDs. Production hides that area.

## 6. History styling changes

History uses the same page spacing, mint headline accent, translucent cards and thin dividers. Current/best/week statistics retain their existing derivations. Progress bars use a teal-to-mint gradient. Complete badges use mint; unfinished Today uses a neutral badge; prior missed goals use restrained coral. Historical milliliters and goals remain separate from today's settings. Thirty-day pagination and Show earlier days are preserved. A browser preview shows unavailable values instead of invented counts.

## 7. Settings styling changes

Settings groups the existing fields into Hydration, Schedule, Reminders, Desktop and Startup. Hydration contains goal/glass; Schedule contains the local working window; Reminders contains the saved ON/OFF preference and retry interval. Desktop shows actual companion, input and tray state, with no unsupported preferences. Startup retains the supported Windows switch and actual OS status.

Labels, validation hints, invalid-input ARIA attributes, explicit Save, Discard, dirty-state protection and storage-failure feedback are preserved. Fields use dark recessed surfaces and mint focus. At wide sizes the grouped cards share two columns; smaller windows use one. The save row wraps without obscuring the form.

## 8. Responsive behavior

Overview content is capped at 1540px and centered on large windows. The grid uses twelve flexible columns. Below 1250px the primary card gets more room, Reminder/Streak share a row and Quick Actions uses two columns. Below 1000px the primary card and lower previews span the full content width. Below 700px the remaining cards stack, the ring/copy stack and the sidebar becomes accessible icon links.

The sidebar narrows to 172px below 1000px. On short windows secondary sidebar decoration condenses so navigation/version remain usable. The main content scrolls vertically. Hero artwork is contained to prevent horizontal overflow. Changing routes returns the content to the top.

Automated native window checks cover content viewports 1366×768, 1920×1080, 2560×1440 and 760×560. They check horizontal overflow and card intersection, take screenshots and exercise keyboard/reduced motion. History and Settings are also checked at the three requested desktop widths and at the compact window.

## 9. Dynamic data mappings

| Visible item | Source/behavior |
| --- | --- |
| Connection/version/display | Actual DesktopSnapshot and native bridge availability. |
| Local day | Persisted hydration local date; calendar parsing avoids UTC date shifts. |
| Water/goal/glass | HydrationService signals from main hydration snapshot. |
| Percent | Existing capped progress signal; rounded only for ring text. |
| Remaining | Existing `max(goal − water, 0)` signal. |
| Drink CTA | `HydrationService.drink()` → canonical main quick-add/drink; main caps the final glass. |
| Next break/countdown | Main `nextReminderAt`, or reserved `reminderRetry.retryAt`; refreshed each minute/on focus. |
| Goal/OFF/Pause/active/exhausted/outside-hours | Actual hydration and scheduler states, with readable text instead of fabricated deadlines. |
| Reminder status | Saved enabled preference and actual session pause; Active means enabled and unpaused. |
| Cadence | Difference between actual generated slots; fractional minutes are labeled approximately and sub-minute slots explicitly. |
| Current/best streak | Main computed streak snapshot. |
| Pause/Resume | Existing main `setPaused()`; stays temporary and updates the tray. |
| Open companion | Explicit user action through the existing runtime; respects goal/OFF/pause/reservation guards. |
| Timeline | Only actual main-generated slots; next three future slots, or last three planned times when the day is over. Past slots are labeled Earlier today, with no invented drink completion. |
| History preview | First three main history rows, including live Today; original recorded goals/percentage/completion. Missing dates are not created. |
| Desktop integration | Actual native visibility/interactivity, pending retry, work area and scaling. |
| Settings | Existing draft, shared validation and canonical settings-save action. |

No production UI uses the brief's example water, percentages, streaks or reminder times as fixtures. Open companion is a manual request, so it can open outside automatic working hours; automatic daily scheduling continues to obey its existing hours. Reminders OFF, pause and a completed goal still prevent manual opening. Drinking remains available during pause/OFF until the goal is complete.

## 10. Manual test checklist

- Run `npm run dev`. Confirm native connection/version and the new Overview, History and Settings sidebar links.
- Drink once from each dashboard CTA. Verify water, ring, remaining water, Today preview, full History, companion progress and tray update together.
- Change glass to 300ml and save. Both CTA labels and the tray must use 300ml; historical goals must remain intact.
- Open companion, then drink from the dashboard during its active reminder. Verify one credit, the existing success/bottle/right exit, and no duplicate companion credit.
- Pause/Resume from Quick Actions. Confirm actual tray state and next-break text. Disable reminders in Settings; Drink remains available, while Pause/Open companion are unavailable.
- Postpone the companion, let it hide, and confirm the next-break card uses its actual return deadline. A dashboard drink or Hide reminder should cancel that return.
- Finish the goal with a partial final glass. Ring caps at 100%, remaining is zero and Drink/Open companion disable. Lowering a goal must preserve already logged intake.
- Check a day with prior complete/incomplete history. Verify Today/Yesterday/date labels, each historical goal, progress bars and current/best streak against full History.
- Resize at the requested desktop sizes and minimum window. Scroll to lower cards and verify no horizontal scrollbar, overlapping text or clipped buttons. Change routes while scrolled down and confirm each starts at the top.
- Tab through sidebar, links, buttons and fields. Check visible focus, explicit labels, validation and reduced-motion mode.
- Run `npm start`. Verify production has no development controls; manual Open companion still works within its guards.
- Close/reopen the dashboard, restart the app, and check saved settings/intake plus unchanged tray/startup behavior.

Validation: `npm run build` and `npm run typecheck` passed. The full 60-test run passed 58 checks, with failures in the short ignored-message assertion and Windows physical pointer check. After capturing the one-second message at DOM render time, `npm run test:electron -- tests/dashboard-redesign.spec.mjs tests/hydration-interaction.spec.mjs` passed all 11 checks against the final build, including all six new dashboard checks. Across these runs, **59 of the 60 tests have a passing result**.

The Windows pointer test remains unverified. Its first run observed the cursor move away from the target; subsequent focused runs passed the bubble click but Windows rejected later pointer-helper movements, reporting `(0,0)` and `SetCursorPos` failure. A read-only probe could access the desktop between runs, but the physical test could not finish reliably. No companion input implementation was changed in this phase. Rerun `npm run test:electron -- tests/phase-one.spec.mjs` on an unlocked desktop with the mouse idle to complete that check. This report does not claim a fully green 60-test suite.

The passing tests cover all dashboard actions and roles, duplicate intake, final-glass clamping, snapshots, generated slots, real history, navigation, keyboard/reduced motion, all requested desktop widths, existing timing/retry behavior, persistence, scheduler, tray, real isolated Windows startup registration and WebM resources. Tests use isolated temporary profiles and preserve normal Mizu data. Temporary test windows were closed.

## 11. Known visual limitations

The approved text brief supplied the visual direction; there is no separate reference image for a pixel-by-pixel comparison. The guardian decoration is intentionally static. Native companion motion remains the animation feature.

Lower cards require vertical scrolling on shorter displays. A browser preview has no native hydration state or working desktop actions; it clearly reports this. Missing archive dates are not filled with demo history. The countdown uses minute precision and may be up to one minute behind between refreshes; focus and new snapshots update it. Decorative contrast/shadows and font rasterization can vary with Windows scaling.

Responsive native screenshots exercise the current Windows system at its current display scale, including programmatically resized larger viewports. They do not certify physical 125%/150% display setups; those remain manual checks. The existing primary-monitor, software-rendering and repository-based startup limitations are documented in the README.

Physical mouse click-through verification needs a reliable unlocked Windows desktop and remains pending as described above. Layout screenshots and DevTools-driven native interactions passed; they do not substitute for that physical mouse check.

Phase 7B stops here for review. No deployment, backend, authentication, cloud sync, multiple companions or advanced charts were added.
