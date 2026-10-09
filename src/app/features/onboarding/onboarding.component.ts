import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { DEFAULT_HYDRATION_SETTINGS, HYDRATION_SETTING_LIMITS, validateHydrationSettings, type HydrationSettings } from '../../../../shared/hydration-settings';
import { profileInitials, validateDisplayName } from '../../../../shared/user-profile';
import { DesktopService } from '../../core/services/desktop.service';
import { LocalProfileService } from '../../core/services/local-profile.service';
import { OnboardingService } from './onboarding.service';

type Routine = Pick<HydrationSettings, 'dailyGoalMl' | 'glassSizeMl' | 'workingStart' | 'workingEnd'>;
export const ONBOARDING_ASSETS = {
  welcome: 'assets/onboarding/slingsip/welcome-hero.png',
  profile: 'assets/onboarding/slingsip/profile-idle.png',
  routine: 'assets/onboarding/slingsip/routine-upside-down.png',
  intro: 'assets/onboarding/slingsip/profile-idle.png',
  ready: 'assets/onboarding/slingsip/success-ready.png',
} as const;

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.low-power]': 'desktop.snapshot()?.companionPreferences?.lowPowerAnimations' },
})
export class OnboardingComponent {
  readonly flow = inject(OnboardingService);
  readonly desktop = inject(DesktopService);
  readonly profile = inject(LocalProfileService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly name = signal(this.profile.name());
  readonly attempted = signal(false);
  readonly imageFailed = signal(false);
  readonly limits = HYDRATION_SETTING_LIMITS;
  private readonly initial = this.desktop.snapshot()?.hydrationState.settings ?? DEFAULT_HYDRATION_SETTINGS;
  readonly routine = signal<Routine>({ dailyGoalMl: this.initial.dailyGoalMl, glassSizeMl: this.initial.glassSizeMl,
    workingStart: this.initial.workingStart, workingEnd: this.initial.workingEnd });
  readonly nameError = computed(() => { try { validateDisplayName(this.name()); return ''; } catch (error) { return (error as Error).message; } });
  readonly previewName = computed(() => this.name().trim().replace(/\s+/gu, ' ') || 'Your name');
  readonly initials = computed(() => profileInitials(this.name()));
  readonly settings = computed(() => ({ ...(this.desktop.snapshot()?.hydrationState.settings ?? DEFAULT_HYDRATION_SETTINGS), ...this.routine() }));
  readonly routineError = computed(() => { try { validateHydrationSettings(this.settings()); return ''; } catch (error) { return (error as Error).message; } });
  readonly image = computed(() => ONBOARDING_ASSETS[this.flow.stage() as keyof typeof ONBOARDING_ASSETS] ?? ONBOARDING_ASSETS.welcome);
  readonly steps = ['Welcome', 'Your name', 'Your routine', 'Meet SlingSip'];
  readonly index = computed(() => ['welcome', 'profile', 'routine', 'intro'].indexOf(this.flow.stage()));
  readonly heading = computed(() => {
    switch (this.flow.stage()) {
      case 'profile': return 'What should SlingSip call you?';
      case 'routine': return 'Build your daily rhythm';
      case 'intro': return 'Meet SlingSip.';
      case 'ready': return "You're ready, " + this.profile.name() + '.';
      case 'loading': return 'Connecting your desktop…';
      default: return 'Welcome to SlingSip';
    }
  });
  private lastStage = '';
  constructor() {
    afterRenderEffect(() => {
      const stage = this.flow.stage();
      if (stage === this.lastStage) return;
      this.lastStage = stage; this.imageFailed.set(false); this.attempted.set(false);
      const root = this.element.nativeElement;
      root.querySelector<HTMLElement>(stage === 'profile' ? '#onboarding-name' : '#onboarding-heading')?.focus({ preventScroll: true });
      root.scrollTop = 0;
    });
  }
  number(key: 'dailyGoalMl' | 'glassSizeMl', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.routine.update(routine => ({ ...routine, [key]: value === '' ? NaN : Number(value) }));
  }
  time(key: 'workingStart' | 'workingEnd', event: Event): void {
    this.routine.update(routine => ({ ...routine, [key]: (event.target as HTMLInputElement).value }));
  }
  input(event: Event): void { this.name.set((event.target as HTMLInputElement).value); }
  async next(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.desktop.busy()) return;
    this.attempted.set(true); this.desktop.error.set(null);
    switch (this.flow.stage()) {
      case 'welcome': this.flow.stage.set('profile'); break;
      case 'profile':
        if (!this.nameError() && await this.desktop.updateDisplayName(this.name())) this.flow.stage.set('routine');
        break;
      case 'routine':
        if (!this.routineError() && await this.desktop.updateHydrationSettings(this.settings())) this.flow.stage.set('intro');
        break;
      case 'intro': await this.flow.startTour(); break;
      case 'ready': await this.flow.complete(); break;
    }
  }
  back(): void {
    const previous = { profile: 'welcome', routine: 'profile', intro: 'routine', ready: 'intro' } as const;
    const stage = this.flow.stage() as keyof typeof previous;
    if (previous[stage]) this.flow.stage.set(previous[stage]);
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.desktop.busy()) { event.preventDefault(); this.flow.defer(); }
    if (event.key === 'Enter' && !['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
      event.preventDefault(); void this.next();
    }
  }
}
