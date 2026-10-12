# SlingSip landing page

A separate browser landing page following the supplied interaction storyboard. The Angular/Electron desktop application, its dependencies, settings, hydration data, scheduler, IPC, tray and release packaging are unchanged. This page has no desktop bridge and stores no hydration/profile data.

Live website: [sling-sip.vercel.app](https://sling-sip.vercel.app/). Official downloads: [ak-ak-k/slingsip](https://github.com/ak-ak-k/slingsip/releases).

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

`src/motion.ts` owns one persistent traveler and viewport-relative story beats. `src/swing-path.ts` samples quadratic curves with cosine timing and restrained tangent rotation. `src/character-rig.ts` partitions the approved PNGs into torso, head, limbs, scarf and eye layers. `src/character-raster.ts` caches those partitions once as cropped, predecoded bitmaps inside the SVG rig, avoiding repeated live-mask rasterization during scroll. Cache resolution follows the CSS maximum mascot size and device pixel ratio, capped at the 1000-unit source rig resolution. Damped joints follow at different rates; breathing, blinks, pointer look and 470 ms arrival compression/recovery run in time rather than being scrubbed by scroll. The initial web, headline and CTA reveals overlap.

Web endpoints include the actual arm, torso, breathing, arrival and pointer transforms. Baked upper ropes are masked in SVG; short directional anchors reconnect after retracting the previous strand. Tension tightens the curve during fast movement, and released resting poses have no leftover strand. A separate happy pose reacts to bottle delivery; the bottle overshoots, swings through diminishing 11°/−8°/5°/−2.5° arcs and stays visible for about 1.3 seconds. Success can finish before morphing into the time-based 0→25→50% progress scene.

One shared GSAP ticker handles character life and smoothed desktop pointer input; no additional perpetual RAF loop or Angular change detection is involved. Interpolation stops updating pointer transforms when converged. Hidden pages remove the life callback and pause owned timelines. Mobile, save-data and devices reporting at most four logical processors throttle life updates to about 30 Hz. Pointer translation is bounded to 10 px/8 px, background movement is weaker, dashboard tilt stays within 2.4°, and feature depth stays within 2 px. Geometry is read on setup/refresh/resize or pointer entry, never by the character frame callback. Moving layers use transform/opacity; no brightness/filter or bottle width animation runs each frame. Partition caching is initialization work only; scratch canvases are released, pending caching is aborted on teardown, and all blob URLs are revoked. Pose changes remain immediate while cached layers progressively replace their identical SVG masks. Unsupported caching retains those approved SVG partitions; missing artwork retains the existing available-pose/static fallback.

`src/dashboard-motion.ts` animates the same illustrative water values and two-day sample streak over the real captures, with a live ring and shallow card depth. It never contacts or changes desktop state.

Reduced motion removes cinematic pinning, large travel and cursor parallax, shows the reminder/progress content together, and preserves manual drink and tray controls. Preference changes tear down/recreate the motion context. Back/forward cache return resumes the existing page; normal navigation aborts pending downloads and removes listeners, RAF and animation state.

## Assets and real screenshots

`scripts/prepare-assets.mjs` copies only the selected existing high-resolution onboarding mascot poses and the normal SlingSip logo into the generated `public/assets/` folder. It wraps the approved bottle PNG in its existing SVG silhouette mask. It does not edit original images or introduce a new character identity. No external image/font CDN is needed.

The repository has flattened poses, not authored transparent joint cutouts, hidden surfaces, eye sprites or a rig. The SVG partitions therefore use small joint ranges and a seam underlap. The happy delivery uses the smiling relaxed artwork with a distinct reaction; it does not insert a new character or the pose with a baked bottle. Exact articulated deformation and new expressions require authored layer exports. The existing bottle remains relatively low resolution.

`artwork/dashboard-{500,1000,1500}.png` are actual captures of the existing production dashboard. They use a sample **Alex** profile in an isolated `%TEMP%/mizu-overlay-tests/landing-capture-*` directory. No normal user data or startup registration is touched. Refresh these images only when the desktop product itself changes:

```powershell
npm run build
npm --prefix landing run capture:dashboard
npm --prefix landing run build
```

The capture helper briefly shows its own isolated dashboard without taking focus, captures it and closes its own Electron instance. Close any screenshot tools that might interfere with rendering; it does not stop a normal running SlingSip instance.

[Production page screenshots](../docs/previews/landing/index.html) cover desktop, mobile, the success bottle, dashboard, tray, V2 and reduced motion. With the preview server running, regenerate them with `node landing/scripts/capture-page.mjs`. Their release-unavailable message is intentionally mocked, not a claim that a real release was published.

## Downloads

`src/download.ts` makes one shared request to GitHub’s public latest-release endpoint for **ak-ak-k/slingsip**, with no token/cookies. It accepts only a stable, non-draft release and an exactly matching `SlingSip-Setup-{version}-x64.exe` asset whose HTTPS URL belongs to that repository. Owner/repository comparison is case-insensitive because GitHub returns the canonical name **SlingSip**; release tags and filenames remain exact. Foreign owners/repositories/hosts, credentials, query strings and fragments are rejected. It never downloads or installs anything automatically.

Both download CTAs use the same loading/ready/fallback state and initially point to the official GitHub Releases page. A valid response changes both to the same EXE and updates their version labels. No release version is shown before validation. Unpublished releases, rate limits, timeouts, invalid metadata and missing installers retain the usable releases-page fallback and explanatory text. The request times out after five seconds; page teardown aborts it. Existing CTA/web animation is unchanged and does not delay navigation.

The current v1 unsigned notice is explicit. Future signed-distribution notices must be reviewed when the actual distribution changes; a version tag does not prove signing. The landing page does not change or enable the desktop updater.

On **12 October 2026**, the public latest-release API returned **v1.0.0** with the official `SlingSip-Setup-1.0.0-x64.exe` asset. The earlier initial-implementation 404 and mocked unavailable screenshots are historical evidence. The website resolver stays dynamic; it does not hardcode this version. No release was created or published during this polish pass.

Technical references: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and [GitHub latest-release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release).

## Verification and manual review

See [landing validation](../docs/slingsip-landing-validation.json) for recorded build/test results and [screenshots](../docs/previews/landing/index.html) for local visual review.

The original validation/gallery describes the initial landing implementation. See [motion-polish report](../docs/slingsip-landing-motion-polish.md) and [motion review](../docs/previews/landing-motion/index.html) for the current animation pass. With a preview running, capture the current scenes and an optional local WebM using `npm --prefix landing run capture:motion`. Generated motion recordings are Git-ignored and excluded from the committed gallery. Video capture requires Playwright's FFmpeg helper; install it once with `npm --prefix landing exec -- playwright install ffmpeg`. Set `LANDING_PREVIEW_URL` for another preview URL; set `LANDING_TEST_PORT` to run browser tests on a different local port without stopping an existing development server.

- Scroll down and back up: the same traveler should continue through the scenes, with no leftover web.
- Click **Drank it** before automatic celebration and watch the bottle; finish the progress story at 50%.
- Close/reopen the tray preview using pointer and keyboard.
- Resize between mobile/tablet/desktop; check text, CTA and section readability.
- Turn reduced motion on/off and navigate with Tab/Enter. The pinned scene must release and all content remain usable.
- Check installer download from the live site after deploying website changes. Cross-browser testing beyond the recorded Chromium/Edge pass remains manual.
