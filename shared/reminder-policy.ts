import { DEFAULT_HYDRATION_SETTINGS, type HydrationSettings } from './hydration-settings';

export interface ReminderTiming { retryIntervalMs: number; successDisplayMs: number }

export const PRODUCTION_REMINDER_TIMING: Readonly<ReminderTiming> = Object.freeze({
  retryIntervalMs: DEFAULT_HYDRATION_SETTINGS.retryIntervalMinutes * 60 * 1000, successDisplayMs: 2000,
});
export const DEVELOPMENT_REMINDER_TIMING: Readonly<ReminderTiming> = Object.freeze({
  retryIntervalMs: 10000, successDisplayMs: 2000,
});

export function reminderTiming(quickRetry: boolean, settings: HydrationSettings = DEFAULT_HYDRATION_SETTINGS): ReminderTiming {
  return { retryIntervalMs: quickRetry ? DEVELOPMENT_REMINDER_TIMING.retryIntervalMs : settings.retryIntervalMinutes * 60000,
    successDisplayMs: PRODUCTION_REMINDER_TIMING.successDisplayMs };
}
