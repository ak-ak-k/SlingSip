# SlingSip branding migration

Review date: October 6, 2026. Scope: the approved brand migration and matching logo. The existing guardian artwork, dashboard grid, animation paths/timing, hydration calculations, scheduler, history and streak behavior remain in place. No deployment or installer was added.

## 1. User-facing changes

The product now identifies as **SlingSip**, with sidebar wordmark **SlingSip.**, primary tagline **Swing in. Sip up. Keep going.** and secondary line **Your hydration sidekick.** The hero reads **YOUR DAILY SIDEKICK / Stay hydrated. / Keep moving.** Its supporting text describes the desktop companion swinging in for a drink.

Overview, History, Settings, browser-preview notices, persistence/reminder errors, accessibility labels and document/native titles use the new name. Both windows use **SlingSip — Desktop Hydration Companion**. Tray actions are **Open SlingSip** and **Quit SlingSip**, with tooltip **SlingSip — Your hydration sidekick**; the same tray instance and actions remain.

The reminder header is **SLINGSIP • WATER BREAK**, followed by the actual glass amount and **Time to hydrate. Your sidekick is here.** Later reads **Okay, I’ll swing back.** and **I’ll check on you again in …**, using the actual retry interval: seconds below one minute, otherwise minutes. Drink/success/goal calculations and the ignored-reminder state remain unchanged.

## 2. Files modified or added

| Area | Files |
| --- | --- |
| Application identity | New `electron/app-identity.ts`; updated `electron/main.ts`, `electron/window-manager.ts`, `electron/windows-startup.ts`. |
| Tray and visible errors | `electron/tray-controller.ts`, `electron/tray-icon.ts`, `electron/hydration-storage.ts`, `electron/hydration-runtime.ts`. The storage/runtime edits change error text only. |
| Renderer identity | `src/index.html`, `src/app/core/services/desktop.service.ts`. The service edit changes browser-preview error text only. |
| Dashboard | `src/app/features/dashboard/dashboard-shell.component.html`, `dashboard-shell.component.scss`, `overview-hero.component.ts`, `overview-format.ts`, `dashboard.component.html`. |
| History and Settings | `src/app/features/history/history.component.html`, `src/app/features/settings/settings.component.html`; business logic and their styles remain unchanged. |
| Companion | `src/app/features/companion/companion.component.html`, `companion-character.component.html`, `speech-bubble.component.html`, `speech-bubble.component.scss`, `speech-bubble.component.ts`, `reminder-interaction.service.ts`. Artwork changes are labels/identifiers only; the interaction service edits are copy only. |
| Assets | New `public/slingsip-logo.svg`; removed `public/mizu.svg`; renamed `public/assets/character/mizu-guardian.svg` to `companion-guardian.svg`; updated title metadata in `public/assets/character/development/idle.svg` and `walk.svg`. |
| Development asset metadata | `scripts/create-development-character.mjs` and `public/assets/character/README.md`. |
| Package metadata | `package.json` and the two root package-name fields in `package-lock.json`. No dependency versions changed. |
| Tests | New `tests/branding.spec.mjs`; updated `tests/dashboard-redesign.spec.mjs`, `tests/character-motion.spec.mjs`, `tests/hydration-interaction.spec.mjs`, `tests/phase-six.spec.mjs`. |
| Documentation | `README.md`, historical annotations/current launch instructions in `docs/phase-6.md`, `docs/phase-7a.md`, `docs/phase-7b.md`, and this report. |
| Review artifacts | New PNGs under `docs/previews/slingsip/`, linked below. These are documentation artifacts, not additional runtime assets. |

## 3. Internal identifiers

`MizuTray` became `SlingSipTray`. Its isolated main-process test hook changed from `__mizuTestTray` to `__slingSipTestTray`, with every test consumer updated. The inline and static character gradients use `guardian-suit`, `guardian-mask` and `guardian-scarf`; all fragment references were updated together. The bottle test selector is now `companion-bottle`.

Package name is `slingsip-desktop-companion`, product name is `SlingSip`, and description is **A playful desktop hydration companion.** The generic Angular project identifier `desktop-companion` remains. There is no installer, appId or bundleId to migrate in this repository.

## 4. IPC and public interfaces

No IPC channels, payloads, preload exports, public bridge types or window roles changed. `window.desktopCompanion`, `DesktopBridge` and every `desktop:*` channel remain intact. Brand constants/profile setup are internal Electron implementation details. Existing permissions, sandboxing and role validation remain unchanged.

## 5. Storage and startup decision

`configureAppIdentity` creates/uses the existing `<appData>/Mizu` directory, sets the visible application name, and explicitly pins both Electron `userData` and `sessionData` to that directory **before readiness and single-instance locking**. On Windows this remains `%APPDATA%/Mizu`, preserving the current file, browser session and instance identity. Validated test profiles explicitly set both directories to their isolated profile instead.

`hydration.json`, schema version 2, keys and stored values were not renamed or migrated. Current water, original historical goals, derived streaks, reminder settings and launch preference remain compatible. Live user data was not read or modified for verification; tests seed temporary fixtures.

The Windows Run entry remains `Mizu`, including its existing approval. Registration, command arguments, verification and ON/OFF behavior are unchanged. Windows Startup settings can still display that legacy registration name. Isolated registration tests retain their uniquely named `Mizu-Test-…` entries and remove only those entries.

## 6. Matching logo and assets

