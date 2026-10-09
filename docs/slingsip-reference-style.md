# SlingSip supplied-reference review

Historical review of the preceding temporary 3D renderer. The supplied PNG assets are now the default; see [the current PNG integration report](slingsip-png-integration.md). The screenshots and results below describe the October 6 build.

Local work on 6 October 2026. The supplied `SlingSip Desktop Hydration Companion.png` is the visual target. **This build is a development approximation, not an exact reproduction.** The PNG contains no rigged model, clips or morphs. The requested final character and bottle GLBs are still missing. Temporary models stay under `public/assets/character/temporary-3d/`, retain their temporary metadata and never occupy a production filename.

## What changed

- The 2D reminder uses the reference's rounded slate panel, white “Time for water!” heading, live “Drink [amount] ml?” copy, cyan Drank it button and slate Later button. Success shows a cyan check, “Great choice!” and the actual credited amount. Goal-complete, already-logged, error and retry copy still comes from the existing coordinator.
- The panel occupies the existing reserved layout height and keeps its original bottom/tail anchor. Existing progress, Open dashboard and Hide controls remain accessible. The dashboard layout and branding are unchanged.
- The development guardian has a charcoal/navy hood, coral trim, brighter almond eyes and cyan chest accent. Its same 17-bone rig and 18 in-place clips still play along the existing screen trajectory. Blinking also affects the eye rims; temporary pupils appear for happy/curious/excited moods. Production pupil visibility is untouched.
- The separate development bottle has cyan glass/water, dark cap, outlined handle and bright rim/highlight geometry. A transparent drop-and-SlingSip label replaces its opaque plate. Only temporary assets receive this generated label; final GLB labels/materials remain authored. Fades preserve authored transparency at full scalar opacity, preventing alpha labels from becoming opaque plates.
- Bottle presentation is upright and slightly larger, still using the existing bounded drop, ten-degree damped swing and retract sample. No duration or state transition changed.
- Three existing socket-to-anchor lines now carry reusable braided white ribbon detail. The core endpoints and release/free-flight/reattach ordering are unchanged. Each line owns one bounded detail mesh with preallocated buffers; hidden strands also hide their detail.

The renderer adds no reminder timers, hydration calls, scheduler changes or IPC. Hydration, persistence, history, Settings, tray and Windows startup code are unchanged.

## Files

| Files | Purpose |
| --- | --- |
| `src/app/features/companion/speech-bubble.component.{ts,html,scss}` | Presentation-only reference copy, panel styling and confirmation mark. |
| `src/app/features/companion/companion.component.{html,scss}` | Button text, button/progress/footer styling; callbacks unchanged. |
| `src/app/features/companion/animation-lab.component.html` | Retains preview-only explanatory copy in the shared bubble. |
| `src/app/features/companion/animation/swing-config.ts` | Bottle scale and upright base angle only. Trajectories/timing unchanged. |
| `src/app/features/companion/three/character-model-controller.ts` | Temporary-pack-only pupil visibility metadata. |
| `src/app/features/companion/three/bottle-controller.ts` | Transparent temporary label; preserves authored transparency through fades. |
| `src/app/features/companion/three/web-controller.ts` | Reusable braided web detail and disposal. |
| `scripts/placeholder-3d.mjs`, regenerated `public/assets/character/temporary-3d/{guardian,bottle}.glb`, its README | Clearly separated reference-guided development geometry. |
| `tests/{asset-integration,branding,character-motion,three-companion}.spec.mjs` | Updated visible-copy/blink mapping assertions, dynamic 175 ml reminder, braided endpoints/opacity/buffer reuse/disposal and authored bottle transparency regression. Existing behavior assertions retained. |
| `scripts/{capture-reference-style,build-reference-review}.mjs`, `docs/previews/reference-style/` | Isolated native screenshots and sampled interactive playback. |
| This report, README, mappings and validation JSON | Current handoff and preceding-report labels. |

The [asset integration report](slingsip-3d-integration.md) documents GLTFLoader/AnimationMixer discovery, all animation roles, facial aliases, sockets, fallback and cleanup. Its preceding screenshots describe the models before this visual refinement. Three.js [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) and [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html) are the underlying loaders/players; code remains tied to the installed Three.js version.

## Assets needed for the exact target

Supply self-contained, Y-up, +Z-facing GLBs with embedded textures, the reference's actual hooded chibi sculpt/materials and readable bottle label:

1. `src/assets/3d/character/slingsip-character.glb`: skinned rig; in-place `SwingIn`, `ArriveSettle`, `AskGesture`, `Smile`, `WebShoot`, `BottlePresent`, `Success`, `SwingExitRight`, `SwingExitLeft`, `Wait`, `Disappointed`, `Idle` clips. Detailed grab/down/bottom/up/release/mid-air/attach/retract clips can replace the generic swing roles. Include the upside-down asking/hanging pose shown in the reference, with Wave/Point gestures inside AskGesture and Web Shoot/Present Bottle gestures in their corresponding clips. Keep locomotion out of the export root.
2. Eight independent named facial shapes: `neutral` (or neutral base), `blink` (or left/right), `smile`, `happy`, `curious`, `waiting`, `disappointed`, `excited`. The temporary model currently supplies blink/smile/frown plus controller recipes; it does not contain all eight authored expression shapes.
3. Character nodes `WebGrip`, `BottleGrip`, `Foot_L`, `Head`, `Chest`, or explicit descriptor aliases. WebGrip must be authored at the actual attachment point in each clip, including the inverted asking pose. A dedicated foot attachment variant requires an explicit pose/socket mapping; the current idle attachment remains hand-based. Separate eye bones/pupils enable gaze.
4. `src/assets/3d/props/slingsip-bottle.glb`: cyan bottle, dark cap/handle, embedded drop/SlingSip label and top attachment `BottleWebGrip` (aliases documented in the integration report). Keep all visual geometry below its top anchor. No baked desktop background.

