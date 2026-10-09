import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { DESKTOP_CHANNELS as channels, type DesktopBridge, type DesktopSnapshot, type WindowRole } from '../shared/desktop-contract';

const role: WindowRole = process.argv.includes('--companion-window=companion') ? 'companion' : 'dashboard';
const bridge: DesktopBridge = {
  role,
  getSnapshot: () => ipcRenderer.invoke(channels.snapshot),
  getHydrationState: () => ipcRenderer.invoke(channels.hydrationState),
  getHydrationSettings: () => ipcRenderer.invoke(channels.hydrationSettings),
  updateHydrationSettings: (settings) => ipcRenderer.invoke(channels.updateHydrationSettings, settings),
  updateCompanionPreferences: (preferences) => ipcRenderer.invoke(channels.updateCompanionPreferences, preferences),
  updateDisplayName: (displayName) => ipcRenderer.invoke(channels.updateDisplayName, displayName),
  completeOnboarding: () => ipcRenderer.invoke(channels.completeOnboarding),
  resetOnboarding: () => ipcRenderer.invoke(channels.resetOnboarding),
  getNextReminder: () => ipcRenderer.invoke(channels.nextReminder),
  triggerDevelopmentReminder: (delayMs = 0) => ipcRenderer.invoke(channels.developmentReminder, delayMs),
  setOverlayVisible: (visible, expectedVisibilityRevision) => ipcRenderer.invoke(channels.overlayVisible, visible, expectedVisibilityRevision),
  suspendReminder: (reminderRevision) => ipcRenderer.invoke(channels.suspendReminder, reminderRevision),
  recordWater: (reminderRevision) => ipcRenderer.invoke(channels.recordWater, reminderRevision),
  recordDrink: (reminderRevision) => reminderRevision === undefined
    ? ipcRenderer.invoke(channels.dashboardDrink) : ipcRenderer.invoke(channels.recordWater, reminderRevision),
  setRemindersPaused: (paused) => ipcRenderer.invoke(channels.remindersPaused, paused),
  openCompanion: () => ipcRenderer.invoke(channels.openCompanion),
  recordTestClick: () => ipcRenderer.invoke(channels.testClick),
  resetTestClicks: () => ipcRenderer.invoke(channels.resetClicks),
  openDashboard: () => ipcRenderer.invoke(channels.openDashboard),
  quit: () => ipcRenderer.invoke(channels.quit),
  getCursorPosition: () => ipcRenderer.invoke(channels.cursorPosition),
  setOverlayInteractive: (interactive) => ipcRenderer.send(channels.overlayInteractive, interactive),
  onSnapshotChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, snapshot: DesktopSnapshot) => callback(snapshot);
    ipcRenderer.on(channels.snapshotChanged, listener);
    return () => ipcRenderer.removeListener(channels.snapshotChanged, listener);
  },
  onNavigate: (callback) => {
    const listener = (_event: IpcRendererEvent, page: unknown) => {
      if (page === 'overview' || page === 'history' || page === 'settings') callback(page);
    };
    ipcRenderer.on(channels.navigate, listener);
    return () => ipcRenderer.removeListener(channels.navigate, listener);
  },
};

contextBridge.exposeInMainWorld('desktopCompanion', bridge);
