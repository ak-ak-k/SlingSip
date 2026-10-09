# SlingSip unified visual identity

The dashboard hero, desktop companion and Animation lab use the same approved SlingSip PNG mascot. Every live Angular view shares one dark navy, mint/cyan and supporting crimson theme. The dashboard structure, text, native windows, hydration behavior and motion timing are preserved.

[Native screenshot gallery](previews/unified-identity/index.html) includes Overview at 760×560, 1366×768, 1920×1080 and 2560×1440, History, Settings, sidekick preferences, transparent Reminder, Happy/bottle, Later and Animation lab. Captures use an isolated profile seeded with 1250 ml and historical days; normal user data is untouched.

## Files modified

| Files | Change |
| --- | --- |
| `src/slingsip-theme.scss` (new) | Single palette, derived borders/tints/glows, surfaces, button/progress fills, radius and control-motion tokens; compatibility aliases. |
| `src/styles.scss` | Load the theme globally for both windows; cyan keyboard focus; tokenized selection/scrollbar. Document and overlay backgrounds remain transparent. |
| `src/dashboard-theme.scss` | Remove the dashboard-owned palette; theme cards, buttons, icons, notices, status pills and progress bars from shared tokens. |
| `src/app/shared/slingsip-artwork.component.ts` (new) | Static approved artwork with shared URL/geometry/mask metadata and approved-only failure handling. No animation loop. |
| `src/app/shared/drop.component.ts` | Shared token for the droplet detail. |
| `src/app/features/dashboard/overview-hero.component.{ts,scss}` | Approved static Idle hero; source silhouette clipping removes sheet debris; tokenized decorative arcs; responsive fit. Existing headline/copy/layout retained. |
| `src/app/features/dashboard/dashboard-shell.component.scss` | Navy sidebar, shared navigation/status borders, accent and glow. |
| `src/app/features/dashboard/today-progress.component.{html,scss}` | Theme ring gradient/track, card shading and glow. Calculations untouched. |
| `src/app/features/dashboard/daily-schedule.component.ts` | Tokenized timeline dots/strands/glow; no schedule changes. |
| `src/app/features/history/history.component.scss` | Shared cards/badges/progress styling; historical data and calculations untouched. |
| `src/app/features/settings/settings.component.scss` | Shared fields, borders, focus and errors. |
| `src/app/features/settings/companion-preferences.component.ts` | Shared card/text/checkbox colors; no preference logic changes. |
| `src/app/features/companion/{companion,speech-bubble,companion-character}.component.scss` | Matching navy surfaces, controls, progress, feedback and artwork glow. Existing layout/animation rules retained. |
| `src/app/features/companion/companion-character.component.{ts,html}` | Disconnect old Three.js and SVG character/bottle branches; use approved pose sockets even if a pose fails; preserve code trajectory and lifecycle. |
| `src/app/features/companion/web-renderer.component.ts` | Use approved PNG hand sockets for every live strand; shared web colors. Existing handoff/bottle math retained. |
| `src/app/features/companion/animation-lab.component.ts` | Tokenized preview surfaces; isolation/controls unchanged. |
| `src/app/features/companion/animation/slingsip-asset-loader.service.ts` | Track individual asset failures; select available approved full-body poses or the existing logo. |
| `src/app/features/companion/animation/slingsip-png-choreography.ts` | Optional availability resolver for pose/socket selection; default production mapping and trajectory formulas unchanged. |
| `src/app/features/companion/animation/slingsip-png-renderer.component.ts` | Per-image errors, approved-only degradation, matching glow and painted logo hit area on total body failure. Existing frame crossfades/idle preserved. |
| `tests/dashboard-redesign.spec.mjs` | Approved hero decode, shared tokens across windows, static hero, in-bounds artwork at existing widths; existing layout/history/actions checks retained. |
| `tests/{body-rendering,three-companion,asset-integration}.spec.mjs`, `tests/helpers/companion-visuals.mjs` | Replace obsolete native fallback expectations with approved-only failure coverage; retain alpha/web/drink/idle/pause/retry/cleanup assertions. Offline historical rig/controller/pack tests remain. |
| `scripts/capture-visual-identity.mjs` (new) | Reproducible native captures into an isolated profile and local screenshot gallery. |
| `README.md`, `docs/slingsip-png-integration.md`, this report | Current usage/fallback documentation and clear historical labeling. |
| `docs/previews/unified-identity/*`, `docs/slingsip-visual-identity-validation.json` | Native screenshots, gallery, capture metadata and final validation evidence. |

