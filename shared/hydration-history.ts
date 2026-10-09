import { localDateKey } from './hydration-schedule';

export interface HydrationHistoryEntry {
  date: string;
  goalMl: number;
  consumedMl: number;
  percentage: number;
  completed: boolean;
  lastDrinkAt?: string;
}
export interface StreakStats { currentStreak: number; bestStreak: number; weekCompletedDays: number; }

export function parseLocalDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === value ? date : null;
}
export function previousDay(key: string): string {
  const date = parseLocalDay(key)!; date.setDate(date.getDate() - 1); return localDateKey(date);
}
export function historyEntry(date: string, goalMl: number, consumedMl: number, lastDrinkAt?: string): HydrationHistoryEntry {
  return { date, goalMl, consumedMl, percentage: Math.min(100, Math.round(consumedMl / goalMl * 1000) / 10),
    completed: consumedMl >= goalMl, ...(lastDrinkAt ? { lastDrinkAt } : {}) };
}
export function upsertHistory(entries: HydrationHistoryEntry[], entry: HydrationHistoryEntry): HydrationHistoryEntry[] {
  return [...entries.filter((item) => item.date !== entry.date), { ...entry }].sort((a, b) => a.date.localeCompare(b.date));
}
export function normalizeHistory(value: unknown): HydrationHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  let entries: HydrationHistoryEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !parseLocalDay(item.date) || !Number.isSafeInteger(item.goalMl) || item.goalMl <= 0
      || item.goalMl > 20000 || !Number.isSafeInteger(item.consumedMl) || item.consumedMl < 0 || item.consumedMl > 20000) continue;
    const timestamp = typeof item.lastDrinkAt === 'string' && Number.isFinite(Date.parse(item.lastDrinkAt))
      && localDateKey(new Date(item.lastDrinkAt)) === item.date ? new Date(item.lastDrinkAt).toISOString() : undefined;
    entries = upsertHistory(entries, historyEntry(item.date, item.goalMl, item.consumedMl, timestamp));
  }
  return entries;
}
/** Incomplete today keeps yesterday's run alive until local midnight. Missing days break it. */
export function streakStats(entries: HydrationHistoryEntry[], today: string): StreakStats {
  const days = new Map(entries.filter((entry) => entry.date <= today).map((entry) => [entry.date, entry]));
  let cursor = days.get(today)?.completed ? today : previousDay(today);
  let currentStreak = 0;
  while (days.get(cursor)?.completed) { currentStreak++; cursor = previousDay(cursor); }
  let bestStreak = 0; let run = 0; let last: string | undefined;
  for (const entry of [...days.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    run = entry.completed ? (last === previousDay(entry.date) ? run + 1 : 1) : 0;
    bestStreak = Math.max(bestStreak, run); last = entry.date;
  }
  const weekStart = parseLocalDay(today)!;
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const first = localDateKey(weekStart);
  const weekCompletedDays = [...days.values()].filter((entry) => entry.completed && entry.date >= first).length;
  return { currentStreak, bestStreak, weekCompletedDays };
}
