# Phase 7C — Companion animation polish

Implemented locally on 6 October 2026. This phase preserves the SlingSip dashboard, branding, character paths and colours, hydration, scheduling, storage, History, Settings, tray, IPC and reminder coordination. It changes the companion's motion layer.

## 1. Files modified

| File | Change |
| --- | --- |
| `src/app/features/companion/animation/swing-config.ts` | Central timings, amplitudes, articulation, web cast, idle and bottle tuning. |
| `src/app/features/companion/animation/swing-motion.ts` | Pure entry/exit, body, settle, delivery and hand attachment calculations. |
| `src/app/features/companion/animation/swing-animation.service.ts` | Drives the new poses with the existing cancellable RAF runner; handles reduced motion. |
| `src/app/features/companion/companion-character.component.ts` | Uses the shared bottle geometry helper. |
| `src/app/features/companion/companion-character.component.html` | Articulated SVG groups, released web strand and central CSS tuning bindings. |
| `src/app/features/companion/companion-character.component.scss` | Joint transforms, hanging sway, breathing, scarf drift, blink and brief reactions. |
| `src/app/features/companion/speech-bubble.component.ts`, `.html`, `.scss` | Configured entrance and message transitions within the existing bubble layout. |
| `tests/character-motion.spec.mjs` | Continuity, short delivery, bottle bounds/attachment, native idle life, delivery cancellation and reduced motion coverage. Existing assertions remain. |
| `tests/phase-one.spec.mjs` | Waits for the finite bubble entrance before measuring physical click/corner coordinates. Native input assertions remain unchanged. |
| `README.md`, `docs/phase-7c.md` | Current behaviour, validation and handoff. |
| `docs/previews/phase-7c/` | Native screenshots and an interactive sampled playback. |

Local capture tooling and test JSON live under `.cache/`; neither ships in the renderer. No dependencies or native application files changed.

## 2. Motion architecture

The existing `CharacterStateService → SwingAnimationService → CompanionCharacterComponent` structure remains. `ReminderInteractionService` still coordinates canonical intake and retries; its code is unchanged. Main still owns intake, persistence, scheduler and the hidden return timer.

The motion helper now supplies shoulder, head and leg angles alongside grip position, body rotation, scarf angle and web geometry. Pure helpers calculate settle, delivery gestures and bottle attachment. CSS handles ambient motion and short reactions. No new public APIs, IPC channels or states were introduced.

## 3. Swing path

Entry remains a constant-length pendulum arc with an offscreen anchor. Hermite timing builds speed into the dip, slows on the rising side and reaches zero translational speed at arrival. Rotation follows the path tangent and is capped at 30 degrees. The final grip coordinates match the reminder point exactly.

Viewport ratios and the existing character size limits adapt the path to the usable desktop. Geometry checks cover 1366×768, 1920×1080 and 2560×1440 work areas at 100%, 125% and 150% scaling. Timing checks cover 30, 60 and 144 Hz and dropped frames; these are mathematical checks, not physical refresh-rate measurements.

## 4. Web rendering

The main SVG strand continuously joins the above-screen anchor to the raised grip. Idle and reaction transforms pivot about that same grip. Native DOM geometry checks verify that sway leaves the hand attached.

Each exit casts a new strand from the grip toward its next offscreen anchor during the first 22% of the motion. The previous strand remains attached while fading out. This replaces the immediate anchor switch. Once the handover finishes, the new strand stays taut while the character reels outward.

## 5. Character motion

Existing artwork paths and colours are preserved. Legs counterbalance the body; the free arm and head react to momentum; the scarf trails with a small lag and flutter. The abrupt left-facing scarf flip was removed.

Reminder idle has a ±0.85-degree hanging sway, 0.8% breathing stretch, two-degree scarf drift and an occasional short blink. Success gives a three-degree positive lean; Later gives a restrained two-degree acknowledgement. Both reactions return to neutral in 380 ms. Delivery gestures move the free shoulder and tilt the head toward the bottle.

## 6. Arrival and settle

After the 2300 ms entry, a 620 ms damped recoil settles the grip and all articulated joints. The position and body pose carry across the phase boundary. The recoil starts and finishes without a position jump, and every joint finishes at exact neutral. The bubble appears after settling.

## 7. Bubble behaviour

The existing bubble dimensions, colours, buttons, progress and copy remain. Entrance fades in over 320 ms, rises ten pixels and scales from 97.5% to 100%, pivoting near the tail. Success and waiting copy fade/rise over 240 ms. The bubble remains stationary during ambient character motion, keeping interaction targets stable.

Reduced-motion preferences disable these CSS transitions and ambient/reaction animations. The service skips travel, settle and moving bottle effects while preserving the reminder, immediate canonical intake and success copy.

## 8. Success and bottle delivery

The existing drink action persists water immediately, before animation. Success still begins as soon as canonical intake resolves and retains its dynamic amount/goal copy. The brief reaction finishes before bottle delivery begins.

Delivery now lasts 1250 ms. A secondary strand casts from the animated free hand; the bottle lowers with a small damped swing and fades at the edges of the phase. Shoulder and body rotations are included in attachment calculations. Native checks verify that the rendered free hand and secondary strand coincide. The drop is constrained by the space above the taskbar, including the tested DPI combinations.

