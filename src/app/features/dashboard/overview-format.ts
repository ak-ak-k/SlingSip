import { parseLocalDay, previousDay } from '../../../../shared/hydration-history';
import { type DesktopSnapshot } from '../../../../shared/desktop-contract';

export function clockLabel(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}
export function countdownLabel(timestamp: string, now: number): string {
  const minutes = Math.max(0, Math.ceil((Date.parse(timestamp) - now) / 60000));
  if (minutes < 1) return 'Due shortly';
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return `In ${hours}h${rest ? ` ${rest}m` : ''}`;
}
export function cadenceLabel(schedule: readonly string[] | undefined): string {
  if (!schedule) return 'Your routine appears in the desktop app.';
  if (!schedule.length) return 'No planned breaks today.';
  if (schedule.length === 1) return 'One gentle reminder each day.';
  const interval = Date.parse(schedule[1]!) - Date.parse(schedule[0]!);
  if (interval < 60000) return 'Gentle reminders less than a minute apart.';
  const minutes = Math.round(interval / 60000);
  if (interval % 60000) return `Gentle reminders about every ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
  return minutes % 60 === 0 ? `Gentle reminders every ${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}.`
    : `Gentle reminders every ${minutes} minutes.`;
}
export function historyLabel(date: string, today?: string): string {
  if (date === today) return 'Today';
  if (today && date === previousDay(today)) return 'Yesterday';
  const parsed = parseLocalDay(date);
  return parsed ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed) : date;
}
export function nextBreakView(snapshot: DesktopSnapshot | null, now: number): { value: string; detail: string } {
  if (!snapshot) return { value: 'Unavailable', detail: 'Open SlingSip on your desktop.' };
  const { scheduler, hydration, reminderRetry } = snapshot;
  if (hydration.currentWater >= hydration.dailyGoal) return { value: 'Goal complete', detail: 'A good day, one glass at a time.' };
  if (!scheduler.remindersEnabled) return { value: 'Reminders off', detail: 'Enable them in Settings.' };
  if (scheduler.remindersPaused) return { value: 'Paused', detail: 'Resume whenever you are ready.' };
  if (reminderRetry.pending && reminderRetry.retryAt) return { value: clockLabel(reminderRetry.retryAt), detail: `${countdownLabel(reminderRetry.retryAt, now)} · SlingSip swings back` };
  if (scheduler.reminderActive) return { value: 'Reminder active', detail: 'Your companion is taking a water break.' };
  if (scheduler.nextReminderAt) return { value: clockLabel(scheduler.nextReminderAt), detail: countdownLabel(scheduler.nextReminderAt, now) };
  return scheduler.workingHoursActive ? { value: 'No upcoming break', detail: 'You have reached the last planned break today.' }
    : { value: 'Outside working hours', detail: `Your routine: ${snapshot.hydrationState.settings.workingStart}–${snapshot.hydrationState.settings.workingEnd}` };
}
