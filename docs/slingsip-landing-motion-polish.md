# SlingSip landing motion polish — 12 October 2026

Implemented locally for animation review. The existing landing layout, navy/mint theme and approved character identity are preserved. Angular/Electron source, hydration, history, profile, settings, scheduler, tray, IPC, updater and packaging are unchanged. No dependencies were added, and nothing was committed, pushed, published or deployed during this pass.

## Animation architecture and character layers

`landing/src/motion.ts` retains one persistent traveler across the whole story. Scroll chooses its macro position; `swing-path.ts` samples a quadratic Bézier with cosine timing, acceleration through the middle and restrained tangent rotation. The hero uses a separate time-based curved entrance.

`character-rig.ts` creates partitions over the existing, unmodified PNGs. `character-raster.ts` caches them once as cropped, predecoded bitmap layers inside the native SVG rig. This preserves the exact approved artwork while avoiding live luminance-mask repainting during motion. Torso, head, arms, paired legs, scarf and eyes move independently. Torso responds first; head follows with a slower spring; scarf trails with the lowest stiffness/damping. Small limb rotations add trailing and recovery. The socket calculation includes these transforms rather than attaching a rope to an approximate static point.

Settled life runs on elapsed time: approximately 2.2 px breathing, 1.1° head drift plus restrained cursor look, tiny eye movement, blinks every 3.3–5.8 seconds, scarf sway and arm movement. The traveler root does not continuously bounce. Arrival plays a 470 ms overshoot/reverse correction with 0.97 → 1.02 → 1 body compression/recovery. A soft shadow provides grounding for the relaxed pose.

| Beat | Approved artwork and reaction |
| --- | --- |
| Hero / travel | `welcome-hero.png`, layered swing |
| Reminder | `routine-upside-down.png`, attentive hanging pose |
| Drank it | `profile-idle.png`, separate happy state and hand/head reaction |
| Progress | `tour-dashboard.png`, pointing gesture |
| Background / tray | `profile-idle.png`, small relaxed state |
| Future concepts | Closest approved pointing pose, subdued opacity |
| Download | `success-ready.png`, confident celebratory state |

Pose changes crossfade over 130 ms. Source PNGs and the original desktop renderer were not edited. Baked upper ropes are masked at render time so the animated SVG web owns the connection.

## Timelines, web and continuous story

- The hero starts its swing at 100 ms, headline at 380 ms and CTA at 1.1 s. The 1.22 s swing and text reveals overlap; there is no wait for the mascot to stop before text starts.
- The same geometry-derived traveler continues through each section. Global travel keeps the existing smoothed `scrub: .55`; idle, blinking, joint springs and arrival reactions are not scrubbed.
- Desktop How it works remains pinned for 2.15 viewport heights. Reminder → happy/bottle → pointing/progress forms one mini-scene, with overlapping 350/450 ms panel transforms. Mobile retains normal flow without that pin.
- Bottle delivery starts immediately, overshoots its short web length, then swings through diminishing 11° / −8° / 5° / −2.5° arcs. The bottle is visible for about 1.3 seconds; retraction begins at 1.2 seconds and finishes by 1.53 seconds. `+250 ml` appears during the delivery. The animated free hand updates the web endpoint throughout.
- Progress waits for an active delivery before morphing, then fills 0 → 25 → 50% over 750 ms. Leaving the scene completely releases transient effects rather than leaving a bottle/web stuck over another section.
- Web anchors remain fixed for each short swing and face the direction of travel. Increasing speed reduces sag; changing attachment retracts the old strand for 100 ms before drawing the next over 180 ms. Resting released poses clear their strand.
- The dashboard enters in restrained perspective and settles toward neutral. Existing screenshot card layers use shallow depth offsets; a live SVG ring and matching illustrative water/remaining/streak values animate over the real captures. Pointer tilt is limited to 2.4°/2.2°, with no perpetual dashboard wobble.

## Bugs found and fixed

An early manual Drank it click could occur while native pinning exposed the reminder but the scrubbed traveler still lagged behind. The old scene-boundary check canceled that delivery. The animation now recognizes the visible pinned reminder during that gap and preserves the click's delivery.

The initial artwork contained baked upper ropes that could leave a duplicate edge; SVG masking removes those portions. Dashboard depth crops were tightened to the actual cards to avoid a visible rectangular crop edge.

Hidden-page resume exposed a story-state bug during ScrollTrigger refresh: temporary reverted pin measurements could select reminder poses over the hero. Story selection is now suspended between `refreshInit` and the completed `refresh` event, then rebuilt from final geometry. The regression also verifies the correct hero pose and one active pose bank after resume.

A new bottle test initially chained external waits and assertions; trace inspection showed the final visibility query occurred approximately 1.4 seconds after the click, at the end of the intended delivery. Its timing check now samples visibility and movement inside the browser from the actual click, retaining the minimum 950 ms visibility assertion. Blink verification similarly observes both short-lived attribute edges instead of polling past the entire blink; neither test adjustment lengthens production animation timing.

## Performance and lifecycle

One shared GSAP ticker owns life, springs, smoothed pointer input and attachment updates. The former separate cursor RAF is removed. The frame callback has no layout/geometry reads and does not run Angular change detection. Geometry is cached on setup, refresh, resize and pointer entry. Pointer transforms stop updating when converged. Moving layers use transform/opacity; mini-progress uses `scaleX`, and bottle width is set once per delivery. No per-frame blur, shadow, brightness or size animation was introduced.

