# SlingSip PNG companion integration

Historical implementation report before the unified visual identity. The current [visual identity report](slingsip-visual-identity.md) supersedes the old dashboard decoration and Three.js/SVG fallback sections below. Frame artwork, trajectory and product behavior are retained.

Local implementation on 7 October 2026. The eleven supplied PNGs now render by default in the desktop overlay and Animation Lab. No new character art was generated, and no supplied PNG was rewritten. The dashboard design, trajectory/controller, reminder coordinator, hydration, scheduler, persistence, history, Settings, tray, startup registration and IPC implementations are unchanged.

[Native playback and screenshots](previews/png-companion/motion-review.html) contain seven flows and 221 sampled Electron frames. The transparent captures can be viewed over the playback's transparency grid. This is sampled review footage, not an FPS/CPU benchmark.

## Files modified

| File | Purpose |
| --- | --- |
| `src/app/features/companion/animation/slingsip-assets.ts` | Central relative URLs, crop regions and measured source-pixel sockets. |
| `src/app/features/companion/animation/slingsip-asset-loader.service.ts` | One decoded eleven-image cache per renderer; load/dimension failures activate fallback. |
| `src/app/features/companion/animation/slingsip-png-choreography.ts` | State/pose selection, frame progress, mirrored left exit, upside-down visual rotation and actual web/bottle endpoints. |
| `src/app/features/companion/animation/slingsip-png-renderer.component.ts` | Full-pose SVG images, exterior masks, silhouette hit targets, 90 ms fades, hanging idle and disappointed head composite. |
| `src/app/features/companion/animation/slingsip-sprite-geometry.ts` | Generated source-space clip paths, normalized hit paths, transforms, dimensions, hashes and sockets. |
| `src/app/features/companion/companion-character.component.{ts,html}` | Prefer PNGs; instantiate the retained Three.js renderer only after a PNG failure; display the supplied bottle. |
| `src/app/features/companion/web-renderer.component.ts` | Reuse the existing SVG web choreography with PNG grip/free-hand coordinates. |
| `src/app/features/companion/speech-bubble.component.ts` | Display the existing canonical `Drink [glass] ml` heading requested in this brief; success/goal/retry amounts stay dynamic. |
| `scripts/prepare-slingsip-pngs.mjs`, `scripts/lib/png-rgba.mjs` | Offline PNG decoding and vector geometry preparation; source bytes remain unchanged. |
| `scripts/dev.mjs`, `package.json` | Prepare geometry before development startup and production renderer build. No dependency/version change. |
| `src/assets/3d/README.md` | Identify the previous GLB pipeline as the retained failure fallback. |
| `tests/png-companion.spec.mjs` | Source integrity, pose/path/web/bottle geometry, native alpha/hit targets, frame changes, Success, Later, Ignore, inversion, hidden cleanup, pause/reduced motion and isolated Lab. |
| `tests/helpers/companion-visuals.mjs`, `tests/{three-companion,asset-integration,body-rendering}.spec.mjs` | Explicitly exercise the retained 3D/SVG fallback by dispatching the real PNG-load error handler; keep existing assertions. |
| `tests/{advanced-companion,phase-one,branding}.spec.mjs` | Use the production PNG's measured painted hit point and updated reminder heading. Physical pointer assertions are retained. |
| `scripts/capture-png-companion.mjs`, `scripts/build-png-review.mjs` | Isolated native capture and self-contained local playback/gallery. |
| `README.md`, `docs/slingsip-{png-integration,png-source-audit,png-validation,reference-style,3d-integration}.md/json`, `docs/companion-3d-assets.md`, `docs/previews/png-companion/` | Current usage, evidence, asset limitations and historical/fallback labeling. |

The existing Angular public-asset copy already includes these files; no `angular.json` edit was necessary. Package scripts are not represented in the lockfile, and package identity/dependencies did not change. No Electron/shared business code was edited.

## Asset and state mapping

All URLs are in `SLINGSIP_ASSETS`, relative to the renderer's base URL so both Angular development serving and Electron `file://` builds work. Paths below are under `public/assets/companion/slingsip/`.

| State/visual | Source | Treatment |
| --- | --- | --- |
| Hidden/default rest | `poses/idle.png` | Preloaded; no visible pose renderer while hidden. |
| Normal SwingingIn | `swing/swing-1.png` through `swing-5.png` | Five consecutive full-body poses; same code-driven trajectory/tangent tilt. |
| Arriving | `swing/swing-5.png` | Hold final frame during the existing 420 ms damped settle. |
| Reminder | `poses/ask.png` | Hanging sway/breathing while the 2D reminder is visible. |
| Upside-down entry/arrival/reminder | `poses/upside-down.png` | Already inverted; compensate the upright-art entry roll visually and keep the inverted PNG at Reminder. |
| Success/DeliveringBottle | `poses/happy.png` | Positive pose and live credited-water message. |
| Waiting after Later/Ignore | `poses/disappointed.png` over `poses/idle.png` | Clip the center head from the head strip, hide the idle head, combine it with the supplied idle body; 380 ms small head nod. |
| SwingingOutRight | Five swing PNGs | Forward order, normal facing, existing right exit. |
| SwingingBackLeft | Five swing PNGs | Forward order mirrored about the shared grip, existing left exit. |
| Bottle prop | `props/bottle.png` | Clip the original silhouette, attach cap socket to its dynamic web. |