## Theme definitions

Colors are defined only in `src/slingsip-theme.scss` for active Angular UI. Derived tokens use `color-mix()` so changing the base palette also updates borders, focus, tracks, glows and translucent surfaces.

| Token | Definition |
| --- | --- |
| `--slingsip-bg` | `#09121c`: almost-black navy. |
| `--slingsip-surface` | `#13212e`: dark navy panels. |
| `--slingsip-surface-2` | `#1b2d3d`: raised navy surfaces. |
| `--slingsip-border` | 12% off-white text mixed with transparency. |
| `--slingsip-text` | `#eff7fb`: off-white. |
| `--slingsip-text-muted` | `#a4b7c7`: cool gray. |
| `--slingsip-accent-primary` | `#8ce8ca`: soft mint. |
| `--slingsip-accent-cyan` | `#39d7e5`: focus, gradients and cyan highlights. |
| `--slingsip-accent-secondary` | `#ed4058`: supporting crimson for streak energy and errors/incomplete-day status. |
| `--slingsip-glow-primary` | 16% cyan mixed with transparency. |
| `--slingsip-glow-secondary` | 8% crimson mixed with transparency. |
| `--slingsip-ink` | `#09242b`: dark text on mint/cyan buttons. |
| `--slingsip-panel-fill` | Raised navy at 88% to navy at 96%; used for soft glass surfaces. |
| `--slingsip-button-fill` | Mint-to-cyan gradient shared by primary dashboard/reminder actions. |
| `--slingsip-progress-fill` | Cyan-to-mint gradient; ring and linear tracks use the same endpoints. |
| `--slingsip-border-accent`, `--slingsip-border-strong` | Cyan at 24% and 48%. |
| `--slingsip-radius-card`, `--slingsip-radius-control` | 18 px cards; 10 px controls. |
| `--slingsip-motion-control` | 160 ms control transitions. Existing trajectory, settle, idle and reminder timers are untouched. |

Other named tokens cover shadow, backdrop, sidebar, fields, subtle highlights, errors, web color and track. Existing `--canvas`, `--surface`, `--surface-raised`, `--line`, `--text`, `--muted`, `--mint`, `--cyan`, `--coral` and `--glow` are aliases, not competing palettes. The logo/tray and authored bitmap colors are unchanged; historical disconnected renderers retain their original authored colors.

## One approved mascot

The hero uses `public/assets/companion/slingsip/poses/idle.png`. The static SVG viewport fits the source bounds rather than the grip-normalized animation canvas; this keeps the complete available silhouette in view at the minimum dashboard size. It has no float, timer or RAF.

Reminder and Animation lab keep the approved `ask.png`, `happy.png`, `upside-down.png`, `idle.png` with the center `disappointed.png` head, five `swing-*.png` frames and `props/bottle.png`. URL, crop, clipping, hit silhouette and measured socket definitions stay centralized in the existing PNG asset/geometry modules. No approved PNG is recolored, regenerated or rewritten.

The live hero no longer references `assets/character/companion-guardian.svg`. The live companion/lab no longer import or instantiate `Companion3DComponent`, `BodySpriteRendererComponent`, their temporary character packs, old GLBs or the hand-drawn fallback bottle. WebRenderer no longer injects a temporary animation pack. These historical files remain isolated for offline regression tests and earlier reports; no production view can select them. They are stopped from use rather than destructively deleted.

