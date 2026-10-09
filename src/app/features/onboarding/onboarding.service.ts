import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DesktopService } from '../../core/services/desktop.service';

export type OnboardingStage = 'loading' | 'welcome' | 'profile' | 'routine' | 'intro' | 'tour' | 'ready' | 'done';

/** UI flow only. Completion is persisted exclusively by the explicit final CTA. */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  readonly desktop = inject(DesktopService);
  private readonly router = inject(Router);
  readonly stage = signal<OnboardingStage>('loading');
  readonly wizard = computed(() => !['done', 'tour'].includes(this.stage()));
  private initialized = false;
  private replay = false;
  constructor() {
    effect(() => {
      const snapshot = this.desktop.snapshot();
      if (this.initialized) return;
      if (!this.desktop.nativeAvailable || snapshot) {
        this.initialized = true;
        this.stage.set(!this.desktop.nativeAvailable || snapshot?.userProfile?.hasCompletedOnboarding ? 'done' : 'welcome');
      }
    });
  }
  defer(): void { this.stage.set('done'); }
  resumeSetup(): void { this.replay = false; this.stage.set('welcome'); }
  async startTour(replay = false): Promise<void> {
    // Angular reports same-URL navigation as skipped; the tour still starts there.
    if (this.router.url !== '/dashboard' && !await this.router.navigateByUrl('/dashboard')) return;
    this.replay = replay; this.stage.set('tour');
  }
  finishTour(): void { this.stage.set(this.replay ? 'done' : 'ready'); }
  async complete(): Promise<void> {
    if (await this.desktop.completeOnboarding()) this.stage.set('done');
  }
}