The current placeholder has an upright asking/hanging pose, simple fingers, approximate facial recipes and basic cyan materials. It does not provide the reference's sculpt, eight distinct expressions, authored gesture polish, inverted idle or cinematic glass glow. Screen paths remain code-owned. Put final files at the preferred paths and recreate the scene; export-name differences can be configured in `COMPANION_3D_ASSETS` without touching hydration or motion logic. Actual final compatibility must then be tested.

Author body inversion/lean on deform or pose bones below the stable export root. Scene-root and default `Armature`/`RigRoot`/`RootMotion` position, rotation and scale tracks are filtered to preserve code-owned travel. A distinct pose pivot below that root can retain in-place body rotation. Animate the shared WebGrip to coincide with the correct attachment point for each clip, or supply a separate foot socket and explicit pose/socket mapping for the inverted hanging variant.

## Performance and interaction

No new render loop, bloom pass, shadow map, background or transmission render target is introduced. Moving phases use the existing frame stream; hanging remains 15 fps (8 in low power); reduced motion suppresses ambient updates. Hidden clears once and stops. Web detail updates only when endpoints change and uses at most 256 segments per strand pair. Meshes/materials/buffers dispose with the existing scene. Character mesh and bubble hit testing remain; web/bottle/blank pixels pass through.

## Validation and local review

Type checking and production Angular/Electron builds pass. The final complete `npm test -- --reporter=list,json` run on this build finished with **84 passed, 1 failed, 0 skipped, 0 flaky** out of 85 tests. All **22 affected** asset-integration, body-rendering, branding, motion and 3D tests passed, including the corrected four-mesh blink mapping and authored-transparency regression. Existing scheduler, settings, persistence/restart, history/streaks, tray, startup and IPC coverage passed. [Machine-readable results](slingsip-reference-validation.json) record the run and actual mappings are in [the placeholder inventory](slingsip-3d-placeholder-mappings.json).

The sole unresolved failure is the retained physical Windows pointer regression in `tests/phase-one.spec.mjs`: `windows-pointer.exe Move 1038 543` reports “The system cannot find the file specified.” The helper exists (5,632 bytes); this message does not establish a missing executable. Its native cursor-operation cause remains unconfirmed. Assertions are retained unchanged. Physical click-through therefore still needs manual verification on the target unlocked desktop, alongside the passing transparency, renderer hit-test and bubble-interactivity coverage.

Native isolated captures produced **156 sampled frames across seven flows**, with no renderer page errors. The local [interactive review](previews/reference-style/motion-review.html) includes the supplied design reference, four entries, Success, Later, Ignore, scrubbing/speed controls and a transparency grid. Its 26-image gallery is generated from the latest capture rather than stale phase PNGs. Screenshot sampling on software WebGL is a review artifact, not a frame-rate or CPU benchmark.

- [Reminder](previews/reference-style/classic-reminder.png)
- [Success and bottle](previews/reference-style/success-delivering-bottle.png)
- [Later](previews/reference-style/later-waiting.png)
- [Ignore](previews/reference-style/ignore-waiting.png)
- [Minimum 760 × 560 window](previews/reference-style/animation-lab-minimum.png)

The minimum-size lab capture keeps the model inside its stage and the sidebar wordmark readable. Existing geometry tests cover other desktop/DPI fixtures; final art and other physical monitor configurations still need the manual checks below. Normal user data was not used for the captures or test fixtures. No deployment.

To regenerate the local review after a production build, run these in sequence with other native tests stopped:

```powershell
node scripts/capture-reference-style.mjs
node scripts/build-reference-review.mjs
```

Keep `design-reference.png` beside the review HTML. Captures use `--companion-test` and close their isolated Electron application.

## Manual checklist

- Run `npm run dev`. Open Animation lab for Classic, High, Fast Zip, Upside Down, Success, Later and hanging previews; it must not change water.
- Trigger a real development reminder. Check dynamic glass size, slate/cyan panel, hand-attached braided web, settle and simultaneous body animation. Blank pixels/web/bottle must pass through.
- Drank it credits once immediately; check Great choice/actual amount, web shot, bottle drop/sway/retraction and right exit. Verify dashboard progress.
- Later and Ignore show the existing retry interval, disappointed reaction, left exit and scheduled return. Pause/Hide/reminders OFF must cancel return as before.
- Inspect at minimum 760 × 560 dashboard size and other desktop DPI/work areas; check all controls, bottle clearance and no clipped model. Test reduced motion, low power, lock/sleep/resume and graphics fallback.
- Add final GLBs, recreate the scene, inspect actual source/mapping/warning datasets and repeat the checks. Confirm all authored expressions/gestures and the inverted asking attachment before calling the character final.

No deployment. Stop after local review.
