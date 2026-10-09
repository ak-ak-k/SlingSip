# SlingSip 3D asset integration

The supplied PNG renderer is now preferred. This report documents the retained 3D fallback and a preceding build; see [the current PNG integration](slingsip-png-integration.md) for current visuals and validation.

This is the pipeline handoff **before the supplied-reference visual refinement**. The later historical [reference-style report](slingsip-reference-style.md) records temporary-model, web, bottle and bubble changes and that build's validation. The loading/mapping contract below remains applicable to the fallback; this report's screenshots and test totals describe the preceding build.

Local integration on 6 October 2026. **The two requested final GLBs are missing.** Following the user's clarification, this change uses only the existing, clearly isolated development placeholders. No new character or bottle artwork is generated and no placeholder is copied into a final filename. Final mesh, rig, material, expression and clip compatibility remain unverified. [Asset inventory](slingsip-3d-asset-inventory.json) records the missing files.

## Files changed

| File | Change |
| --- | --- |
| `angular.json` | Copies `src/assets/3d/**` to `assets/3d/**`, alongside existing public assets, for development and built Electron loads. |
| `src/assets/3d/README.md` | Marks the final-input directory and missing-file/fallback behavior. |
| `three/companion-3d-assets.ts` | Preferred character/bottle URLs, explicit temporary fallback, optional clip/node/morph aliases, root-motion node names and bottle anchor. |
| `three/character-animation-controller.ts` | New AnimationMixer owner; discovers/maps clips, filters export-root/unbound tracks, caches actions, samples existing normalized visual time and disposes actions. |
| `three/character-animation-sequence.ts` | New visual-only sequence selection inside existing states/durations. |
| `three/character-facial-controller.ts` | New eight-mood morph controller, independent blinking, multi-mesh/left-right channels, neutral reset and reported missing targets. |
| `three/character-model-controller.ts` | Rig validation, GLTFLoader fallback, socket aliases, optional automatic height/grip normalization, face/animation composition, subtle head/pupil/eye-bone gaze and diagnostics. |
| `three/bottle-controller.ts` | Preferred/fallback GLTF loading, top-socket/bounds normalization, preserved production labels/materials and temporary-only generated label. |
| `three/companion-3d-scene.ts` | Integrates controllers with the existing frame stream, sockets, bottle choreography, raycasts and render lifecycle; publishes actual sources/mappings/warnings. |
| `scripts/inspect-3d-assets.mjs` | Offline GLB JSON inventory of clips, morph names, nodes/skins, extensions and external resources; explicitly distinguishes missing/incompatible files. |
| `tests/asset-integration.spec.mjs` | New named-clip/root-motion, normalization/gaze, facial composition, sequence and native missing-file fallback regressions. |
| `README.md`, `docs/companion-3d-assets.md`, `docs/phase-7e.md`, this report, JSON inventories/validation and `docs/previews/asset-integration/` | Current usage, discovery contract, preceding-build label and handoff. |

`three/` paths are under `src/app/features/companion/`. Existing placeholder binaries, WebController, screen trajectory, reminder coordinator, hydration calculations, scheduler, persistence, dashboard/history/settings layout, tray/startup, preload and IPC are unchanged by this integration. No deployment.

## Loading and fallback

Preferred runtime URLs are `assets/3d/character/slingsip-character.glb` and `assets/3d/props/slingsip-bottle.glb`, copied from the supplied source paths. GLTFLoader loads them locally under the existing renderer CSP. Each missing/unusable model falls back independently to `assets/character/temporary-3d/guardian.glb` or `bottle.glb`. A final character may therefore coexist with a temporary bottle, with separate temporary flags. Missing WebGL2, failed fallback assets or context loss retain the existing independent sprite renderer.

The character must contain a skinned rig, a usable in-place swing clip, and resolvable grip/free-hand/boot/head/chest nodes. A missing optional pose uses a documented compatible pose and emits a warning; it never extends a business timeout. A model with no usable animation or a required unresolved rig node uses the temporary fallback. Async late results and invalid models are disposed.

The canvas exposes `characterSource`, `bottleSource`, `characterTemporary`, `bottleTemporary`, `temporary`, `assetWarnings`, `animationMapping`, `morphMapping`, `socketMapping`, `bottleAnchor`, `strippedRootTracks` and `unboundTracks`. These describe what actually loaded. In DevTools:

