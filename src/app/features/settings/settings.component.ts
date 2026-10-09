import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DEFAULT_HYDRATION_SETTINGS, HYDRATION_SETTING_LIMITS, timeMinutes, validateHydrationSettings, type HydrationSettings } from '../../../../shared/hydration-settings';
import { CompanionPreferencesComponent } from './companion-preferences.component';
import { DesktopService } from '../../core/services/desktop.service';
import { AboutUpdatesComponent } from '../updates/about-updates.component';

@Component({
  selector: 'app-settings',
  imports: [CompanionPreferencesComponent, AboutUpdatesComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['../dashboard/ritual-page.scss', './settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  readonly desktop = inject(DesktopService);
  readonly limits = HYDRATION_SETTING_LIMITS;
  readonly draft = signal<HydrationSettings>({ ...DEFAULT_HYDRATION_SETTINGS });
  readonly dirty = signal(false);
  readonly saved = signal(false);
  readonly startup = computed(() => this.desktop.snapshot()?.startup);
  readonly errors = computed(() => {
    const settings = this.draft(); const errors: Record<string, string> = {};
    if (!Number.isSafeInteger(settings.dailyGoalMl) || settings.dailyGoalMl < this.limits.goalMin || settings.dailyGoalMl > this.limits.goalMax) errors['goal'] = 'Choose a whole number from 500 to 5000 ml.';
    if (!Number.isSafeInteger(settings.glassSizeMl) || settings.glassSizeMl < this.limits.glassMin || settings.glassSizeMl > this.limits.glassMax || settings.glassSizeMl > settings.dailyGoalMl) errors['glass'] = 'Choose 50–1000 ml, no larger than your daily goal.';
    if (!Number.isSafeInteger(settings.retryIntervalMinutes) || settings.retryIntervalMinutes < this.limits.retryMin || settings.retryIntervalMinutes > this.limits.retryMax) errors['retry'] = 'Choose 1–60 whole minutes.';
    try { if (timeMinutes(settings.workingStart) >= timeMinutes(settings.workingEnd)) errors['hours'] = 'Start must be earlier than end on the same day.'; }
    catch { errors['hours'] = 'Choose valid start and end times.'; }
    return errors;
  });
  readonly valid = computed(() => { try { validateHydrationSettings(this.draft()); return true; } catch { return false; } });

  constructor() {
    effect(() => {
      const settings = this.desktop.snapshot()?.hydrationState.settings;
      if (settings && !this.dirty()) this.draft.set({ ...settings });
    });
  }

  number(key: 'dailyGoalMl' | 'glassSizeMl' | 'retryIntervalMinutes', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.change(key, value === '' ? Number.NaN : Number(value));
  }
  time(key: 'workingStart' | 'workingEnd', event: Event): void { this.change(key, (event.target as HTMLInputElement).value); }
  toggle(key: 'remindersEnabled' | 'launchAtStartup', event: Event): void { this.change(key, (event.target as HTMLInputElement).checked); }
  reset(): void {
    this.dirty.set(false); this.saved.set(false); this.desktop.error.set(null);
    this.draft.set({ ...(this.desktop.snapshot()?.hydrationState.settings ?? DEFAULT_HYDRATION_SETTINGS) });
  }
  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.valid()) return;
    if (await this.desktop.updateHydrationSettings(this.draft())) {
      this.reset(); this.saved.set(true);
    }
  }
  private change<K extends keyof HydrationSettings>(key: K, value: HydrationSettings[K]): void {
    this.dirty.set(true); this.saved.set(false); this.draft.update((settings) => ({ ...settings, [key]: value }));
  }
}