If one body image fails, the renderer selects a remaining approved full-body image and that image's sockets/hit silhouette. Head strips and bottles are excluded from body substitution. A failed disappointed head is omitted. If every full-body image fails, the existing SlingSip logo appears with a small painted hit region while reminder controls keep working. A failed bottle removes its prop and strand while actual credited-water feedback, state transitions and exit timing continue. No alternate character or invented production artwork is introduced.

## Dashboard and reminder changes

The sidebar, hero, progress ring, remaining water, next break, reminders, streak, quick actions, timeline and history preview keep their existing placement and live data. Shared glass surfaces, restrained cyan borders, off-white text, mint/cyan actions and cyan focus connect the dashboard with the reminder. Crimson supports the mascot's hood and meaningful energy/error statuses; it does not fill primary controls. History, Settings, companion preferences and Animation lab use the same palette.

The native Electron overlay remains alpha-transparent with its existing click-through system. Screen-space paths, web release/retract/reattach order, body-frame cadence, 420 ms settle, lightweight hanging loop, success/bottle/exit and Later/Ignore retry remain controlled by the existing motion/workflow code. No extra render loop is introduced. Old Three.js scenes are no longer created even on PNG failure.

The visual-identity change did not edit Electron, preload, shared hydration/settings/history, scheduler, persistence, startup or tray implementations. Subsequent [restart workflow work](slingsip-restart-workflow.md) is documented separately. Public APIs, secure IPC, persisted identifiers and legacy `%APPDATA%/Mizu` remain unchanged.

## Validation

Final results are recorded in [the validation record](slingsip-visual-identity-validation.json). Native focused coverage verifies shared tokens/static hero at all four widths, single/all-body/bottle failure, alpha transparency, actual sockets, web handoffs, canonical intake, pause/reduced motion, retry, lab isolation and hidden cleanup. The screenshot-heavy fault test initially exceeded its 10-second exit assertion; its assertion was retained with a 30-second allowance for native software rendering, and the rerun passed. Product timing was not changed.

Type checking and production build pass. All 90 existing checks are verified passing across the complete run (89/90) and the targeted Windows-pointer rerun (1/1). The first pointer attempt failed at the native SetCursorPos operation with a Win32 error; the rerun passed the full physical-click/security/recovery case with assertions unchanged. PNG bytes/alpha, storage/history/settings, scheduling, tray/startup, IPC, reduced motion, frame/web/bottle and failure behavior passed. These results precede the subsequent restart-workflow changes.

## Remaining artwork polish

The supplied PNGs are small (body sheets roughly 143–180 px wide) and some source limbs are already cropped. Their existing masks remove captions, separators and exterior checker remnants; they cannot restore missing artwork. The disappointed asset is a head strip, so the existing approved idle-body composite remains. There are no separately authored facial/eye/head channels or additional in-place frames in these PNGs. Higher-resolution, clean-alpha, full-body exports and a complete disappointed pose would improve large-screen sharpness and expression continuity. The current implementation uses the approved originals and does not fabricate replacements.

## Manual review

1. Open Overview at minimum and desktop sizes. Check the Idle mascot, full wordmark, unchanged copy, no horizontal overflow, matching progress and card styles.
2. Navigate History and Settings; check readable muted/error states, cyan keyboard focus and unchanged Save/validation behavior.
3. Open companion and try Drink, Later and Ignore. Check the approved poses, shared bubble/buttons, bottle feedback, exits and dashboard synchronization.
4. Move/click on painted character, bubble and blank desktop. Check existing glance/reactions and native pass-through behavior.
5. Check reduced motion, low power, suspend/resume and Animation lab. Close/hide the companion and check no idle work persists.
6. Review the screenshot gallery; compare 760 px with desktop widths. Repeat on other physical DPI/monitor combinations as needed.

Work stops after local review. Nothing is deployed.
