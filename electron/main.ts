import { app, dialog, Menu, powerMonitor, screen, session } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerDesktopIpc } from './desktop-ipc';
import { DesktopWindows } from './window-manager';
import { WindowsStartup } from './windows-startup';
import { SlingSipTray } from './tray-controller';
import { configureAppIdentity } from './app-identity';
import { RestartController } from './restart-controller';
import { UpdateService, type UpdateBackend } from './update-service';
import { createElectronUpdateBackend, updateAvailability } from './update-backend';
import { UpdateTestDriver } from './update-test-driver';
import { DEV_PROFILE_CONFLICT_EXIT_CODE, DEV_RESTART_EXIT_CODE } from '../shared/development-contract';

const electronDirectory = path.dirname(fileURLToPath(import.meta.url));
// Avoid querying an unavailable Windows D3D video-overlay device. Chromium still
// composites the alpha window and decodes WebM using its software fallback.
if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-direct-composition');
}
const testMode = !app.isPackaged && process.argv.includes('--companion-test');
let testProfile: string | undefined;
let testProfileName: string | undefined;
if (testMode) {
  // A validated test profile supports restart tests without touching real saved progress.
  const profileArgument = process.argv.find((argument) => argument.startsWith('--companion-test-profile='));
  const profileName = profileArgument?.slice('--companion-test-profile='.length) ?? `${process.pid}-${randomUUID()}`;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(profileName)) throw new Error('Invalid companion test profile name.');
  testProfileName = profileName;
  testProfile = path.join(app.getPath('temp'), 'mizu-overlay-tests', profileName);
}
// Configure both paths before readiness, storage, sessions and the instance lock.
configureAppIdentity(app, testProfile);
const developmentManaged = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL']
  && process.env['SLINGSIP_DEV_SUPERVISED'] === '1' && typeof process.send === 'function';

