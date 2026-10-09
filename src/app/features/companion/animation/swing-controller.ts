import { advanceSwing } from './swing-motion';
import { abortError } from './webm-player';
export interface FrameClock { request(callback: FrameRequestCallback): number; cancel(id: number): void }
/** Owns one finite RAF at a time. Pause cancels RAF and discards inactive wall-clock time. */
export class SwingController {
  private frame?: number;
  private active = true;
  private tick?: FrameRequestCallback;
  private resumeTick?: () => void;
  private completeRun?: () => void;
  constructor(private readonly clock: FrameClock = { request: cb => requestAnimationFrame(cb), cancel: id => cancelAnimationFrame(id) }) {}
  /** A live reduced-motion change finishes the current phase without cancelling its business flow. */
  complete(): void { this.completeRun?.(); }
  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (!active && this.frame !== undefined) { this.clock.cancel(this.frame); this.frame = undefined; }
    if (active) this.resumeTick?.();
  }
  run(duration: number, signal: AbortSignal, update: (progress: number) => void, fps = Infinity): Promise<void> {
    if (this.tick) return Promise.reject(new Error('A swing is already running.'));
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      let elapsed = 0, previous: number | undefined, rendered = -Infinity;
      const finish = (cancelled: boolean) => {
        if (this.frame !== undefined) this.clock.cancel(this.frame);
        this.frame = undefined; this.tick = undefined; this.resumeTick = undefined; this.completeRun = undefined;
        signal.removeEventListener('abort', abort);
        cancelled ? reject(abortError()) : resolve();
      };
      const abort = () => finish(true);
      this.completeRun = () => { update(1); finish(false); };
      const schedule = () => { if (this.active && this.tick && this.frame === undefined) this.frame = this.clock.request(this.tick); };
      this.tick = timestamp => {
        this.frame = undefined;
        if (signal.aborted) { finish(true); return; }
        elapsed = advanceSwing(elapsed, previous === undefined ? 0 : timestamp - previous, duration); previous = timestamp;
        if (elapsed >= duration || timestamp - rendered >= 1000 / fps) { rendered = timestamp; update(elapsed / duration); }
        if (elapsed >= duration) finish(false); else schedule();
      };
      this.resumeTick = () => { previous = undefined; schedule(); };
      signal.addEventListener('abort', abort, { once: true });
      update(0); schedule();
    });
  }
}
