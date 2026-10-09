import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApplicationUpdatesService } from '../../core/services/application-updates.service';

@Component({
  selector: 'app-update-status', changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.display]': 'updates.meaningful() ? null : "none"' },
  template: `@if (updates.meaningful()) { <button type="button" class="update-chip" data-testid="update-chip" (click)="open()" title="Open About & Updates">{{ label() }}</button> }`,
  styles: [`:host{display:inline-flex;max-width:100%}.update-chip{border:1px solid var(--slingsip-border-accent);border-radius:20px;background:var(--slingsip-tint-soft);color:var(--mint);font:inherit;font-size:10px;padding:7px 11px;cursor:pointer;max-width:100%;overflow-wrap:anywhere}.update-chip:focus-visible{outline:2px solid var(--mint);outline-offset:3px}`],
})
export class UpdateStatusComponent {
  readonly updates = inject(ApplicationUpdatesService);
  private readonly router = inject(Router);
  readonly label = computed(() => {
    const state = this.updates.state();
    return state?.status === 'downloading' ? `Downloading · ${state.downloadProgress === null ? 'Preparing' : state.downloadProgress + '%'}`
      : state?.status === 'downloaded' ? 'Update ready · Restart'
      : state?.status === 'error' ? 'Update download failed'
      : `Update available · v${state?.availableVersion}`;
  });
  async open(): Promise<void> {
    this.updates.show();
    await this.router.navigateByUrl('/dashboard/settings');
    requestAnimationFrame(() => document.getElementById('about-updates')?.scrollIntoView({ block: 'start', behavior: 'auto' }));
  }
}
