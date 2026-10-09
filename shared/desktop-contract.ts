import { type HydrationSnapshot, type PersistedHydrationState } from './hydration';
import { type HydrationSettings } from './hydration-settings';
import { type HydrationSchedulerSnapshot } from './hydration-schedule';
import { type ReminderTiming } from './reminder-policy';
import { type HydrationHistoryEntry, type StreakStats } from './hydration-history';
import { type DashboardPage, type StartupStatus, type TrayStatus } from './product-contract';
import { type CompanionPreferences } from './companion-preferences';
import { type UserProfile } from './user-profile';
import { type UpdateSnapshot } from './update-contract';

export type WindowRole = 'dashboard' | 'companion';

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopSnapshot {
  revision: number;
  appVersion: string;
  updates: UpdateSnapshot;
  electronVersion: string;
  angularVersion: string;
  platform: string;
  display: {
    id: number;
    label: string;
    bounds: Rectangle;
    workArea: Rectangle;
    scaleFactor: number;
  };
  dashboardOpen: boolean;
  /** Read-only native content geometry for visual avoidance; no new renderer operation. */
  dashboardBounds?: Rectangle | null;
  hydration: HydrationSnapshot;
  hydrationState: PersistedHydrationState;
  scheduler: HydrationSchedulerSnapshot;
  developmentMode: boolean;
  companionPreferences: CompanionPreferences;
  companionPreferencesError: string | null;
  userProfile: UserProfile | null;
  userProfileError: string | null;
  displayActive: boolean;
  storageError: string | null;
  schedulerError: string | null;
  reminderTiming: ReminderTiming;
  history: HydrationHistoryEntry[];
  streaks: StreakStats;
  startup: StartupStatus;
  tray: TrayStatus;
  creditedReminder: { revision: number; addedWater: number } | null;
  reminderRetry: { pending: boolean; retryAt: string | null; count: number };
  overlay: {
    visible: boolean;
    interactive: boolean;
    bounds: Rectangle | null;
    layoutRevision: number;
    visibilityRevision: number;
    testClicks: number;
  };
}

export interface DesktopBridge {
  readonly role: WindowRole;
  getSnapshot(): Promise<DesktopSnapshot>;
  checkForUpdates(): Promise<DesktopSnapshot>;
  downloadUpdate(): Promise<DesktopSnapshot>;
  restartAndUpdate(): Promise<DesktopSnapshot>;
  getHydrationState(): Promise<PersistedHydrationState>;
  getHydrationSettings(): Promise<HydrationSettings>;
  updateHydrationSettings(settings: HydrationSettings): Promise<DesktopSnapshot>;
  updateCompanionPreferences(preferences: CompanionPreferences): Promise<DesktopSnapshot>;
  updateDisplayName(displayName: string): Promise<DesktopSnapshot>;
  completeOnboarding(): Promise<DesktopSnapshot>;
  resetOnboarding(): Promise<DesktopSnapshot>;
  getNextReminder(): Promise<HydrationSchedulerSnapshot>;
  triggerDevelopmentReminder(delayMs?: 0 | 15000): Promise<DesktopSnapshot>;
  setOverlayVisible(visible: boolean, expectedVisibilityRevision?: number): Promise<DesktopSnapshot>;
  suspendReminder(reminderRevision: number): Promise<DesktopSnapshot>;
  recordWater(reminderRevision: number): Promise<{ snapshot: DesktopSnapshot; addedWater: number }>;
  recordDrink(reminderRevision?: number): Promise<{ snapshot: DesktopSnapshot; addedWater: number }>;
  setRemindersPaused(paused: boolean): Promise<DesktopSnapshot>;
  openCompanion(): Promise<DesktopSnapshot>;
  recordTestClick(): Promise<DesktopSnapshot>;
  resetTestClicks(): Promise<DesktopSnapshot>;
  openDashboard(): Promise<void>;
  quit(): Promise<void>;
  getCursorPosition(): Promise<{ x: number; y: number }>;
  setOverlayInteractive(interactive: boolean): void;
  onSnapshotChanged(callback: (snapshot: DesktopSnapshot) => void): () => void;
  onNavigate(callback: (page: DashboardPage) => void): () => void;
}

export const DESKTOP_CHANNELS = {
  snapshot: 'desktop:snapshot',
  snapshotChanged: 'desktop:snapshot-changed',
  updateCheck: 'desktop:update-check',
  updateDownload: 'desktop:update-download',
  updateInstall: 'desktop:update-install',
  hydrationState: 'desktop:hydration-state',
  hydrationSettings: 'desktop:hydration-settings',
  updateHydrationSettings: 'desktop:update-hydration-settings',
  updateCompanionPreferences: 'desktop:update-companion-preferences',
  updateDisplayName: 'desktop:update-display-name',
  completeOnboarding: 'desktop:complete-onboarding',
  resetOnboarding: 'desktop:reset-onboarding',
  nextReminder: 'desktop:next-reminder',
  developmentReminder: 'desktop:development-reminder',
  overlayVisible: 'desktop:overlay-visible',
  suspendReminder: 'desktop:suspend-reminder',
  recordWater: 'desktop:record-water',
  dashboardDrink: 'desktop:dashboard-drink',
  remindersPaused: 'desktop:reminders-paused',
  openCompanion: 'desktop:open-companion',
  overlayInteractive: 'desktop:overlay-interactive',
  testClick: 'desktop:test-click',
  resetClicks: 'desktop:reset-clicks',
  openDashboard: 'desktop:open-dashboard',
  cursorPosition: 'desktop:cursor-position',
  quit: 'desktop:quit',
  navigate: 'desktop:navigate',
} as const;
