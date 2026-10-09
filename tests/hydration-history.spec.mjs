import { test, expect } from '@playwright/test';
import { DEFAULT_HYDRATION_SETTINGS, validateHydrationSettings } from '../shared/hydration-settings.ts';
import { historyEntry, normalizeHistory, streakStats, upsertHistory } from '../shared/hydration-history.ts';
import { HydrationSession, restoreHydrationState } from '../shared/hydration.ts';
import { HydrationRuntime } from '../electron/hydration-runtime.ts';

const settings = { ...DEFAULT_HYDRATION_SETTINGS };
const at = (day, hours = 12, minutes = 0) => new Date(2026, 9, day, hours, minutes);
const entry = (day, water = 2000, goal = 2000) => historyEntry(`2026-10-${String(day).padStart(2, '0')}`, goal, water);

test('Phase 6 settings validate limits and booleans while migrating Phase 5 preferences', () => {
  const { remindersEnabled, launchAtStartup, ...legacy } = settings;
  expect(validateHydrationSettings(legacy)).toEqual(settings);
  for (const changes of [{ dailyGoalMl: 499 }, { dailyGoalMl: 5001 }, { glassSizeMl: 49 }, { glassSizeMl: 1001 },
    { retryIntervalMinutes: 61 }, { retryIntervalMinutes: 1.5 }, { remindersEnabled: 'true' }, { launchAtStartup: null }]) {
    expect(() => validateHydrationSettings({ ...settings, ...changes })).toThrow();
  }
  expect(validateHydrationSettings({ ...settings, dailyGoalMl: 500, glassSizeMl: 50, retryIntervalMinutes: 60 })).toMatchObject({ dailyGoalMl: 500 });
  const restored = restoreHydrationState({ date: '2026-10-05', currentWaterMl: 750,
    settings: { ...legacy, dailyGoalMl: 20000, glassSizeMl: 1500, retryIntervalMinutes: 120, workingStart: '09:00' } }, at(5));
  expect(restored).toMatchObject({ schemaVersion: 2, currentWaterMl: 750, settings: { dailyGoalMl: 5000, glassSizeMl: 1000, retryIntervalMinutes: 60, workingStart: '09:00', remindersEnabled: true, launchAtStartup: false } });
});

test('History deduplicates dates and rebuilds derived fields without trusting corrupt records', () => {
  expect(upsertHistory([entry(1), entry(2, 500)], entry(2, 1750))).toEqual([entry(1), entry(2, 1750)]);
  expect(normalizeHistory([null, { ...entry(1), date: '2026-02-30' }, { ...entry(1), goalMl: 0 },
    { ...entry(2, 500), completed: true, percentage: 999 }, entry(2, 1750), entry(1)])).toEqual([entry(1), entry(2, 1750)]);
});

test('Current streak preserves yesterday until midnight, completed today extends it immediately', () => {
  expect(streakStats([], '2026-10-05')).toEqual({ currentStreak: 0, bestStreak: 0, weekCompletedDays: 0 });
  const past = [entry(2), entry(3), entry(4)];
  expect(streakStats([...past, entry(5, 500)], '2026-10-05')).toEqual({ currentStreak: 3, bestStreak: 3, weekCompletedDays: 0 });
  expect(streakStats([...past, entry(5)], '2026-10-05')).toEqual({ currentStreak: 4, bestStreak: 4, weekCompletedDays: 1 });
  expect(streakStats([...past, entry(5, 500), entry(6, 0)], '2026-10-06').currentStreak).toBe(0);
});

test('Missing and incomplete days break streaks while the historical best stays intact', () => {
  const past = [entry(1), entry(2), entry(3), entry(4, 1750), entry(5), entry(7)];
  expect(streakStats(past, '2026-10-07')).toEqual({ currentStreak: 1, bestStreak: 3, weekCompletedDays: 2 });
  expect(streakStats(past, '2026-10-10')).toEqual({ currentStreak: 0, bestStreak: 3, weekCompletedDays: 2 });
  expect(streakStats([historyEntry('2026-09-30', 500, 500), entry(1)], '2026-10-01').currentStreak).toBe(2);
});

test('Legacy previous-day migration finalizes once, preserves its original goal and skips absent dates', () => {
  const migrated = restoreHydrationState({ date: '2026-10-01', currentWaterMl: 1750, settings }, at(5));
  expect(migrated.history).toEqual([entry(1, 1750)]);
  expect(migrated.currentWaterMl).toBe(0);
  expect(restoreHydrationState(migrated, at(5)).history).toEqual([entry(1, 1750)]);
  const legacyLargeGoal = restoreHydrationState({ date: '2026-10-01', currentWaterMl: 6000, settings: { ...settings, dailyGoalMl: 6000 } }, at(5));
  expect(legacyLargeGoal.history[0]).toEqual(entry(1, 6000, 6000));
  expect(legacyLargeGoal.settings.dailyGoalMl).toBe(5000);
});

