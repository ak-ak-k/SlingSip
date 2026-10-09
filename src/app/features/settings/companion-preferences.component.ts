import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from '../../../../shared/companion-preferences';
import { DesktopService } from '../../core/services/desktop.service';

@Component({
  selector: 'app-companion-preferences', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="card" aria-labelledby="motion-title">
    <div class="kicker">YOUR SIDEKICK</div><h2 id="motion-title">A little personality.</h2>
    <p>Sound and movement preferences apply to your companion. Your water schedule stays the same.</p>
    <label><span>Sound effects <small>{{ draft().soundEffects ? 'On — quiet, original cues' : 'Off' }}</small></span><input data-testid="sound-effects" type="checkbox" [checked]="draft().soundEffects" (change)="toggle('soundEffects', $event)"></label>
    <label><span>Sound volume <small>{{ volume() }}% maximum output</small></span><input data-testid="sound-volume" aria-label="Sound volume" type="range" min="0" max="30" step="1" [value]="volume()" (input)="setVolume($event)" [disabled]="!draft().soundEffects"></label>
    <label><span>Low power animations <small>Lighter idle movement, simple web, 30 fps and no cursor tracking.</small></span><input data-testid="low-power" type="checkbox" [checked]="draft().lowPowerAnimations" (change)="toggle('lowPowerAnimations', $event)"></label>
    <label><span>Cursor awareness <small>A subtle glance when your pointer is nearby.</small></span><input data-testid="cursor-awareness" type="checkbox" [checked]="draft().cursorAwareness" (change)="toggle('cursorAwareness', $event)"></label>
    <label><span>Character reactions <small>Tap the painted character during a reminder. Empty space passes clicks through.</small></span><input data-testid="character-reactions" type="checkbox" [checked]="draft().characterReactions" (change)="toggle('characterReactions', $event)"></label>
    <p class="hint">Your system’s reduced-motion preference always takes priority.</p>
    @if (desktop.snapshot()?.companionPreferencesError) { <p role="alert">{{ desktop.snapshot()?.companionPreferencesError }}</p> }
    <button class="primary" data-testid="save-companion-preferences" type="button" (click)="save()" [disabled]="!dirty() || !desktop.snapshot() || desktop.busy()">Save companion preferences</button>
    @if (saved()) { <span class="saved" role="status">Companion preferences saved.</span> }
  </section>`,
  styles: [`:host { display:block;margin-top:24px } .card { padding:24px;border:1px solid var(--slingsip-border);border-radius:16px;background:var(--slingsip-surface) } .kicker { font-size:10px;letter-spacing:2px;color:var(--slingsip-accent-primary) } h2 { font-size:20px;margin:10px 0 } p,small { color:var(--slingsip-text-muted);font-size:13px } label { display:flex;justify-content:space-between;gap:24px;align-items:center;padding:16px 0;border-bottom:1px solid var(--slingsip-border) } small { display:block;margin-top:5px } input { accent-color:var(--slingsip-accent-primary) } .hint { margin:20px 0 } .saved { color:var(--slingsip-accent-primary);margin:12px;display:inline-block } @media(max-width:850px) { .card { padding:18px } label { gap:12px } }`],
})
export class CompanionPreferencesComponent {
  readonly desktop = inject(DesktopService);
  readonly draft = signal<CompanionPreferences>({ ...DEFAULT_COMPANION_PREFERENCES });
  readonly dirty = signal(false);
  readonly saved = signal(false);
  volume(): number { return Math.round(this.draft().soundVolume * 100); }
  constructor() { effect(() => { const preferences = this.desktop.snapshot()?.companionPreferences; if (preferences && !this.dirty()) this.draft.set({ ...preferences }); }); }
  toggle(key: 'soundEffects' | 'lowPowerAnimations' | 'cursorAwareness' | 'characterReactions', event: Event): void { this.dirty.set(true); this.saved.set(false); this.draft.update(p => ({ ...p,[key]:(event.target as HTMLInputElement).checked })); }
  setVolume(event: Event): void { this.dirty.set(true); this.saved.set(false); this.draft.update(p => ({ ...p,soundVolume:Number((event.target as HTMLInputElement).value) / 100 })); }
  async save(): Promise<void> { if (await this.desktop.updateCompanionPreferences(this.draft())) { this.dirty.set(false); this.saved.set(true); } }
}
