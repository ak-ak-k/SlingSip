# SlingSip restart and development refresh

Tray **Restart SlingSip** saves the current hydration record and companion preferences, stops main-process reminder work, destroys both windows and the retained tray, schedules Electron relaunch and exits the old process. The new process restores the existing store and reconstructs its scheduler through the ordinary startup path. No drink is credited by restart.

## Files modified

| File | Purpose |
| --- | --- |
| `electron/restart-controller.ts` (new) | Reusable main-owned restart coordinator; prevents repeated requests and aborts before cleanup if persistence fails. |
| `electron/main.ts` | Wire restart to the tray, idempotent shutdown, Electron relaunch/exit, isolated-profile argument preservation, private development-parent control and local dev shortcut. |
| `electron/desktop-ipc.ts` | Main-only persistence preflight using the existing storage objects and schemas. Existing renderer APIs/channels are unchanged. |
| `electron/window-manager.ts` | Destroy owned windows for shutdown; prevent pending open/show operations from creating replacements during teardown. |
| `electron/tray-controller.ts` | Add one Restart item; existing Open/Drink/Pause/Settings/Quit behavior remains. |
| `shared/development-contract.ts` (new) | Private parent/main command names and restart/profile-conflict exit codes. Not a preload API. |
| `scripts/dev.mjs` | Supervise Electron; watch main/shared/assets; retain Angular server through restart; canonicalize Windows paths; stop owned resources on exit. |
| `scripts/dev-workflow.mjs` (new) | Debounce/serialize builds and replacements; wait for old-child exit; asset-only renderer refresh; handle build errors and concurrent manual restarts. |
| `scripts/build-electron.mjs` | Compile main and preload in memory first; replace outputs only after both compile successfully. |
| `angular.json` | Explicit Angular HMR and development `Cache-Control: no-store` responses. |
| `src/app/shared/slingsip-artwork.component.ts` | Read-only source-hash metadata for checking that refreshed hero artwork matches regenerated PNG geometry. |
| `tests/restart.spec.mjs` (new) | Save/cleanup/relaunch order, persistence failure, duplicate requests, dev ownership and real production tray relaunch/data/startup/lock checks. |
| `tests/development-refresh.spec.mjs` (new) | Run the real launcher in an isolated project copy; change main, preload, renderer and PNG metadata; verify replacement, HMR, fresh asset bytes and shortcuts. |
| `README.md`, this report, `docs/slingsip-restart-validation.json` | Usage, architecture, manual checklist and final validation evidence. |

No hydration arithmetic, scheduler implementation, history/streak calculations, settings rules, storage schema, startup registration identity or companion choreography was modified. No new dependency or updater is introduced.

## Restart architecture

`SlingSipTray` calls `RestartController.restart()` in Electron main. The coordinator saves through the existing `HydrationStorage` and `CompanionPreferencesStorage` before marking restart in progress. If either save fails, it leaves the running session, windows and timers intact and shows a main-process error.