The new mark combines a mint drop (`#8ce8ca`), cyan swing arc (`#83d2dd`) and small coral endpoint (`#ee8490`). Its transparent 64-unit SVG uses simple geometry without external artwork, fonts or animation. The sidebar adds a dark rounded tile; the wordmark retains a mint period. Wordmark size/spacing fit the existing 214/172 px sidebar widths without widening them.

The sidebar, favicon and reminder header load `slingsip-logo.svg`. `electron/tray-icon.ts` rasterizes the equivalent geometry with supersampling into a transparent 32 px native PNG for tray and window icons. Its coordinates/colours correspond to the SVG, including the subtle curved drop detail. No image-generation dependency or icon package was added.

The character's chest drop and bottle artwork keep their existing geometry. The static dashboard guardian was renamed and relabelled, with its reference updated. Generic development sheet filenames remain. Old runtime logo/guardian filenames have no remaining references or duplicate files.

## 7. README and historical material

README starts with **SlingSip**, the primary tagline and the Angular/Electron product description. It updates launch/tray/reminder copy and documents the preserved profile and Windows registration. Setup and run commands remain the same.

Earlier phase reports now carry a historical annotation linking here. Their original screenshots and descriptions retain the product name used at the time; applicable launch instructions and the current static guardian path were updated. Original supplied reference images/briefs remain source material from before migration and are not runtime assets. `prompt.txt` is untouched personal input and is not shipped by Angular.

## 8. Verification

`npm run typecheck` and `npm run build` passed. The production build contains the new SVG and renamed guardian with no old runtime assets.

The complete 62-test run passed 60 checks. The new branding fixture initially seeded history in reverse order; it was corrected to the existing chronological format without changing application code or relaxing comparisons. The physical input test initially passed bubble clicks, blank-space click-through and earlier recovery checks, then failed its Later target assertion while the observed cursor moved outside the bubble.

`npm run test:electron -- tests/branding.spec.mjs tests/phase-one.spec.mjs` then passed **all three focused checks**: both branding tests and the complete unchanged native physical-input regression. That rerun verifies real bubble clicks, click-through, stationary cursor/show handling, display changes, native Later/Drink actions, window reuse and renderer recovery. **All 62 tests have passing results across the full and focused runs against the final branding build.** The first full run was not wholly green; the focused rerun resolved both failures. No pointer assertions or input implementation were changed, and no physical check remains pending for this build. All temporary test applications were closed.

New tests verify normal legacy-directory resolution against a temporary app-data root, unchanged seeded file contents, explicit isolated session/profile paths, native application/window identity, existing v2 intake/history/preferences across restart, actual streaks, current tray labels, accessibility text, asset loading, rendered button hit areas and reminder/Later branding. The fixture uses the existing chronological stored-history format. Existing dashboard tests now additionally check wordmark overflow at every tested width; copy/selectors/test hooks were updated without removing assertions.

Layout verification covers 1366×768, 1920×1080, 2560×1440 and 760×560 content sizes. Visual inspection confirms the wordmark, hero and reminder fit their existing surfaces. Review PNGs show real application rendering with isolated seeded progress, not hardcoded production values.

## 9. Intentional remaining legacy references

| Reference | Reason |
| --- | --- |
| `Mizu` in the profile helper and corresponding test | Existing on-disk directory compatibility. |
| `Mizu` / `Mizu-Test-…` in Windows startup and registration tests | Preserve the real registration and OS approval; keep isolated test cleanup compatible. |
| `mizu-overlay-tests` in main/tests/README | Existing isolated profile namespace; not visible product branding. |
| `/mizu/i` in branding tests | Explicitly reject old branding in rendered text and accessibility labels. |
| Earlier phase reports/screenshots and this migration explanation | Clearly labelled historical or compatibility documentation. |

Case-insensitive source/asset audit found no remaining old branding in renderer production copy, labels, titles, logo references or development asset titles. Native source matches are limited to the intentional compatibility identifiers above.

## 10. Review screenshots and manual checklist

Screenshots: [Overview](previews/slingsip/overview.png), [minimum window](previews/slingsip/overview-minimum.png), [lower Overview](previews/slingsip/overview-lower.png), [History](previews/slingsip/history.png), [Settings](previews/slingsip/settings.png), [reminder](previews/slingsip/reminder.png), [Later response](previews/slingsip/later.png), [swing entry](previews/slingsip/swing-in.png), [bottle delivery](previews/slingsip/bottle-delivery.png), [native 32 px mark](previews/slingsip/logo-native-32.png).

1. Quit an existing running instance from its tray. Run `npm run dev` and confirm SlingSip wordmark, three-line tagline and updated hero.
2. Open History and Settings; confirm existing data/preferences and new product copy.
3. Open the companion. Confirm SlingSip header, correct glass amount, unchanged guardian/web and transparent surroundings.
4. Use **Drank it**; confirm immediate water synchronization, actual success amount, bottle delivery and right exit.
5. Use **Remind me later** on another reminder; confirm the actual retry interval, left exit and one delayed return. Development uses ten seconds; `npm start` uses configured production minutes.
6. Check tray icon, tooltip, Open/Quit labels, retained Pause/Resume and Settings actions; closing the dashboard must leave reminders running.
7. Restart and confirm saved water, history and preferences survive. The existing legacy profile directory is intentional.
8. Check Launch with Windows ON/OFF and eventual sign-in behavior. The OS registration can still show `Mizu`; do not create a duplicate SlingSip entry.
9. Review logo at small sizes on your actual tray/taskbar and check physical click-through on an unlocked desktop with the mouse idle.

Stop after local review. No deployment was performed.
