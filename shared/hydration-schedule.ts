import { type HydrationSettings, timeMinutes } from './hydration-settings';

export interface HydrationSchedulerSnapshot {
  nextReminderAt: string | null;
  workingHoursActive: boolean;
  todaySchedule: string[];
  reminderActive: boolean;
  remindersEnabled: boolean;
  remindersPaused: boolean;
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function nextLocalMidnight(now: Date): Date {
  // Calendar arithmetic also handles local 23/25-hour daylight-saving days.
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

export function localWorkingBoundary(day: Date, time: string): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, timeMinutes(time));
}

export function hydrationSessionCount(settings: HydrationSettings): number {
  return Math.ceil(settings.dailyGoalMl / settings.glassSizeMl);
}

export function generateTodaySchedule(settings: HydrationSettings, day: Date): Date[] {
  const count = hydrationSessionCount(settings);
  const start = localWorkingBoundary(day, settings.workingStart).getTime();
  const durationMs = localWorkingBoundary(day, settings.workingEnd).getTime() - start;
  if (durationMs <= 0) return []; // A working window entirely skipped by a local DST change.
  // Local boundaries define the period; elapsed spacing stays ordered across DST changes.
  return Array.from({ length: count }, (_, index) => new Date(start + Math.round(index * durationMs / count)));
}

export function isWorkingHours(settings: HydrationSettings, now: Date): boolean {
  return now >= localWorkingBoundary(now, settings.workingStart) && now < localWorkingBoundary(now, settings.workingEnd);
}

export function selectNextReminder(schedule: Date[], now: Date, goalCompleted: boolean, lastReminderAt?: string): Date | null {
  if (goalCompleted) return null;
  const last = lastReminderAt ? Date.parse(lastReminderAt) : -Infinity;
  return schedule.find((slot) => slot.getTime() > Math.max(now.getTime(), last)) ?? null;
}

export function clampWater(currentWaterMl: number, glassSizeMl: number, dailyGoalMl: number): number {
  const current = Math.max(0, currentWaterMl);
  return current >= dailyGoalMl ? current : Math.min(dailyGoalMl, current + glassSizeMl);
}
