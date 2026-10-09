import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { type DesktopBridge, type DesktopSnapshot } from '../../../../shared/desktop-contract';
import { type HydrationSettings } from '../../../../shared/hydration-settings';
import { type CompanionPreferences } from '../../../../shared/companion-preferences';
import { Router } from '@angular/router';

declare global {
  interface Window { desktopCompanion?: DesktopBridge }
}

@Injectable({ providedIn: 'root' })
export class DesktopService {
  private readonly bridge = window.desktopCompanion;
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = signal<DesktopSnapshot | null>(null);
  readonly snapshot = this.state.asReadonly();
  readonly role = this.bridge?.role ?? 'dashboard';
  readonly nativeAvailable = !!this.bridge;
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly updateActionError = signal<string | null>(null);
  readonly overlayVisible = computed(() => this.snapshot()?.overlay.visible ?? false);
  readonly testClicks = computed(() => this.snapshot()?.overlay.testClicks ?? 0);

  async initialize(): Promise<void> {
    if (!this.bridge) return;
    const unsubscribe = this.bridge.onSnapshotChanged((state) => this.acceptSnapshot(state));
    this.destroyRef.onDestroy(unsubscribe);
    const router = inject(Router);
    this.destroyRef.onDestroy(this.bridge.onNavigate((page) => {
      void router.navigateByUrl(page === 'overview' ? '/dashboard' : `/dashboard/${page}`);
    }));
    try { this.acceptSnapshot(await this.bridge.getSnapshot()); }
    catch (error) { this.error.set(this.message(error)); }
  }

  async toggleOverlay(): Promise<void> {
    await this.perform(async (bridge) => this.acceptSnapshot(await bridge.setOverlayVisible(!this.overlayVisible())));
  }

  checkForUpdates(): Promise<void> { return this.performUpdate(bridge => bridge.checkForUpdates()); }
  downloadUpdate(): Promise<void> { return this.performUpdate(bridge => bridge.downloadUpdate()); }
  restartAndUpdate(): Promise<void> { return this.performUpdate(bridge => bridge.restartAndUpdate()); }
  private async performUpdate(action: (bridge: DesktopBridge) => Promise<DesktopSnapshot>): Promise<void> {
    if (!this.bridge) return;
    this.updateActionError.set(null);
    try { this.acceptSnapshot(await action(this.bridge)); }
    catch { this.updateActionError.set('This update action could not be completed. Please try again.'); }
  }

  async showOverlay(): Promise<void> {
    await this.perform(async (bridge) => this.acceptSnapshot(await bridge.triggerDevelopmentReminder()));
  }

  async scheduleDevelopmentReminder(): Promise<void> {
    await this.perform(async (bridge) => this.acceptSnapshot(await bridge.triggerDevelopmentReminder(15000)));
  }

  async updateHydrationSettings(settings: HydrationSettings): Promise<boolean> {
    if (!this.bridge || this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      const snapshot = await this.bridge.updateHydrationSettings(settings);
      this.acceptSnapshot(snapshot);
      return !snapshot.storageError;
    }
    catch (error) { this.error.set(this.message(error)); return false; }
    finally { this.busy.set(false); }
  }

  async hideOverlay(): Promise<void> {
    await this.perform(async (bridge) => this.acceptSnapshot(await bridge.setOverlayVisible(false)));
  }
  async updateCompanionPreferences(preferences: CompanionPreferences): Promise<boolean> {
    if (!this.bridge || this.busy()) return false;
    this.busy.set(true); this.error.set(null);
    try {
      const snapshot = await this.bridge.updateCompanionPreferences(preferences);
      this.acceptSnapshot(snapshot);
      return !snapshot.companionPreferencesError;
    } catch (error) { this.error.set(this.message(error)); return false; }
    finally { this.busy.set(false); }
  }

