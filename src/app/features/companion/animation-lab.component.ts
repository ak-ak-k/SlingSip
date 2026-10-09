import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { DesktopService } from '../../core/services/desktop.service';
import { CharacterStateService } from './animation/character-state.service';
import { CharacterState } from './animation/character.model';
import { SwingAnimationService } from './animation/swing-animation.service';
import { AudioService } from './animation/audio.service';
import { ENTRY_VARIANTS, type EntryVariant } from './animation/entry-variants';
import { CompanionCharacterComponent } from './companion-character.component';
import { SpeechBubbleComponent } from './speech-bubble.component';
import { CompanionVisualHitTestService } from './three/companion-visual-hit-test.service';

/** A separate renderer/session. It cannot record drinks, reserve reminders or schedule retries. */
@Component({
  selector: 'app-animation-lab', imports: [CompanionCharacterComponent, SpeechBubbleComponent],
  providers: [CharacterStateService, SwingAnimationService, AudioService, CompanionVisualHitTestService], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="lab-backdrop" (keydown.escape)="closed.emit()"><section role="dialog" aria-modal="true" aria-labelledby="lab-title" class="lab">
    <header><div><h2 id="lab-title">Animation lab</h2><p>Local preview only. No water logged or reminders scheduled.</p></div><button class="secondary" type="button" data-testid="close-animation-lab" (click)="closed.emit()">Close</button></header>
    <nav aria-label="Animation previews">
      @for (variant of variants; track variant.id) { <button class="secondary" type="button" [attr.data-testid]="'lab-' + variant.id" (click)="entry(variant.id)" [disabled]="!motion.ready()">{{ variant.label }}</button> }
      <button class="secondary" type="button" data-testid="lab-bottle" (click)="bottle()" [disabled]="!idle()">Bottle Delivery</button>
      <button class="secondary" type="button" data-testid="lab-success" (click)="success()" [disabled]="!idle()">Success Exit</button>
      <button class="secondary" type="button" data-testid="lab-retry" (click)="retry()" [disabled]="!idle()">Retry Exit</button>
      <button class="secondary" type="button" (click)="entry(motion.variant())">Idle</button>
      <button class="secondary" type="button" data-testid="lab-cursor" (click)="cursor()" [disabled]="!idle()">Cursor Reaction</button>
    </nav>
    <div class="lab-stage" data-testid="animation-lab-stage" (mousemove)="move($event)" (mouseleave)="away()">
      <div class="preview-bubble" [style.left.px]="bubble().left" [style.top.px]="bubble().top" [style.visibility]="showBubble() ? 'visible' : 'hidden'">
        <app-speech-bubble [visible]="showBubble()" [state]="motion.state.current()" [heading]="heading()" [preview]="true" message="Animation preview. Your daily progress is unchanged." />
      </div>
      <app-companion-character />
    </div>
    <p class="readout" role="status">{{ motion.variant() }} · {{ motion.state.current() }} · {{ motion.reducedMotion() ? 'Reduced motion' : motion.preferences().lowPowerAnimations ? 'Low power' : 'Full motion' }}</p>
    @if (error()) { <p role="alert">{{ error() }}</p> }
  </section></div>`,
  styles: [`:host { position:fixed;inset:0;z-index:100 } .lab-backdrop { position:absolute;inset:0;display:grid;place-items:center;background:var(--slingsip-backdrop);padding:16px } .lab { width:min(980px,100%);max-height:95vh;overflow:auto;background:var(--slingsip-surface);border:1px solid var(--slingsip-border-accent);border-radius:18px;padding:20px;box-shadow:0 24px 80px var(--slingsip-shadow) } header { display:flex;justify-content:space-between;gap:16px;align-items:center } h2 { margin:0;font-size:22px } p { color:var(--slingsip-text-muted);font-size:12px } nav { display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 } nav button { font-size:11px;padding:8px 12px } .lab-stage { position:relative;height:500px;overflow:hidden;border:1px solid var(--slingsip-border);border-radius:12px;background:radial-gradient(at 55% 60%,var(--slingsip-surface-2),var(--slingsip-bg)) } .preview-bubble { position:absolute;z-index:2;width:300px;pointer-events:none;--tail-x:150px } .readout { margin-bottom:0 } @media(max-height:700px) { .lab-stage { height:420px } }`],
})
export class AnimationLabComponent {
  readonly motion = inject(SwingAnimationService);
  private readonly desktop = inject(DesktopService);
  readonly variants = ENTRY_VARIANTS;
  readonly closed = output();
  readonly error = signal<string | null>(null);
  readonly idle = computed(() => this.motion.state.current() === CharacterState.Reminder);
  readonly showBubble = computed(() => [CharacterState.Reminder,CharacterState.Success,CharacterState.Waiting,CharacterState.DeliveringBottle].includes(this.motion.state.current()));
  readonly heading = computed(() => this.motion.state.current() === CharacterState.Waiting ? 'Okay, I’ll swing back.' : this.motion.state.current() === CharacterState.Success || this.motion.state.current() === CharacterState.DeliveringBottle ? 'Nice! Preview only.' : 'Drink 250 ml');
  readonly bubble = computed(() => { const layout = this.motion.layout(), config = this.motion.config; return {left:layout.reminder.x - config.bubbleWidth / 2,top:Math.max(config.edgePadding,layout.reminder.y - layout.characterHeight * config.gripYRatio - config.bubbleHeight - config.bubbleGap)}; });
  private generation = 0;
  constructor() {
    const visibility = () => this.motion.setActive((this.desktop.snapshot()?.displayActive ?? true) && !document.hidden);
    document.addEventListener('visibilitychange', visibility);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', visibility));
    effect(() => { const snapshot = this.desktop.snapshot(); if (snapshot) untracked(() => { this.motion.configure(snapshot.companionPreferences); this.motion.setActive(snapshot.displayActive && !document.hidden); }); }); }
  async entry(variant: EntryVariant): Promise<void> {
    const generation = ++this.generation; this.motion.cancelCurrentAnimation(); this.error.set(null);
    // Let the aborted previous promise settle before opening a new finite RAF owner.
    await Promise.resolve(); if (generation !== this.generation || !this.motion.beginSession(variant)) return;
    await this.run(async () => { await this.motion.swingIn(); await this.motion.settleAtReminder(); });
  }
  async bottle(): Promise<void> { if (!this.idle()) return; await this.run(async () => { this.motion.state.transition(CharacterState.Success); await this.motion.wait(this.motion.config.successDisplayMs); await this.motion.deliverBottle(); await this.motion.swingOutRight(); this.motion.cancelCurrentAnimation(); }); }
  async success(): Promise<void> { await this.bottle(); }
  async retry(): Promise<void> { if (!this.idle()) return; await this.run(async () => { this.motion.state.transition(CharacterState.Waiting); await this.motion.wait(this.motion.config.waitingDisplayMs); await this.motion.swingBackLeft(); this.motion.cancelCurrentAnimation(); }); }
  cursor(): void { const pose = this.motion.frame().pose; this.motion.lookToward({x:pose.x + 80,y:pose.y + 50}); }
  move(event: MouseEvent): void { const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect(); this.motion.lookToward({x:event.clientX - bounds.left,y:event.clientY - bounds.top}); }
  away(): void { this.motion.lookToward({x:-10000,y:-10000}); }
  private async run(work: () => Promise<void>): Promise<void> { try { await work(); } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) this.error.set(error instanceof Error ? error.message : 'Preview failed.'); } }
}
