import { HydrationSession } from '../shared/hydration';
import { isWorkingHours, localDateKey } from '../shared/hydration-schedule';
import { reminderTiming } from '../shared/reminder-policy';
import { type HydrationPersistence } from './hydration-storage';
import { ReminderScheduler, SYSTEM_SCHEDULER_CLOCK, type SchedulerClock } from './reminder-scheduler';
import { type DesktopWindows } from './window-manager';

export class HydrationRuntime {
  readonly session: HydrationSession;
  readonly scheduler: ReminderScheduler;
  error: string | null = null;
  private triggering = false;
  private stopped = false;
  private developmentTimer: unknown;
  private pendingTrayCredit: number | null = null;
  private retryTimer: unknown;
  private retry: { revision: number; date: string; retryAt: Date } | undefined;
  private retryCount = 0;
  remindersPaused = false;
  creditedReminder: { revision: number; addedWater: number } | null = null;

  constructor(private readonly windows: DesktopWindows, private readonly storage: HydrationPersistence,
    readonly developmentMode: boolean, private readonly changed: () => void,
    private readonly clock: SchedulerClock = SYSTEM_SCHEDULER_CLOCK) {
    this.session = new HydrationSession(storage.load(), clock.now());
    this.persist();
    this.scheduler = new ReminderScheduler({
      state: () => this.session.persisted(), active: () => this.active(), paused: () => this.remindersPaused, rollDay: (now) => { this.rollDay(now); },
      trigger: () => this.trigger(false), changed, failed: (error) => this.failed(error),
    }, clock);
  }

  active(): boolean { return this.triggering || !!this.retry || !!this.windows.companion?.isVisible(); }
  retrySnapshot() { return { pending: !!this.retry, retryAt: this.retry?.retryAt.toISOString() ?? null, count: this.retryCount }; }
  timing() { return reminderTiming(this.developmentMode, this.session.persisted().settings); }
  storageError(): string | null { return this.storage.error; }
  start(): void { this.scheduler.start(); }
  refresh(): void { this.scheduler.refresh(); }
  allowed(): boolean { return this.session.persisted().settings.remindersEnabled && !this.remindersPaused; }

  setPaused(paused: boolean): void {
    this.remindersPaused = paused;
    if (paused) this.cancelReminder();
    this.refresh();
    this.changed();
  }

  stop(): void {
    this.stopped = true;
    this.scheduler.stop();
    this.clearRetry();
    if (this.developmentTimer !== undefined) this.clock.clearTimeout(this.developmentTimer);
    this.developmentTimer = undefined;
    this.persist();
  }

  recordDrink(revision?: number): number {
    if (revision !== undefined && !this.allowed()) throw new Error('This water reminder is no longer active.');
    if (this.rollDay(this.clock.now()) && revision !== undefined) {
      this.refresh();
      throw new Error('A new day has started. This water reminder is no longer active.');
    }
    const added = this.session.recordGlass(revision, this.clock.now());
    if (revision !== undefined && added > 0) this.creditedReminder = { revision, addedWater: added };
    if (added > 0) this.persist();
    this.refresh();
    this.changed();
    return added;
  }

  quickAdd(): number {
    const newDay = this.rollDay(this.clock.now());
    const visible = !!this.windows.companion?.isVisible();
    const added = this.recordDrink(!newDay && visible && this.allowed() ? this.windows.visibilityRevision : undefined);
    if (this.triggering && !visible && this.allowed() && added > 0) this.pendingTrayCredit = (this.pendingTrayCredit ?? 0) + added;
    // A drink from the tray also satisfies a reminder that is waiting offscreen.
    if (this.retry && added > 0) { this.clearRetry(); this.refresh(); this.changed(); }
    return added;
  }

  updateSettings(value: unknown): void {
    this.rollDay(this.clock.now());
    const previousRetryMs = this.timing().retryIntervalMs;
    this.session.updateSettings(value);
    if (!this.allowed()) this.cancelReminder();
    else if (this.retry) {
      if (this.session.snapshot().currentWater >= this.session.snapshot().dailyGoal) this.clearRetry();
      else if (previousRetryMs !== this.timing().retryIntervalMs) this.armRetry(this.retry);
    }
    this.persist();
    this.refresh();
    this.changed();
  }

  async trigger(development: boolean, manual = false): Promise<void> {
    if (development && !this.developmentMode) throw new Error('Development reminders are disabled in production.');
    if (this.stopped || this.windows.quitting || this.active() || !this.allowed()) return;
    this.rollDay(this.clock.now());
    const state = this.session.persisted();
    if (!development && (state.currentWaterMl >= state.settings.dailyGoalMl || !manual && !isWorkingHours(state.settings, this.clock.now()))) return;
    // Reserve before awaiting native creation: concurrent requests cannot start two runs.
    this.triggering = true;
    this.pendingTrayCredit = null;
    this.retryCount = 0;
    this.error = null;
    this.refresh();
    try {
      await this.windows.setCompanionVisible(true);
      const sameDay = localDateKey(this.clock.now()) === state.date;
      if (!sameDay) this.rollDay(this.clock.now());
      if (sameDay && this.pendingTrayCredit !== null) {
        this.session.creditActiveReminder(this.windows.visibilityRevision);
        this.creditedReminder = { revision: this.windows.visibilityRevision, addedWater: this.pendingTrayCredit };
      }
      if (sameDay && !this.stopped && this.allowed()) {
        this.session.markReminder(this.clock.now());
        this.persist();
      } else await this.windows.setCompanionVisible(false, this.windows.visibilityRevision);
    } catch (error) { this.failed(error); throw error; }
    finally { this.triggering = false; this.pendingTrayCredit = null; this.refresh(); this.changed(); }
  }

