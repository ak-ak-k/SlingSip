import { type UpdateBackend, type UpdateEvent } from './update-service';

/** Isolated main-process test driver. Main never creates/exposes this in a packaged application. */
export class UpdateTestDriver implements UpdateBackend {
  listener?: (event: UpdateEvent) => void;
  result: 'available' | 'not-available' | 'error' = 'available';
  version = '2.0.0';
  installCount = 0;
  checkCount = 0;
  downloadCount = 0;
  installFails = false;
  private downloadDone?: () => void;
  subscribe(listener: (event: UpdateEvent) => void): () => void { this.listener = listener; return () => { this.listener = undefined; }; }
  async check(): Promise<void> {
    this.checkCount++;
    this.emit(this.result === 'available' ? { type: 'available', version: this.version, releaseName: 'Temporary update test',
      releaseNotes: 'Development-only simulated release. No installer is downloaded.' } : { type: this.result });
  }
  download(): Promise<void> { this.downloadCount++; return new Promise(resolve => { this.downloadDone = resolve; }); }
  install(): void { this.installCount++; if (this.installFails) this.emit({ type: 'error' }); }
  emit(event: UpdateEvent): void { this.listener?.(event); if (event.type === 'downloaded' || event.type === 'error') { this.downloadDone?.(); this.downloadDone = undefined; } }
  cancel(): void { this.downloadDone?.(); this.listener = undefined; }
}