test('Today is live and unique; goal changes preserve intake and finalized historical goals', () => {
  const session = new HydrationSession({ date: '2026-10-04', currentWaterMl: 2000, settings }, at(5));
  session.recordGlass(undefined, at(5));
  session.updateSettings({ ...settings, dailyGoalMl: 2400, glassSizeMl: 300 });
  expect(session.history()).toEqual([historyEntry('2026-10-05', 2400, 250, at(5).toISOString()), entry(4)]);
  session.recordGlass(undefined, at(5));
  expect(session.history().filter((day) => day.date === '2026-10-05')).toHaveLength(1);
  session.updateSettings({ ...settings, dailyGoalMl: 500 });
  expect(session.snapshot().currentWater).toBe(550);
  expect(session.recordGlass(undefined, at(5))).toBe(0);
  session.resetForDay(at(6)); session.resetForDay(at(6));
  expect(session.history()).toMatchObject([entry(6, 0, 500), entry(5, 550, 500), entry(4)]);
  expect(new HydrationSession(session.persisted(), at(6)).history()).toEqual(session.history());
});

class Clock {
  constructor() { this.time = at(5, 10, 25); this.timers = new Map(); this.seq = 0; }
  now() { return this.time; }
  setTimeout(callback, delay) { const id = ++this.seq; this.timers.set(id, { callback, delay }); return id; }
  clearTimeout(id) { this.timers.delete(id); }
}
function runtime() {
  const clock = new Clock(); let visible = false; let writes; let broadcasts = 0;
  const windows = { quitting: false, visibilityRevision: 1, companion: { isVisible: () => visible },
    setCompanionVisible: async (value) => { visible = value; windows.visibilityRevision++; } };
  const main = new HydrationRuntime(windows, { error: null, load: () => undefined, save: (state) => { writes = state; } }, true, () => { broadcasts++; }, clock);
  main.start();
  return { main, clock, windows, saved: () => writes, broadcasts: () => broadcasts };
}

test('Tray quick add shares capped logging, persistence, broadcasts and active-reminder deduplication', async () => {
  const h = runtime(); const before = h.broadcasts();
  expect(h.main.quickAdd()).toBe(250); expect(h.main.quickAdd()).toBe(250);
  expect(h.saved().currentWaterMl).toBe(500); expect(h.broadcasts()).toBeGreaterThan(before);
  await h.main.trigger(true); const revision = h.windows.visibilityRevision;
  expect(h.main.quickAdd()).toBe(250);
  expect(h.main.recordDrink(revision)).toBe(0);
  expect(h.main.creditedReminder).toEqual({ revision, addedWater: 250 });
  await h.windows.setCompanionVisible(false);
  h.main.updateSettings({ ...settings, dailyGoalMl: 1000, glassSizeMl: 300 });
  expect(h.main.quickAdd()).toBe(250); expect(h.main.quickAdd()).toBe(0);
  expect(h.saved().currentWaterMl).toBe(1000); h.main.stop(); expect(h.clock.timers.size).toBe(0);
});

test('Session pause and persistent OFF cancel active and delayed reminders; resume selects only future slots', async () => {
  const h = runtime(); await h.main.trigger(true);
  h.main.triggerDevelopment(15000); h.main.setPaused(true); await Promise.resolve();
  expect(h.main.active()).toBe(false);
  expect(h.main.scheduler.snapshot()).toMatchObject({ nextReminderAt: null, remindersPaused: true, remindersEnabled: true });
  expect(h.clock.timers.size).toBe(1); // Only calendar/clock maintenance remains.
  h.clock.time = at(5, 13, 25); h.main.setPaused(false);
  expect(h.main.scheduler.snapshot().nextReminderAt).toBe(at(5, 14).toISOString());
  h.main.updateSettings({ ...settings, remindersEnabled: false });
  expect(h.main.scheduler.snapshot()).toMatchObject({ nextReminderAt: null, remindersEnabled: false, remindersPaused: false });
  await h.main.trigger(false); expect(h.main.active()).toBe(false);
  expect(h.main.quickAdd()).toBe(250); expect(h.saved().settings.remindersEnabled).toBe(false);
  expect(() => h.main.triggerDevelopment(0)).toThrow('Enable and resume');
  h.main.updateSettings(settings); expect(h.main.scheduler.snapshot().nextReminderAt).toBe(at(5, 14).toISOString());
  h.main.stop();
});

test('A tray drink during pending native creation satisfies that prompt without a second credit', async () => {
  const clock = new Clock(); let visible = false; let release;
  const windows = { quitting: false, visibilityRevision: 0, companion: { isVisible: () => visible },
    setCompanionVisible: async (value) => {
      if (value) await new Promise((resolve) => { release = resolve; });
      visible = value; windows.visibilityRevision++;
    } };
  const main = new HydrationRuntime(windows, { error: null, load: () => undefined, save: () => {} }, true, () => {}, clock);
  main.start(); const showing = main.trigger(true);
  expect(main.quickAdd()).toBe(250); release(); await showing;
  expect(main.creditedReminder).toEqual({ revision: windows.visibilityRevision, addedWater: 250 });
  expect(main.recordDrink(windows.visibilityRevision)).toBe(0);
  expect(main.session.snapshot().currentWater).toBe(250); main.stop();
});
