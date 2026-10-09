import { computed, inject, Injectable } from '@angular/core';
import { greetingForHour, profileInitials } from '../../../../shared/user-profile';
import { DesktopService } from './desktop.service';

/** Presentation of the canonical main-process profile; no browser storage. */
@Injectable({ providedIn: 'root' })
export class LocalProfileService {
  readonly desktop = inject(DesktopService);
  readonly profile = computed(() => this.desktop.snapshot()?.userProfile ?? null);
  readonly name = computed(() => this.profile()?.displayName ?? '');
  readonly initials = computed(() => profileInitials(this.name()));
  readonly memberSince = computed(() => {
    const value = this.profile()?.createdAt;
    return value ? new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not set up yet';
  });
  greeting(now: number): string {
    return this.name() ? greetingForHour(new Date(now).getHours()) + ', ' + this.name() + '.' : '';
  }
}
