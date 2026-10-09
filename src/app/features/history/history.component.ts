import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { parseLocalDay, previousDay } from '../../../../shared/hydration-history';
import { DesktopService } from '../../core/services/desktop.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['../dashboard/ritual-page.scss', './history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryComponent {
  readonly desktop = inject(DesktopService);
  readonly limit = signal(30);
  readonly entries = computed(() => this.desktop.snapshot()?.history ?? []);
  readonly visible = computed(() => this.entries().slice(0, this.limit()));
  readonly stats = computed(() => this.desktop.snapshot()?.streaks ?? { currentStreak: 0, bestStreak: 0, weekCompletedDays: 0 });
  label(date: string): string {
    const today = this.desktop.snapshot()?.hydrationState.date;
    if (today === date) return 'Today';
    if (today && previousDay(today) === date) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(parseLocalDay(date)!);
  }
  time(timestamp: string): string { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp)); }
}
