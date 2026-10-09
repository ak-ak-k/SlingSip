import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverviewState } from './overview-state.service';
import { UiIconComponent } from '../../shared/ui-icon.component';
@Component({
  selector: 'app-quick-actions', imports: [UiIconComponent, RouterLink],
  template: `<section class="panel" aria-labelledby="actions-heading"><div class="card-top"><h2 id="actions-heading">Quick actions</h2><span class="icon-tile cyan"><app-ui-icon name="spark" /></span></div><div class="quick-grid">
    <button class="secondary" type="button" data-testid="quick-drink" (click)="state.hydration.drink()" [disabled]="!state.canDrink()"><app-ui-icon name="plus" />{{ state.glassLabel() }}</button>
    <button class="secondary" type="button" data-testid="pause-reminders" (click)="state.desktop.toggleReminderPause()" [disabled]="!state.available() || state.desktop.busy() || !state.snapshot()?.scheduler?.remindersEnabled"><app-ui-icon [name]="state.snapshot()?.scheduler?.remindersPaused ? 'play' : 'pause'" />{{ state.snapshot()?.scheduler?.remindersPaused ? 'Resume reminders' : 'Pause reminders' }}</button>
    <button class="secondary" type="button" data-testid="open-companion" (click)="state.desktop.openCompanion()" [disabled]="!state.canOpenCompanion()"><app-ui-icon name="desktop" />{{ state.companionLabel() }}</button>
    <a class="action-link" routerLink="/dashboard/settings" aria-label="Adjust settings"><app-ui-icon name="settings" />Settings</a>
  </div></section>`,
  styleUrl: './overview-card.scss', styles: ['.quick-grid { display: grid; grid-template-columns: 1fr; gap: 9px; }.quick-grid > * { justify-content: flex-start; padding: 10px 12px; min-width: 0; }.quick-grid app-ui-icon { width: 17px; height: 17px; color: var(--mint); flex-shrink: 0; }@media (min-width: 701px) and (max-width: 1250px) { .quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickActionsComponent { readonly state = inject(OverviewState); }
