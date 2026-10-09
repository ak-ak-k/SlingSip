import { app, BrowserWindow, ipcMain, screen, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { DESKTOP_CHANNELS as channels, type DesktopSnapshot, type WindowRole } from '../shared/desktop-contract';
import { DesktopWindows } from './window-manager';
import { HydrationRuntime } from './hydration-runtime';
import { HydrationStorage } from './hydration-storage';
import { validateHydrationSettings } from '../shared/hydration-settings';
import { WindowsStartup } from './windows-startup';
import { type TrayStatus } from '../shared/product-contract';
import { CompanionPreferencesStorage } from './companion-preferences-storage';
import { UserProfileStorage } from './user-profile-storage';
import { type UpdateService } from './update-service';

export function registerDesktopIpc(windows: DesktopWindows, developmentMode: boolean, startup: WindowsStartup,
  trayStatus: () => TrayStatus, published: (snapshot: DesktopSnapshot) => void, updates: UpdateService) {
  let revision = 0;
  let testClicks = 0;
  let displayActive = true;
  const companionPreferences = new CompanionPreferencesStorage();
  const userProfile = new UserProfileStorage();

  const snapshot = (): DesktopSnapshot => {
    const display = screen.getPrimaryDisplay();
    const companion = windows.companion;
    return {
      revision,
      appVersion: app.getVersion(),
      updates: updates.snapshot(),
      electronVersion: process.versions.electron,
      angularVersion: '22.2.1',
      platform: process.platform,
      display: {
        id: display.id,
        label: display.label || 'Primary display',
        bounds: { ...display.bounds },
        workArea: { ...display.workArea },
        scaleFactor: display.scaleFactor,
      },
      dashboardOpen: !!windows.dashboard && !windows.dashboard.isDestroyed(),
      dashboardBounds: windows.dashboard && !windows.dashboard.isDestroyed() && windows.dashboard.isVisible() && !windows.dashboard.isMinimized()
        ? windows.dashboard.getContentBounds() : null,
      hydration: hydration.session.snapshot(),
      hydrationState: hydration.session.persisted(),
      scheduler: hydration.scheduler.snapshot(),
      developmentMode,
      companionPreferences: companionPreferences.snapshot(),
      companionPreferencesError: companionPreferences.error,
      userProfile: userProfile.snapshot(),
      userProfileError: userProfile.error,
      displayActive,
      storageError: hydration.storageError(),
      schedulerError: hydration.error,
      reminderTiming: hydration.timing(),
      history: hydration.session.history(),
      streaks: hydration.session.streaks(),
      startup: startup.snapshot(),
      tray: trayStatus(),
      creditedReminder: hydration.creditedReminder,
      reminderRetry: hydration.retrySnapshot(),
      overlay: {
        visible: !!companion && !companion.isDestroyed() && companion.isVisible(),
        interactive: windows.interactive,
        bounds: companion && !companion.isDestroyed() ? companion.getBounds() : null,
        layoutRevision: windows.layoutRevision,
        visibilityRevision: windows.visibilityRevision,
        testClicks,
      },
    };
  };

  const publish = (): DesktopSnapshot => {
    revision += 1;
    const state = snapshot();
    if (!windows.quitting) {
      for (const window of [windows.dashboard, windows.companion]) {
        if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
          window.webContents.send(channels.snapshotChanged, state);
        }
      }
    }
    published(state);
    return state;
  };
  const hydrationStorage = new HydrationStorage();
  const hydration = new HydrationRuntime(windows, hydrationStorage, developmentMode, () => { publish(); });
  windows.on('changed', () => { hydration.refresh(); publish(); });
  // Reflect a startup entry changed in Windows Settings when the dashboard regains focus.
  app.on('browser-window-focus', () => {
    const actual = startup.refresh();
    if (actual.supported && !actual.error && hydration.session.persisted().settings.launchAtStartup !== actual.enabled) {
      hydration.updateSettings({ ...hydration.session.persisted().settings, launchAtStartup: actual.enabled });
    }
    publish();
  });

  const authorize = (event: IpcMainEvent | IpcMainInvokeEvent, requiredRole?: WindowRole): BrowserWindow => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const knownWindow = window && (window === windows.dashboard || window === windows.companion);
    const roleMatches = !requiredRole || window === (requiredRole === 'dashboard' ? windows.dashboard : windows.companion);
    if (!knownWindow || !roleMatches || event.senderFrame !== event.sender.mainFrame
      || !windows.isTrustedRenderer(window, event.senderFrame.url)) {
      throw new Error('This desktop operation is not available to the requesting frame.');
    }
    return window;
  };

  ipcMain.handle(channels.snapshot, (event) => { authorize(event); hydration.refresh(); return snapshot(); });
  const updateCommand = (event: IpcMainInvokeEvent, args: unknown[], action: () => void) => {
    authorize(event, 'dashboard');
    if (args.length) throw new Error('Update commands do not accept parameters.');
    action();
    return publish();
  };
  ipcMain.handle(channels.updateCheck, (event, ...args: unknown[]) => updateCommand(event, args, () => { void updates.check(); }));
  ipcMain.handle(channels.updateDownload, (event, ...args: unknown[]) => updateCommand(event, args, () => { void updates.download(); }));
  ipcMain.handle(channels.updateInstall, (event, ...args: unknown[]) => updateCommand(event, args, () => updates.install()));
  ipcMain.handle(channels.hydrationState, (event) => { authorize(event); hydration.refresh(); return hydration.session.persisted(); });
  ipcMain.handle(channels.hydrationSettings, (event) => { authorize(event); return hydration.session.persisted().settings; });
  ipcMain.handle(channels.nextReminder, (event) => { authorize(event); hydration.refresh(); return hydration.scheduler.snapshot(); });
  ipcMain.handle(channels.updateHydrationSettings, (event, settings: unknown) => {
    authorize(event, 'dashboard');
    const validated = validateHydrationSettings(settings);
    try {
      startup.refresh();
      if (validated.launchAtStartup !== startup.snapshot().enabled || startup.snapshot().error && startup.snapshot().supported) startup.setEnabled(validated.launchAtStartup);
      hydration.updateSettings({ ...validated, launchAtStartup: startup.snapshot().enabled });
    } catch (error) { publish(); throw error; }
    return publish();
  });
  ipcMain.handle(channels.updateCompanionPreferences, (event, preferences: unknown) => {
    authorize(event, 'dashboard');
    companionPreferences.update(preferences);
    return publish();
  });
  ipcMain.handle(channels.developmentReminder, async (event, delayMs: unknown) => {
    authorize(event, 'dashboard');
    await hydration.triggerDevelopment(delayMs);
    return publish();
  });
  ipcMain.handle(channels.updateDisplayName, (event, value: unknown) => {
    authorize(event, 'dashboard');
    try { userProfile.updateName(value); } catch (error) { publish(); throw error; }
    return publish();
  });
  ipcMain.handle(channels.completeOnboarding, (event) => {
    authorize(event, 'dashboard');
    try { userProfile.complete(); } catch (error) { publish(); throw error; }
    return publish();
  });
  ipcMain.handle(channels.resetOnboarding, (event) => {
    authorize(event, 'dashboard');
    try { userProfile.resetOnboarding(); } catch (error) { publish(); throw error; }
    return publish();
  });
  ipcMain.handle(channels.overlayVisible, async (event, visible: unknown, expectedVisibilityRevision: unknown) => {
    authorize(event);
    if (typeof visible !== 'boolean') throw new Error('Overlay visibility must be a boolean.');
    if (expectedVisibilityRevision !== undefined) {
      authorize(event, 'companion');
      if (visible || typeof expectedVisibilityRevision !== 'number' || !Number.isSafeInteger(expectedVisibilityRevision) || expectedVisibilityRevision < 0) {
        throw new Error('Conditional hide requires a valid visibility revision.');
      }
    }
    if (visible) await hydration.trigger(true);
    else await hydration.finishReminder(expectedVisibilityRevision as number | undefined);
    return publish();
  });
  ipcMain.handle(channels.suspendReminder, async (event, reminderRevision: unknown) => {
    authorize(event, 'companion');
    if (typeof reminderRevision !== 'number' || !Number.isSafeInteger(reminderRevision) || reminderRevision < 0) {
      throw new Error('Retry requires a valid reminder revision.');
    }
    await hydration.suspendReminder(reminderRevision);
    return publish();
  });
  ipcMain.on(channels.overlayInteractive, (event, value: unknown) => {
    try {
      authorize(event, 'companion');
      if (typeof value !== 'boolean') throw new Error('Overlay interactivity must be a boolean.');
      windows.setInteractive(value);
    } catch (error) { console.error(String(error)); }
  });
  ipcMain.handle(channels.cursorPosition, (event) => {
    const window = authorize(event, 'companion');
    const cursor = screen.getCursorScreenPoint();
    const bounds = window.getContentBounds();
    // Only page zoom changes CSS coordinates; OS scale is already accounted for by Electron.
    const zoom = window.webContents.getZoomFactor();
    return { x: (cursor.x - bounds.x) / zoom, y: (cursor.y - bounds.y) / zoom };
  });
  ipcMain.handle(channels.testClick, (event) => {
    authorize(event, 'companion');
    if (!developmentMode) throw new Error('Development test counters are disabled in production.');
    if (!windows.companion?.isVisible()) throw new Error('Show the desktop test before recording a click.');
    testClicks += 1;
    return publish();
  });
  ipcMain.handle(channels.recordWater, (event, reminderRevision: unknown) => {
    authorize(event, 'companion');
    if (typeof reminderRevision !== 'number' || !Number.isSafeInteger(reminderRevision) || reminderRevision < 0) {
      throw new Error('Water intake requires a valid reminder revision.');
    }
    if (!windows.companion?.isVisible() || windows.visibilityRevision !== reminderRevision) {
      throw new Error('This water reminder is no longer active.');
    }
    // The amount is fixed in main; duplicate clicks on the same reminder are idempotent.
    const addedWater = hydration.recordDrink(reminderRevision);
    return { snapshot: publish(), addedWater };
  });
  ipcMain.handle(channels.dashboardDrink, (event) => {
    authorize(event, 'dashboard');
    return { addedWater: hydration.quickAdd(), snapshot: publish() };
  });
  ipcMain.handle(channels.remindersPaused, (event, paused: unknown) => {
    authorize(event, 'dashboard');
    if (typeof paused !== 'boolean') throw new Error('Reminder pause must be a boolean.');
    hydration.setPaused(paused);
    return publish();
  });
  ipcMain.handle(channels.openCompanion, async (event) => {
    authorize(event, 'dashboard');
    if (hydration.session.snapshot().currentWater < hydration.session.snapshot().dailyGoal) await hydration.trigger(false, true);
    return publish();
  });
  ipcMain.handle(channels.resetClicks, (event) => {
    authorize(event, 'dashboard');
    if (!developmentMode) throw new Error('Development test counters are disabled in production.');
    testClicks = 0; return publish();
  });
  ipcMain.handle(channels.openDashboard, async (event) => { authorize(event, 'companion'); await windows.openDashboard(); });
  ipcMain.handle(channels.quit, (event) => { authorize(event, 'dashboard'); setImmediate(() => app.quit()); });
  return { hydration, snapshot, publish, setDisplayActive: (active: boolean) => { displayActive = active; publish(); },
    persistForRestart: () => {
      hydrationStorage.save(hydration.session.persisted());
      companionPreferences.update(companionPreferences.snapshot());
      userProfile.persist();
      if (hydrationStorage.error || companionPreferences.error) throw new Error(hydrationStorage.error ?? companionPreferences.error!);
    },
  };
}
