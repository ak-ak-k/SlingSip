import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OverviewState } from './overview-state.service';
import { UiIconComponent } from '../../shared/ui-icon.component';
@Component({
  selector: 'app-streak-card', imports: [UiIconComponent],
  template: `<section class="panel" aria-labelledby="streak-heading"><div class="card-top"><h2 id="streak-heading">Current streak</h2><span class="icon-tile coral"><app-ui-icon name="flame" /></span></div><div class="metric">{{ state.stats()?.currentStreak ?? '—' }}<small>{{ state.stats()?.currentStreak === 1 ? 'day' : 'days' }}</small></div><p class="muted card-note">Small steps make a lasting habit.</p><div class="best-streak card-footer"><span class="muted">Personal best</span><span>{{ state.stats()?.bestStreak ?? '—' }} {{ state.stats()?.bestStreak === 1 ? 'day' : 'days' }} <app-ui-icon name="spark" /></span></div></section>`,
  styleUrl: './overview-card.scss', styles: ['.best-streak { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.best-streak > span:last-child { display: inline-flex; align-items: center; gap: 7px; color: var(--mint); font-size: 11px; }.best-streak app-ui-icon { width: 14px; height: 14px; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreakCardComponent { readonly state = inject(OverviewState); }
