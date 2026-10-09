import { computed, inject, Injectable, signal } from '@angular/core';
import { DesktopService } from './desktop.service';

/** UI derivations only; update operations and canonical state stay in Electron main. */
@Injectable({ providedIn: 'root' })
export class ApplicationUpdatesService {
  readonly desktop = inject(DesktopService);
  readonly state = computed(() => this.desktop.snapshot()?.updates ?? null);
  readonly meaningful = computed(() => ['available', 'downloading', 'downloaded'].includes(this.state()?.status ?? '')
    || this.state()?.status === 'error' && this.state()?.failureStage === 'download');
  readonly canCheck = computed(() => !!this.state()?.enabled && !this.state()?.installing
    && !['checking', 'downloading', 'downloaded'].includes(this.state()?.status ?? ''));
  readonly canInstall = computed(() => {
    const desktop = this.desktop.snapshot();
    return !!desktop?.updates.enabled && desktop.updates.status === 'downloaded' && !desktop.updates.installing
      && !desktop.overlay.visible && (!desktop.scheduler.reminderActive || desktop.reminderRetry.pending);
  });
  private readonly deferred = signal<string | null>(null);
  private readonly key = computed(() => `${this.state()?.availableVersion}/${this.state()?.status}`);
  readonly dismissed = computed(() => this.deferred() === this.key());
  later(): void { this.deferred.set(this.key()); }
  show(): void { this.deferred.set(null); }
}
