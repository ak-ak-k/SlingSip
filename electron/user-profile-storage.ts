import Store from 'electron-store';
import { restoreUserProfile, validateDisplayName, type UserProfile } from '../shared/user-profile';

/** Same main-only, atomic electron-store architecture as companion preferences. */
export class UserProfileStorage {
  private store?: Store<{ schemaVersion: number; profile: UserProfile | null }>;
  private current: UserProfile | null = null;
  error: string | null = null;
  constructor() {
    try {
      const record = this.storage().store;
      if (record.schemaVersion !== undefined && record.schemaVersion !== 1) throw new Error('Unsupported local profile schema.');
      this.current = restoreUserProfile(record.profile);
    } catch { this.error = 'Your local profile could not be read. You can set it up again; hydration data is safe.'; }
  }
  snapshot(): UserProfile | null { return this.current ? { ...this.current } : null; }
  updateName(value: unknown): void {
    const displayName = validateDisplayName(value);
    this.save({ displayName, createdAt: this.current?.createdAt ?? new Date().toISOString(),
      hasCompletedOnboarding: this.current?.hasCompletedOnboarding ?? false });
  }
  complete(): void {
    if (!this.current) throw new Error('Set your name before finishing onboarding.');
    this.save({ ...this.current, hasCompletedOnboarding: true });
  }
  resetOnboarding(): void {
    if (this.current) this.save({ ...this.current, hasCompletedOnboarding: false });
  }
  persist(): void { if (this.current) this.save(this.current); }
  private save(profile: UserProfile): void {
    try {
      this.storage().store = { schemaVersion: 1, profile: { ...profile } };
      this.current = { ...profile }; this.error = null;
    } catch {
      this.error = 'Your profile could not be saved locally. Try again; your hydration data is safe.';
      throw new Error(this.error);
    }
  }
  private storage() {
    return this.store ??= new Store<{ schemaVersion: number; profile: UserProfile | null }>({ name: 'user-profile', clearInvalidConfig:true });
  }
}
