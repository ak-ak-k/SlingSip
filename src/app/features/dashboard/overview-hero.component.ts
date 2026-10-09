import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SlingSipArtworkComponent } from '../../shared/slingsip-artwork.component';
import { OverviewState } from './overview-state.service';
import { LocalProfileService } from '../../core/services/local-profile.service';
@Component({
  selector: 'app-overview-hero', imports: [SlingSipArtworkComponent],
  template: `<header class="hero"><div class="hero-copy"><div class="eyebrow">YOUR DAILY SIDEKICK</div><h1>Stay hydrated.<br><span>Keep moving.</span></h1><p>A playful desktop companion that swings in when it’s time to drink.</p><div class="hero-date">@if (profile.name()) { <span data-testid="profile-greeting">{{ profile.greeting(state.now()) }}</span><span aria-hidden="true"> &middot; </span> }{{ state.dayLabel() }}</div></div>
    <div class="hero-art" aria-hidden="true"><svg viewBox="0 0 320 220" fill="none"><defs><linearGradient id="hero-trail"><stop stop-color="var(--slingsip-accent-primary)" stop-opacity="0"/><stop offset="1" stop-color="var(--slingsip-accent-primary)" stop-opacity=".6"/></linearGradient></defs><ellipse cx="165" cy="124" rx="100" ry="77" stroke="var(--slingsip-accent-primary)" stroke-opacity=".06"/><path d="M9 153 Q150 247 296 64 M15 177 Q167 245 298 87" stroke="url(#hero-trail)" stroke-width="1.3"/><path d="M55 107v8m-4-4h8M274 157v8m-4-4h8" stroke="var(--slingsip-accent-primary)" stroke-opacity=".5"/><circle cx="82" cy="179" r="2" fill="var(--slingsip-accent-cyan)" fill-opacity=".45"/></svg><app-slingsip-artwork pose="idle" /></div>
  </header>`,
  styleUrl: './overview-hero.component.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewHeroComponent { readonly state = inject(OverviewState); readonly profile = inject(LocalProfileService); }
