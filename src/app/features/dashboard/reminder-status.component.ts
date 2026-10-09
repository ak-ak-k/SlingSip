import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverviewState } from './overview-state.service';
import { UiIconComponent } from '../../shared/ui-icon.component';
@Component({
  selector: 'app-reminder-status', imports: [UiIconComponent, RouterLink],
  template: `<section class="panel" aria-labelledby="reminders-heading"><div class="card-top"><h2 id="reminders-heading">Reminder status</h2><span class="icon-tile"><app-ui-icon name="bell" /></span></div><div class="reminder-state" data-testid="reminder-status"><span class="status-dot" [class.inactive]="state.status() !== 'Active'"></span>{{ state.status() }}</div><p class="muted card-note">{{ state.cadence() }}</p><a class="text-link card-footer" routerLink="/dashboard/settings">Adjust your routine <app-ui-icon name="arrow" /></a></section>`,
  styleUrl: './overview-card.scss', styles: ['.reminder-state { display: flex; align-items: center; gap: 10px; color: var(--mint); font-size: 23px; font-weight: 500; }.reminder-state .inactive { background: var(--muted); }.card-footer { display: flex; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderStatusComponent { readonly state = inject(OverviewState); }
