# SlingSip onboarding and local personalization

Implemented on 8 October 2026. Local review only; deployment and the next Final QA campaign remain separate tasks.

## Files created and modified

Created production files:

- `shared/user-profile.ts`: minimal record, plain-name validation, Unicode initials and hour-based greeting.
- `electron/user-profile-storage.ts`: main-only profile storage using the existing electron-store architecture.
- `src/app/core/services/local-profile.service.ts`: presentation of the canonical profile.
- `src/app/features/onboarding/onboarding.service.ts`: setup and replay flow.
- `src/app/features/onboarding/onboarding.component.ts`, `.html`, `.scss`: welcome, name, routine, introduction and completion.
- `src/app/features/onboarding/dashboard-tour.component.ts`, `.html`, `.scss`, `tour-position.ts`: guided dashboard tour and viewport positioning.
- `src/app/features/profile/profile-chip.component.ts`, `.html`, `.scss`: compact profile chip, editing, replay and reset confirmation.

Modified production files:

- `shared/desktop-contract.ts`, `electron/preload.ts`, `electron/desktop-ipc.ts`: three typed, role-checked profile operations and read-only snapshot fields.
- `electron/main.ts`: incomplete onboarding opens the dashboard even on autostart; completed users retain quiet tray startup.
- `src/app/core/services/desktop.service.ts`: profile request/error handling and snapshot synchronization.
- `src/app/features/dashboard/dashboard-shell.component.ts`, `.html`, `.scss`: setup/tour mounting, profile chip and stable tour targets.
- `src/app/features/dashboard/overview-hero.component.ts` and `.scss`: a greeting beside the existing date and wrapping for long names.
- `src/app/features/companion/reminder-interaction.service.ts`: selective personalized message text.
- `README.md`: first-launch and profile usage, storage details.

Created `tests/onboarding.spec.mjs` and `tests/helpers/existing-user-electron.mjs`. Existing Electron launch fixtures now explicitly seed an already-onboarded test user for established regression flows. The helper writes only into uniquely isolated test directories and never changes hydration fixtures. Fresh-user tests use the original Playwright launcher without this helper. Fixture imports changed in `advanced-companion`, `asset-integration`, `body-rendering`, `branding`, `character-motion`, `companion-polish`, `dashboard-redesign`, `final-qa`, `hydration-interaction`, `hydration-persistence`, `phase-one`, `phase-six`, `png-companion`, `restart`, `three-companion` and `webm-player` specs. Restart coverage also verifies profile preservation; reminder coverage verifies name changes and goal-complete copy. All existing physical-pointer assertions remain.

Added this report, the validation JSON and the [native screenshot gallery](previews/onboarding/index.html). Production build output is regenerated normally. No package, lockfile, Angular configuration, logo or character asset changes were needed.

## Onboarding architecture

The dashboard shell mounts the setup component over the existing dashboard. While setup is shown, the dashboard is hidden and inert, preserving its route and business state. The independent desktop companion and main-process scheduling retain their normal lifecycle.

The UI flow is:

```text
Welcome → Name → Existing routine → Meet SlingSip → Dashboard tour → Ready
                                                           Skip ↗       ↓
                                                             Start my day → Dashboard
```

Missing/incomplete profile starts at Welcome; a completed profile opens the dashboard. Returning after an interrupted setup starts at Welcome with the saved name and current settings prefilled. Completion is written exclusively by **Start my day**, after successful local persistence. **Set up later** or Escape exits setup for the current dashboard session without setting completion. **Continue setup** in the profile menu returns to Welcome.

Onboarding runs in Electron, where the secure local persistence bridge is available. The existing standalone browser preview continues to show the dashboard; it does not create a browser profile or claim to save one.

Routine setup initializes from existing settings, falls back to existing defaults, validates with the shared validator and saves through the existing settings API. Only goal, glass size and active-hour fields are edited. Retry interval, reminder enablement and Windows startup preference are merged from the current canonical settings; there is no duplicate settings record.

## Profile persistence and security