  async recordWater(reminderRevision?: number): Promise<number> {
    if (!this.bridge) throw new Error('Open SlingSip in Electron to record water.');
    const result = await this.bridge.recordDrink(reminderRevision);
    this.acceptSnapshot(result.snapshot);
    return result.addedWater;
  }

  updateDisplayName(name: string): Promise<boolean> { return this.profileAction(bridge => bridge.updateDisplayName(name)); }
  completeOnboarding(): Promise<boolean> { return this.profileAction(bridge => bridge.completeOnboarding()); }
  resetOnboarding(): Promise<boolean> { return this.profileAction(bridge => bridge.resetOnboarding()); }
  private async profileAction(action: (bridge: DesktopBridge) => Promise<DesktopSnapshot>): Promise<boolean> {
    if (!this.bridge || this.busy()) return false;
    this.busy.set(true); this.error.set(null);
    try { const snapshot = await action(this.bridge); this.acceptSnapshot(snapshot); return !snapshot.userProfileError; }
    catch (error) { this.error.set(this.message(error)); return false; }
    finally { this.busy.set(false); }
  }

  async quickAddWater(): Promise<number> {
    if (!this.bridge || this.busy()) return 0;
    this.busy.set(true);
    this.error.set(null);
    try { return await this.recordWater(); }
    catch (error) { this.error.set(this.message(error)); return 0; }
    finally { this.busy.set(false); }
  }

  async toggleReminderPause(): Promise<void> {
    await this.perform(async bridge => this.acceptSnapshot(await bridge.setRemindersPaused(!this.snapshot()?.scheduler.remindersPaused)));
  }

  async openCompanion(): Promise<void> {
    await this.perform(async bridge => this.acceptSnapshot(await bridge.openCompanion()));
  }

  async finishReminder(visibilityRevision: number): Promise<void> {
    if (!this.bridge) return;
    this.acceptSnapshot(await this.bridge.setOverlayVisible(false, visibilityRevision));
  }

  async suspendReminder(visibilityRevision: number): Promise<void> {
    if (!this.bridge) return;
    this.acceptSnapshot(await this.bridge.suspendReminder(visibilityRevision));
  }

  async finishCharacterTest(visibilityRevision: number): Promise<void> {
    if (!this.bridge) return;
    try {
      if (this.snapshot()?.overlay.visibilityRevision !== visibilityRevision || !this.overlayVisible()) return;
      // Completion is a production flow. Optional development telemetry cannot prevent hiding.
      if (this.snapshot()?.developmentMode) {
        await this.bridge.recordTestClick().then(state => this.acceptSnapshot(state))
          .catch(error => this.error.set(this.message(error)));
      }
      // Completion must hide even if a dashboard action is busy. A stale run cannot hide a new one.
      this.acceptSnapshot(await this.bridge.setOverlayVisible(false, visibilityRevision));
    } catch (error) { this.error.set(this.message(error)); }
  }

  async recordTestClick(): Promise<void> {
    await this.perform(async (bridge) => this.acceptSnapshot(await bridge.recordTestClick()));
  }

  async resetTestClicks(): Promise<void> {
    await this.perform(async (bridge) => this.acceptSnapshot(await bridge.resetTestClicks()));
  }

  async openDashboard(): Promise<void> {
    await this.perform((bridge) => bridge.openDashboard());
  }

  async quit(): Promise<void> {
    await this.perform((bridge) => bridge.quit());
  }

  setOverlayInteractive(interactive: boolean): void {
    this.bridge?.setOverlayInteractive(interactive);
  }

  async getCursorPosition(): Promise<{ x: number; y: number } | null> {
    return this.bridge ? this.bridge.getCursorPosition() : null;
  }

  private acceptSnapshot(state: DesktopSnapshot): void {
    if (state.revision >= (this.state()?.revision ?? -1)) this.state.set(state);
  }

  private async perform(action: (bridge: DesktopBridge) => Promise<void>): Promise<void> {
    if (!this.bridge || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try { await action(this.bridge); }
    catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
