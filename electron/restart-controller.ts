export interface RestartOperations {
  persist(): void;
  cleanup(): void;
  relaunch(): void;
  exit(): void;
  failed(error: unknown): void;
}

/** Main-owned, reusable by the tray, development supervisor or a future updater. */
export class RestartController {
  private restarting = false;
  constructor(private readonly operations: RestartOperations) {}

  restart(): boolean {
    if (this.restarting) return false;
    // Storage errors must leave the running session intact instead of discarding it.
    try { this.operations.persist(); }
    catch (error) { this.operations.failed(error); return false; }
    this.restarting = true;
    this.operations.cleanup();
    this.operations.relaunch();
    this.operations.exit();
    return true;
  }
}