```js
const canvas = document.querySelector('[data-testid="companion-3d"]');
JSON.parse(canvas.dataset.assetWarnings);
JSON.parse(canvas.dataset.animationMapping);
JSON.parse(canvas.dataset.morphMapping);
JSON.parse(canvas.dataset.socketMapping);
```

Restart/recreate the renderer after adding the actual files; a scene that already selected a fallback does not continually retry missing assets.

## Animation mappings

Names match exact aliases first, then case/punctuation-insensitive aliases, removing an exporter namespace such as `Armature|`. Explicit `clips` overrides in the descriptor take priority. Ambiguous normalized names, duplicates, missing roles and unbound tracks are reported. The table lists preferred names and the **current temporary** mappings; it does not claim discovery of unavailable final clips.

[Machine-read mappings for the existing placeholder](slingsip-3d-placeholder-mappings.json) record its actual clip names, resolved roles, morphs, sockets and missing dedicated shapes.

| Visual role | Preferred clip / common alias | Current temporary clip |
| --- | --- | --- |
| SwingIn | `SwingIn`, `swing-in`, `swing` | Generic lookup: `swing-down`; current detailed entry uses grab/down/bottom/up/release/mid-air/attach clips. |
| ArriveSettle | `ArriveSettle`, `settle`, `arrive` | `settle` |
| AskGesture | `AskGesture`, `asking`, `ask` | `asking` |
| Smile | `Smile`, `smile-pose`, `success`, `happy` | `success` |
| WebShoot | `WebShoot`, `web-shoot`, `web-shot` | `web-shot` |
| BottlePresent | `BottlePresent`, `bottle-present`, `bottle-hold` | `bottle-hold` |
| Success | `Success`, `celebrate`, `celebration`, `happy` | `success` |
| SwingExitRight | `SwingExitRight`, `exit-right`, `exit-swing` | `exit-swing` |
| SwingExitLeft | `SwingExitLeft`, `exit-left`, `exit-swing` | `exit-swing` |
| Wait | `Wait`, `waiting`, `hanging`, `idle` | `waiting`; detailed hanging uses `hanging`. |
| Disappointed | `Disappointed`, `sad`, `disappointment` | `disappointed` |
| Idle | `Idle`, `hanging`, `idle` | `idle` |

Detailed `swing-grab`, `swing-down`, `swing-bottom`, `swing-up`, `release`, `mid-air`, `attach` and `retract` clips are supported when supplied. When only a generic SwingIn clip exists, it samples the full entry progress continuously across web handoffs; it does not restart at each web/body segment. Both outgoing named roles support a shared `exit-swing` fallback. Missing expressive clips degrade to compatible poses with a warning, rather than pretending the corresponding authored animation exists.

AnimationMixer samples in-place clips at normalized progress. Scene/export-root position, rotation and scale tracks are removed from the loaded runtime clones; source GLBs remain untouched. Default export-root names are `Armature`, `RigRoot` and `RootMotion`, configurable through `rootMotionNodes`. Hips/limb tracks are retained. A differently named bone containing baked locomotion needs an explicit mapping or an in-place re-export; arbitrary root-motion retargeting is not inferred.

## Sequences and synchronization

- **Success:** SwingIn → ArriveSettle → AskGesture → Smile → WebShoot → BottlePresent → Success → retract → SwingExitRight.
- **Later:** SwingIn → ArriveSettle → AskGesture → brief waiting/okay gesture with disappointed face → Disappointed → SwingExitLeft.
- **Ignore:** SwingIn → ArriveSettle → AskGesture → Wait → Disappointed → SwingExitLeft → the existing retry.

The existing motion service continues to own screen-space Bezier/pendulum position, rotation, state transitions and timing. The 420 ms arrival and bubble presentation remain. AskGesture uses the first two visible seconds, followed by a 4.2-second hanging/Wait loop. Smile uses the existing 450 ms success phase. Inside the existing 1.2-second bottle phase, WebShoot occupies 0–18%, BottlePresent 18–70%, Success 70–86%, and retraction 86–100%. Bottle geometry still follows the existing shot/drop/damped-swing/retract presentation. Waiting/disappointed body gestures fit the existing one-second Waiting phase. Retry, ignore and hydration decisions remain with the original coordinator; this renderer adds no reminder timers or intake requests.