Upside Down retains the existing 15% selection weight and exclusion of the previous entry. It returns to Happy on a drink or the normal disappointed/left-exit flow on Later/Ignore. No reminder timer or extra selection loop was introduced.

## Swing-frame timing

The current finite delta-time RAF driver owns screen travel. PNG selection reads its normalized phase progress directly: `[0,.2)` → frame 1, `[.2,.4)` → frame 2, `[.4,.6)` → frame 3, `[.6,.8)` → frame 4, `[.8,1]` → frame 5. There is no separate sprite clock to drift from the path. Normal-motion frame changes crossfade for 90 ms; low power/reduced motion disable these fades.

| Existing phase | Duration | Nominal interval per frame |
| --- | --- | --- |
| Classic entry | 1700 ms | 340 ms |
| High entry | 1950 ms | 390 ms |
| Fast Zip entry | 1120 ms | 224 ms |
| Upside Down entry | 1900 ms | Holds the inverted pose rather than cycling upright frames. |
| Right exit | 1350 ms | 270 ms |
| Left exit | 1500 ms | 300 ms |

Reduced motion uses the final frame during movement and the existing short fade/slide. Finite animation pauses/resumes with the existing display activity handling. Neither trajectory math nor phase durations changed.

## Masks, sockets and dynamic webs

The supplied files mix authored transparency with opaque sheet separators, captions and exterior checker patches. Preparation reads their original RGBA data, clips known caption/neighbor regions, flood-fills exterior gray remnants, removes small border fragments, and emits simplified vector contours. Enclosed white eyes survive the exterior flood. SVG images retain authored alpha inside these contours; native desktop alpha is preserved. The same normalized contours form pointer targets, so image rectangles and removed sheet material do not intercept clicks.

The audit records the eleven original SHA-256 hashes, dimensions, crops and normalized sockets. Preparation never writes to `public/assets/companion/slingsip/`. Replace artwork by updating the central source-point/crop configuration and rerunning preparation; review the resulting mask and sockets.

Every full-body frame aligns its measured grip to `(125,22)` in the existing `160×220` artwork coordinates. This prevents changes in source crop size from adding jumps to screen travel. Free-hand positions are measured separately, so the bottle web starts at Happy's actual hand. The fourth swing frame has a cut-off raised arm; its visible hood connection is used rather than fabricating an unseen hand. Source anchors that fall outside opaque pixels snap to the nearest foreground pixel during preparation. Left-exit reflection preserves the same shared grip.

The existing two-web choreography draws SVG lines from world anchors to these transformed sockets: attach web 1, swing, retract old web, free flight, attach web 2, swing, settle. Old and new strands never overlap at full opacity; blank phases have neither. Upside-down attached strands are vertical. Exit anchors remain upper-left/upper-right. Bottle lines run from the free hand to the cap. No web PNG, additional canvas, native window or new IPC operation was added.

## Bottle delivery

A drink is credited by the unchanged main-process intake immediately, before visual delivery. The existing 450 ms Success phase displays Happy, then the existing 1200 ms bottle phase runs:

| Bottle phase progress | Visual |
| --- | --- |
| 0–.18 | Web shot grows from Happy's free hand. |
| .16–.38 | Bottle appears and lowers on the web. |
| .38–.86 | Damped pendulum: `10 × sin(3πt) × exp(-1.2t)` degrees. Actual peak is between 8° and 10°. |
| .52–.86 | Live `+[credited amount] ml` feedback fades up. |
| .86–1 | Web/bottle retract and fade; no prop remains during exit. |

The prop is nonzero-opacity for about 1008 ms, uses the supplied cap/bottle silhouette, and remains bounded to the usable desktop. Swing frames then carry the existing right exit and native hide. Double clicking still credits one glass.

## Performance and fallback

PNG success creates no WebGL canvas or Three.js scene. Eleven small decoded images are shared within a renderer, including its Animation Lab, to avoid frame-load flicker. Motion, web and bottle subscribe to the same finite frame stream; they add no RAF or timer. Reminder hanging uses one browser-managed 4.2-second rotation/breathing loop around the grip, producing roughly 2–3 px of lower-body sway at normal desktop size. Crossfade effects are canceled when replaced; Hidden destroys the pose component and cancels idle/fades. Suspended renderers pause effects. Existing input polling stops when the overlay hides; the PNG layer adds no cursor/event listener.

