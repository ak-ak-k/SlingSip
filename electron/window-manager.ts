import { BrowserWindow, screen, type WebPreferences } from 'electron';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
import { type WindowRole } from '../shared/desktop-contract';
import { DESKTOP_CHANNELS } from '../shared/desktop-contract';
import { type DashboardPage } from '../shared/product-contract';
import { getCompanionBounds } from './window-geometry';
import { WINDOW_TITLE } from './app-identity';
import { trayIcon } from './tray-icon';

interface WindowResources {
  preload: string;
  rendererFile: string;
  developmentUrl?: string;
}

export class DesktopWindows extends EventEmitter<{ changed: [] }> {
  dashboard: BrowserWindow | undefined;
  companion: BrowserWindow | undefined;
  interactive = false;
  layoutRevision = 0;
  visibilityRevision = 0;
  quitting = false;
  private openingDashboard: Promise<BrowserWindow> | undefined;
  private openingCompanion: Promise<BrowserWindow> | undefined;
  private visibilityChange: Promise<void> = Promise.resolve();
  private readonly failedRenderers = new WeakSet<BrowserWindow>();

  constructor(private readonly resources: WindowResources) {
    super();
    if (resources.developmentUrl) {
      const url = new URL(resources.developmentUrl);
      if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
        throw new Error('The development renderer must use a local HTTP server.');
      }
    }
  }

  isTrustedRenderer(window: BrowserWindow, url: string): boolean {
    const role = window === this.dashboard ? 'dashboard' : 'companion';
    const entryUrl = this.rendererUrl(role);
    const candidate = new URL(url);
    const hashes = role === 'dashboard' ? ['#/dashboard', '#/dashboard/history', '#/dashboard/settings'] : ['#/companion'];
    if (!hashes.includes(candidate.hash)) return false;
    candidate.hash = '';
    const entry = new URL(entryUrl);
    entry.hash = '';
    return candidate.toString() === entry.toString()
      || (!this.resources.developmentUrl && candidate.toString() === new URL('./', entry).toString());
  }

  async ensureCompanion(): Promise<BrowserWindow> {
    if (this.quitting) throw new Error('SlingSip is shutting down.');
    if (this.openingCompanion) return this.openingCompanion;
    if (this.companion && this.usable(this.companion)) return this.companion;
    this.companion?.destroy();
    this.openingCompanion = this.createCompanion();
    try { return await this.openingCompanion; }
    finally { this.openingCompanion = undefined; }
  }

  setCompanionVisible(visible: boolean, expectedVisibilityRevision?: number): Promise<void> {
    const change = this.visibilityChange.then(() => {
      if (expectedVisibilityRevision !== undefined && this.visibilityRevision !== expectedVisibilityRevision) return;
      return this.applyCompanionVisibility(visible);
    });
    this.visibilityChange = change.catch(() => {});
    return change;
  }

  private async applyCompanionVisibility(visible: boolean): Promise<void> {
    if (this.quitting) return;
    if (visible) {
      const window = await this.ensureCompanion();
      if (!window.isVisible()) {
        this.positionCompanion();
        this.setInteractive(false);
        window.showInactive();
      }
      window.moveTop();
    } else {
      if (this.openingCompanion) await this.openingCompanion;
      if (this.companion && this.usable(this.companion)) this.companion.hide();
      this.setInteractive(false);
    }
  }

  setInteractive(value: boolean): void {
    const window = this.companion;
    if (!window || window.isDestroyed()) return;
    const next = value && window.isVisible() && !this.failedRenderers.has(window);
    // Forward movement while passing clicks through, so targets can become interactive again.
    window.setIgnoreMouseEvents(!next, { forward: true });
    if (next !== this.interactive) {
      this.interactive = next;
      this.emit('changed');
    }
  }

  positionCompanion(): void {
    const window = this.companion;
    if (!window || window.isDestroyed()) return;
    window.setBounds(getCompanionBounds(screen.getPrimaryDisplay().workArea));
    this.setInteractive(false);
    // Also reprobe a stationary cursor after scale changes that leave DIP bounds unchanged.
    this.layoutRevision += 1;
    this.emit('changed');
  }

  async openDashboard(page?: DashboardPage): Promise<void> {
    if (this.quitting) return;
    if (this.openingDashboard) {
      await this.openingDashboard;
      return this.openDashboard(page);
    }
    if (this.dashboard && this.usable(this.dashboard)) {
      if (this.dashboard.isMinimized()) this.dashboard.restore();
      this.dashboard.show();
      this.dashboard.focus();
      if (page) this.dashboard.webContents.send(DESKTOP_CHANNELS.navigate, page);
      return;
    }
    this.dashboard?.destroy();
    this.openingDashboard = this.createDashboard();
    try { await this.openingDashboard; }
    finally { this.openingDashboard = undefined; }
    if (page && this.dashboard && !this.dashboard.isDestroyed()) this.dashboard.webContents.send(DESKTOP_CHANNELS.navigate, page);
  }

  private usable(window: BrowserWindow | undefined): boolean {
    return !!window && !window.isDestroyed() && !this.failedRenderers.has(window);
  }

  destroyAll(): void {
    this.quitting = true;
    for (const window of [this.companion, this.dashboard]) if (window && !window.isDestroyed()) window.destroy();
  }

  private async createCompanion(): Promise<BrowserWindow> {
    const window = new BrowserWindow({
      ...getCompanionBounds(screen.getPrimaryDisplay().workArea),
      title: WINDOW_TITLE,
      icon: trayIcon(),
      show: false,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      hasShadow: false,
      thickFrame: false,
      roundedCorners: false,
      backgroundColor: '#00000000',
      webPreferences: this.webPreferences('companion'),
    });
    this.companion = window;
    this.layoutRevision += 1;
    window.setIgnoreMouseEvents(true, { forward: true });
    window.on('show', () => { this.visibilityRevision += 1; this.emit('changed'); });
    window.on('hide', () => { this.visibilityRevision += 1; this.setInteractive(false); this.emit('changed'); });
    window.on('close', (event) => {
      if (!this.quitting) { event.preventDefault(); window.hide(); }
    });
    window.on('closed', () => {
      if (this.companion === window) { this.companion = undefined; this.interactive = false; this.visibilityRevision += 1; }
      this.emit('changed');
    });
    await this.loadWindow(window, 'companion');
    this.emit('changed');
    return window;
  }

  private async createDashboard(): Promise<BrowserWindow> {
    const area = screen.getPrimaryDisplay().workArea;
    const width = Math.min(1160, area.width);
    const height = Math.min(820, area.height);
    const window = new BrowserWindow({
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height,
      minWidth: Math.min(760, area.width),
      minHeight: Math.min(560, area.height),
      show: false,
      title: WINDOW_TITLE,
      icon: trayIcon(),
      backgroundColor: '#0d1116',
      autoHideMenuBar: true,
      webPreferences: this.webPreferences('dashboard'),
    });
    this.dashboard = window;
    window.on('closed', () => {
      if (this.dashboard === window) this.dashboard = undefined;
      this.emit('changed');
    });
    await this.loadWindow(window, 'dashboard');
    if (!this.quitting) window.show();
    this.emit('changed');
    return window;
  }

  private webPreferences(role: WindowRole): WebPreferences {
    return {
      preload: this.resources.preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
      // Sound remains opt-in; only the trusted companion may play a quiet background cue.
      autoplayPolicy: role === 'companion' ? 'no-user-gesture-required' : 'user-gesture-required',
      accessibleTitle: role === 'companion' ? 'SlingSip hydration companion' : 'SlingSip dashboard',
      additionalArguments: [`--companion-window=${role}`],
    };
  }

  private rendererUrl(role: WindowRole): string {
    const url = this.resources.developmentUrl
      ? new URL(this.resources.developmentUrl)
      : pathToFileURL(this.resources.rendererFile);
    url.hash = `/${role}`;
    return url.toString();
  }

  private async loadWindow(window: BrowserWindow, role: WindowRole): Promise<void> {
    const contents = window.webContents;
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.on('render-process-gone', (_event, details) => {
      console.error(`${role} renderer stopped: ${details.reason}`);
      this.failedRenderers.add(window);
      if (window === this.companion) this.setInteractive(false);
      if (!window.isDestroyed()) window.hide();
      this.emit('changed');
    });
    let cleanup = () => {};
    const firstPaint = new Promise<void>((resolve, reject) => {
      const ready = () => resolve();
      const failed = () => reject(new Error(`The ${role} window closed before its first paint.`));
      window.once('ready-to-show', ready);
      window.once('closed', failed);
      contents.once('render-process-gone', failed);
      cleanup = () => {
        window.removeListener('ready-to-show', ready);
        window.removeListener('closed', failed);
        contents.removeListener('render-process-gone', failed);
      };
    });
    try {
      await Promise.all([contents.loadURL(this.rendererUrl(role)), firstPaint]);
    } catch (error) {
      if (!window.isDestroyed()) window.destroy();
      throw error;
    } finally { cleanup(); }
  }
}
