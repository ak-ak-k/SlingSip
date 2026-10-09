import { computed, effect, untracked, DestroyRef, inject, Injectable, NgZone, signal } from '@angular/core';
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from '../../../../../shared/companion-preferences';
import { CharacterStateService } from './character-state.service';
import { CharacterState } from './character.model';
import { SWING_CONFIG } from './swing-config';
import { artworkPoint, deliveryPose, settleSample, swingLayout, swingSample, type Point, type SwingSample } from './swing-motion';
import { chooseEntryVariant, entryDuration, entrySample, type EntryVariant } from './entry-variants';
import { SwingController } from './swing-controller';
import { AudioService } from './audio.service';
import { abortError } from './webm-player';
import type { VisualRectangle } from './companion-placement';
export interface MotionFrame { pose: SwingSample; bottleProgress: number | null; progress: number }
@Injectable()
export class CompanionMotionService {
  readonly state = inject(CharacterStateService);
  readonly config = SWING_CONFIG;
  readonly audio = inject(AudioService);
  private readonly zone = inject(NgZone);
  readonly ready = signal(false);
  readonly viewport = signal({ width: 0, height: 0 });
  private readonly dashboardBounds = signal<VisualRectangle | null>(null);
  private pendingDashboardBounds: VisualRectangle | null = null;
  readonly layout = computed(() => swingLayout(this.viewport().width, this.viewport().height, this.dashboardBounds()));
  readonly dimensions = computed(() => ({ width: this.layout().characterWidth, height: this.layout().characterHeight }));
  readonly pose = signal<SwingSample>({ x: 0, y: 0, anchor: { x: 0, y: 0 }, rotation: 0, scarf: 0, frontLeg: 0, rearLeg: 0, arm: 0, head: 0 });
  readonly x = computed(() => this.pose().x);
  readonly error = signal<string | null>(null);
  readonly bottleProgress = signal<number | null>(null);
  readonly moving = signal(false);
  readonly active = signal(true);
  readonly preferences = signal<CompanionPreferences>({ ...DEFAULT_COMPANION_PREFERENCES }, {equal:(a,b) =>
    a.soundEffects === b.soundEffects && a.soundVolume === b.soundVolume && a.lowPowerAnimations === b.lowPowerAnimations && a.cursorAwareness === b.cursorAwareness && a.characterReactions === b.characterReactions});
  readonly variant = signal<EntryVariant>('classic');
  readonly reducedMotion = signal(false);
  private readonly motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  private controller?: AbortController;
  private readonly driver = new SwingController();
  private previousVariant?: EntryVariant;
  private entryCued = false;
  private phaseProgress = 0;
  private latest: MotionFrame = { pose: this.pose(), bottleProgress: null, progress:0 };
  private listeners = new Set<(frame: MotionFrame) => void>();
  private lastClick = -Infinity;
  private clickCount = 0;
  private viewListeners = new Set<(look: Point, reaction?: string) => void>();
  private look: Point = { x: 0, y: 0 };
  constructor() {
    effect(() => { if (this.state.current() === CharacterState.Success) untracked(() => this.audio.play('success')); });
    const destroy = inject(DestroyRef), query = this.motionQuery;
    this.reducedMotion.set(query.matches);
    const change = () => { this.reducedMotion.set(query.matches); this.resetLook(); if (query.matches) this.driver.complete(); };
    query.addEventListener('change', change);
    destroy.onDestroy(() => { this.cancelCurrentAnimation(); query.removeEventListener('change', change); this.listeners.clear(); this.viewListeners.clear(); });
  }
  frame(): MotionFrame { return this.latest; }
  onFrame(listener: (frame: MotionFrame) => void): () => void { this.listeners.add(listener); listener(this.latest); return () => this.listeners.delete(listener); }
  onView(listener: (look: Point, reaction?: string) => void): () => void { this.viewListeners.add(listener); listener(this.look); return () => this.viewListeners.delete(listener); }
  configure(preferences: CompanionPreferences): void { this.preferences.set({ ...preferences }); this.audio.configure(preferences, this.active()); if (!preferences.cursorAwareness || preferences.lowPowerAnimations) this.resetLook(); }
  setActive(active: boolean): void { this.active.set(active); this.driver.setActive(active); this.audio.configure(this.preferences(), active); if (!active) this.resetLook(); else this.cueEntry(); }
  setDashboardBounds(bounds: VisualRectangle | null): void {
    this.pendingDashboardBounds = bounds;
    // Freeze placement for each interaction: moving a window must not teleport a swinging body.
    if (!this.controller) this.dashboardBounds.set(bounds);
  }
  resize(width: number, height: number): void {
    this.viewport.set({ width, height });
    if (!this.moving() && this.state.visible()) this.publish({ ...this.latest.pose, ...this.layout().reminder, anchor: entrySample(this.layout(), this.variant(), 1).anchor }, null, true);
    this.ready.set(width > 0 && height > 0);
  }
  beginSession(forced?: EntryVariant): boolean {
    if (this.controller || !this.ready()) return false;
    // Hidden renderers can defer media-query change events; read the current preference on entry.
    this.reducedMotion.set(this.motionQuery.matches);
    this.dashboardBounds.set(this.pendingDashboardBounds);
    this.controller = new AbortController(); this.error.set(null); this.clickCount = 0; this.lastClick = -Infinity; this.entryCued = false;
    const next = forced ?? chooseEntryVariant(Math.random(), this.previousVariant);
    this.variant.set(next); this.previousVariant = next; return true;
  }
  async swingIn(): Promise<void> {
    this.state.face('right'); this.resetLook();
    const variant = this.variant(), reduced = this.reducedMotion();
    this.publish(entrySample(this.layout(), variant, reduced ? 1 : 0), null, true);
    this.state.transition(CharacterState.SwingingIn); this.cueEntry();
    await this.animate(entryDuration(variant), t => this.publish(entrySample(this.layout(), variant, t)));
  }
  async settleAtReminder(): Promise<void> {
    this.state.transition(CharacterState.Arriving); const from = this.latest.pose;
    await this.animate(this.config.settleDurationMs, t => this.publish(settleSample(this.layout(), from, t)));
    this.state.transition(CharacterState.Reminder); this.audio.play('bubble');
  }
  async deliverBottle(): Promise<void> {
    this.resetLook(); this.state.transition(CharacterState.DeliveringBottle);
    const from = this.latest.pose; this.bottleProgress.set(0); let clink = false;
    try { await this.animate(this.config.bottleDurationMs, t => { this.publish(deliveryPose(from, t), t); if (t >= this.config.bottleCastRatio && !clink) { clink = true; this.audio.play('bottle'); } }); }
    finally { this.bottleProgress.set(null); this.publish(this.latest.pose, null, true); }
  }
  async swingOutRight(): Promise<void> { await this.exit('right', CharacterState.SwingingOutRight, this.config.successExitDurationMs); }
  async swingBackLeft(): Promise<void> { await this.exit('left', CharacterState.SwingingBackLeft, this.config.backExitDurationMs); }
  cancelCurrentAnimation(): void {
    this.controller?.abort(); this.controller = undefined; this.moving.set(false); this.bottleProgress.set(null); this.state.reset(); this.publish(this.latest.pose, null, true); this.resetLook(); this.audio.stop();
  }
  lookToward(point: Point): void {
    const preferences = this.preferences();
    if (!this.active() || this.reducedMotion() || preferences.lowPowerAnimations || !preferences.cursorAwareness || this.state.current() !== CharacterState.Reminder) { this.resetLook(); return; }
    const head = artworkPoint(this.layout(), this.latest.pose, 80, 55), dx = point.x - head.x, dy = point.y - head.y;
    const distance = Math.hypot(dx, dy), q = this.config.cursorQuantization;
    const next = distance > this.config.cursorRadius ? { x: 0, y: 0 } : { x: Math.round(dx / this.config.cursorRadius * q) / q, y: Math.round(dy / this.config.cursorRadius * q) / q };
    if (next.x !== this.look.x || next.y !== this.look.y) { this.look = next; this.viewListeners.forEach(listener => listener(next)); }
  }
  reactToClick(): void {
    if (!this.active() || this.state.current() !== CharacterState.Reminder || !this.preferences().characterReactions) return;
    const now = performance.now(), rapid = now - this.lastClick < this.config.rapidClickMs;
    this.clickCount = now - this.lastClick > this.config.clickSequenceMs ? 1 : this.clickCount + 1; this.lastClick = now;
    const reaction = rapid && this.clickCount >= 3 ? 'annoyed' : this.clickCount === 1 ? 'nod' : 'playful';
    this.viewListeners.forEach(listener => listener(this.look, reaction));
  }
  private resetLook(): void { this.look = { x: 0, y: 0 }; this.viewListeners.forEach(listener => listener(this.look)); }
  private cueEntry(): void {
    if (!this.active() || this.entryCued || this.state.current() !== CharacterState.SwingingIn) return;
    this.entryCued = true; this.audio.play('attach'); this.audio.play('swing');
  }
  private publish(pose: SwingSample, bottleProgress: number | null = null, boundary = false): void {
    this.latest = { pose, bottleProgress, progress:this.phaseProgress }; if (boundary) this.pose.set(pose); this.listeners.forEach(listener => listener(this.latest));
  }
  private async exit(phase: 'right' | 'left', state: CharacterState, duration: number): Promise<void> {
    this.resetLook(); this.state.face(phase); const from = this.latest.pose;
    this.state.transition(state); this.audio.play('attach'); this.audio.play('swing');
    if (this.reducedMotion()) await this.wait(this.config.bubbleAppearMs);
    else await this.animate(duration, t => this.publish(swingSample(this.layout(), phase, t, from)));
    this.state.transition(CharacterState.Hidden); this.audio.stop();
  }
  wait(duration: number): Promise<void> {
    const signal = this.controller?.signal; if (!signal || signal.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
      const timer = window.setTimeout(finish, duration);
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(abortError()); };
      signal.addEventListener('abort', abort, {once:true});
    });
  }
  private async animate(duration: number, update: (t: number) => void): Promise<void> {
    const signal = this.controller?.signal;
    if (!signal || signal.aborted) throw abortError();
    const present = (t:number) => { this.phaseProgress=t;update(t); };
    if (this.reducedMotion()) { present(1); this.pose.set(this.latest.pose); return; }
    this.moving.set(true);
    try { await this.zone.runOutsideAngular(() => this.driver.run(duration, signal, present, this.preferences().lowPowerAnimations ? this.config.lowPowerFps : Infinity)); }
    finally { this.moving.set(false); this.pose.set(this.latest.pose); }
  }
}
