import { computed, DestroyRef, effect, inject, Injectable, untracked } from '@angular/core';
import { SwingAnimationService } from './animation/swing-animation.service';
import { DesktopService } from '../../core/services/desktop.service';
import { CompanionVisualHitTestService } from './three/companion-visual-hit-test.service';

@Injectable()
export class CompanionInputService {
  private readonly motion = inject(SwingAnimationService);
  private readonly desktop = inject(DesktopService);
  private readonly visualHitTest = inject(CompanionVisualHitTestService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = computed(() => {
    const overlay = this.desktop.snapshot()?.overlay;
    return `${overlay?.visible ?? false}:${overlay?.layoutRevision ?? 0}:${this.desktop.snapshot()?.displayActive ?? true}:${this.motion.active()}`;
  });
  private stage: HTMLElement | undefined;
  private lastRequested: boolean | undefined;
  private cursorCheck: number | undefined;
  private probing = false;
  private generation = 0;

  constructor() {
    effect(() => {
      this.layout();
      untracked(() => this.refresh());
    });
    this.destroyRef.onDestroy(() => {
      this.cancelProbe();
      this.stopCursorChecks();
      this.desktop.setOverlayInteractive(false);
    });
  }

  connect(stage: HTMLElement): void {
    this.stage = stage;
    const move = (event: MouseEvent) => {
      this.cancelProbe();
      this.hitTest(event.clientX, event.clientY);
    };
    // Native input ownership changes can emit leave while the cursor is still over a target.
    const leave = () => this.refresh();
    const resize = () => this.refresh();
    document.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseleave', leave);
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    stage.querySelectorAll('[data-overlay-interactive]').forEach((target) => observer.observe(target));
    this.refresh();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseleave', leave);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    });
  }

  private refresh(): void {
    this.lastRequested = undefined;
    this.cancelProbe();
    if (!this.stage || !this.desktop.overlayVisible() || !this.motion.active()) {
      this.stopCursorChecks();
      this.requestInteractive(false);
      return;
    }
    // Forwarded movement is primary. Check the real cursor while visible to cover missed
    // native movement/leave events and an already stationary pointer on Windows.
    this.cursorCheck ??= window.setInterval(() => this.probeCursor(), 200);
    // Layout is read after Angular's update without starting an idle RAF loop.
    queueMicrotask(() => this.probeCursor());
  }

  refreshTargets(): void { this.refresh(); }

  private probeCursor(): void {
    if (this.probing || !this.desktop.overlayVisible() || !this.motion.active() || this.destroyRef.destroyed) return;
    this.probing = true;
    const generation = this.generation;
    void this.desktop.getCursorPosition().then((point) => {
      if (point && generation === this.generation && !this.destroyRef.destroyed) this.hitTest(point.x, point.y);
    }).catch(() => {
      if (generation === this.generation && !this.destroyRef.destroyed) this.requestInteractive(false);
    }).finally(() => { this.probing = false; });
  }

  private stopCursorChecks(): void {
    if (this.cursorCheck !== undefined) clearInterval(this.cursorCheck);
    this.cursorCheck = undefined;
  }

  private hitTest(x: number, y: number): void {
    this.motion.lookToward({x,y});
    const target = document.elementFromPoint(x, y)?.closest('[data-overlay-interactive]');
    this.requestInteractive(this.motion.active() && this.desktop.overlayVisible() && ((!!target && !!this.stage?.contains(target)) || this.visualHitTest.hit(x,y)));
  }

  private requestInteractive(value: boolean): void {
    if (value === this.lastRequested) return;
    this.lastRequested = value;
    this.desktop.setOverlayInteractive(value);
  }

  private cancelProbe(): void {
    this.generation += 1;
  }
}