Low power keeps the existing 30 fps motion cap, disables PNG shadow/glow/crossfades and reduces idle amplitude. Reduced motion disables idle, nod/fades and cycling. Default full-pose art receives a very small whole-body cursor tilt via the existing cursor service; the supplied images do not provide independent eye/head channels.

A load/decode failure, unexpected image dimensions or rendered-image error activates the retained Three.js path. Missing final GLBs then use the explicitly temporary GLBs; graphics failure activates the existing independent SVG pack. All eleven PNGs must load for the primary renderer, avoiding mixed or incomplete character packs. No placeholder is displayed during successful PNG loading, and only one character renderer is visible at a time.

## Validation

Type checking and the production renderer/Electron build pass. **All 90 distinct checks are verified passing across a complete run and one targeted rerun.** The full run passed 89/90; its sole failure was a test helper returning a DOMPoint without serializable x/y properties. Returning plain numeric coordinates fixed the helper, and its complete preferences/input/audio/pause/restart test passed on rerun. No application change followed the full run. [Machine-readable results](slingsip-png-validation.json) retain both runs and the initial failure.

All five new PNG cases passed in the full run: source integrity; unchanged path and web/bottle geometry; five native swing frames, alpha/hit targets, Ask/Happy, immediate/idempotent intake and bottle/hidden cleanup; inverted hanging, suspension, isolated Lab and reduced motion; Later/Ignore expression, left exit, retained native window, retry and cancellation. Both retained fallback renderers passed. The physical Windows pointer regression, including actual character/reminder clicks and click-through, also passed; the earlier native-helper error was not reproduced. No Windows pointer assertion was removed or skipped.

Captured locally: Classic, High, Fast Zip, Upside Down, Success, Later and Ignore; unchanged dashboard/preferences; Animation Lab at normal and minimum window size. Screenshots preserve native alpha. Existing regression coverage continues to exercise retry, scheduler, restart/persistence, history/streaks, tray, real startup registration, secure IPC and both fallback renderers.

## Manual checklist

1. Run `npm run dev`. Open Animation Lab and preview all four entries. Confirm multiple body poses, moving web, 420 ms settle, Ask, and a still-inverted Upside Down reminder.
2. Trigger a real development reminder. Click Drank it once and rapidly twice on another reminder: verify one configured glass per reminder, immediate dashboard progress, Happy, bottle drop/pendulum/feedback, right exit and disappearance.
3. Choose Remind me later. Confirm the actual interval, brief disappointed expression, new upper-left web and left exit. Keep watching: the existing ten-second development return uses the same native window. In production the configured retry interval applies.
4. Ignore a reminder. Confirm Ask, the existing timeout, disappointed head/body reaction, left exit, native hide and one later return. Pause reminders while hidden and confirm cancellation.
5. Move/click over the painted character and bubble. Confirm reactions/buttons work, and web, bottle, image margins, clipped captions and blank desktop areas pass through to the underlying app.
6. Enable low power, turn cursor/reactions off, mute sound, test reduced motion and suspend/resume or lock/unlock. Confirm paused/hidden motion does not accumulate loops or skip intake.
7. Use Animation Lab at a 760×560 window, then review the overlay on 1366×768, 1920×1080 and 2560×1440 displays at 100%, 125% and 150%. Geometry fixtures cover these sizes; additional physical DPI/multi-monitor checks remain manual.
8. Close/reopen the dashboard and restart SlingSip. Verify saved water/settings/history and tray/startup behavior. To inspect fallback without touching production files, run the retained fallback tests; they simulate the existing image-error handler in an isolated profile.

## Remaining visual limitations

- These are low-resolution sheet crops: full poses are roughly 170–180×260, swing frames roughly 143–150×172–175, and the bottle 115×185. Scaling exposes soft edges, premultiplied/color fringes and baked interior checker artifacts. Exterior clipping cannot restore missing detail.
- Some swing limbs/cape and Happy's hand are already cut off at source boundaries. Five distinct full poses provide frame-based body motion, with visible pose changes; they do not supply smooth skeletal interpolation, independent breathing limbs, eye tracking or blinking.
- `disappointed.png` is a head strip, not a complete pose. Its center head is visibly combined with Idle. A clean matching full-body disappointed pose would remove this workaround.
- Some measured web connections use a visible hood/boot region because the source lacks a complete raised hand. This is documented, not represented as a rigged hand socket.
- For a cleaner finish, provide isolated transparent PNG exports on a consistent canvas with complete limbs, no labels/separators/checker patches, aligned grips and a full-body disappointed pose. Additional in-between frames and optional separate head/eye layers would improve animation smoothness. The renderer and business logic need no redesign for replacement art.
- The retained physical Windows pointer regression passed on the current desktop; its earlier native-helper error was not reproduced. Additional physical display/DPI combinations and manual lock/unlock checks are not claimed as completed.

The earlier reference-style and 3D reports/playbacks are historical or fallback documentation. Local work stops after this handoff. No deployment.
