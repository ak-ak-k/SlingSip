# Phase 7A — Mizu web-swing companion

> Historical report from before the SlingSip brand migration. Old names, copy and screenshots describe that phase. See the [current branding report](slingsip-branding.md) for the current product and compatibility identifiers.

The original Mizu guardian swings in from the left on a visible web, settles below the hydration bubble, and delivers a symbolic water bottle after a logged drink. Success continues right; Later and Ignore leave left and wait offscreen for the existing retry interval. The Angular/Electron architecture and canonical hydration, history, streaks, settings, tray and Windows startup remain in place.

## 1. Files created

- `src/app/features/companion/animation/swing-config.ts` — centralized visual tuning.
- `src/app/features/companion/animation/swing-motion.ts` — pure responsive trajectory and delta-time math.
- `src/app/features/companion/animation/swing-animation.service.ts` — cancellable movement promises.
- `docs/phase-7a.md` — this report and acceptance checklist.

## 2. Files modified

- `animation/character.model.ts` replaces the active walking state graph. The old `character-animation.service.ts` and `walk-motion.ts` were removed.
- `companion-character.component.ts`, `.html`, `.scss` render the original articulated vector guardian, dynamic web and Mizu bottle. Navy suit, coral accents, mint drop badge, white lenses and ribbon artwork were drawn directly in SVG; no third-party superhero assets are used.
- `reminder-interaction.service.ts` coordinates entry, stable interaction, success, delivery and either exit.
- `companion.component.ts`, `.html` wire the swing engine and success controls.
- `speech-bubble.component.html`, `.scss` apply the success styling.
- `companion-input.service.ts` retains target hit testing and stationary-cursor recovery, with no idle RAF probe.
- `electron/window-geometry.ts` uses the entire primary display work area as the transparent canvas.
- `electron/hydration-runtime.ts` adds one cancellable hidden-return reservation/timeout around the retained daily scheduler and HydrationSession.
- `electron/desktop-ipc.ts`, `electron/preload.ts`, `shared/desktop-contract.ts`, `core/services/desktop.service.ts` add the typed, secured companion-only suspension operation and retry snapshot.
- `dashboard.component.ts`, `.html` update the development trigger label and pending-retry status/cancel availability. Page design is retained.
- `tests/character-motion.spec.mjs`, `hydration-interaction.spec.mjs`, `hydration-scheduler.spec.mjs`, `window-geometry.spec.mjs`, `phase-one.spec.mjs`, `phase-six.spec.mjs` migrate movement expectations and check the new lifecycle alongside retained regressions.
- `README.md` documents the current flow and run commands.
- `public/assets/character/README.md` identifies the retained sprite/WebM assets as legacy and points to the final SVG guardian.

Existing sprite/WebM utilities and development artwork remain available as legacy assets. They are not used by the final guardian; the independent WebM regression remains.

## 3. Final state machine

```text
Hidden → SwingingIn → Arriving → Reminder
Reminder → Success → DeliveringBottle → SwingingOutRight → Hidden
Reminder → Waiting → SwingingBackLeft → Hidden → retry → SwingingIn
```

Both Later and Ignore use Waiting, with different messages. Explicit hide, pause, OFF, destruction and date rollover cancel to Hidden. Normal transitions are validated by `CharacterStateService`; old WalkingIn/WalkingOut states are removed.

## 4. Swing trajectory

Entry uses a pendulum arc: an offscreen anchor, a fixed radius and an angle eased over elapsed time. It starts fully outside the left edge, descends through the low middle, then rises and slows toward the interaction point. Arrival adds a small damped settle. Exits use cubic Bézier curves with time eased in, creating acceleration from the stable pose toward either offscreen edge. The right exit continues the original travel direction.

The engine accumulates RAF timestamp deltas, rather than moving a fixed distance per frame. Pure tests compare 30, 60 and 144 Hz and a long frame stall. Movement methods return `Promise<void>` and contain no hydration mutations.

## 5. Web-line rendering