Normal Windows path: `%APPDATA%\Mizu\user-profile.json`. Isolated tests keep their existing independent temporary directories. The legacy userData/session path, `hydration.json`, `companion-preferences.json` and Windows `Mizu` startup registration are retained.

```json
{
  "schemaVersion": 1,
  "profile": {
    "displayName": "Aditya Kirtane",
    "createdAt": "2026-10-08T00:00:00.000Z",
    "hasCompletedOnboarding": true
  }
}
```

Names are normalized to NFC, trimmed, whitespace-collapsed and limited to 48 Unicode code points. Letters and numbers from international scripts are accepted; markup and unsafe control characters are rejected. The same validator runs in the renderer and main process. Creation date is preserved on edit and reset.

The secure preload exposes `updateDisplayName`, `completeOnboarding` and `resetOnboarding`, mapped to `desktop:update-display-name`, `desktop:complete-onboarding` and `desktop:reset-onboarding`. Main accepts profile mutations only from the trusted dashboard main frame. The companion can read the synchronized profile but cannot write it. Raw `ipcRenderer` and Node access are not exposed.

Writes commit to electron-store before updating in-memory profile state. A failed write displays an error and leaves completion false. A malformed profile can be rebuilt without touching water/history records. The existing restart persistence callback now includes the profile before cleanup/relaunch.

## Guided tour

A small custom component uses a native modal HTML dialog; no Shepherd, CDK or other dependency was added.

| Step | Highlight |
| --- | --- |
| 1 | Today's Progress |
| 2 | Next Water Break |
| 3 | History navigation |
| 4 | Settings navigation |
| 5 | Profile chip |
| 6 | System tray explanation, centered because the tray is outside the renderer |

The card has Next, Back, Skip, visible step count and keyboard focus containment. Escape skips safely. Initial tour completion/skip proceeds to the Ready screen, with completion still false. Replay completion/skip returns directly to the dashboard. Replay navigates from History/Settings to Overview first and also works when Overview is already open.

Positioning uses current DOM rectangles, viewport dimensions and measured card size. Targets scroll into view; edge cases use a bounded card position. A missing/hidden target uses a centered explanation instead of blocking the tour. Resize/scroll and targeted DOM changes trigger at most one pending RAF measurement. Listeners, observers, RAF and dialog focus are cleaned up on destruction. No continuous tour or profile render loop runs.

Welcome float/glow/decorative web motion, profile bob, upside-down sway, tour entrance/spotlight transitions and completion glow are subtle CSS animations. Reduced motion and low-power preferences disable these effects. New cards use an opaque navy base under the existing gradient for readable text.

## Supplied assets

All five supplied PNGs are used without rewriting their bytes. Angular's existing public asset configuration copies them into the production build; relative URLs also work with Electron file loading.

| File under `public/assets/onboarding/slingsip/` | Placement |
| --- | --- |
| `welcome-hero.png` | Welcome |
| `profile-idle.png` | Name step and Meet SlingSip |
| `routine-upside-down.png` | Routine |
| `tour-dashboard.png` | Small tour-card mascot |
| `success-ready.png` | Ready |

These source images measure 1254 × 1254 px. A failed setup image falls back to the existing SlingSip logo. A failed tour image is omitted; controls remain usable. No alternate mascot or new visual identity is introduced.

## Dynamic name locations

The dashboard greeting uses local time: 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–04:59 evening. It uses the existing minute/focus clock and no new timer.

The name appears in the profile chip/menu, live name preview, completion heading and goal-complete message. Every third reminder visibility revision uses a short personalized hydration check; other reminder messages retain the existing copy. Name edits immediately synchronize the greeting, initials and active personalized companion message through the existing snapshot stream.

## Profile actions and preservation

- **Edit profile** saves only the display name. The chip truncates long names visually and retains the full accessible name; setup/menu headings can wrap.
- **Replay welcome tour** shows only the six dashboard steps. It preserves profile completion, progress, history, streak and settings.
- **Reset onboarding** first shows confirmation with Cancel focused. Confirm sets only completion false, preserving the name and creation date. The current dashboard remains usable; closing and reopening it, or restarting the application, shows Welcome again.

