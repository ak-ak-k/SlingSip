import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApplicationUpdatesService } from '../../core/services/application-updates.service';
import { UpdatePanelComponent } from './update-panel.component';

@Component({
  selector: 'app-about-updates', imports: [DatePipe, UpdatePanelComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../dashboard/ritual-page.scss',
  template: `
    <section class="card" id="about-updates" aria-labelledby="about-updates-title" data-testid="about-updates" style="margin-top:18px">
      <div class="kicker">ABOUT & UPDATES</div><h2 id="about-updates-title">SlingSip</h2>
      <p data-testid="update-current-version">Version {{ updates.state()?.currentVersion ?? updates.desktop.snapshot()?.appVersion ?? '—' }}</p>
      <p>Automatic update checking: {{ updates.state()?.automaticChecking ? 'On · stable releases · every 6 hours' : 'Unavailable in this build' }}</p>
      <p>Last checked: {{ updates.state()?.lastCheckedAt ? (updates.state()?.lastCheckedAt | date:'medium') : 'Not checked yet' }}</p>
      <button class="secondary" type="button" data-testid="check-for-updates" [disabled]="!updates.canCheck()" (click)="updates.desktop.checkForUpdates()">{{ updates.state()?.status === 'checking' ? 'Checking…' : 'Check for updates' }}</button>
      <app-update-panel />
    </section>
  `,
})
export class AboutUpdatesComponent { readonly updates = inject(ApplicationUpdatesService); }