A full-canvas SVG line joins the offscreen anchor to the guardian's grip. The character's transform origin is that exact grip, so rotation does not detach the rope. Entry keeps the length constant. Exits switch to an anchor ahead/right or upper-left and reel as needed along their Bézier curves. A second line connects the free hand to the delivery bottle. Lines and artwork accept no pointer input.

## 6. Character rotation

The path tangent controls a bounded body rotation, capped at 30 degrees. The settle damps it to zero. Separate SVG leg transforms add articulation, and the ribbon deflects opposite travel momentum. The left-return ribbon changes its trailing side. The guardian does not turn into a walking pose.

## 7. Success flow

Drank it disables immediately and calls the existing secured main-process intake API. Main selects the configured glass, caps the final amount, deduplicates the native reminder token and persists before animation begins. Both windows, history, streaks and tray receive the canonical snapshot immediately. Success shows `Nice! +<added> ml 💧`, or the completed-goal message, alongside current water and percentage.

After a short success beat, delivery runs and the guardian swings right. Completion hides the native window conditionally using its visibility revision. A stale completion cannot hide a newer reminder. Tray drinks during visible entry/interaction also credit the same prompt and produce success; hidden tray drinks satisfy and cancel its pending return.

## 8. Bottle delivery

The 1.6-second delivery extends a web from the free hand, lowers a teal transparent bottle with a Mizu drop emblem, and applies a small pendulum wobble and glow. It stays below the bubble text. This is symbolic feedback; water logging does not wait for it. The bottle and its line disappear when delivery completes or is canceled.

## 9. Swing-back flow

Later shows `Okay, I'll wait.` and the actual retry interval. Ignore shows `Still waiting... 💧` after the existing response timeout. Each holds the message briefly, attaches a web upper-left, curves out left, and becomes Hidden. The native window hides and click interception is disabled throughout the wait.

## 10. Retry integration

Response timeout uses the existing shared timing: ten seconds in development, configured minutes in production, five minutes by default. Once the left exit finishes, a secured companion-only `suspendReminder(revision)` reserves the current reminder in main and hides the native window. One main-process timeout then returns the same BrowserWindow and Angular character instance through SwingingIn.

The hidden reservation counts as an active reminder, so daily slots and development triggers cannot create overlapping prompts. Return does not add water or rewrite daily slot calculations. Retry-count snapshots persist across returns for that interaction. Changes to retry timing replace the pending return timeout. Hide, pause, OFF, midnight, goal completion, tray satisfaction and quit cancel it. Returns can continue beyond working end because they belong to an already active interaction, as before.

The daily scheduler, history arithmetic and HydrationSession business rules are unchanged. Main owns hidden return timing so renderer background throttling does not hold an invisible active overlay or lose the retry reservation.

## 11. Responsive scaling

The native canvas copies `screen.getPrimaryDisplay().workArea`, including negative origins and taskbar offsets. Electron supplies DIPs; scaleFactor is not applied twice. Trajectory ratios use the actual renderer viewport. Character height adapts with a configured maximum, and the bubble clamps to usable bounds with separation above the guardian.

Geometry/path fixtures cover 1366×768, 1920×1080 and 2560×1440 at 100%, 125% and 150%. The entry anchor adjusts to keep the lowest point of the arc and the guardian's feet inside shorter DIP work areas. Display changes resize the same canvas and re-evaluate layout and stationary-cursor hit testing. Very small usable areas remain subject to the limitations below.

## 12. Performance safeguards

- One movement RAF exists only during entry, settle, bottle movement or exit. Stable Reminder and Hidden have no movement RAF.
- AbortController cancellation rejects unfinished movement promises and removes RAF/abort listeners. Each renderer interaction owns one short timeout.
- Native hide clears renderer work and the visible-only 200 ms cursor probe. The retry wait has one main timeout, alongside the retained daily/calendar scheduler timer.
- Hidden SVG character, web and bottle content is removed. No idle sprite, video or CSS animation loop runs for the final mascot.
- One native companion window is reused. Revision checks guard stale operations; no renderer receives arbitrary IPC, Node or filesystem access.
- Windows graphics fallback from Phase 6 remains enabled. No animation dependency was added.