## Morph-target mappings and gaze

| Mood | Discovered targets / fallback | Actual temporary support |
| --- | --- | --- |
| neutral | Optional `neutral`/`face-neutral`; otherwise managed weights reset to zero. | Neutral base pose. |
| blink | `blink`, `eyeBlinkLeft`, `eyeBlinkRight`, left/right blink aliases. | `Eye_L:blink`, `Eye_R:blink`. |
| smile | `smile`, `mouthSmileLeft`, `mouthSmileRight`, left/right smile aliases. | `Mouth:smile`. |
| happy | Dedicated `happy`/`face-happy`; otherwise smile. | Smile recipe; no dedicated happy shape. |
| curious | `curious`, `browInnerUp`, `brow-raise`, `face-curious`. | Head/pupil glance; no curious/brow morph. |
| waiting | Dedicated `waiting`/`face-waiting`; otherwise light curious or 25% disappointed shape. | Light frown recipe. |
| disappointed | `disappointed`, `frown`, `sad`, left/right mouth-frown aliases. | `Mouth:frown`, 75% during Waiting/left exit. |
| excited | Dedicated `excited`/`face-excited`; otherwise happy/smile. | Smile recipe; no dedicated excited shape. |

Blink composes independently with the selected mood. Only managed channels reset; unrelated authored morph channels are retained. `morphAliases` can map final export names. Missing dedicated shapes are recorded, including when a recipe provides a usable fallback. Neutral and fallback recipes are controller behavior, not newly authored final facial assets.

The existing saved cursor/reaction preferences gate awareness. Head yaw/pitch are small additive offsets, pupils shift subtly, and optional `Eye_L`, `Eye_R`, `LeftEye`, `RightEye`, `eyeLeft` or `eyeRight` bones receive smaller rotations. Pupil meshes are discovered by `pupil` in their names. Animation baselines restore before each sample to prevent accumulated head/eye/breath offsets. Nearby cursor direction can select curious mood; lack of a brow target leaves the head/eye glance usable.

## Web sockets and bottle

| Socket purpose | Preferred node | Supported bone/socket aliases |
| --- | --- | --- |
| Primary web grip | `WebGrip` | `WebSocket_R`, `socket-web-right`, `RightHand`, `Hand_R`, `HandR` |
| Bottle web hand | `BottleGrip` | `BottleSocket`, `socket-bottle`, `LeftHand`, `Hand_L`, `HandL` |
| Inverted entry boot | `Foot_L` | `LeftFoot`, `FootL` |
| Head gaze | `Head` | `head-bone` |
| Chest sway/breath | `Chest` | `Spine2`, `Spine1`, `Spine` |

Exporter prefixes/case/punctuation normalize during discovery. `nodes` and `nodeAliases` allow exact final mappings. A hand-bone fallback uses its exported origin and reports that precise fingertip sockets should be supplied. Current placeholders resolve the five preferred nodes directly.

Final models use measured height and grip alignment inside a separate model wrapper, preserving the code-owned screen trajectory. The grip remains aligned during attached phases; release/free flight allows the actual hand to move. Exports should be Y-up and face +Z. Incorrect axes or badly authored socket positions need asset correction or an explicit descriptor mapping; they cannot be verified while the files are missing.

The existing three reusable Three.js line geometries connect current world-space hand/boot sockets to screen anchors and the bottle top. Old web retraction precedes free flight and the new web attachment. Webs never claim mouse input. The separate bottle GLB uses `bottleAnchor` or `BottleWebGrip`, `BottleTop`, `WebAttachment`, `BottleAnchor`; otherwise its bounds top centre is an explicitly approximate anchor with a warning. Its height normalizes to one model unit and its origin follows the web endpoint. Production label textures/materials are preserved. Only the existing temporary bottle receives the generated SlingSip label. Drop, damped swing, water feedback and retraction are decorative; canonical water is credited by existing logic.

## Transparency, click-through and performance

The existing transparent Electron window and alpha WebGL2 canvas remain. No background, heavy shadow or post-processing is added. Character mesh raycasts feed the current input owner alongside the 2D bubble DOM targets, through unchanged IPC. Blank canvas, web and bottle pass input through. The dashboard itself has no 3D canvas; only the already-existing isolated Animation lab previews the companion.