The idempotent cleanup marks the windows as quitting, invokes the existing `hydration.stop()` to cancel scheduler/development/retry timers, destroys companion/dashboard renderers and destroys the tray. Destroying native windows terminates their visual timers/render loops without generating an intake action. The production path then calls `app.relaunch({args})` and `app.exit(0)`; explicit cleanup is necessary because `app.exit()` bypasses normal quit events. Electron launches the successor after the old process exits. See [Electron app lifecycle documentation](https://www.electronjs.org/docs/latest/api/app#apprelaunchoptions).

The existing single-instance lock is still acquired before storage, tray, windows or scheduler creation. Restart never releases it early and never uses a second manual spawn in production. The successor uses the same executable, working directory, arguments and compatibility profile. Isolated tests also retain their validated profile name even if it was generated for the original process.

The reusable main coordinator can later be called after an updater has downloaded a release. No updater, network update check or installer migration is implemented.

## Tray and shortcut

Production shows **Restart SlingSip**. Development shows **Restart SlingSip (Dev)**. Every request reaches the same save-and-cleanup coordinator.

The supervised development launcher adds **Ctrl+Alt+Shift+R** while a SlingSip window has keyboard focus. This intentionally leaves the ordinary Ctrl+Shift+R chord unchanged. It is a local window shortcut, not a global Windows shortcut, and is absent from production. It does not require a new dashboard button or preload API.

## Development behavior

Run `npm run dev`. Angular/Vite HMR applies supported renderer template/style edits; ordinary Angular live reload covers other renderer changes. The Electron main PID stays unchanged for those renderer edits. [Angular's serve documentation](https://angular.dev/cli/serve) describes the HMR/watch settings used here.

The launcher watches `electron/` and `shared/` TypeScript files. A save burst is debounced and builds are serialized. Both main and preload must compile before output files are replaced. A compilation failure keeps the running instance and reports the error. After a successful build, the parent sends a private restart command to its owned Electron child. That child performs the same persistence/cleanup and exits with code 75. Only after its exit does the parent launch one replacement; Angular stays running. A manual tray/shortcut restart during a build waits for the build before creating the successor.

This private control uses Node's inherited parent-child IPC pipe. It is not `ipcRenderer`, is not exposed through `contextBridge`, and is enabled only for an unpackaged renderer-server launch explicitly supervised by this script. Main accepts only fixed restart/quit/asset-refresh commands. Packaged and ordinary production launches do not enable the pipe or shortcut. Electron preload itself and all existing typed renderer IPC channels are unchanged.

The launcher watches `public/` and `src/assets/`. Asset changes prepare the existing PNG masks/socket metadata and refresh both renderers after Angular completes its rebuild. Static-only updates have a short fallback refresh when no bundle rebuild is running. Main clears the HTTP resource cache and reloads both native pages ignoring cache; the dev server also sends `Cache-Control: no-store`. The loader is recreated so old decoded PNGs do not survive a refresh. Original raster artwork is never rewritten by preparation. Asset preparation errors are reported and refreshed views use the approved-only fallback.

Windows short-name working directories are resolved to their canonical native path before Angular starts, so Vite's asset allow list uses the same path as its file requests. No Vite security restriction is disabled.

Quit from the tray or press Ctrl+C in the dev terminal to stop the owned Electron child, watchers and Angular server. The parent first asks Electron to quit normally; a five-second fallback terminates only its own unresponsive child. If the parent disappears, the inherited pipe disconnect asks Electron to quit, avoiding an orphan tray process.

If another instance already owns the normal profile, dev startup exits with a clear message and stops its own server. It does not force-kill another running application. An instance launched before this change needs one normal tray Quit before the first updated dev launch; its already-loaded code cannot acquire the new restart service. Afterwards, supervised restarts and source watches handle replacement.

## Data and active reminders

Restart retains current water, dates/history/goals/streaks, hydration settings, sound/motion/cursor preferences and the existing Windows startup preference. Files still use `%APPDATA%/Mizu`, the existing JSON schemas and the legacy `Mizu` Run entry. No data or registry migration occurs.

An active reminder closes without logging an extra glass. Pending hidden retries and delayed development prompts are cancelled rather than replayed after relaunch. The new scheduler selects future daily slots using the existing calculation; outside working hours, `nextReminderAt` can correctly be null while calendar/boundary maintenance continues. Temporary Pause remains session state and resets as in an ordinary quit/start; persistent reminders OFF and all saved preferences remain intact.

## Validation

See [the validation record](slingsip-restart-validation.json) for final typecheck/build and regression results. New native checks use isolated profiles; the development test copies the project and adds only PNG text metadata to that copy, preserving source pixels and the working project. Its temporary Windows startup entry is uniquely named and cleaned up.

Type checking and the production build passed. The complete 95-test run passed 93 checks in 18.2 minutes. All five new restart/development tests passed, including production tray relaunch with saved water/history/streak/settings/preferences and isolated Windows startup registration, duplicate-instance reuse, restart/persistence-failure ordering, serialized development ownership, and the real main/preload/HMR/PNG/native-shortcut workflow. The development test uses Electron native input through an isolated loopback inspector because CDP keyboard input bypasses Electron before-input-event; production gains no debugger or new renderer API.

The existing quiet-autostart/tray Settings reopening check timed out in the full run and passed unchanged on its targeted rerun, including pause reset and clean Quit. That gives 94 distinct passing checks out of 95. No skipped cases or weakened assertions were used.

The separate Windows physical-pointer regression remains unresolved. The full run failed inside the native pointer helper with “The system cannot find the file specified” while moving the cursor; the executable exists. Two unchanged reruns reached different physical-input assertions: stationary-cursor interaction after a display event, then blank-space click-through. Diagnostics recorded cursor movement away from the tested point. This suggests desktop input interference, but the cause is not conclusively isolated. The earlier visual-identity build passed this case on its targeted rerun; that earlier pass does not replace the current failure. All pointer/security/recovery assertions remain intact. Restart work did not modify the pointer helper or companion hit-testing. See the validation record for exact runs and repeat this check on an unlocked desktop with the mouse idle.

## Manual checklist

1. Build/start SlingSip, record a glass, and confirm its tray icon and saved water.
2. Click **Restart SlingSip** while a reminder is visible. Check the old windows/tray disappear and one successor tray appears; no extra glass is recorded.
3. Open the dashboard from the new tray. Check saved water/history/streak, settings, sidekick preferences and Windows startup preference; check the next eligible daily schedule.
4. Try a second ordinary launch. Check it reopens the same owner and does not add a tray, scheduler or companion window.
5. Run `npm run dev` after quitting any older unmanaged instance. Edit a renderer template/style: check Angular updates it without replacing main.
6. Edit main/preload: check one clean Electron replacement, preserved water and no stale tray. Introduce/fix a compilation error: check the old instance remains until a successful build.
7. Replace a supplied PNG and review measured sockets. Check regenerated geometry and refreshed hero/reminder artwork in both windows; check missing artwork still uses approved-only fallback.
8. Try development **Ctrl+Alt+Shift+R** and ordinary **Ctrl+Shift+R**. Check only the explicit full-restart chord replaces main. Verify the dev chord is absent in production.
9. Restart while a hidden retry or 15-second development prompt is pending. Check neither old timer creates a duplicate reminder.
10. Quit/Ctrl+C. Check the supervised tray and Angular server stop. For production asset updates, rebuild first and use tray Restart to load the new local bundle.
11. Separately, on an unlocked desktop with no other pointer activity, run `npm run test:electron -- tests/phase-one.spec.mjs`. Verify bubble clicks, blank-space click-through, stationary-cursor recovery, native water clicks and renderer recovery. This physical Windows check is still unresolved in the current validation.

Local implementation and review only. No deployment.