Hydration, history, scheduling, native window management, startup, tray and restart-controller source files remain byte-identical to the task baseline. The only companion change is presentation text. Dashboard layout/cards, assets, trajectories, timing, input/click-through, low-power motion and persistence calculations are preserved.

## Validation and manual checks

This section records the original implementation checkpoint. See the [subsequent focused onboarding QA](slingsip-onboarding-qa.md) for the latest polish and stronger replay, persistence and dismissal checks.

The production Angular/Electron build and TypeScript checks pass. The seven onboarding tests cover fresh setup, supplied assets, trimmed/international names, live initials, Enter submission, shared routine validation, six tour steps, Back/Skip/Escape/focus, final-only completion, relaunch, editing, replay from History, reset confirmation, data preservation, real disk-write failure/retry, malformed-profile recovery, role-checked IPC, autostart, image fallback, reduced motion, observer/RAF cleanup and viewport scaling.

**47 unique affected checks pass**, combining the regression run and focused follow-ups. The broad run initially finished 46 passed / 1 failed: the longer personalized reminder text changed the bubble height. Shortening it to “Hydration check, {name}.” restored the original exact geometry assertion and passed the full Later/Ignore retry flow. Three other focused follow-up checks covered secure intake/goal copy, fresh setup and long names; the long-name test initially read geometry before a pending zoom reposition frame. Its final run waits for bounded geometry and retains every viewport, overflow, focus and cleanup assertion. No application behavior or assertion was disabled.

Coverage includes dashboard actions/layouts, settings/history, storage recovery and real background scheduling, companion motion/preferences/cursor/suspension, PNG bottle/exits/hidden cleanup, Windows startup and real active/idle/paused tray restarts preserving the profile. The final layout check includes a 48-character unbroken name at minimum size and 150% zoom.

Native content sizes include 760 × 560, 1366 × 768, 1920 × 1080 and 2560 × 1440, with 125%/150% page scaling as a Windows scaling proxy. The [validation record](slingsip-onboarding-validation.json) records affected regression results and protected-file/asset checks. All 110 suite tests collect successfully; this task does not constitute the next complete Final QA run.

Manual review:

1. Launch the rebuilt app with a fresh/incomplete profile. Confirm Welcome and the supplied mascot. Enter a name using Enter; inspect live initials.
2. Review the existing routine, save it and confirm consumed water/history remain. Check the upside-down artwork.
3. Use Back/Next through all six tour steps. Try Skip and Escape; confirm Ready appears and setup remains incomplete until **Start my day**.
4. Restart SlingSip through the tray. Confirm one tray/window pair, the saved name, normal dashboard and preserved progress/settings.
5. Edit the name from the profile chip. Confirm greeting/initials update. On a personalized reminder, confirm the visible copy updates too.
6. Replay from Overview, History and Settings. Confirm no welcome wizard or completion card appears on replay and no data changes.
7. Cancel reset first, then confirm it. Restart and confirm Welcome with the saved name/current routine.
8. At compact size and Windows scaling, check scrolling, card visibility, keyboard navigation and reduced motion. Set up later must always offer a way back to the dashboard.
9. Confirm background reminders, Later/Ignore retries, immediate drink credit, bottle/right exit, quiet autostart after completion and startup preference behave as before.

## Remaining visual/test limits

The supplied artwork is static PNG poses with subtle CSS motion; it has no independent face/body animation channels. Source alpha includes a visible red rim in places and remains unchanged. At very small/scaled viewports setup scrolls vertically; a large target can overlap the bounded tour card when there is no adjacent free space. Missing targets deliberately use a centered explanation.

Tests exercise native Electron content sizes and page zoom on this host, rather than a physical 2560px monitor or every OS DPI configuration. A screen-reader review and physical Windows pointer check remain manual/Final QA work. The prior Windows pointer access-denied result is retained separately in the [preceding Final QA report](slingsip-final-qa.md); this onboarding validation does not replace it.

No normal user profile was reset or seeded, and the already-running user instance was left alone. Load this build with **Restart SlingSip** after building (or one normal Quit/relaunch if the running instance predates restart support).
