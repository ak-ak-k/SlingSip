import Store from 'electron-store';
import { DEFAULT_COMPANION_PREFERENCES, restoreCompanionPreferences, validateCompanionPreferences, type CompanionPreferences } from '../shared/companion-preferences';

/** Independent visual/audio preferences. The existing hydration file/schema is untouched. */
export class CompanionPreferencesStorage {
  private store: Store<{ schemaVersion: number; preferences: CompanionPreferences }> | undefined;
  private current: CompanionPreferences = { ...DEFAULT_COMPANION_PREFERENCES };
  error: string | null = null;
  constructor() {
    try { this.current = restoreCompanionPreferences(this.storage().get('preferences')); }
    catch { this.error = 'Companion preferences could not be read. Default motion and muted sound are active.'; }
  }
  snapshot(): CompanionPreferences { return { ...this.current }; }
  update(value: unknown): void {
    this.current = validateCompanionPreferences(value);
    try { this.storage().store = { schemaVersion: 1, preferences: this.snapshot() }; this.error = null; }
    catch { this.error = 'Companion preferences apply to this session but could not be saved. Try saving again.'; }
  }
  private storage() {
    return this.store ??= new Store<{ schemaVersion: number; preferences: CompanionPreferences }>({ name: 'companion-preferences', clearInvalidConfig: true });
  }
}
