import { test, expect } from '@playwright/test';
import { DEFAULT_HYDRATION_SETTINGS, validateHydrationSettings } from '../shared/hydration-settings.ts';
import { clampWater, generateTodaySchedule, hydrationSessionCount, isWorkingHours, localDateKey, nextLocalMidnight, selectNextReminder } from '../shared/hydration-schedule.ts';
import { HydrationSession, restoreHydrationState } from '../shared/hydration.ts';
import { reminderTiming } from '../shared/reminder-policy.ts';
import { ReminderScheduler, CLOCK_RECHECK_MS } from '../electron/reminder-scheduler.ts';
import { HydrationRuntime } from '../electron/hydration-runtime.ts';

const settings = { ...DEFAULT_HYDRATION_SETTINGS };
const at = (day, hours = 0, minutes = 0, seconds = 0) => new Date(2026, 9, day, hours, minutes, seconds);
const times = (schedule) => schedule.map((date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);

class TestClock {
  constructor(now) { this.time = now.getTime(); this.timers = new Map(); this.sequence = 0; }
  now() { return new Date(this.time); }
  setTimeout(callback, delay) { const id = ++this.sequence; this.timers.set(id, { at: this.time + delay, callback }); return id; }
  clearTimeout(id) { this.timers.delete(id); }
  advance(to) {
    const target = to.getTime();
    while (true) {
      const first = [...this.timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first || first[1].at > target) break;
      this.time = first[1].at; this.timers.delete(first[0]); first[1].callback();
    }
    this.time = target;
  }
  wake(to) {
    // Suspended timers fire once at the actual wake time, not once per missed interval.
    this.time = to.getTime();
    const due = [...this.timers].filter(([, timer]) => timer.at <= this.time);
    for (const [id, timer] of due) { this.timers.delete(id); timer.callback(); }
  }
}

function schedulerHarness(now, saved) {
  const clock = new TestClock(now);
  const session = new HydrationSession(saved, now);
  let active = false;
  const triggers = [];
  const errors = [];
  const scheduler = new ReminderScheduler({
    state: () => session.persisted(), active: () => active,
    rollDay: (date) => { if (session.resetForDay(date)) active = false; },
    trigger: async () => { active = true; session.markReminder(clock.now()); triggers.push(clock.now()); },
    changed: () => {}, failed: (error) => errors.push(error),
  }, clock);
  scheduler.start();
  return { clock, session, scheduler, triggers, errors, hide: () => { active = false; scheduler.refresh(); } };
}

test('Default schedule has eight dynamic start-inclusive/end-exclusive sessions', () => {
  expect(hydrationSessionCount(settings)).toBe(8);
  expect(times(generateTodaySchedule(settings, at(5)))).toEqual(['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
  const changed = { ...settings, dailyGoalMl: 2400, glassSizeMl: 300 };
  expect(hydrationSessionCount(changed)).toBe(8);
  expect(times(generateTodaySchedule(changed, at(5)))).toEqual(times(generateTodaySchedule(settings, at(5))));
  const partial = { ...settings, dailyGoalMl: 1000, glassSizeMl: 300 };
  expect(hydrationSessionCount(partial)).toBe(4);
  expect(times(generateTodaySchedule(partial, at(5)))).toEqual(['10:00', '12:00', '14:00', '16:00']);
});

test('Settings reject invalid numbers, clocks, reversed hours, and excessive sessions', () => {
  expect(validateHydrationSettings(settings)).toEqual(settings);
  for (const value of [null, [], {}, { ...settings, dailyGoalMl: 0 }, { ...settings, dailyGoalMl: Infinity },
    { ...settings, glassSizeMl: -1 }, { ...settings, glassSizeMl: 3000 }, { ...settings, glassSizeMl: 1 },
    { ...settings, dailyGoalMl: 2000.5 }, { ...settings, retryIntervalMinutes: 0 },
    { ...settings, workingStart: '9:00' }, { ...settings, workingStart: '24:00' },
    { ...settings, workingEnd: '10:00' }, { ...settings, workingEnd: '09:00' }]) {
    expect(() => validateHydrationSettings(value)).toThrow();
  }
  expect(reminderTiming(false, { ...settings, retryIntervalMinutes: 7 }).retryIntervalMs).toBe(420000);
  expect(reminderTiming(true, { ...settings, retryIntervalMinutes: 7 }).retryIntervalMs).toBe(10000);
});

test('Late opening selects only a strictly future slot, respects boundaries, and stops at goal', () => {
  const schedule = generateTodaySchedule(settings, at(5));
  expect(selectNextReminder(schedule, at(5, 13, 25), false)).toEqual(at(5, 14));
  expect(selectNextReminder(schedule, at(5, 14), false)).toEqual(at(5, 15));
  expect(selectNextReminder(schedule, at(5, 9), false)).toEqual(at(5, 10));
  expect(selectNextReminder(schedule, at(5, 18), false)).toBeNull();
  expect(selectNextReminder(schedule, at(5, 15), true)).toBeNull();
  expect(selectNextReminder(schedule, at(5, 11), false, at(5, 14).toISOString())).toEqual(at(5, 15));
  expect(isWorkingHours(settings, at(5, 9, 59))).toBe(false);
  expect(isWorkingHours(settings, at(5, 10))).toBe(true);
  expect(isWorkingHours(settings, at(5, 17, 59))).toBe(true);
  expect(isWorkingHours(settings, at(5, 18))).toBe(false);
});

test('Local-day restoration keeps today, resets yesterday, and sanitizes corrupt data', () => {
  const saved = { date: localDateKey(at(5)), currentWaterMl: 1500, settings, lastDrinkAt: at(5, 12).toISOString() };
  expect(restoreHydrationState(saved, at(5, 16))).toEqual({ ...saved, schemaVersion: 2, history: [] });
  const tomorrow = restoreHydrationState(saved, at(6, 8));
  expect(tomorrow).toMatchObject({ schemaVersion: 2, date: localDateKey(at(6)), currentWaterMl: 0, settings });
  expect(tomorrow.history).toEqual([{ date: saved.date, goalMl: 2000, consumedMl: 1500, percentage: 75, completed: false, lastDrinkAt: saved.lastDrinkAt }]);
  expect(restoreHydrationState({ ...saved, currentWaterMl: 3000 }, at(5)).currentWaterMl).toBe(3000);
  expect(restoreHydrationState({ ...saved, currentWaterMl: '500', settings: { dailyGoalMl: -1 }, lastDrinkAt: 'bad' }, at(5)))
    .toEqual({ schemaVersion: 2, history: [], date: localDateKey(at(5)), currentWaterMl: 0, settings });
  expect(nextLocalMidnight(new Date(2026, 9, 31, 23, 59))).toEqual(new Date(2026, 10, 1));
});

test('Water clamps a partial final glass and reminder credits reset only with the local day', () => {
  expect(clampWater(1900, 250, 2000)).toBe(2000);
  const session = new HydrationSession({ date: localDateKey(at(5)), currentWaterMl: 1900, settings }, at(5));
  expect(session.recordGlass(1, at(5, 12))).toBe(100);
  expect(session.recordGlass(1, at(5, 12))).toBe(0);
  expect(session.recordGlass(2, at(5, 13))).toBe(0);
  expect(session.snapshot().currentWater).toBe(2000);
  expect(session.resetForDay(at(5, 23, 59))).toBe(false);
  expect(session.resetForDay(at(6))).toBe(true);
  expect(session.recordGlass(1, at(6, 12))).toBe(250);
});

test('Main scheduler triggers automatically, skips overlapping slots, and resumes after hiding', () => {
  const h = schedulerHarness(at(5, 9, 59, 55));
  expect(h.triggers).toHaveLength(0);
  expect(h.clock.timers.size).toBe(1);
  h.clock.advance(at(5, 10));
  expect(h.triggers).toEqual([at(5, 10)]);
  expect(h.scheduler.snapshot().reminderActive).toBe(true);
  h.clock.advance(at(5, 12, 25));
  expect(h.triggers).toHaveLength(1);
  h.hide();
  expect(h.scheduler.snapshot().nextReminderAt).toBe(at(5, 13).toISOString());
  h.clock.advance(at(5, 13));
  expect(h.triggers).toHaveLength(2);
  h.clock.advance(at(5, 18));
  expect(h.scheduler.snapshot().workingHoursActive).toBe(false);
  h.hide();
  expect(h.scheduler.snapshot().nextReminderAt).toBeNull();
  h.scheduler.stop();
  expect(h.clock.timers.size).toBe(0);
});

test('Main scheduler never backfills on late startup, resume, or a large clock jump', () => {
  const h = schedulerHarness(at(5, 13, 25));
  expect(h.triggers).toHaveLength(0);
  expect(h.scheduler.snapshot().nextReminderAt).toBe(at(5, 14).toISOString());
  h.clock.wake(at(5, 16, 25));
  expect(h.triggers).toHaveLength(0);
  expect(h.scheduler.snapshot().nextReminderAt).toBe(at(5, 17).toISOString());
  expect([...h.clock.timers.values()][0].at - h.clock.time).toBeLessThanOrEqual(CLOCK_RECHECK_MS);
  h.clock.advance(at(5, 17));
  expect(h.triggers).toEqual([at(5, 17)]);
  h.scheduler.stop();
});

test('Goal completion cancels normal slots; settings recalculate; midnight rebuilds the next day', () => {
  const h = schedulerHarness(at(5, 15, 25));
  h.session.updateSettings({ ...settings, dailyGoalMl: 500 });
  h.scheduler.refresh();
  expect(h.scheduler.snapshot().todaySchedule).toHaveLength(2);
  expect(h.scheduler.snapshot().nextReminderAt).toBeNull();
  h.session.updateSettings(settings);
  for (let index = 1; index <= 8; index++) h.session.recordGlass(index, h.clock.now());
  h.scheduler.refresh();
  expect(h.scheduler.snapshot().nextReminderAt).toBeNull();
  h.clock.advance(at(5, 18));
  expect(h.triggers).toHaveLength(0);
  h.clock.advance(at(6));
  expect(h.session.persisted()).toMatchObject({ schemaVersion: 2, date: localDateKey(at(6)), currentWaterMl: 0, settings });
  expect(h.session.persisted().history).toMatchObject([{ date: localDateKey(at(5)), consumedMl: 2000, completed: true }]);
  expect(h.scheduler.snapshot().nextReminderAt).toBe(at(6, 10).toISOString());
  expect(h.scheduler.snapshot().todaySchedule).toHaveLength(8);
  h.scheduler.stop();
});

test('Runtime persists immediately, reserves native creation, and handles overnight cancellation', async () => {
  const clock = new TestClock(at(5, 9, 59, 55));
  let stored;
  const writes = [];
  const persistence = { error: null, load: () => stored, save: (value) => { stored = structuredClone(value); writes.push(stored); } };
  let visible = false;
  let release;
  let shows = 0;
  const windows = { quitting: false, visibilityRevision: 0, companion: { isVisible: () => visible },
    setCompanionVisible: async (value) => {
      if (value) { shows++; await new Promise((resolve) => { release = resolve; }); }
      visible = value; windows.visibilityRevision++;
    } };
  const runtime = new HydrationRuntime(windows, persistence, true, () => {}, clock);
  runtime.start();
  clock.advance(at(5, 10));
  await runtime.trigger(true);
  expect(shows).toBe(1);
  expect(runtime.scheduler.snapshot().reminderActive).toBe(true);
  release(); await Promise.resolve(); await Promise.resolve();
  expect(runtime.recordDrink(windows.visibilityRevision)).toBe(250);
  expect(stored.currentWaterMl).toBe(250);
  expect(stored.lastDrinkAt).toBe(at(5, 10).toISOString());
  expect(runtime.recordDrink(windows.visibilityRevision)).toBe(0);
  expect(writes.at(-1).currentWaterMl).toBe(250);
  clock.advance(at(6));
  await Promise.resolve();
  expect(visible).toBe(false);
  expect(stored.date).toBe(localDateKey(at(6)));
  expect(stored.currentWaterMl).toBe(0);
  runtime.stop();
  expect(clock.timers.size).toBe(0);
});

test('Unavailable storage keeps the runtime usable and production rejects development triggers', async () => {
  const clock = new TestClock(at(5, 13, 25));
  const persistence = { error: 'Disk unavailable', load: () => undefined, save: () => {} };
  const windows = { quitting: false, companion: undefined, setCompanionVisible: async () => { throw new Error('Renderer unavailable'); } };
  const runtime = new HydrationRuntime(windows, persistence, false, () => {}, clock);
  runtime.start();
  expect(runtime.session.snapshot().currentWater).toBe(0);
  expect(runtime.storageError()).toBe('Disk unavailable');
  expect(runtime.timing().retryIntervalMs).toBe(300000);
  expect(() => runtime.triggerDevelopment(0)).toThrow('disabled in production');
  await expect(runtime.trigger(false)).rejects.toThrow('Renderer unavailable');
  expect(runtime.active()).toBe(false);
  expect(runtime.error).toContain('could not be shown');
  expect(runtime.scheduler.snapshot().nextReminderAt).toBe(at(5, 14).toISOString());
  runtime.stop();
});

test('The isolated 15-second development timer neither changes daily slots nor overlaps an active run', async () => {
  const clock = new TestClock(at(5, 20));
  let visible = false;
  let shows = 0;
  const windows = { quitting: false, visibilityRevision: 0, companion: { isVisible: () => visible },
    setCompanionVisible: async (value) => { visible = value; if (value) shows++; } };
  const runtime = new HydrationRuntime(windows, { error: null, load: () => undefined, save: () => {} }, true, () => {}, clock);
  runtime.start();
  const normal = runtime.scheduler.snapshot().todaySchedule;
  runtime.triggerDevelopment(15000);
  expect(shows).toBe(0);
  clock.advance(at(5, 20, 0, 15));
  await Promise.resolve();
  expect(shows).toBe(1);
  expect(runtime.scheduler.snapshot().todaySchedule).toEqual(normal);
  runtime.triggerDevelopment(15000);
  clock.advance(at(5, 20, 0, 30));
  await Promise.resolve();
  expect(shows).toBe(1);
  runtime.stop();
  expect(clock.timers.size).toBe(0);
});

function retryHarness(development = false, now = at(5, 13, 25)) {
  const clock = new TestClock(now); let visible = false; let shows = 0; let saved;
  const windows = { quitting: false, visibilityRevision: 0, companion: { isVisible: () => visible },
    setCompanionVisible: async (value, revision) => {
      if (revision !== undefined && revision !== windows.visibilityRevision) return;
      if (value !== visible) windows.visibilityRevision++;
      visible = value; if (value) shows++;
    } };
  const runtime = new HydrationRuntime(windows, { error: null, load: () => saved, save: value => { saved = value; } }, development, () => {}, clock);
  runtime.start();
  return { runtime, clock, windows, visible: () => visible, shows: () => shows, saved: () => saved };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

test('Hidden retry retains one reminder reservation, returns once, and uses configured production timing', async () => {
  const h = retryHarness(); await h.runtime.trigger(false);
  const first = h.windows.visibilityRevision;
  const originalSchedule = h.runtime.scheduler.snapshot().todaySchedule;
  await h.runtime.suspendReminder(first);
  expect(h.visible()).toBe(false);
  expect(h.runtime.retrySnapshot()).toEqual({ pending: true, retryAt: at(5, 13, 30).toISOString(), count: 0 });
  expect(h.runtime.scheduler.snapshot().reminderActive).toBe(true);
  await h.runtime.trigger(false); expect(h.shows()).toBe(1);
  expect(h.clock.timers.size).toBe(2); // Existing daily/calendar timer plus one return timeout.
  h.clock.advance(at(5, 13, 29, 59)); await flush(); expect(h.visible()).toBe(false);
  h.clock.advance(at(5, 13, 30)); await flush(); expect(h.visible()).toBe(true);
  expect(h.shows()).toBe(2); expect(h.runtime.retrySnapshot()).toEqual({ pending: false, retryAt: null, count: 1 });
  expect(h.runtime.scheduler.snapshot().todaySchedule).toEqual(originalSchedule);
  await h.runtime.finishReminder(first); expect(h.visible()).toBe(true); // Stale completion cannot hide the return.
  await h.runtime.finishReminder(h.windows.visibilityRevision); expect(h.visible()).toBe(false);
  h.runtime.stop(); expect(h.clock.timers.size).toBe(0);
});

test('Retry timing changes replace one pending timeout; hidden tray drink satisfies it without reappearance', async () => {
  const h = retryHarness(); await h.runtime.trigger(false); await h.runtime.suspendReminder(h.windows.visibilityRevision);
  h.runtime.updateSettings({ ...settings, retryIntervalMinutes: 7 });
  expect(h.runtime.retrySnapshot().retryAt).toBe(at(5, 13, 32).toISOString());
  expect(h.clock.timers.size).toBe(2);
  expect(h.runtime.quickAdd()).toBe(250); expect(h.saved().currentWaterMl).toBe(250);
  expect(h.runtime.retrySnapshot().pending).toBe(false);
  h.clock.advance(at(5, 13, 33)); await flush(); expect(h.shows()).toBe(1); expect(h.visible()).toBe(false);
  h.runtime.stop();
});

test('Pause, OFF, explicit hide, midnight and quit cancel hidden returns without affecting persisted water', async () => {
  for (const action of ['pause', 'off', 'hide', 'midnight', 'quit']) {
    const h = retryHarness(true); h.runtime.quickAdd();
    await h.runtime.trigger(true); const revision = h.windows.visibilityRevision;
    await h.runtime.suspendReminder(revision);
    if (action === 'pause') h.runtime.setPaused(true);
    if (action === 'off') h.runtime.updateSettings({ ...settings, remindersEnabled: false });
    if (action === 'hide') await h.runtime.finishReminder();
    if (action === 'midnight') { h.clock.wake(at(6)); h.runtime.refresh(); }
    if (action === 'quit') h.runtime.stop();
    await flush(); expect(h.runtime.retrySnapshot().pending).toBe(false);
    if (action !== 'midnight') { h.clock.advance(at(5, 13, 26)); await flush(); }
    expect(h.shows()).toBe(1); expect(h.visible()).toBe(false);
    expect(h.saved().currentWaterMl).toBe(action === 'midnight' ? 0 : 250);
    if (action === 'midnight') expect(h.saved().history[0].consumedMl).toBe(250);
    h.runtime.stop(); expect(h.clock.timers.size).toBe(0);
  }
});

test('Suspension rejects stale tokens and hidden requests; completing a goal prevents a return', async () => {
  const h = retryHarness(true);
  await expect(h.runtime.suspendReminder(0)).rejects.toThrow('no longer active');
  await h.runtime.trigger(true);
  await expect(h.runtime.suspendReminder(h.windows.visibilityRevision - 1)).rejects.toThrow('no longer active');
  await h.runtime.suspendReminder(h.windows.visibilityRevision);
  h.runtime.updateSettings({ ...settings, dailyGoalMl: 500 });
  h.runtime.quickAdd(); h.runtime.quickAdd();
  h.clock.advance(at(5, 13, 26)); await flush();
  expect(h.visible()).toBe(false); expect(h.shows()).toBe(1); expect(h.saved().currentWaterMl).toBe(500);
  h.runtime.stop();
});

test('Lowering the goal cancels a hidden reservation immediately; unrelated settings keep its deadline', async () => {
  const h = retryHarness(); h.runtime.quickAdd(); h.runtime.quickAdd(); h.runtime.quickAdd();
  await h.runtime.trigger(false); await h.runtime.suspendReminder(h.windows.visibilityRevision);
  const deadline = h.runtime.retrySnapshot().retryAt;
  h.clock.advance(at(5, 13, 26));
  h.runtime.updateSettings({ ...settings, glassSizeMl: 300 });
  expect(h.runtime.retrySnapshot().retryAt).toBe(deadline);
  h.runtime.updateSettings({ ...settings, dailyGoalMl: 500 });
  expect(h.runtime.retrySnapshot().pending).toBe(false); expect(h.runtime.active()).toBe(false);
  expect(h.saved().currentWaterMl).toBe(750);
  h.clock.advance(at(5, 13, 33)); await flush(); expect(h.shows()).toBe(1);
  h.runtime.stop();
});
