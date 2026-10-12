# SlingSip website/download polish — 12 October 2026

Local implementation and production browser validation passed. **41 tests passed, 0 failed, 0 skipped, 0 flaky**, including all existing landing motion checks. Real public API resolution passed at desktop/mobile sizes. **An actual installer transfer remains unconfirmed:** GitHub returned the installer redirect, but its asset delivery connection reset in command-line and browser probes. This is recorded separately from the passing URL-resolution and intercepted-navigation tests.

No deployment, push, tag, GitHub release or repository About change was performed. The existing live deployment still uses the old resolver/fallback until these website changes are deployed. Desktop application code, version, persistence and packaging were unchanged.

## Files changed in this pass

- `landing/src/download.ts`: fix canonical GitHub repository casing; shared finite download state; ignore malformed unrelated asset entries; suppress updates after teardown.
- `landing/index.html`: identical CTA wording, shared accessible status description, concise unsigned copy and loading text.
- `landing/tests/download.spec.mjs`: shared-request/direct-navigation checks at 320/390/1440 px; unsafe metadata, malformed data, dynamic version and clickable fallback coverage.
- `landing/tests/landing.spec.mjs`: use GitHub's actual canonical casing in the existing positive fixture and assert fallback state/version labels.
- `README.md`: recruiter-facing website/download/repository links, Windows download section, verified public version/unsigned notice, remove outdated unpublished/undeployed statements.
- `landing/README.md`: document the live website, canonicalization fix, shared state and actual public release; distinguish earlier 404/mock captures as historical evidence.
- This report and `docs/slingsip-website-download-validation.json`.

Pre-existing uncommitted motion changes and review artifacts were preserved. No character, trajectory, reminder simulation, dashboard animation or stylesheet was changed by this pass.

## Release resolution and download behavior

There is one `initDownloads()` call in `landing/src/main.ts`, one fetch in `landing/src/download.ts`, and one public endpoint:

`https://api.github.com/repos/ak-ak-k/slingsip/releases/latest`

The response must describe a non-draft, non-prerelease three-part version and contain an exactly matching `SlingSip-Setup-{version}-x64.exe`. The installer must use HTTPS on `github.com`, owner `ak-ak-k` and repository `slingsip`. Only owner/repository matching ignores case: GitHub's canonical repository name is **SlingSip**. The tag, filename and remaining download path stay exact. Foreign hosts/owners/repositories, credentials, query strings and fragments are rejected. No token or cookies are sent.

The original validator compared the complete path against lowercase `/ak-ak-k/slingsip/`. The real API returned `/ak-ak-k/SlingSip/`, causing a valid public installer to fall back. This mismatch is now covered by fixtures and real API browser checks.

Both hero and finale receive the same state:

| State | Link | Version/status |
| --- | --- | --- |
| Loading | Official repository Releases page | `Version on GitHub`; subtle finding message |
| Ready | Same validated official EXE | Real version from response; installer filename |
| Fallback | Official repository Releases page | No unverified version; direct download unavailable message |

The five-second timeout applies to the shared request. Network errors, rate limits, invalid JSON, missing installers and invalid metadata finish loading and retain a clickable fallback. Page teardown clears the timer and aborts the request. No extra service or dependency was introduced.

The existing CTA/web click animation remains in `main.ts`; normal anchor navigation is immediate. There is no automatic download or install. The website does not alter the desktop updater.

## Current public release

The live API returned **v1.0.0**, stable and non-draft, with the uploaded **111,772,527-byte** asset:

[SlingSip-Setup-1.0.0-x64.exe](https://github.com/ak-ak-k/SlingSip/releases/download/v1.0.0/SlingSip-Setup-1.0.0-x64.exe)

The landing code stays dynamic; this version appears only after a trusted response. README intentionally links the verified V1 asset. The [official release notes](https://github.com/ak-ak-k/slingsip/releases/tag/v1.0.0) identify the build as unsigned with automatic updates disabled.

The unsigned notice reads:

> This Windows build is currently unsigned.
> Windows may show an Unknown Publisher or SmartScreen warning.
> Download SlingSip only from the official GitHub repository.

## Validation

Commands, from the repository root:

```powershell
npm --prefix landing run build
npm --prefix landing run preview -- --port 5174
$env:LANDING_TEST_PORT='5174'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='../test-results/landing-download-full-report.json'
npm --prefix landing test -- --reporter=list,json
```

- Production build passed: asset preparation, strict TypeScript checking and Vite bundling. JS: `index-C4seYnAp.js`; CSS: `index-DdZy-eGQ.css`.
- Full suite passed in **148.637 seconds** on headless Microsoft Edge; no reruns were needed. Existing character life, hand/web attachment, bottle delivery, continuous story, dashboard, reduced-motion and low-power assertions remain intact.
- Both CTAs performed intercepted direct navigation at **320/390/1440 px**, using one API request per page. The test serves a text response instead of downloading an installer.
- A separate unmocked API browser audit on the local production bundle at **390/1440 px** found both CTAs ready, both version labels `v1.0.0`, no page/console errors, no failed assets, no horizontal overflow and all 13 page images loaded. Local screenshots were inspected for readable CTA/notice layout.
- All **12** generated production asset URLs returned HTTP 200 in a separate HEAD audit.
- Production HTML/JS/CSS scans found no localhost URLs, development bridge/endpoints, GitLab references or GitHub token patterns. The bundle contains one latest-release endpoint. All external page links belong to the official repository. No Releases section was added.
- The existing Vercel site returned HTTP 200 and no asset/console errors, but still showed the old fallback and old hero copy. It has not received this local change.
- The actual official installer URL returned HTTP 302 to GitHub's release-assets CDN. Subsequent transfer probes failed with `ECONNRESET` / browser `net::ERR_CONNECTION_RESET`; no completed binary download is claimed. The URL/API/fixture checks do not substitute for that final transfer check.
- `git diff --check` passed. Desktop source/config/version diffs were empty. Build outputs, generated assets, scratch captures and raw test results remain Git-ignored; `.gitignore` was unchanged.

The condensed [validation record](slingsip-website-download-validation.json) retains actual outcomes. Raw browser/test reports and scratch screenshots remain ignored local QA artifacts.

## Remaining manual steps

1. In GitHub repository **About → Website**, set [https://sling-sip.vercel.app/](https://sling-sip.vercel.app/). No application setting or code can substitute for this metadata field.
2. When ready, deploy these website changes using the existing Vercel workflow; this task did not push or deploy them.
3. On a connection that can reach GitHub's download CDN, click hero and finale on the deployed site, confirm the installer downloads with the expected filename, and verify the fallback by blocking the GitHub API. A complete installer download remains the outstanding external-network check.
