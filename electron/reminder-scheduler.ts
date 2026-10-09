import { type PersistedHydrationState } from '../shared/hydration';
import { generateTodaySchedule, isWorkingHours, localDateKey, localWorkingBoundary, nextLocalMidnight, selectNextReminder,
  type HydrationSchedulerSnapshot } from '../shared/hydration-schedule';

export interface SchedulerClock {
  now(): Date;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(timer: unknown): void;
}

export const SYSTEM_SCHEDULER_CLOCK: SchedulerClock = {
  now: () => new Date(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

interface SchedulerDependencies {
  state(): PersistedHydrationState;
  active(): boolean;
  paused?(): boolean;
  rollDay(now: Date): void;
  trigger(): Promise<void>;
  changed(): void;
  failed(error: unknown): void;
}

// No clock-change event exists on every desktop. This bounds re-evaluation to five minutes,
// while resume/foreground events reconcile immediately. It is never a one-second interval.
export const CLOCK_RECHECK_MS = 5 * 60000;
export const MAX_REMINDER_LATENESS_MS = 30000;

/** Owns exactly one daily/boundary/midnight timer, independently of Angular windows. */
export class ReminderScheduler {
  private timer: unknown;
  private running = false;
  private current: HydrationSchedulerSnapshot = { nextReminderAt: null, todaySchedule: [], workingHoursActive: false, reminderActive: false, remindersEnabled: true, remindersPaused: false };

  constructor(private readonly dependencies: SchedulerDependencies, private readonly clock: SchedulerClock = SYSTEM_SCHEDULER_CLOCK) {}

  snapshot(): HydrationSchedulerSnapshot { return { ...this.current, todaySchedule: [...this.current.todaySchedule] }; }

  start(): void { this.running = true; this.refresh(); }
  stop(): void { this.running = false; this.clearTimer(); }

  refresh(): void {
    if (!this.running) return;
    this.clearTimer();
    const now = this.clock.now();
    this.dependencies.rollDay(now);
    const state = this.dependencies.state();
    const schedule = generateTodaySchedule(state.settings, now);
    const active = this.dependencies.active();
    const paused = this.dependencies.paused?.() ?? false;
    const next = active || paused || !state.settings.remindersEnabled ? null : selectNextReminder(schedule, now, state.currentWaterMl >= state.settings.dailyGoalMl, state.lastReminderAt);
    const previous = JSON.stringify(this.current);
    this.current = { nextReminderAt: next?.toISOString() ?? null, todaySchedule: schedule.map((slot) => slot.toISOString()),
      workingHoursActive: isWorkingHours(state.settings, now), reminderActive: active,
      remindersEnabled: state.settings.remindersEnabled, remindersPaused: paused };
    const candidates = [nextLocalMidnight(now).getTime(), now.getTime() + CLOCK_RECHECK_MS];
    for (const time of [state.settings.workingStart, state.settings.workingEnd]) {
      const boundary = localWorkingBoundary(now, time).getTime();
      if (boundary > now.getTime()) candidates.push(boundary);
    }
    if (next) candidates.push(next.getTime());
    const deadline = Math.min(...candidates);
    this.timer = this.clock.setTimeout(() => {
      this.timer = undefined;
      const currentTime = this.clock.now();
      const latest = this.dependencies.state();
      // Late startup, resume, and large clock jumps select a future slot without backfilling.
      const due = next && deadline === next.getTime() && currentTime.getTime() >= deadline
        && currentTime.getTime() - deadline <= MAX_REMINDER_LATENESS_MS
        && localDateKey(currentTime) === state.date && latest.date === state.date
        && isWorkingHours(latest.settings, currentTime) && latest.currentWaterMl < latest.settings.dailyGoalMl
        && latest.settings.remindersEnabled && !this.dependencies.paused?.()
        && !this.dependencies.active();
      if (due) void this.dependencies.trigger().catch((error: unknown) => this.dependencies.failed(error));
      this.refresh();
    }, Math.max(1, deadline - now.getTime()));
    if (previous !== JSON.stringify(this.current)) this.dependencies.changed();
  }

  private clearTimer(): void {
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }
}
