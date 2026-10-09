import { computed, inject, Injectable } from '@angular/core';
import { HYDRATION_DEFAULTS } from '../../../../shared/hydration';
import { DesktopService } from './desktop.service';

@Injectable({ providedIn: 'root' })
export class HydrationService {
  private readonly desktop = inject(DesktopService);
  private readonly water = computed(() => this.desktop.snapshot()?.hydration ?? HYDRATION_DEFAULTS);
  readonly dailyGoal = computed(() => this.water().dailyGoal);
  readonly glassSize = computed(() => this.water().glassSize);
  readonly currentWater = computed(() => this.water().currentWater);
  readonly remainingWater = computed(() => Math.max(this.dailyGoal() - this.currentWater(), 0));
  readonly progressPercentage = computed(() => Math.min(this.currentWater() / this.dailyGoal() * 100, 100));
  readonly goalCompleted = computed(() => this.currentWater() >= this.dailyGoal());
  readonly date = computed(() => this.desktop.snapshot()?.hydrationState.date ?? null);
  readonly scheduler = computed(() => this.desktop.snapshot()?.scheduler ?? null);

  drink(reminderRevision?: number): Promise<number> {
    return reminderRevision === undefined ? this.desktop.quickAddWater() : this.desktop.recordWater(reminderRevision);
  }
}
