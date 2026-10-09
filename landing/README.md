# SlingSip landing page

A separate browser landing page following the supplied interaction storyboard. The Angular/Electron desktop application, its dependencies, settings, hydration data, scheduler, IPC, tray and release packaging are unchanged. This page has no desktop bridge and stores no hydration/profile data.

## Run and build

From the repository root, with Node 24.15+:

```powershell
npm --prefix landing ci
npm --prefix landing run dev
```

Open **http://127.0.0.1:5173**. Development uses Vite HMR. Stop any preview server using this port before starting development.

```powershell
npm --prefix landing run build
npm --prefix landing run preview
npm --prefix landing test
```

The production output is `landing/dist/`. Build runs asset preparation, strict TypeScript checking and Vite bundling. Build artifacts, generated asset copies, dependencies and test output are Git-ignored. Nothing is deployed or published by these commands.

Browser tests use installed Microsoft Edge on Windows. On other systems install the Playwright Chromium browser, or set `PLAYWRIGHT_CHROMIUM_CHANNEL` to an installed supported channel. Tests run against the production preview with isolated browser contexts; release responses are mocked, and no installer is downloaded.

## Story and motion

| Storyboard beat | Implementation |
| --- | --- |
| 0–12% · Hero | Web draw, curved swing-in, restrained settling, ordered word/description/CTA reveal, weighted cursor parallax and navy city atmosphere |
| 12–22% · Transition | Fading hero, drawing connecting thread, same mascot travels toward the next scene |
| 22–40% · How it works | Desktop pin over 2.15 viewport heights; reminder, automatic/manual Drank it, bottle drop/pendulum/+250 ml, then 0→25→50% progress and chart |
| 40–56% · Dashboard | Real production captures at 500/1000/1500 ml, perspective settling, shallow card depth and matching remaining-water labels |
| 56–67% · Details | Bell ring, chart rise, flame pulse and tray illumination, with local cursor border glow and small depth movement |
| 67–78% · Background | Dashboard shrinks away, tray remains, reminder appears; close/reopen also works with pointer and keyboard |
| 78–88% · Future | Darkened mascot, scanning line, sequential concepts, persistent COMING IN V2 labels; no integrations are implemented |
| 88–100% · Download | Final approach, CTA edge web, official release resolution, dynamic version and permanent current unsigned warning |

The percentages describe approximate narrative beats. Actual positions come from viewport/section geometry, with resize refresh and normal browser scrolling. Desktop pinning adds natural transition space. Mobile uses document flow and smaller travel paths. There is no scroll hijacking.

`src/motion.ts` owns one persistent traveler and a continuous sequence of viewport-relative poses. Curved screen travel and SVG webs use GSAP/ScrollTrigger; old strands retract before replacement. Existing artwork already contains short blue strands, so dynamic SVG continues those at the image boundary. The success delivery uses the existing masked bottle artwork and a damped 10° pendulum.

Cursor input is smoothed with one demand-driven RAF loop on devices with a fine pointer. It sleeps when interpolation converges, cancels when hidden and is removed on cleanup. Pointer translation is bounded to about 10 px, background motion is weaker, dashboard pointer tilt stays within 2.4°, and feature depth stays within 2 px. No Angular change-detection loop is involved. Finite GSAP animation owns major motion; the active reminder has a subtle opacity-only breathing accent.

Reduced motion removes cinematic pinning, large travel and cursor parallax, shows the reminder/progress content together, and preserves manual drink and tray controls. Preference changes tear down/recreate the motion context. Back/forward cache return resumes the existing page; normal navigation aborts pending downloads and removes listeners, RAF and animation state.

## Assets and real screenshots

`scripts/prepare-assets.mjs` copies only the selected existing high-resolution onboarding mascot poses and the normal SlingSip logo into the generated `public/assets/` folder. It wraps the approved bottle PNG in its existing SVG silhouette mask. It does not edit original images or introduce a new character identity. No external image/font CDN is needed.

`artwork/dashboard-{500,1000,1500}.png` are actual captures of the existing production dashboard. They use a sample **Alex** profile in an isolated `%TEMP%/mizu-overlay-tests/landing-capture-*` directory. No normal user data or startup registration is touched. Refresh these images only when the desktop product itself changes:

```powershell
npm run build
npm --prefix landing run capture:dashboard
npm --prefix landing run build
```

The capture helper briefly shows its own isolated dashboard without taking focus, captures it and closes its own Electron instance. Close any screenshot tools that might interfere with rendering; it does not stop a normal running SlingSip instance.

[Production page screenshots](../docs/previews/landing/index.html) cover desktop, mobile, the success bottle, dashboard, tray, V2 and reduced motion. With the preview server running, regenerate them with `node landing/scripts/capture-page.mjs`. Their release-unavailable message is intentionally mocked, not a claim that a real release was published.

## Downloads

`src/download.ts` requests GitHub’s public latest-release endpoint for **ak-ak-k/slingsip**, with no token/cookies. It accepts only a stable, non-draft release and an exactly matching `SlingSip-Setup-{version}-x64.exe` asset whose HTTPS URL belongs to that repository. It never downloads or installs anything automatically.

Both download CTAs initially point to the official GitHub Releases page. A valid response changes them to the EXE and updates version labels. Unpublished releases, rate limits, timeouts, invalid metadata and missing installers retain the usable releases-page fallback and explanatory text. The request times out after five seconds.

The current v1 unsigned notice is explicit. Future signed-distribution notices must be reviewed when the actual distribution changes; a version tag does not prove signing. The landing page does not change or enable the desktop updater.

Live check during implementation: the public latest-release API returned **404**, so an EXE download cannot yet be exercised against a real release. Valid direct-download behavior and fallback cases are covered with browser fixtures. No release was created to satisfy the check.

Technical references: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and [GitHub latest-release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release).

## Verification and manual review

See [landing validation](../docs/slingsip-landing-validation.json) for recorded build/test results and [screenshots](../docs/previews/landing/index.html) for local visual review.

- Scroll down and back up: the same traveler should continue through the scenes, with no leftover web.
- Click **Drank it** before automatic celebration and watch the bottle; finish the progress story at 50%.
- Close/reopen the tray preview using pointer and keyboard.
- Resize between mobile/tablet/desktop; check text, CTA and section readability.
- Turn reduced motion on/off and navigate with Tab/Enter. The pinned scene must release and all content remain usable.
- Check actual installer navigation after a compatible public release exists. Cross-browser testing beyond the recorded Chromium/Edge pass remains manual.