  triggerDevelopment(delayMs: unknown): void | Promise<void> {
    if (!this.developmentMode) throw new Error('Development reminders are disabled in production.');
    if (delayMs !== 0 && delayMs !== 15000) throw new Error('Development reminders support only immediate or 15-second triggers.');
    if (!this.allowed()) throw new Error('Enable and resume reminders before running a development test.');
    if (this.developmentTimer !== undefined) this.clock.clearTimeout(this.developmentTimer);
    this.developmentTimer = undefined;
    if (delayMs === 0) return this.trigger(true);
    this.developmentTimer = this.clock.setTimeout(() => {
      this.developmentTimer = undefined;
      void this.trigger(true).catch((error: unknown) => this.failed(error));
    }, delayMs);
  }

  async suspendReminder(revision: number): Promise<void> {
    if (!this.allowed() || !this.windows.companion?.isVisible() || this.windows.visibilityRevision !== revision) {
      throw new Error('This water reminder is no longer active.');
    }
    if (this.rollDay(this.clock.now())) throw new Error('A new day has started. This water reminder is no longer active.');
    if (this.session.snapshot().currentWater >= this.session.snapshot().dailyGoal || this.creditedReminder?.revision === revision) {
      await this.finishReminder(revision);
      return;
    }
    // Reserve before hide emits changed: daily slots must not overlap an offscreen retry.
    const retry = { revision, date: this.session.persisted().date, retryAt: this.clock.now() };
    this.retry = retry;
    try { await this.windows.setCompanionVisible(false, revision); }
    catch (error) {
      if (this.retry === retry) this.clearRetry();
      this.refresh();
      this.changed();
      throw error;
    }
    if (this.retry !== retry || this.stopped || !this.allowed()) return;
    this.armRetry(retry);
    this.refresh();
    this.changed();
  }

  async finishReminder(expectedRevision?: number): Promise<void> {
    if (expectedRevision !== undefined && expectedRevision !== this.windows.visibilityRevision && expectedRevision !== this.retry?.revision) return;
    const hideRevision = expectedRevision === undefined ? undefined : this.windows.visibilityRevision;
    this.clearRetry();
    await this.windows.setCompanionVisible(false, hideRevision);
    this.refresh();
    this.changed();
  }

  private armRetry(retry: NonNullable<HydrationRuntime['retry']>): void {
    if (this.retryTimer !== undefined) this.clock.clearTimeout(this.retryTimer);
    retry.retryAt = new Date(this.clock.now().getTime() + this.timing().retryIntervalMs);
    this.retryTimer = this.clock.setTimeout(() => {
      this.retryTimer = undefined;
      void this.returnReminder(retry).catch((error: unknown) => this.failed(error));
    }, this.timing().retryIntervalMs);
  }

  private async returnReminder(retry: NonNullable<HydrationRuntime['retry']>): Promise<void> {
    this.rollDay(this.clock.now());
    if (this.retry !== retry) return;
    this.clearRetry();
    if (this.stopped || this.windows.quitting || !this.allowed() || retry.date !== this.session.persisted().date
      || this.session.snapshot().currentWater >= this.session.snapshot().dailyGoal) { this.refresh(); this.changed(); return; }
    this.retryCount += 1;
    this.triggering = true;
    this.pendingTrayCredit = null;
    try {
      await this.windows.setCompanionVisible(true);
      if (this.pendingTrayCredit !== null) {
        this.session.creditActiveReminder(this.windows.visibilityRevision);
        this.creditedReminder = { revision: this.windows.visibilityRevision, addedWater: this.pendingTrayCredit };
      }
      if (this.stopped || !this.allowed() || retry.date !== localDateKey(this.clock.now())) {
        await this.windows.setCompanionVisible(false);
      }
    } finally { this.triggering = false; this.pendingTrayCredit = null; this.refresh(); this.changed(); }
  }

  private clearRetry(): void {
    if (this.retryTimer !== undefined) this.clock.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.retry = undefined;
  }

  private rollDay(now: Date): boolean {
    if (!this.session.resetForDay(now)) return false;
    this.creditedReminder = null;
    this.clearRetry();
    this.persist();
    // Cancel yesterday's short-lived renderer retry by hiding its revision only.
    if (this.windows.companion?.isVisible()) {
      void this.windows.setCompanionVisible(false, this.windows.visibilityRevision).catch((error: unknown) => this.failed(error));
    }
    this.changed();
    return true;
  }

  private persist(): void { this.storage.save(this.session.persisted()); }
  private cancelReminder(): void {
    this.clearRetry();
    if (this.developmentTimer !== undefined) this.clock.clearTimeout(this.developmentTimer);
    this.developmentTimer = undefined;
    if (this.windows.companion?.isVisible() || this.triggering) {
      void this.windows.setCompanionVisible(false).catch((error: unknown) => this.failed(error));
    }
    this.changed();
  }
  private failed(error: unknown): void {
    this.error = 'The reminder could not be shown. SlingSip will try the next scheduled water break.';
    console.error('Hydration scheduler failed:', error);
    this.changed();
  }
}
