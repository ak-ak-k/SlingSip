# SlingSip companion visual polish

Local Windows review, 8 October 2026. This change polishes the existing approved PNG companion. Dashboard design, hydration, scheduling, retries, history, settings, persistence, tray and startup behavior retain their existing implementation. No character artwork, dependencies or deployment were added.

## Visual changes

- **Mascot:** both dimensions are 20% larger, retaining the 160:220 aspect ratio. Normal motion height changes from 196 to 235.2 DIPs; short work areas retain the proportional size clamp. Original PNG bytes and silhouette clipping are unchanged.
- **Webs:** rounded quadratic SVG strands have a small bend, softer opacity (56% for the main strand), movement-directed casting and local anchors. Visible main strands are bounded to 1.12 mascot heights rather than drawing from a distant screen-top pivot. Resting anchors cast outward from the holding hand. Ask, Happy and Idle have separately measured web-hand sockets; the original artwork/trajectory pivot stays unchanged. Idle and cursor rotation pivot around the holding socket to keep it connected. Bottle strands curve subtly with their pendulum. Old-web retraction and free-flight order remain intact; webs accept no pointer input.
- **Placement:** Electron supplies the visible dashboard's actual content bounds through an optional read-only field in the existing snapshot. The overlay converts those bounds relative to its Electron work area. It prefers a free right desktop gutter, then the left; a dashboard that fills the work area uses its header/decorative hero region above the progress/action cards, with the bubble beside the mascot. Placement freezes during an interaction so window movement cannot teleport the character. The next reminder reads current bounds. Compact work areas retain an edge-clamped fallback. No new IPC channel, preload API, scheduler decision or renderer refresh loop was introduced.
- **Bottle:** the existing prop is approximately 1.5 times its former visual size. In the unchanged 1,200 ms delivery phase it is visible for approximately 984 ms, including an approximately 816 ms fully opaque interval. It keeps the existing ten-degree damped pendulum, hand attachment, water feedback and retraction. Water credits before the visual sequence; delivery adds no intake delay. Very short viewports can still constrain the bottle to keep it inside the work area.
- **Exits:** Later and Ignore travel left; successful drinks travel right. Earlier lateral acceleration makes the direction visible promptly. Each existing Bezier exit remains opaque until the entire mascot has travelled beyond its chosen work-area edge. Exit durations and retry intervals are unchanged.
- **Bubble:** the dark surface has a restrained cyan border, soft shadow/glow and greater opacity for contrast. The side placement has a side-facing tail. Copy, buttons and interaction behavior are retained.
- **Hero:** the existing approved mascot and subtle radial glow already satisfy the requested quiet hero treatment. Its layout, artwork and animation behavior were left unchanged.

## Changed files

| File | Purpose |
| --- | --- |
| `src/app/features/companion/animation/swing-config.ts` | Size, anchor limits, exit tuning and bottle visibility parameters |
| `src/app/features/companion/animation/companion-placement.ts` | New pure work-area/dashboard placement helper |
| `src/app/features/companion/animation/swing-motion.ts` | Apply placement; preserve a bounded entry arc; clarify directional exits |
| `src/app/features/companion/animation/companion-motion.service.ts` | Freeze dashboard geometry per visual interaction |
| `src/app/features/companion/animation/web-geometry.ts` | New bounded anchors and curved strand geometry |
| `src/app/features/companion/animation/body-choreography.ts` | Optional visual anchors and bottle reveal/retract envelope |
| `src/app/features/companion/animation/slingsip-assets.ts` | Measured web-hand sockets on existing PNGs |
| `src/app/features/companion/animation/slingsip-png-choreography.ts` | Directional local webs and actual hand projection |
| `src/app/features/companion/animation/slingsip-png-renderer.component.ts` | Socket metadata and idle/cursor pivot alignment |
| `src/app/features/companion/web-renderer.component.ts` | SVG path rendering, opacity and power/motion preference handling |
| `src/app/features/companion/companion.component.ts` | Convert native dashboard bounds to overlay-local coordinates |
| `src/app/features/companion/companion.component.html` | Side placement presentation class |
| `src/app/features/companion/reminder-interaction.service.ts` | Delegate only bubble coordinates to the visual layout |
| `src/app/features/companion/speech-bubble.component.scss` | Bubble separation and side tail |
| `shared/desktop-contract.ts` | Optional read-only dashboard bounds metadata |
| `electron/desktop-ipc.ts` | Populate existing snapshot with visible content bounds |
| `tests/helpers/companion-visuals.mjs` | Measure real SVG curve endpoints against transformed sockets |
| `tests/character-motion.spec.mjs` | Dashboard-aware reduced-motion position and ordered flow observation |
| `tests/companion-polish.spec.mjs` | Placement, size, directional travel, socket/curve, bottle and native cleanup regression coverage |
| `README.md` | Current report and screenshot links |
| `docs/slingsip-companion-polish.md`, `docs/slingsip-companion-polish-validation.json`, `docs/previews/companion-polish/` | Review report, validation record and native preview artifacts |

## Validation

Type checking and the production build pass. The broad run passed 33 of 35 checks; its two failures were the initial-hidden-frame observation and a paused native visibility transition. The ordered-flow observer was corrected without removing the final-hide assertion, and visual context sampling was limited to reminder startup. After rebuilding, both failures and all four polish checks passed (6/6). All 35 targeted checks therefore have passing results across the broad run and final follow-up. The complete repository suite was not rerun. Exact commands, initial failures and final results are recorded in [the machine-readable record](slingsip-companion-polish-validation.json). Native tests use isolated profiles and do not change normal hydration data or the user's running app. Original asset hash assertions remain in the PNG tests.

Placement fixtures cover 1366, 1920 and 2560 pixel work areas at 100/125/150% scale; native captures use this Windows desktop's 1920 by 1032 DIP work area. The normal-window and maximized-window native test compares the settled bubble and body against actual progress, reminder-status, streak and button rectangles. These are geometry/native checks, not physical tests on every monitor/DPI combination. The hero fallback follows the existing Overview header geometry; it does not track page scrolling or move a reminder that is already active.

Reduced motion retains its existing shortened presentation and disabled idle. Low power retains the existing 30 fps trajectory cap, removes web shadows and uses straight simplified strand geometry. The web/body/bottle continue sharing the existing finite frame owner. Hidden visual nodes are destroyed, frame callbacks removed, idle/fade animations cancelled, and no extra interval or RAF loop was introduced. Physical Windows pointer automation was not rerun for this visual-only change; existing input code and assertions are retained.

## Local review

Open the [native preview gallery](previews/companion-polish/index.html). It layers dashboard and transparent overlay captures using measured native bounds; individual images remain available with their original alpha. The [capture record](previews/companion-polish/capture.json) includes work-area/window geometry and actual directional exit samples.

1. Use tray **Restart SlingSip** after building to load updated assets/code.
2. Open a reminder with the dashboard normally sized, maximized and closed. Check clear progress/buttons and a hand-connected web.
3. Click **Drank it**: progress updates immediately, the larger bottle hangs/swings, then the character travels right before disappearing.
4. Choose **Remind me later**, then separately ignore a reminder: both exits travel left and the existing retry behavior remains intact.
5. Check transparent margins/webs still pass input through; painted character and bubble buttons remain usable.
6. Check cursor awareness, low power, reduced motion, display suspension and hidden cleanup. Move/scroll the dashboard between reminders to review the next placement.

Stop after local review. No deployment was performed.
