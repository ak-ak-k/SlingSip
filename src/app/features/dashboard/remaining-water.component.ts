import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OverviewState } from './overview-state.service';
import { UiIconComponent } from '../../shared/ui-icon.component';
@Component({
  selector: 'app-remaining-water', imports: [UiIconComponent], styleUrl: './overview-card.scss',
  template: `<section class="panel" aria-labelledby="remaining-heading"><div class="card-top"><h2 id="remaining-heading">Remaining water</h2><span class="icon-tile cyan"><app-ui-icon name="drop" /></span></div><div class="metric" data-testid="remaining-water">{{ state.available() ? state.hydration.remainingWater() : '—' }}<small>ml</small></div><p class="muted card-note">{{ state.available() && state.hydration.goalCompleted() ? 'You made time for yourself today.' : 'To reach your daily goal.' }}</p></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemainingWaterComponent { readonly state = inject(OverviewState); }