## 9. Left/right exits and return

Right exit takes 1350 ms; Later/Ignore exit takes 1500 ms. Both accelerate from the current pose along a curved Bezier path, dip within the available work area, rise and clear the screen completely. Body angles blend from the starting pose, rather than jumping to an exit lean. The web handover is shared by both exits.

Later and Ignore retain their existing messages, reservation, retry intervals and main-owned hidden timer. Retry reuses the same entry/settle engine and native window. There are no animation-owned retry timers or additional reminder instances.

## 10. Performance and validation

Only entry, settle, bottle delivery and exits run the service's delta-time RAF loop. CSS supplies ambient life without a JavaScript movement loop. Hidden SVG/bottle elements are removed, RAF is cancelled on hide/destruction, and abort listeners are removed when each phase finishes. Existing cursor probes and click-through ownership remain unchanged.

Regression checks retain zero idle/hidden RAF assertions and add proof that the idle SVG actually moves, the web stays attached, and cancelling delivery removes the bottle without a delayed exit or duplicate intake. Reduced-motion coverage checks endpoint poses, disabled ambient CSS and stable idle/hidden frame counts. Framework rendering may request isolated frames and briefly render transitional state labels when state changes; the character is already at the endpoint in those phases.

**Validation:** final `npm run typecheck` and `npm run build` passed. All 65 tests have passing results across the complete suite and focused rerun. The full run passed 63/65 in 12.1 minutes. The two failed checks were corrected in test assertions/sequencing: reduced motion now checks endpoint coordinates despite transitional state labels, and physical click measurements wait for the finite bubble entrance. The focused reduced-motion and native Windows input run passed 2/2. No product-code changes followed the final build.

The Windows pointer assertions were retained and now pass, including real click-through, hydration clicks, reuse and renderer recovery. The first run logged cursor movement and early intake while waiting for dashboard focus; the focused run passed with stable coordinate measurement. No unresolved Windows pointer failure remains. Main-owned isolated startup ON/OFF registration also passed.

Raw reports are `.cache/phase7c-full.json` and `.cache/phase7c-final-focused.json`; `.cache/phase7c-validation-summary.json` consolidates all 65 unique passing tests. Test screenshots remain under `test-results/phase7c-full/` and `test-results/phase7c-final-focused/`.

The retained software-rendering configuration can still use CPU for CSS painting. This phase does not claim a hardware FPS or CPU benchmark.

## 11. Manual review checklist

- Run `npm run dev`; use **Development tools → Trigger Swing In · Dev**. Entry should dip/rise, articulate and settle before showing the bubble.
- Leave the reminder untouched briefly. Confirm gentle sway/breathing/scarf motion and an occasional blink, with the raised hand attached to its strand.
- Click **Drank it**. Confirm immediate progress sync, brief positive lean, short attached bottle drop and continuous right exit. Check that a second click does not log another glass.
- Trigger again and choose **Remind me later**. Confirm the actual interval in the message, acknowledgement, left exit and the same companion returning. Let a reminder time out to check the Ignore flow too.
- Hide during entry and bottle delivery. Pause reminders or turn reminders OFF while a return is pending. Confirm there is no later animation or duplicate return.
- Repeat on physical 1366×768, 1920×1080 and 2560×1440 displays at the relevant scaling settings. Check shoes, bubble, bottle and taskbar clearance.
- Check that only the bubble accepts mouse input; the character, strands, bottle and empty desktop pass input through. Keep the mouse idle when running the automated physical input test.
- Enable the OS reduced-motion preference: reminders and logging should work with travel/ambient effects suppressed.
- Open Overview, History and Settings; check layout, data, tray actions and restart preservation. Quit SlingSip from the tray when finished.

Review [sampled native Success/Later playback](previews/phase-7c/motion-review.html), [entry dip](previews/phase-7c/entry-dip.png), [entry rise](previews/phase-7c/entry-rise.png), [reminder](previews/phase-7c/success-reminder.png), [bottle delivery](previews/phase-7c/bottle-delivery.png), [Later](previews/phase-7c/later-waiting.png), [right handover](previews/phase-7c/success-swinging-out-right.png), [left handover](previews/phase-7c/later-swinging-back-left.png) and [unchanged dashboard](previews/phase-7c/dashboard-unchanged.png).

The playback contains 99 actual native screenshots sampled around 6–7 frames per second. It supports play/pause, flow selection and seeking; use the live app for full-speed smoothness assessment. Capture testing reported no renderer errors.

## 12. Remaining limitations

Motion is a lightweight articulated SVG system with designed pendulum/Bezier paths, not a physics simulation or a fully rigged 3D character. The entry strand is fixed-length; exit casting/reeling is stylized. The main anchor stays outside the usable work area.

The primary-monitor architecture and tiny-work-area limitations remain. Physical display/DPI and sleep/background-throttling combinations still need the manual review above. Software rendering can increase CPU use, and a throttled frame advances by elapsed time rather than replaying missed poses. A mid-flight display change recomputes responsive geometry on the following frame; it is not a blended migration between monitors.

Local implementation, automated verification and native capture review are the stopping point. No deployment or product redesign is included.
