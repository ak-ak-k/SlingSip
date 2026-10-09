import { initialUpdateSnapshot, type UpdateSnapshot } from '../shared/update-contract';

export type UpdateEvent =
  | { type: 'available'; version: string; releaseName?: string | null; releaseNotes?: string | null }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error' };

export interface UpdateBackend {
  subscribe(listener: (event: UpdateEvent) => void): () => void;
  check(): Promise<void>;
  download(): Promise<void>;
  install(): void;
  cancel(): void;
}

export interface UpdateClock {
  now(): Date;
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(timer: unknown): void;
}
export const UPDATE_STARTUP_DELAY_MS = 30_000;
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const clock: UpdateClock = { now: () => new Date(), setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) };
const text = (value: string | null | undefined, limit: number) => value?.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, limit) || null;

/** Independent of hydration: owns only update state, network operations and an occasional check timer. */
export class UpdateService {
  private state: UpdateSnapshot;
  private timer: unknown;
  private unsubscribe?: () => void;
  private stopped = false;
  private started = false;

  constructor(private readonly options: {
    currentVersion: string; backend?: UpdateBackend; disabledReason?: string; automaticChecking?: boolean;
    changed(): void; persist(): void; canInstall(): boolean; clock?: UpdateClock;
  }) {
    this.state = initialUpdateSnapshot(options.currentVersion, !!options.backend, options.disabledReason ?? null,
      !!options.backend && (options.automaticChecking ?? true));
    this.unsubscribe = options.backend?.subscribe(event => this.receive(event));
  }
  snapshot(): UpdateSnapshot { return { ...this.state }; }
  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    if (this.state.automaticChecking) this.schedule(UPDATE_STARTUP_DELAY_MS);
  }
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== undefined) this.time.clearTimeout(this.timer);
    this.timer = undefined;
    this.unsubscribe?.(); this.unsubscribe = undefined;
    this.options.backend?.cancel();
  }
  async check(): Promise<void> {
    if (!this.operational() || ['checking', 'downloading', 'downloaded'].includes(this.state.status) || this.state.installing) return;
    this.update({ status: 'checking', errorMessage: null, failureStage: null, availableVersion: null,
      downloadProgress: null, releaseName: null, releaseNotes: null, lastCheckedAt: this.time.now().toISOString() });
    try { await this.options.backend!.check(); }
    catch { if (!this.stopped && this.state.status === 'checking') this.failed('check'); }
  }
  async download(): Promise<void> {
    if (!this.operational() || this.state.installing || !(this.state.status === 'available'
      || this.state.status === 'error' && this.state.failureStage === 'download')) return;
    this.update({ status: 'downloading', downloadProgress: null, errorMessage: null, failureStage: null });
    try { await this.options.backend!.download(); }
    catch { if (!this.stopped && this.snapshot().status === 'downloading') this.failed('download'); }
  }
  install(): void {
    if (!this.operational() || this.state.status !== 'downloaded' || this.state.installing) return;
    if (!this.options.canInstall()) {
      this.update({ errorMessage: 'Finish the current water break before restarting to update.', failureStage: 'install' });
      return;
    }
    try { this.options.persist(); }
    catch {
      this.update({ errorMessage: 'Your current state could not be saved. SlingSip was kept open; try again after resolving the storage error.', failureStage: 'install' });
      return;
    }
    this.update({ installing: true, errorMessage: null, failureStage: null });
    // Let the updater initiate quit; existing before-quit cleanup runs only if handoff succeeds.
    try { this.options.backend!.install(); }
    catch { this.failed('install'); }
  }
  private get time(): UpdateClock { return this.options.clock ?? clock; }
  private operational(): boolean { return !this.stopped && !!this.options.backend; }
  private schedule(delay: number): void {
    this.timer = this.time.setTimeout(() => {
      this.timer = undefined;
      if (this.stopped) return;
      void this.check();
      this.schedule(UPDATE_CHECK_INTERVAL_MS);
    }, delay);
  }
  private receive(event: UpdateEvent): void {
    if (!this.operational()) return;
    switch (event.type) {
      case 'available':
        if (this.state.status === 'checking') this.update({ status: 'available', availableVersion: text(event.version, 256),
          releaseName: text(event.releaseName, 160), releaseNotes: text(event.releaseNotes, 1600) });
        break;
      case 'not-available':
        if (this.state.status === 'checking') this.update({ status: 'not-available' });
        break;
      case 'progress':
        if (this.state.status === 'downloading' && Number.isFinite(event.percent)) {
          const progress = Math.max(0, Math.min(100, Math.floor(event.percent)));
          if (progress !== this.state.downloadProgress) this.update({ downloadProgress: progress });
        }
        break;
      case 'downloaded':
        if (this.state.status === 'downloading' && event.version === this.state.availableVersion) this.update({ status: 'downloaded', downloadProgress: 100 });
        break;
      case 'error':
        if (this.state.installing) this.failed('install');
        else if (this.state.status === 'checking') this.failed('check');
        else if (this.state.status === 'downloading') this.failed('download');
    }
  }
  private failed(stage: 'check' | 'download' | 'install'): void {
    this.update({ status: stage === 'install' ? 'downloaded' : 'error', failureStage: stage, installing: false,
      errorMessage: stage === 'check' ? 'SlingSip could not check for updates. Please try again later.'
        : stage === 'download' ? 'The update could not be downloaded or verified. Please try again later.'
        : 'The update could not be started. SlingSip was kept open; please try again.' });
  }
  private update(change: Partial<UpdateSnapshot>): void { this.state = { ...this.state, ...change }; this.options.changed(); }
}
