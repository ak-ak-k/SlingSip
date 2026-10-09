# Final companion asset handoff

Historical/fallback GLB contract. The current desktop companion uses supplied PNGs by default; see [the PNG integration report](slingsip-png-integration.md) for current asset mappings and visual limitations.

This is the original Phase 7E detailed-art contract. The current loader also supports named `SwingIn`, `ArriveSettle`, `AskGesture`, `Smile`, `WebShoot`, `BottlePresent`, `Success`, `SwingExitRight`, `SwingExitLeft`, `Wait`, `Disappointed` and `Idle` clips, plus eight facial moods. Current filenames are `src/assets/3d/character/slingsip-character.glb` and `src/assets/3d/props/slingsip-bottle.glb`. See [the current integration report](slingsip-3d-integration.md) for discovery rules, aliases, normalization and missing-data behavior. The detailed sequences below remain compatible; they are not mandatory for a model with the named sequence clips.

Provide two production GLBs and their editable source files. The included files under `temporary-3d/` are development placeholders. The scene's `COMPANION_3D_ASSETS` descriptor selects final files, named sockets, morph names and scale; changing that descriptor does not change trajectory or hydration/reminder logic.

## Character: `guardian.glb`

An original navy/mint/cyan/coral sidekick, with expressive face, rigged arms/hands/legs/head/chest and a scarf. Avoid an existing copyrighted superhero identity. Export glTF 2.0 binary with embedded textures, materials, skeleton, skin weights, morph targets and all clips below. Include the Blender/Maya source and asset/license notes.

Use Y-up, character facing +Z, and a consistent 2.2-unit nominal height. The root origin is the raised web grip, not the feet. Clips must be **in place**: do not bake the desktop path, camera, web lines, bottle, bubble, background, ground plane or root screen translation into the model. Keep the raised grip stable during attached/hanging poses; free-flight may express release without baking root travel. Match adjacent clip endpoints to avoid pose pops. Keep loop endpoints seamless.

Required clips, with these exact names:

| Clip | Body action | Playback |
| --- | --- | --- |
| `swing-grab` | Grip, arm tension, knees preparing for momentum. | Once, sampled during first attachment. |
| `swing-down` | Knees/hips tuck, chest stretches, scarf trails. | Once; reused for the second swing. |
| `swing-bottom` | Deep tuck/compression and changing knee silhouette. | Once. |
| `swing-up` | Legs extend, torso opens, free arm anticipates release. | Once. |
| `release` | Fingers let go, wrist opens, recoil begins. | Once. |
| `mid-air` | Compact free-flight body with active arms/legs. | Once. |
| `attach` | Reach, web grip closes, shoulder takes load. | Once. |
| `settle` | Small overshoot, recoil, stable hanging endpoint. | Resampled over the existing 420 ms spring. |
| `idle` | Neutral hanging pose, gentle body/head motion. | Seamless loop; also neutral/reduced fallback. |
| `success` | Smile-ready celebratory free-hand/body gesture. | Resampled over the existing 450 ms success phase. |
| `web-shot` | Readable open-hand/wrist web-shoot gesture. | First 18% of the existing bottle phase. |
| `bottle-hold` | Present/hold the secondary web, follow the bottle. | Middle 68% of the existing bottle phase. |
| `retract` | Reel the secondary web back and prepare to leave. | Last 14% of the existing bottle phase. |
| `hanging` | Gentle breathing, small hand/head/body shifts. | Seamless 4.2-second loop after asking. |
| `asking` | Friendly hand raise/question gesture toward bubble. | Once over the first two seconds of Reminder. |
| `waiting` | Small okay gesture/head tilt. | Waiting phase. |
| `disappointed` | Mild disappointed/sad body language. | Remaining Waiting phase. |
| `exit-swing` | Committed outgoing swing after the new web attaches. | Remaining exit progress; reused for either direction. |

Frame counts/FPS can differ from the placeholders. AnimationMixer resamples each clip against normalized visual progress; longer clips do not extend the reminder's business timers.

Required sockets/nodes (names can be mapped in the descriptor):

- `WebGrip`: raised-hand attachment point, at the root grip origin in attached poses.
- `BottleGrip`: free-hand/fingertip web attachment point, following its gestures.
- `Foot_L`: front boot contact point for inverted entry.
- `Head`: head bone for additive small cursor/reaction motion.
- `Chest`: chest/spine bone for subtle breathing/body sway.

Required facial morph targets: `blink` on both eye/lid meshes, and `smile` plus `frown` on the face/mouth. Neutral is all weights zero. Blink should close the lids without moving the entire head. Keep expressive effects readable at the on-screen 112–196 DIP height. Optional separate pupil meshes named `Eye_L_Pupil` and `Eye_R_Pupil` enable the current subtle pupil gaze; head gaze also works without them.

Suggested budget: under 20k triangles, at most 4–6 character materials, one 1024px colour atlas plus small optional normal/roughness maps, and a GLB around 2 MB or less. Use ordinary glTF PBR materials. Do not require custom shaders, external network textures, transmission/refraction, heavy hair/cloth, proprietary rig plugins or a separate animation runtime.

## Bottle: `bottle.glb`

A compact elegant SlingSip bottle: slightly translucent teal body, mint/cyan details, readable SlingSip identity. Export its top web attachment at root `(0,0,0)`, Y-up, with the bottle extending downward to approximately `Y=-1`. Use +Z as the label-facing direction. The scene scales it to the current delivery height and supplies its drop/pendulum/retraction; do not bake that screen motion.

Embed the final label texture in the GLB. Optionally name a replaceable label plane `BottleLabel` if the runtime SlingSip text label should be used. Keep it under about 2k triangles and two or three materials; lightweight alpha opacity is supported. Avoid expensive transmission/refraction. Provide the editable source and license notes.

## Webs

No web GLB is required. The renderer owns dynamic lines between the configured anchor, actual model sockets and bottle top. Keep webs out of the character and bottle exports so release/retraction can remove the old strand before another attaches.

## Optional sprite fallback artwork

The independent temporary SVG pack remains a working graphics fallback. If you want it replaced too, supply transparent SVG frames or full-canvas PNG/WebP frames in a common logical 160×220 space (raster exports may be 640×880). Required sequences are the first thirteen clips above. Current frame counts are: grab 4, down 6, bottom 6, up 6, release 4, mid-air 6, attach 4, settle 8, idle 8, success 6, web-shot 4, bottle-hold 6, retract 4; total 72. Counts are manifest-driven and may change.

Provide each frame's raised grip, free hand, boot, head and painted hit-point coordinates. The raised grip stays at logical `(125,22)`. Bitmap frames also need an alpha silhouette SVG `hitPath` for click-through, and may include a separate aligned head layer for gaze. Leave background/web/bottle/bubble out. Final fallback art is optional for the 3D phase; the temporary pack can remain until it is supplied.