Moving phases render on the existing finite frame stream, without a second movement RAF. Visible hanging/waiting uses 15 fps, Success 24 fps, low-power idle 8 fps; reduced motion suppresses ambient rendering. Hidden clears once and stops the visual timer. Suspend/document inactivity pauses rendering. No background asset-retry loop runs. Size/DPR caps remain. Model destruction uncaches actions, cancels timers/listeners, disposes geometry/materials/textures/skeletons and releases WebGL. Software WebGL CPU/battery cost and final-art GPU cost require physical measurement; test frame counters are not a battery benchmark.

## Validation

Type checking and production renderer/Electron builds pass. The first focused run passed all **13 tests**, covering the new integration and existing 3D/body renderer. The final full `npm test -- --reporter=json` run rebuilt both production targets and completed with **84 passed, 1 failed, 0 skipped, 0 flaky**, out of 85 tests. All five new integration tests and all existing 3D/body-rendering checks passed in that final build, including the added head/eye no-accumulation assertion. Existing scheduler, storage/restart, history/streaks, settings, tray/startup, synchronization and secure IPC checks passed.

The remaining physical Windows regression, `Native swing regression: transparent overlay, native hydration clicks, secure IPC, reuse, and recovery`, failed on `windows-pointer.exe Move 1132 462` with `The system cannot find the file specified`. The helper executable exists; its Win32 cursor operation failed. The cause is unconfirmed. Its physical painted-hit, blank click-through, native click and recovery assertions remain unchanged. Recheck physical mouse interaction on an unlocked interactive Windows desktop; passing synthetic raycasts/native button tests do not replace that test.

[Machine-readable validation](slingsip-3d-validation.json) records the runs and failure. Current native captures show [the reminder](previews/asset-integration/3d-reminder.png) and [bottle success](previews/asset-integration/3d-bottle.png), both using the explicit temporary models. Native pixel assertions confirm zero alpha in blank overlay space. The screenshots are local visual evidence, not production character art or a rendering benchmark.

## Manual checklist and missing data

1. Run `npm run dev`. Open Animation lab and confirm the known temporary rig/bottle appear, all four entries work, and warnings identify both missing preferred files. No placeholder should exist under a final filename.
2. Trigger a real reminder. Check separate knees/arms/head motion during travel, release/free flight/reattachment, settled web endpoint and the existing 2D bubble.
3. Use Drank it, including a double click. Confirm exactly one configured/capped glass, synchronized dashboard, Smile → WebShoot → bottle lowering/swing → Success → retraction → right exit.
4. Try Later and Ignore. Check waiting/disappointed body/face, left exit, the actual configured retry and reuse of one overlay.
5. Move/click near the character, disable cursor awareness/reactions, and test blink with smile/frown. Check transparent margins and blank desktop click-through with the real physical mouse.
6. Enable reduced motion and low power; test hide/reopen, lock/unlock and sleep/resume. Check stopped hidden render counts, saved preferences and no duplicated render/return loop.
7. Confirm 2D Overview/History/Settings, tray intake/pause/quit, startup, restart persistence and existing history/streak calculations.
8. Once actual GLBs are supplied, run `node scripts/inspect-3d-assets.mjs docs/slingsip-3d-asset-inventory.json`, rebuild/restart, inspect actual source/mapping diagnostics, and verify all named roles, precise fingertip/top anchors, axes, material transparency and seams at existing desktop sizes/DPI settings.

Missing now: **both final files and therefore their actual clip names, sockets, morph names, skeleton/rest axes, materials, textures, model dimensions and license/source data**. Current temporary art lacks dedicated happy/curious/waiting/excited targets and distinct left/right exit clips; the documented recipes/shared clip handle those states for integration testing. Missing pose warnings remain visible in diagnostics. This loader does not configure Draco/Meshopt/KTX2 decoders; compressed assets need local decoder support or compatible re-export once their data is known. Export-local hips locomotion, skin quality, alpha-cutout mesh hit precision, clip boundary continuity and real GPU/DPI performance remain asset/manual review items. The original final-art contract is [available here](companion-3d-assets.md).

Stop after local implementation and review. No deployment.