if (!app.requestSingleInstanceLock()) {
  if (developmentManaged) app.exit(DEV_PROFILE_CONFLICT_EXIT_CODE);
  else app.quit();
} else {
  const windows = new DesktopWindows({
    preload: path.join(electronDirectory, 'preload.cjs'),
    rendererFile: path.join(electronDirectory, '../renderer/browser/index.html'),
    developmentUrl: !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined,
  });
  let restartController: RestartController | undefined;
  if (developmentManaged) app.on('web-contents-created', (_event, contents) => contents.on('before-input-event', (event, input) => {
    const owned = [windows.dashboard, windows.companion].some(window => window?.webContents === contents);
    if (owned && input.type === 'keyDown' && !input.isAutoRepeat && input.control && input.alt && input.shift
      && (input.code === 'KeyR' || input.key.toLowerCase() === 'r')) {
      event.preventDefault(); restartController?.restart();
    }
  }));
  app.on('before-quit', () => { windows.quitting = true; });
  const openDashboard = () => {
    void app.whenReady().then(() => windows.openDashboard()).catch(console.error);
  };
  app.on('second-instance', (_event, args) => {
    if (!args.includes('--autostart')) openDashboard();
  });
  app.on('activate', openDashboard);
  // Closing the dashboard or hiding the companion preserves their independent lifecycle.
  app.on('window-all-closed', () => {});
  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    const quickRetry = !app.isPackaged && (!!process.env['ELECTRON_RENDERER_URL'] || testMode) && !(testMode && process.argv.includes('--companion-test-production'));
    const startup = new WindowsStartup(testMode);
    let tray: SlingSipTray | undefined;
    let updateDesktop: ReturnType<typeof registerDesktopIpc> | undefined;
    // This test adapter is main-only, explicitly opted in and impossible in packaged builds.
    const updateTestDriver = testMode && process.argv.includes('--companion-test-updater') ? new UpdateTestDriver() : undefined;
    let updateDisabledReason = updateAvailability(app.isPackaged, process.platform, process.resourcesPath);
    let updateBackend: UpdateBackend | undefined = updateTestDriver;
    if (!updateBackend && updateDisabledReason === null) {
      try { updateBackend = createElectronUpdateBackend(); }
      catch { updateDisabledReason = 'The update service could not start. SlingSip can still be used normally.'; }
    }
    const updates = new UpdateService({
      currentVersion: app.getVersion(),
      backend: updateBackend,
      disabledReason: updateTestDriver ? undefined : updateDisabledReason ?? undefined,
      automaticChecking: !updateTestDriver && updateDisabledReason === null,
      changed: () => { updateDesktop?.publish(); },
      persist: () => { if (!updateDesktop) throw new Error('Application is not ready.'); updateDesktop.persistForRestart(); },
      canInstall: () => !!updateDesktop && !windows.quitting && !windows.companion?.isVisible()
        && (!updateDesktop.hydration.active() || updateDesktop.hydration.retrySnapshot().pending),
    });
    const desktop = registerDesktopIpc(windows, quickRetry, startup,
      () => tray?.status ?? { available: false, error: null }, (state) => tray?.update(state), updates);
    updateDesktop = desktop;
    const hydration = desktop.hydration;
    const actualStartup = startup.snapshot();
    if (actualStartup.supported && !actualStartup.error && hydration.session.persisted().settings.launchAtStartup !== actualStartup.enabled) {
      hydration.updateSettings({ ...hydration.session.persisted().settings, launchAtStartup: actualStartup.enabled });
    }
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      windows.quitting = true;
      updates.stop();
      hydration.stop();
      windows.destroyAll();
      tray?.destroy();
    };
    const restart = new RestartController({
      persist: desktop.persistForRestart,
      cleanup,
      relaunch: () => {
        // The managed dev parent launches only after the old child has exited.
        if (developmentManaged) return;
        const args = process.argv.slice(1);
        if (testProfileName && !args.some(arg => arg.startsWith('--companion-test-profile='))) args.push('--companion-test-profile=' + testProfileName);
        app.relaunch({ args });
      },
      exit: () => app.exit(developmentManaged ? DEV_RESTART_EXIT_CODE : 0),
      failed: error => {
        console.error('SlingSip restart cancelled:', error);
        dialog.showErrorBox('SlingSip could not restart', 'Your running session was kept open because its current state could not be saved.\n\n' + String(error));
      },
    });
    restartController = restart;
    tray = new SlingSipTray(windows, hydration, () => { if (!updates.snapshot().installing) restart.restart(); }, () => updates.install());
    // Native test access exists only in the isolated main process, never in preload.
    if (testMode) Object.assign(globalThis, { __slingSipTestTray: tray });
    if (updateTestDriver) Object.assign(globalThis, { __slingSipTestUpdater: updateTestDriver });
    // Install cleanup before any renderer await: Quit also works during initial loading.
    app.on('before-quit', cleanup);
    if (developmentManaged) {
      // This is the inherited parent Node IPC pipe, not renderer IPC.
      process.on('message', message => {
        if (!message || typeof message !== 'object' || !('type' in message) || windows.quitting) return;
        if (message.type === 'slingsip:restart') restart.restart();
        else if (message.type === 'slingsip:quit') app.quit();
        else if (message.type === 'slingsip:reload-assets') {
          void session.defaultSession.clearCache().then(() => {
            if (!windows.quitting) for (const window of [windows.dashboard, windows.companion]) {
              if (window && !window.isDestroyed()) window.webContents.reloadIgnoringCache();
            }
          }).catch(console.error);
        }
      });
      process.once('disconnect', () => app.quit());
    }
    let screenLocked = false;
    powerMonitor.on('suspend', () => desktop.setDisplayActive(false));
    powerMonitor.on('lock-screen', () => { screenLocked = true; desktop.setDisplayActive(false); });
    powerMonitor.on('resume', () => { desktop.setDisplayActive(!screenLocked); hydration.refresh(); });
    powerMonitor.on('unlock-screen', () => { screenLocked = false; desktop.setDisplayActive(true); hydration.refresh(); });
    app.on('browser-window-focus', () => hydration.refresh());
    const reposition = () => windows.positionCompanion();
    screen.on('display-metrics-changed', reposition);
    screen.on('display-added', reposition);
    screen.on('display-removed', reposition);
    hydration.start();
    updates.start();
    desktop.publish();
    await windows.ensureCompanion();
    if (windows.quitting) return;
    if (!process.argv.includes('--autostart') || !tray.status.available || !desktop.snapshot().userProfile?.hasCompletedOnboarding) await windows.openDashboard();
    if (developmentManaged && !windows.quitting) process.send?.({ type: 'slingsip:ready', pid: process.pid });
  }).catch((error: unknown) => { console.error(error); app.quit(); });
}
