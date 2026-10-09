import { DEFAULT_HYDRATION_SETTINGS, restoreHydrationSettings, validateHydrationSettings, type HydrationSettings } from './hydration-settings';
import { clampWater, localDateKey } from './hydration-schedule';
import { historyEntry, normalizeHistory, parseLocalDay, streakStats, upsertHistory, type HydrationHistoryEntry } from './hydration-history';

export interface HydrationSnapshot {
  dailyGoal: number;
  glassSize: number;
  currentWater: number;
}

export const HYDRATION_DEFAULTS: Readonly<HydrationSnapshot> = Object.freeze({
  dailyGoal: DEFAULT_HYDRATION_SETTINGS.dailyGoalMl, glassSize: DEFAULT_HYDRATION_SETTINGS.glassSizeMl, currentWater: 0,
});

export interface PersistedHydrationState {
  schemaVersion: 2;
  history: HydrationHistoryEntry[];
  date: string;
  currentWaterMl: number;
  settings: HydrationSettings;
  lastDrinkAt?: string;
  lastReminderAt?: string;
}

export function restoreHydrationState(value: unknown, now: Date): PersistedHydrationState {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const settings = restoreHydrationSettings(saved['settings']);
  const today = localDateKey(now);
  const water = saved['currentWaterMl'];
  // Preserve existing actual intake even if a new goal is lower. Actions never add above goal.
  const validWater = typeof water === 'number' && Number.isSafeInteger(water) ? Math.max(0, Math.min(water, 20000)) : 0;
  let history = normalizeHistory(saved['history']);
  const savedDate = saved['date'];
  if (typeof savedDate === 'string' && parseLocalDay(savedDate) && savedDate < today) {
    const original = saved['settings'] as Partial<HydrationSettings> | undefined;
    const originalGoal = typeof original?.dailyGoalMl === 'number' && Number.isSafeInteger(original.dailyGoalMl) && original.dailyGoalMl > 0 && original.dailyGoalMl <= 20000
      ? original.dailyGoalMl : settings.dailyGoalMl;
    const lastDrink = typeof saved['lastDrinkAt'] === 'string' && Number.isFinite(Date.parse(saved['lastDrinkAt']))
      && localDateKey(new Date(saved['lastDrinkAt'])) === savedDate ? new Date(saved['lastDrinkAt']).toISOString() : undefined;
    history = upsertHistory(history, historyEntry(savedDate, originalGoal, validWater, lastDrink));
  }
  const currentWaterMl = savedDate === today ? validWater : 0;
  const state: PersistedHydrationState = { schemaVersion: 2, history, date: today, currentWaterMl, settings };
  if (saved['date'] === today) {
    for (const key of ['lastDrinkAt', 'lastReminderAt'] as const) {
      const timestamp = saved[key];
      if (typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp)) && localDateKey(new Date(timestamp)) === today) {
        state[key] = new Date(timestamp).toISOString();
      }
    }
  }
  return state;
}

/** Pure hydration rules. Exactly one instance lives in main, backed by local storage. */
export class HydrationSession {
  private state: PersistedHydrationState;
  private creditedReminder: number | undefined;

  constructor(saved?: unknown, now = new Date()) { this.state = restoreHydrationState(saved, now); }

  snapshot(): HydrationSnapshot {
    return { dailyGoal: this.state.settings.dailyGoalMl, glassSize: this.state.settings.glassSizeMl, currentWater: this.state.currentWaterMl };
  }

  persisted(): PersistedHydrationState { return { ...this.state, history: this.state.history.map((entry) => ({ ...entry })), settings: { ...this.state.settings } }; }
  history(): HydrationHistoryEntry[] {
    return upsertHistory(this.state.history.filter((entry) => entry.date < this.state.date),
      historyEntry(this.state.date, this.state.settings.dailyGoalMl, this.state.currentWaterMl, this.state.lastDrinkAt)).reverse();
  }
  streaks() { return streakStats(this.history(), this.state.date); }

  resetForDay(now: Date): boolean {
    if (this.state.date === localDateKey(now)) return false;
    const history = upsertHistory(this.state.history, historyEntry(this.state.date, this.state.settings.dailyGoalMl, this.state.currentWaterMl, this.state.lastDrinkAt));
    this.state = { schemaVersion: 2, history, date: localDateKey(now), currentWaterMl: 0, settings: { ...this.state.settings } };
    this.creditedReminder = undefined;
    return true;
  }

  updateSettings(settings: unknown): void {
    this.state.settings = validateHydrationSettings(settings);
  }

  markReminder(now: Date): void { this.state.lastReminderAt = now.toISOString(); }

  recordGlass(reminderRevision?: number, now = new Date()): number {
    if (reminderRevision !== undefined && this.creditedReminder === reminderRevision) return 0;
    if (reminderRevision !== undefined) this.creditedReminder = reminderRevision;
    const previous = this.state.currentWaterMl;
    this.state.currentWaterMl = clampWater(previous, this.state.settings.glassSizeMl, this.state.settings.dailyGoalMl);
    const added = this.state.currentWaterMl - previous;
    if (added > 0) this.state.lastDrinkAt = now.toISOString();
    return added;
  }

  creditActiveReminder(revision: number): void { this.creditedReminder = revision; }
}
