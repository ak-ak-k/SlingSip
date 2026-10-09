import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AnimationLabComponent } from '../companion/animation-lab.component';
import { OverviewState } from './overview-state.service';
import { OverviewHeroComponent } from './overview-hero.component';
import { TodayProgressComponent } from './today-progress.component';
import { RemainingWaterComponent } from './remaining-water.component';
import { NextBreakComponent } from './next-break.component';
import { ReminderStatusComponent } from './reminder-status.component';
import { StreakCardComponent } from './streak-card.component';
import { QuickActionsComponent } from './quick-actions.component';
import { DailyScheduleComponent } from './daily-schedule.component';
import { HistoryPreviewComponent } from './history-preview.component';
import { DesktopIntegrationComponent } from './desktop-integration.component';

@Component({
  selector: 'app-dashboard',
  imports: [AnimationLabComponent, OverviewHeroComponent, TodayProgressComponent, RemainingWaterComponent, NextBreakComponent,
    ReminderStatusComponent, StreakCardComponent, QuickActionsComponent, DailyScheduleComponent,
    HistoryPreviewComponent, DesktopIntegrationComponent],
  providers: [OverviewState],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent { readonly labOpen = signal(false); readonly state = inject(OverviewState); }
