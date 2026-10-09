export interface HydrationSettings {
  dailyGoalMl: number;
  glassSizeMl: number;
  workingStart: string;
  workingEnd: string;
  retryIntervalMinutes: number;
  remindersEnabled: boolean;
  launchAtStartup: boolean;
}

export const DEFAULT_HYDRATION_SETTINGS: Readonly<HydrationSettings> = Object.freeze({
  dailyGoalMl: 2000,
  glassSizeMl: 250,
  workingStart: '10:00',
  workingEnd: '18:00',
  retryIntervalMinutes: 5,
  remindersEnabled: true,
  launchAtStartup: false,
});

export const HYDRATION_SETTING_LIMITS = Object.freeze({ goalMin: 500, goalMax: 5000, glassMin: 50, glassMax: 1000, retryMin: 1, retryMax: 60 });

export function timeMinutes(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Working hours must use HH:mm.');
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Validate at the main-process boundary; never trust renderer or disk values. */
export function validateHydrationSettings(value: unknown): HydrationSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Hydration settings must be an object.');
  const settings = value as Record<string, unknown>;
  const goal = settings['dailyGoalMl'];
  const glass = settings['glassSizeMl'];
  const retry = settings['retryIntervalMinutes'];
  const start = settings['workingStart'];
  const end = settings['workingEnd'];
  if (typeof goal !== 'number' || !Number.isSafeInteger(goal) || goal < HYDRATION_SETTING_LIMITS.goalMin || goal > HYDRATION_SETTING_LIMITS.goalMax) {
    throw new Error('Choose a daily goal between 500 and 5000 ml.');
  }
  if (typeof glass !== 'number' || !Number.isSafeInteger(glass) || glass < HYDRATION_SETTING_LIMITS.glassMin || glass > HYDRATION_SETTING_LIMITS.glassMax || glass > goal) {
    throw new Error('Choose a glass from 50 to 1000 ml, no larger than your goal.');
  }
  if (typeof retry !== 'number' || !Number.isSafeInteger(retry) || retry < HYDRATION_SETTING_LIMITS.retryMin || retry > HYDRATION_SETTING_LIMITS.retryMax) {
    throw new Error('Choose a retry interval from 1 to 60 whole minutes.');
  }
  if (typeof start !== 'string' || typeof end !== 'string' || timeMinutes(start) >= timeMinutes(end)) {
    throw new Error('Working start must be earlier than working end on the same day.');
  }
  const enabled = settings['remindersEnabled'] === undefined ? DEFAULT_HYDRATION_SETTINGS.remindersEnabled : settings['remindersEnabled'];
  const startup = settings['launchAtStartup'] === undefined ? DEFAULT_HYDRATION_SETTINGS.launchAtStartup : settings['launchAtStartup'];
  if (typeof enabled !== 'boolean' || typeof startup !== 'boolean') throw new Error('Reminder and startup preferences must be ON or OFF.');
  return { dailyGoalMl: goal, glassSizeMl: glass, workingStart: start, workingEnd: end, retryIntervalMinutes: retry, remindersEnabled: enabled, launchAtStartup: startup };
}

/** Migrate valid legacy fields individually; stricter Phase 6 limits must not erase a routine. */
export function restoreHydrationSettings(value: unknown): HydrationSettings {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const integer = (key: keyof HydrationSettings, minimum: number, maximum: number): number => {
    const value = saved[key];
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      ? Math.max(minimum, Math.min(maximum, value)) : DEFAULT_HYDRATION_SETTINGS[key] as number;
  };
  const goal = integer('dailyGoalMl', HYDRATION_SETTING_LIMITS.goalMin, HYDRATION_SETTING_LIMITS.goalMax);
  let workingStart = DEFAULT_HYDRATION_SETTINGS.workingStart; let workingEnd = DEFAULT_HYDRATION_SETTINGS.workingEnd;
  try {
    const start = saved['workingStart']; const end = saved['workingEnd'];
    if (typeof start === 'string' && typeof end === 'string' && timeMinutes(start) < timeMinutes(end)) { workingStart = start; workingEnd = end; }
  } catch { /* Keep the safe same-day default. */ }
  return { dailyGoalMl: goal, glassSizeMl: Math.min(goal, integer('glassSizeMl', HYDRATION_SETTING_LIMITS.glassMin, HYDRATION_SETTING_LIMITS.glassMax)),
    retryIntervalMinutes: integer('retryIntervalMinutes', HYDRATION_SETTING_LIMITS.retryMin, HYDRATION_SETTING_LIMITS.retryMax), workingStart, workingEnd,
    remindersEnabled: typeof saved['remindersEnabled'] === 'boolean' ? saved['remindersEnabled'] : true,
    launchAtStartup: typeof saved['launchAtStartup'] === 'boolean' ? saved['launchAtStartup'] : false };
}
