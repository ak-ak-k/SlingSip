import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OverviewState } from './overview-state.service';
import { UiIconComponent } from '../../shared/ui-icon.component';
@Component({
  selector: 'app-next-break', imports: [UiIconComponent],
  template: `<section class="panel" aria-labelledby="next-heading"><div class="card-top"><h2 id="next-heading">Next water break</h2><span class="icon-tile"><app-ui-icon name="clock" /></span></div><div class="next-value" data-testid="next-reminder">{{ state.nextBreak().value }}</div><p class="muted card-note" data-testid="next-countdown">{{ state.nextBreak().detail }}</p></section>`,
  styleUrl: './overview-card.scss', styles: ['.next-value { font-size: 25px; font-weight: 550; letter-spacing: -.7px; line-height: 1.3; font-variant-numeric: tabular-nums; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NextBreakComponent { readonly state = inject(OverviewState); }
