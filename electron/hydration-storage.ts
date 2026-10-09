import Store from 'electron-store';
import { type PersistedHydrationState } from '../shared/hydration';

export interface HydrationPersistence {
  load(): unknown;
  save(state: PersistedHydrationState): void;
  readonly error: string | null;
}

/** Only main imports electron-store. One atomic JSON record, no renderer filesystem access. */
export class HydrationStorage implements HydrationPersistence {
  private store: Store<Record<string, unknown>> | undefined;
  error: string | null = null;

  load(): unknown {
    try {
      this.store ??= new Store<Record<string, unknown>>({ name: 'hydration', clearInvalidConfig: true });
      const value = this.store.store;
      this.error = null;
      return value;
    } catch (error) {
      this.failed(error);
      return undefined;
    }
  }

  save(state: PersistedHydrationState): void {
    try {
      this.store ??= new Store<Record<string, unknown>>({ name: 'hydration', clearInvalidConfig: true });
      this.store.store = { ...state, settings: { ...state.settings } };
      this.error = null;
    } catch (error) { this.failed(error); }
  }

  private failed(error: unknown): void {
    this.error = 'Progress could not be saved locally. SlingSip will keep this session in memory and retry on the next change.';
    console.error('Hydration storage unavailable:', error);
  }
}
