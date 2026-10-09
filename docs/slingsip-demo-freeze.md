# SlingSip demo freeze — 8 October 2026

**READY FOR DEMO WITH ONE KNOWN TEST-HARNESS LIMITATION**

The existing product is ready for recruiter-facing desktop recording with the preparation below. No features, redesign, production refactor, new artwork, dependency changes or deployment were made. The user's normal profile/history and running application were left alone.

The automated native pointer regression remains flaky because of Windows cursor/target-ownership interference. Its failed result remains recorded. User-performed manual physical QA passed, and there is no confirmed production click-through defect. Production build, security and core flows passed; see the [Final QA report](slingsip-final-qa-2026-10-08.md) and [manual physical evidence](slingsip-final-qa-2026-10-08-validation.json).

**Freeze verification**

- Five focused existing regressions passed, with zero failures/skips: production development gates; branding/data identity; saved v2 history/settings/water across restart; production once-only Drank/background/goal completion; onboarding profile/replay/reset/relaunch preservation.
- A separate isolated live audit passed for Overview, History, Settings and the production reminder. Application/document/window/tray branding is SlingSip; dev sections, animation lab, test buttons/counters, dummy labels and console overlays are absent. Current approved artwork loads without broken images or recorded asset failures.
- The live audit exercised normal **Open companion**, immediate Drank credit/bottle success, production Later's five-minute reservation and Pause/Resume cancellation for retakes. It reported no renderer errors and its isolated Electron owner exited.
- Production and development remain separate: Angular defaults to the production build and strict local CSP; the normal launch script removes the renderer-server environment variable. Dev HMR connections/UI/short retry controls remain limited to development. Production rejects development-trigger/counter requests.
- Intentional `Mizu` data/session/startup identifiers remain for compatibility. They are not current application branding. Historical 3D/SVG/temporary artwork is disconnected from live views. Ordinary name-input hints are legitimate form guidance.

The [freeze validation record](slingsip-demo-freeze-validation.json) contains results, native observations and source/build hashes. The Final QA automated count remains **110 passed, 1 failed, 0 skipped**; these focused passes do not relabel the flaky pointer case.

The existing onboarding regression refreshed ten screenshots in its normal QA gallery. These show isolated test profiles and remain test evidence; use the running production application for recording.

**Manual setup before recording**

1. Quit any existing SlingSip instance through **tray → Quit SlingSip**. If a development terminal is running, stop it with Ctrl+C. Closing dashboard X alone leaves the app running, so a second launch can reuse its old mode. Run `npm start` from the repository, wait for the built application, then minimize the terminal. Verify tray **Restart SlingSip** has no “(Dev)” suffix and Overview has no Development tools.
2. Use a clean primary desktop, ideally the already checked 1920×1080 / 100% display. Capture the **whole display**, since the dashboard, companion and tray are separate native surfaces. Minimize IDE, browser tabs, QA galleries, terminals and personal documents; enable notification quiet mode. Keep the SlingSip tray icon visible/pinned for the closing shot.
3. Set your actual display name using **profile chip → Edit profile**. Ensure reminders are enabled, unpaused and that at least two configured glasses remain below today's goal. Leave the existing routine unchanged during onboarding. Avoid starting within a minute of a normal scheduled reminder.
4. Clear a pending Later/Ignore return before a new take using **Pause reminders → Resume reminders**. Wait for the companion to hide before opening the next reminder. Rehearsal Drank clicks record real water; check remaining progress between takes.
5. For the full welcome flow, use **profile chip → Reset onboarding → confirm**, then **Continue setup** to open Welcome immediately; alternatively close/reopen the dashboard from the tray. Reset only changes the completion flag. Name, member-since, water, history, streak and settings remain. **Replay welcome tour** plays only the dashboard tour and preserves completion/data.
6. Keep current approved assets and motion settings. For a full swing recording, check that reduced motion/low-power preferences match the animation you want to show. Sound can remain off. Inspect the normal app for storage/error banners and a visible tray before the take.

Reset onboarding is not a water/history reset. Completing the wizard uses the existing settings service; preserve the current values if you want the routine unchanged. Finish with **Start my day** so onboarding does not return afterward. If today's goal is complete, Open companion is correctly unavailable: use a later real day or a separate Windows user profile for a fresh demo, rather than deleting data, fabricating history or changing the system clock. If History has no past days, show its honest Today view.

**Recommended 60-second recording**

| Time | On-screen action |
| --- | --- |
| 0–15 s | Start at Welcome. **Get Started → Your name → Continue → Your routine → Continue → Meet SlingSip → Show me around**. Show one tour highlight, click **Skip**, then **Start my day**. The name/routine are already filled from preparation. |
| 15–21 s | Hold on Overview: personalized greeting/profile chip, progress, next break and the approved hero mascot. Click **Open companion**. |
| 21–31 s | Let swing-in settle. Click **Drank it** once. Keep the bottle/+water and right exit continuously visible; the real dashboard progress updates immediately. |
| 31–39 s | After the companion fully hides, click **Open companion** again. Click **Remind me later**; show “Okay, I’ll swing back.”, the actual retry interval and the left exit. |
| 39–44 s | Open **History** and show Today plus any genuine existing past records/streaks. |
| 44–50 s | Open **Settings**. Show daily goal, glass size, active hours and reminder preferences without changing them. |
| 50–57 s | Close the dashboard with **X**. Hold briefly on the clean desktop, open the SlingSip tray menu, then click **Open SlingSip**. This demonstrates background operation. |
| 57–60 s | Hold on the reopened dashboard with the same profile/progress. End on the SlingSip wordmark and mascot. |

This uses the real production **Open companion** action to show the reminder on demand; normal reminders are scheduled. Keep motion/bottle/Later clips at normal speed. The short bottle phase needs an uninterrupted shot. Trim navigation pauses if a take runs long; no application timing changes are needed. Restart preservation is already verified and can be shown in a separate optional clip if desired.

Suggested narration: “SlingSip is a desktop hydration sidekick. It personalizes your routine, swings in for a water break, celebrates a sip, and comes back later when you're busy. Your progress stays local, and reminders keep running from the tray.”

**Known limitations and shots to avoid**

- Keep the flaky native input automation and QA consoles out of the recording. Manual physical pass-through passed; an all-passing automated input run is not claimed.
- Production Later uses the saved retry interval, five minutes by default. Show its scheduling and exit; do not wait for the return or use development's ten-second timing.
- Use normal scale and full desktop framing. The supplied PNG artwork has resolution/crop limits; the current renderer is 2.5D, not a production rigged 3D model. Avoid extreme mascot zoom and historical mockup/3D/placeholder galleries.
- The overlay uses the primary work area. Avoid secure desktop/UAC, exclusive fullscreen and unverified physical multi-monitor/DPI changes during the take. Windows software rendering can increase visible CPU; close unnecessary applications.
- Windows Startup settings can show the retained `Mizu` registration name. The demo can show SlingSip's own Settings without opening the OS startup registry view.

Freeze keeps current code, assets, dependencies, business rules and timing. No deployment, portfolio website, installer or release publishing is included. Work stops after local preparation.
