import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { OverviewState } from './overview-state.service';
import { UiIconComponent } from '../../shared/ui-icon.component';
@Component({
  selector: 'app-today-progress', imports: [UiIconComponent, DecimalPipe],
  templateUrl: './today-progress.component.html', styleUrl: './today-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayProgressComponent { readonly state = inject(OverviewState); }
