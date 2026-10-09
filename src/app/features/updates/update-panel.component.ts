import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ApplicationUpdatesService } from '../../core/services/application-updates.service';

@Component({
  selector: 'app-update-panel', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updates.state(); as state) {
      <div class="update-panel" data-testid="update-panel" [attr.data-state]="state.status" aria-live="polite" aria-atomic="true">
        @if (updates.dismissed() && (state.status === 'available' || state.status === 'downloaded')) {
          <p>SlingSip {{ state.availableVersion }} {{ state.status === 'downloaded' ? 'is ready when you are.' : 'is available when you are.' }}</p>
          <button type="button" class="secondary" (click)="updates.show()">Show update</button>
        } @else {
          @switch (state.status) {
            @case ('idle') { <p>{{ state.enabled ? 'Check for a new stable release.' : state.disabledReason }}</p> }
            @case ('checking') { <p>Checking for updates…</p> }
            @case ('not-available') { <p>You’re using the latest available stable release.</p> }
            @case ('available') {
              <h3>SlingSip {{ state.availableVersion }} is available</h3>
              @if (state.releaseName) { <p>{{ state.releaseName }}</p> }
              @if (state.releaseNotes) { <p class="notes">{{ state.releaseNotes }}</p> }
              <div class="actions"><button type="button" class="primary" data-testid="download-update" (click)="updates.desktop.downloadUpdate()">Download update</button><button type="button" class="secondary" data-testid="update-later" (click)="updates.later()">Later</button></div>
            }
            @case ('downloading') {
              <h3>Downloading SlingSip {{ state.availableVersion }}</h3>
              <p data-testid="update-progress">{{ state.downloadProgress === null ? 'Preparing download…' : state.downloadProgress + '%' }}</p>
              <progress max="100" [attr.value]="state.downloadProgress" aria-label="Update download progress"></progress>
              <p>Your water breaks keep running while the update downloads.</p>
            }
            @case ('downloaded') {
              <h3>SlingSip {{ state.availableVersion }} is ready.</h3>
              <p>Restart SlingSip to finish updating.</p>
              <div class="actions"><button type="button" class="primary" data-testid="restart-and-update" [disabled]="!updates.canInstall()" (click)="updates.desktop.restartAndUpdate()">{{ state.installing ? 'Restarting…' : 'Restart & Update' }}</button><button type="button" class="secondary" data-testid="update-later" [disabled]="state.installing" (click)="updates.later()">Later</button></div>
              @if (!updates.canInstall() && !state.installing) { <p>Finish the current water break before restarting to update.</p> }
            }
            @case ('error') {
              @if (state.failureStage === 'download' && state.availableVersion) {
                <button type="button" class="primary" data-testid="download-update" (click)="updates.desktop.downloadUpdate()">Retry download</button>
              }
            }
          }
        }
        @if (state.errorMessage) { <p class="error" role="status" data-testid="update-error">{{ state.errorMessage }}</p> }
        @if (updates.desktop.updateActionError()) { <p class="error" role="status">{{ updates.desktop.updateActionError() }}</p> }
      </div>
    }
  `,
  styles: [`
    :host{display:block}.update-panel{margin-top:18px;border:1px solid var(--slingsip-border-accent);border-radius:12px;background:var(--slingsip-tint-soft);padding:16px;color:var(--text)}
    h3{font-size:14px;font-weight:550;margin:0 0 8px}p{font-size:11px;line-height:1.7;color:var(--muted);margin:8px 0}.notes{white-space:pre-wrap;max-height:8em;overflow:auto;overflow-wrap:anywhere}
    .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}button{border:1px solid var(--slingsip-border);border-radius:9px;padding:10px 13px;font:inherit;font-size:11px;cursor:pointer}button.primary{background:var(--mint);color:var(--slingsip-field)}button.secondary{background:var(--slingsip-field);color:var(--text)}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:2px solid var(--mint);outline-offset:3px}
    progress{width:100%;height:7px;accent-color:var(--mint)}.error{color:var(--slingsip-error)}
  `],
})
export class UpdatePanelComponent { readonly updates = inject(ApplicationUpdatesService); }
