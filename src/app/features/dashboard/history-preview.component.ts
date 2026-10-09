import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverviewState } from './overview-state.service';
import { UiIconComponent } from '../../shared/ui-icon.component';
@Component({
  selector: 'app-history-preview', imports: [UiIconComponent, RouterLink],
  template: `<section class="panel" aria-labelledby="history-preview-heading"><div class="card-top"><h2 id="history-preview-heading">A few good days</h2><a class="text-link" routerLink="/dashboard/history">View history <app-ui-icon name="arrow" /></a></div><div class="history-rows">@for (day of state.history(); track day.date) {
    <article class="history-row" [attr.data-testid]="'preview-' + day.date"><div class="history-label"><strong>{{ state.historyLabel(day.date) }}</strong>@if (day.completed) { <span class="completion" aria-label="Goal complete"><app-ui-icon name="check" /></span> }<span>{{ day.percentage }}%</span></div><div class="history-amount"><time [attr.datetime]="day.date">{{ day.date }}</time><span>{{ day.consumedMl }} / {{ day.goalMl }} ml</span></div><div class="bar" role="progressbar" [attr.aria-label]="state.historyLabel(day.date) + ' hydration'" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="day.percentage"><span [style.width.%]="day.percentage"></span></div></article>
  } @empty { <p class="empty-note">Your first glass starts the story. Your logged days will appear here.</p> }</div></section>`,
  styleUrl: './overview-card.scss', styles: ['.history-row { padding: 13px 0; border-top: 1px solid var(--line); }.history-label, .history-amount { display: flex; align-items: center; gap: 9px; }.history-label strong { font-size: 12px; font-weight: 500; }.history-label > span:last-child { color: var(--mint); font-size: 11px; margin-left: auto; }.completion { display: inline-flex; color: var(--mint); }.completion app-ui-icon { width: 14px; height: 14px; }.history-amount { justify-content: space-between; color: var(--muted); font-size: 10px; margin: 7px 0 10px; }.card-top .text-link { white-space: nowrap; font-size: 10px; }.card-top h2 { font-size: 16px; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPreviewComponent { readonly state = inject(OverviewState); }
