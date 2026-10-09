import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DesktopService } from '../../core/services/desktop.service';
import { HydrationService } from '../../core/services/hydration.service';
import { cadenceLabel, clockLabel, countdownLabel, historyLabel, nextBreakView } from './overview-format';
import { parseLocalDay } from '../../../../shared/hydration-history';

/** Presentation only. Canonical water, history and daily scheduling stay in main. */
@Injectable()
export class OverviewState {
  readonly desktop = inject(DesktopService);
  readonly hydration = inject(HydrationService);
  readonly snapshot = this.desktop.snapshot;
  readonly now = signal(Date.now());
  readonly available = computed(() => !!this.snapshot());
  readonly canDrink = computed(() => this.available() && !this.hydration.goalCompleted() && !this.desktop.busy());
  readonly glassLabel = computed(() => this.available() ? `Drink +${this.hydration.glassSize()} ml` : 'Drink water');
  readonly nextBreak = computed(() => nextBreakView(this.snapshot(), this.now()));
  readonly history = computed(() => (this.snapshot()?.history ?? []).slice(0, 3));
  readonly stats = computed(() => this.snapshot()?.streaks);
  readonly dayLabel = computed(() => {
    const date = parseLocalDay(this.hydration.date());
    return date ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date) : 'Your daily ritual';
  });
  readonly status = computed(() => {
    const scheduler = this.snapshot()?.scheduler;
    return !scheduler ? 'Unavailable' : !scheduler.remindersEnabled ? 'Off' : scheduler.remindersPaused ? 'Paused' : 'Active';
  });
  readonly cadence = computed(() => cadenceLabel(this.snapshot()?.scheduler.todaySchedule));
  readonly schedule = computed(() => {
    const snapshot = this.snapshot();
    if (!snapshot) return [];
    const future = snapshot.scheduler.todaySchedule.filter(slot => Date.parse(slot) >= this.now());
    const items = future.length ? future.slice(0, 3) : snapshot.scheduler.todaySchedule.slice(-3);
    return items.map(slot => ({ timestamp: slot, time: clockLabel(slot), next: slot === snapshot.scheduler.nextReminderAt,
      title: slot === snapshot.scheduler.nextReminderAt ? 'Next water break' : Date.parse(slot) < this.now() ? 'Earlier today' : 'Planned water break',
      detail: `${snapshot.hydration.glassSize} ml · ${this.hydration.goalCompleted() ? 'goal complete' : !snapshot.scheduler.remindersEnabled ? 'reminders off' : snapshot.scheduler.remindersPaused ? 'paused' : Date.parse(slot) < this.now() ? 'scheduled time' : countdownLabel(slot, this.now())}` }));
  });
  readonly canOpenCompanion = computed(() => this.available() && !this.desktop.busy() && !this.hydration.goalCompleted()
    && !!this.snapshot()?.scheduler.remindersEnabled && !this.snapshot()?.scheduler.remindersPaused && !this.snapshot()?.scheduler.reminderActive);
  readonly companionLabel = computed(() => this.snapshot()?.reminderRetry.pending ? 'Return scheduled' : this.desktop.overlayVisible() ? 'Companion active' : 'Open companion');
  readonly displaySize = computed(() => {
    const display = this.snapshot()?.display;
    return display ? `${display.workArea.width} × ${display.workArea.height} · ${Math.round(display.scaleFactor * 100)}%` : 'Unavailable';
  });
  readonly inputLabel = computed(() => !this.available() ? 'Unavailable' : this.snapshot()?.overlay.interactive ? 'Overlay interactive' : 'Passes through');
  readonly progressMessage = computed(() => !this.available() ? 'Your ritual starts here.' : this.hydration.goalCompleted() ? 'Daily goal complete!' : this.hydration.currentWater() > 0 ? "You're doing great!" : 'Every glass is a good start.');

  constructor() {
    const refresh = () => this.now.set(Date.now());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    inject(DestroyRef).onDestroy(() => { clearInterval(timer); window.removeEventListener('focus', refresh); });
  }
  historyLabel(date: string): string { return historyLabel(date, this.hydration.date() ?? undefined); }
}
