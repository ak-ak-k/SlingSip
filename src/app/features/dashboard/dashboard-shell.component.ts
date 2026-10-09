import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DesktopService } from '../../core/services/desktop.service';
import { ProfileChipComponent } from '../profile/profile-chip.component';
import { OnboardingService } from '../onboarding/onboarding.service';
import { OnboardingComponent } from '../onboarding/onboarding.component';
import { DashboardTourComponent } from '../onboarding/dashboard-tour.component';
import { UpdateStatusComponent } from '../updates/update-status.component';

@Component({
  selector: 'app-dashboard-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ProfileChipComponent, OnboardingComponent, DashboardTourComponent, UpdateStatusComponent],
  templateUrl: './dashboard-shell.component.html',
  styleUrl: './dashboard-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardShellComponent {
  readonly desktop = inject(DesktopService);
  readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly url = signal(this.router.url);
  private readonly main = viewChild<ElementRef<HTMLElement>>('mainContent');
  readonly page = computed(() => this.url().endsWith('/settings') ? 'Settings' : this.url().endsWith('/history') ? 'History' : 'Overview');
  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.url.set(event.urlAfterRedirects);
        this.main()?.nativeElement.scrollTo({ top: 0 });
      }
    });
  }
}
