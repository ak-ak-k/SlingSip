import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { DesktopService } from '../../core/services/desktop.service';
import { LocalProfileService } from '../../core/services/local-profile.service';
import { HydrationService } from '../../core/services/hydration.service';
import { SwingAnimationService } from './animation/swing-animation.service';
import { CharacterState } from './animation/character.model';

@Injectable()
export class ReminderInteractionService {
  readonly hydration = inject(HydrationService);
  private readonly desktop = inject(DesktopService);
  private readonly profile = inject(LocalProfileService);
  private readonly animation = inject(SwingAnimationService);
  private readonly active = signal(false);
  private readonly added = signal(0);
  private readonly pending = signal(false);
  private readonly ignored = signal(false);
  readonly reminderActive = this.active.asReadonly();
  readonly retryCount = computed(() => this.desktop.snapshot()?.reminderRetry.count ?? 0);
  readonly busy = this.pending.asReadonly();
  readonly error = signal<string | null>(null);
  readonly success = computed(() => [CharacterState.Success, CharacterState.DeliveringBottle].includes(this.animation.state.current()));
  readonly bubbleVisible = computed(() => this.active() && ([CharacterState.Reminder, CharacterState.Waiting].includes(this.animation.state.current()) || this.success()));
  readonly canDrink = computed(() => this.active() && this.animation.state.current() === CharacterState.Reminder && !this.pending());
  readonly canPostpone = this.canDrink;
  readonly heading = computed(() => {
    if (this.success()) return this.hydration.goalCompleted() ? 'Daily goal complete! 💧' : this.added() > 0 ? `Nice! +${this.added()} ml 💧` : 'Already logged. 💧';
    if (this.animation.state.current() === CharacterState.Waiting) return this.ignored() ? 'Still waiting... 💧' : "Okay, I’ll swing back.";
    return `Drink ${this.hydration.glassSize()} ml`;
  });
  readonly message = computed(() => {
    if (this.success()) return this.hydration.goalCompleted() ? (this.profile.name() ? 'Nice work, ' + this.profile.name() + '! Your daily water goal is reached.' : 'Your daily water goal is reached.') : 'A little closer to your daily goal.';
    if (this.animation.state.current() === CharacterState.Waiting) {
      const seconds = (this.desktop.snapshot()?.reminderTiming.retryIntervalMs ?? 300000) / 1000;
      return seconds < 60 ? `I’ll check on you again in ${seconds} seconds.` : `I’ll check on you again in ${seconds / 60} ${seconds === 60 ? 'minute' : 'minutes'}.`;
    }
    return this.profile.name() && this.revision % 3 === 0 ? 'Hydration check, ' + this.profile.name() + '.' : 'Time to hydrate. Your sidekick is here.';
  });
  readonly bubblePosition = computed(() => {
    return this.animation.layout().bubble;
  });
  private controller: AbortController | undefined;
  private revision = 0;
  private timer: number | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
    const retryMs = computed(() => this.desktop.snapshot()?.reminderTiming.retryIntervalMs ?? 300000);
    effect(() => {
      retryMs();
      untracked(() => { if (this.controller && this.canDrink()) this.scheduleIgnore(this.controller); });
    });
    effect(() => {
      const credit = this.desktop.snapshot()?.creditedReminder;
      const allowed = this.desktop.snapshot()?.scheduler;
      const canDrink = this.canDrink();
      untracked(() => {
        if (this.active() && allowed && (!allowed.remindersEnabled || allowed.remindersPaused)) this.cancel();
        else if (credit?.revision === this.revision && canDrink && this.controller) {
          const controller = this.controller;
          this.pending.set(true);
          this.added.set(credit.addedWater);
          void this.showSuccess(controller).catch((error: unknown) => this.fail(error, controller));
        }
      });
    });
  }

  async start(visibilityRevision: number): Promise<void> {
    if (this.active() || !this.animation.beginSession()) return;
    const controller = new AbortController();
    this.controller = controller;
    this.revision = visibilityRevision;
    this.active.set(true);
    this.added.set(0);
    this.error.set(null);
    this.pending.set(true);
    try {
      await this.animation.swingIn();
      await this.animation.settleAtReminder();
      if (!this.owns(controller)) return;
      const credit = this.desktop.snapshot()?.creditedReminder;
      if (this.hydration.goalCompleted() || credit?.revision === this.revision) {
        if (credit?.revision === this.revision) this.added.set(credit.addedWater);
        await this.showSuccess(controller);
      } else {
        this.pending.set(false);
        this.scheduleIgnore(controller);
      }
    } catch (error) { await this.fail(error, controller); }
  }

  async drankIt(): Promise<void> {
    const controller = this.controller;
    if (!controller || !this.canDrink()) return;
    this.cancelTimer();
    this.pending.set(true);
    this.error.set(null);
    try {
      // Canonical main-process intake persists immediately, before any success animation.
      const added = await this.hydration.drink(this.revision);
      if (!this.owns(controller)) return;
      this.added.set(added);
      await this.showSuccess(controller).catch((error: unknown) => this.fail(error, controller));
    } catch (error) {
      if (this.owns(controller)) {
        this.error.set(this.errorMessage(error));
        this.pending.set(false);
        this.scheduleIgnore(controller);
      }
    }
  }

  async remindLater(): Promise<void> {
    const controller = this.controller;
    if (!controller || !this.canPostpone()) return;
    await this.leaveForRetry(controller, false).catch((error: unknown) => this.fail(error, controller));
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.cancelTimer();
    this.active.set(false);
    this.pending.set(false);
    this.animation.cancelCurrentAnimation();
  }

  private async showSuccess(controller: AbortController): Promise<void> {
    this.cancelTimer();
    this.animation.state.transition(CharacterState.Success);
    await this.wait(this.animation.config.successDisplayMs, controller);
    await this.animation.deliverBottle();
    await this.animation.swingOutRight();
    if (!this.owns(controller)) return;
    const revision = this.revision;
    this.cancel();
    await this.desktop.finishCharacterTest(revision);
  }

  private async leaveForRetry(controller: AbortController, ignored: boolean): Promise<void> {
    this.cancelTimer();
    this.pending.set(true);
    this.ignored.set(ignored);
    this.animation.state.transition(CharacterState.Waiting);
    await this.wait(this.animation.config.waitingDisplayMs, controller);
    if (!this.owns(controller)) return;
    const credit = this.desktop.snapshot()?.creditedReminder;
    if (credit?.revision === this.revision) {
      this.added.set(credit.addedWater);
      await this.showSuccess(controller);
      return;
    }
    await this.animation.swingBackLeft();
    if (!this.owns(controller)) return;
    await this.desktop.suspendReminder(this.revision);
    // Native hide cancels local work. Main owns the only return timer while hidden.
  }

  private scheduleIgnore(controller: AbortController): void {
    this.cancelTimer();
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      if (this.owns(controller)) void this.leaveForRetry(controller, true).catch((error: unknown) => this.fail(error, controller));
    }, this.desktop.snapshot()?.reminderTiming.retryIntervalMs ?? 300000);
  }
  private wait(duration: number, controller: AbortController): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.owns(controller)) { reject(new DOMException('Canceled', 'AbortError')); return; }
      const abort = () => { this.cancelTimer(); reject(new DOMException('Canceled', 'AbortError')); };
      controller.signal.addEventListener('abort', abort, { once: true });
      this.timer = window.setTimeout(() => { this.timer = undefined; controller.signal.removeEventListener('abort', abort); resolve(); }, duration);
    });
  }
  private cancelTimer(): void { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; }
  private owns(controller: AbortController): boolean { return this.controller === controller && !controller.signal.aborted; }
  private async fail(error: unknown, controller: AbortController): Promise<void> {
    if (!this.owns(controller)) return;
    this.error.set(this.errorMessage(error));
    console.error('Reminder interaction failed.', error);
    const revision = this.revision;
    this.cancel();
    await this.desktop.finishReminder(revision).catch(console.error);
  }
  private errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
}