## 13. Validation and manual checklist

Final verification: `npm run build` and `npm run typecheck` passed. The full Playwright suite passed **54/54 tests** in 8.9 minutes, including real Windows bubble clicks/click-through, native focus/recovery, both exit directions, immediate canonical intake, bottle rendering, state progression, fixed entry rope length, frame-rate independence, native hiding/reuse, hidden cancellation, and retained hydration/security/settings/history/startup regressions. The real isolated Windows Run registration was removed afterward. The initial return-layout check sampled the bubble during its appearance animation; it now waits for animation completion before comparing stable bounds.

A separate native smoke test against the Angular development server also passed swing-in, immediate intake, bottle delivery, native hide and clean quit, with no renderer errors or the earlier Windows GPU-device warning. Temporary Electron and development-server processes were stopped; normal user data was not used by these checks.

1. Quit any running SlingSip instance from its tray, then run `npm run dev`.
2. Select **Trigger Swing In · Dev**. Watch a curved left entry, attached web, damped settle, and separated bubble.
3. Check the original navy/coral/mint guardian, expressive lenses and ribbon. No opaque rectangle should cover the desktop.
4. Click **Drank it ✓** twice rapidly. Exactly one configured glass should appear immediately in dashboard, companion, tray and History.
5. Watch the bottle extend/lower for about 1.6 seconds, then the guardian accelerate right and disappear.
6. Trigger again and choose **Remind me later**. Check the waiting message, left exit, native hide, and one return after ten development seconds.
7. Ignore the returned bubble. After ten seconds check `Still waiting... 💧`, a left exit, and another offscreen retry.
8. While hidden, try another trigger: it must remain one reserved reminder/window. Use the dashboard **Hide reminder** control to cancel; no return should follow.
9. Repeat Later, then use tray **Pause**, reminders OFF, or tray **Drink** during the hidden wait. Each should cancel the return; tray Drink still logs normally.
10. During a visible reminder, use tray **Drink**. Check one canonical credit, success delivery and right exit. A duplicate Drank it must add zero.
11. Verify desktop clicks pass through blank areas, guardian, web, bottle and rounded bubble corners; bubble buttons remain clickable. Move away and back, and test a stationary cursor when the bubble appears.
12. Close the dashboard during a reminder/retry. Main, tray and the same companion continue; Open dashboard reopens the shared data.
13. Hide or pause during entry, settle, delivery and either exit. No delayed movement or unexpected return should survive cancellation.
14. Test the three requested resolutions and 100/125/150% scaling, taskbars on different edges and a display change. Bubble text and buttons must remain in usable bounds.
15. Quit fully, restart with `npm start`, and check saved water/settings/history. Development controls must be absent; production Later uses the configured retry minutes.
16. Change production retry minutes while a return is pending. Check the new interval and one return only. Test rollover/sleep/resume and a completed goal without backfilled daily reminders.
17. Quit from tray or dashboard. Check that both native windows, timers and tray terminate.

## 14. Known limitations and phase boundary

The companion uses the primary monitor work area; it does not travel between monitors. Tiny work areas can clip the bubble/character. Native graphics and physical pointer behavior depend on Windows display/session state; UAC/secure desktop and exclusive fullscreen are outside a normal always-on-top window. Software rendering can use more CPU for a desktop-sized alpha canvas. Sleep can delay delivery/return, and visible renderer response timers can be throttled while inactive. Pending reminders/retries are session state, not persisted across quitting; saved intake/settings/history remain persisted.

The final art is an original articulated SVG mascot, rather than pre-rendered video. The bottle is visual feedback only. Existing startup-path and filesystem limitations from Phase 6 remain.

**Phase 7A ends here. Dashboard redesign waits for the instruction `Start dashboard redesign`.**