Only active joint banks and a traveling root request `will-change`; inactive/paused/low-power banks do not. Mobile, save-data and hardware reporting at most four logical processors throttle character life to about 30 Hz. Elapsed-time breathing/blinks remain time-based; spring integration is bounded after slow frames. Hidden-page events remove the life callback and pause owned character, delivery, dashboard and journey timelines. Reduced motion removes cinematic travel/pinning/parallax and preserves readable manual controls. Media preference changes and page disposal clean up rigs, listeners, timelines and ticker callbacks.

Cache resolution follows the CSS maximum mascot size multiplied by device pixel ratio, capped at 1000 pixels. At 1× density this prepares 440-pixel source surfaces rather than 1000-pixel surfaces, reducing the pixel processing area by about 81% while retaining the displayed resolution. Canvas bounds/crops are initialization work only; the animated socket coordinate system stays at 1000 units.

The first renderer used live SVG masks. Idle samples were generally near 16.7 ms, but a fast scroll probe showed median 50 ms / p95 150 ms. A controlled comparison measured about 67 ms median with animated masks, versus 17 ms when character painting was removed. Freezing only joints also substantially improved it, identifying repeated masked-part painting as a real cost. Caching partitions once reduced the subsequent scroll diagnostic to a 16.7 ms median / 50 ms p95, with seven of 120 intervals above 33.5 ms. Cropping/predecoding limits bitmap painting and avoids first-use decoding during a pose swap. Pose selection remains immediate during cache preparation, and each partition replaces its original mask as soon as ready; early interaction never waits for the complete cache. Temporary canvases are released, canceled contexts abort pending work, and blob URLs are revoked on teardown. Caching failure retains approved SVG partitions; missing artwork keeps the existing available-pose/static fallback.

Final performance evidence is recorded in [capture.json](previews/landing-motion/capture.json) for initial idle, warmed idle and scroll travel, without video encoding. These are headless Edge RAF measurements on a browser reporting four logical processors, not a physical-device certification. The page targets 60 Hz where hardware permits; smoothness on the intended recording machine still needs visual review.

| Final 120-frame sample | Median interval | p95 interval | Intervals above 33.5 ms |
| --- | --- | --- | --- |
| Initial idle | 16.7 ms | 16.8 ms | 1 |
| Warmed idle | 16.7 ms | 16.8 ms | 0 |
| Fast scroll through dashboard | 16.8 ms | 50 ms | 11 |

All six pose banks were cached at each sample's end. The fast-scroll tail still contains hitches in this environment; do not describe it as a locked 60 FPS result.

## Repository and download audit

There were no GitLab links or release-history sections in the existing page, and none were added. Production source contains no GitLab reference or Releases heading. Official GitHub repository/download fallback links and the validated latest-release API remain intact. Unverified static `v1.0.0` labels were replaced with “Version on GitHub”; a version is displayed only after a valid official release response. No fake asset/version/download metadata was added. Review captures deliberately mock an unavailable GitHub release.

## Validation and review

Final build and browser-suite results are recorded in [motion validation](slingsip-landing-motion-validation.json). Production build/strict TypeScript pass. On the final bundle, 25 tests passed in the full run; the tray pointer test timed out in `page.goto`, before its assertions. That unchanged test then passed on an isolated `--last-failed` rerun (5.2 s test / 6.9 s run). All 26 distinct tests have passed on the final bundle, but this is not a claim of one clean 26/26 run. The navigation-timeout cause is not established; retain it in QA evidence rather than treating it as a confirmed tray/production defect.

The suite covers curved timing, simultaneous hero reveal, independent joints/blinks, actual hand-to-web geometry, bottle visibility/movement, progress, hidden-page pause, low-power throttling, reduced-motion recreation, reverse travel, mobile/tablet widths, tray controls, missing assets and safe download behavior.

Changed files are confined to the landing project and review material:

- New renderer/helpers: `landing/src/character-rig.ts`, `character-raster.ts`, `swing-path.ts`, `dashboard-motion.ts`.
- Existing motion/demo/style: `landing/src/motion.ts`, `demo.ts`, `style.css`.
- Release-label correction: `landing/index.html`.
- QA/tooling: `landing/tests/motion.spec.mjs`, `landing.spec.mjs`, `playwright.config.mjs`, `scripts/capture-motion.mjs`, `package.json` (script only), `README.md`.
- Review: this report, `docs/slingsip-landing-motion-validation.json` and `docs/previews/landing-motion/`.

Commands from the repository root:

```powershell
npm --prefix landing run build
$env:LANDING_TEST_PORT='5174'
npm --prefix landing test
$env:LANDING_PREVIEW_URL='http://127.0.0.1:5174'
npm --prefix landing run capture:motion
```

See the [nine curated scene captures](previews/landing-motion/index.html). The optional motion recording remains a local, Git-ignored QA artifact and is not distributed with the gallery. The user's existing development server remains at **http://127.0.0.1:5173**. The temporary production QA preview is stopped after review.

## Asset limits and remaining manual review

The repository contains flattened poses, not authored transparent joint cutouts or hidden surfaces. The rig uses constrained rotations and a small seam underlap; large anatomical deformation would expose the masks. Legs are a paired layer. Eyes blink/look using the approved eye artwork, not new authored expression frames. The happy state reuses the approved smiling relaxed pose with distinct motion. The bottle source remains relatively low resolution. No replacement identity, generated character or heavy 3D renderer was introduced.

Scroll down/back up in the running page on the intended machine to assess follow-through and frame pacing. Check slow/fast scroll, an early manual Drank it click, bottle readability, resize, Tab/Enter, reduced motion on/off and tab hide/resume. Automated verification uses headless Edge/Chromium on Windows; Safari/Firefox and physical weaker-device smoothness remain manual. This report does not claim universal 60 FPS or a user-approved artistic sign-off.
