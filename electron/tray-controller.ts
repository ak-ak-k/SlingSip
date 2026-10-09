import { app, Menu, Tray } from 'electron';
import { type DesktopSnapshot } from '../shared/desktop-contract';
import { type TrayStatus } from '../shared/product-contract';
import { type DesktopWindows } from './window-manager';
import { type HydrationRuntime } from './hydration-runtime';
import { trayIcon } from './tray-icon';

export class SlingSipTray {
  readonly tray: Tray | undefined;
  menu: Menu | undefined;
  readonly status: TrayStatus;

  constructor(private readonly windows: DesktopWindows, private readonly hydration: HydrationRuntime,
    private readonly restart: () => void) {
    try {
      this.tray = new Tray(trayIcon());
      this.tray.setToolTip('SlingSip — Your hydration sidekick');
      this.tray.on('double-click', () => { void windows.openDashboard().catch(console.error); });
      this.status = { available: true, error: null };
    } catch {
      this.status = { available: false, error: 'The tray could not be created. Launch SlingSip again to reopen its dashboard.' };
    }
  }

  update(state: DesktopSnapshot): void {
    if (!this.tray || this.tray.isDestroyed()) return;
    const schedule = state.scheduler;
    const enabled = schedule.remindersEnabled;
    const next = !enabled ? 'Reminders off in Settings' : schedule.remindersPaused ? 'Reminders paused for this session'
      : state.hydration.currentWater >= state.hydration.dailyGoal ? 'Daily goal complete'
      : schedule.reminderActive ? 'Water break active'
      : schedule.nextReminderAt ? `Next break: ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(schedule.nextReminderAt))}`
      : 'Next break: tomorrow';
    this.menu = Menu.buildFromTemplate([
      { id: 'open', label: 'Open SlingSip', click: () => { void this.windows.openDashboard().catch(console.error); } },
      { id: 'drink', label: `Drink +${state.hydration.glassSize} ml`, enabled: state.hydration.currentWater < state.hydration.dailyGoal,
        click: () => { this.hydration.quickAdd(); } },
      { id: 'pause', label: !enabled ? 'Reminders off in Settings' : schedule.remindersPaused ? 'Resume reminders' : 'Pause reminders',
        enabled, click: () => this.hydration.setPaused(!this.hydration.remindersPaused) },
      { type: 'separator' },
      { id: 'progress', label: `Today: ${state.hydration.currentWater} / ${state.hydration.dailyGoal} ml`, enabled: false },
      { id: 'next', label: next, enabled: false },
      { type: 'separator' },
      { id: 'settings', label: 'Settings', click: () => { void this.windows.openDashboard('settings').catch(console.error); } },
      { id: 'restart', label: this.hydration.developmentMode ? 'Restart SlingSip (Dev)' : 'Restart SlingSip', click: this.restart },
      { id: 'quit', label: 'Quit SlingSip', click: () => app.quit() },
    ]);
    this.tray.setContextMenu(this.menu);
  }

  destroy(): void { if (this.tray && !this.tray.isDestroyed()) this.tray.destroy(); }
}
