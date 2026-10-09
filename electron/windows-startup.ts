import { app } from 'electron';
import { type StartupStatus } from '../shared/product-contract';

/** The repository launch uses local built assets, so login never needs the dev server. */
export class WindowsStartup {
  private current: StartupStatus;
  private readonly executable = process.execPath;
  // Electron's Windows command-line builder quotes spaced arguments itself.
  private readonly args = app.isPackaged ? ['--autostart'] : [app.getAppPath(), '--autostart'];
  private readonly name: string;

  constructor(testMode: boolean) {
    const isolatedLoginTest = testMode && process.argv.includes('--companion-test-login-items');
    // Retain the existing Run entry and OS approval after the SlingSip rename.
    this.name = isolatedLoginTest ? `Mizu-Test-${app.getPath('userData').split(/[\\/]/).pop()}` : 'Mizu';
    this.current = { supported: process.platform === 'win32' && (!testMode || isolatedLoginTest), enabled: false,
      error: process.platform !== 'win32' ? 'Launch at startup is available on Windows.'
        : testMode && !isolatedLoginTest ? 'Startup registration is disabled in isolated tests.' : null };
    this.refresh();
  }

  snapshot(): StartupStatus { return { ...this.current }; }

  refresh(): StartupStatus {
    if (!this.current.supported) return this.snapshot();
    try {
      // Older Electron versions compare a quoted executable differently. Inspect our own
      // named entry and its approval rather than another app that uses electron.exe.
      const results = [this.executable, `"${this.executable}"`].map((path) => app.getLoginItemSettings({ path, args: this.args }));
      const item = results.flatMap((result) => result.launchItems).find((entry) => entry.name === this.name && entry.scope === 'user');
      const unquote = (value: string) => value.replace(/^"|"$/g, '');
      const matches = item && unquote(item.path).toLowerCase() === this.executable.toLowerCase()
        // Electron launchItems.args contains positional arguments only, omitting switches.
        && item.args.map(unquote).join('\0') === this.args.filter((argument) => !argument.startsWith('--')).map(unquote).join('\0');
      this.current = { supported: true, enabled: !!matches && !!item.enabled, error: null };
    } catch {
      this.current.error = 'Windows startup status could not be read. Try saving again.';
    }
    return this.snapshot();
  }

  setEnabled(enabled: boolean): void {
    if (!this.current.supported) {
      if (!enabled) return;
      throw new Error(this.current.error ?? 'Windows startup is unavailable.');
    }
    try {
      app.setLoginItemSettings({ name: this.name, path: this.executable, args: this.args, openAtLogin: enabled, enabled });
      const actual = this.refresh();
      if (actual.error || actual.enabled !== enabled) throw new Error('Verification failed');
    } catch {
      this.refresh();
      this.current.error = 'Windows could not update startup. Check Windows Settings > Apps > Startup and try again.';
      throw new Error(this.current.error);
    }
  }
}
