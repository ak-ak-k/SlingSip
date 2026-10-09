export interface CompanionPreferences {
  soundEffects: boolean;
  soundVolume: number;
  lowPowerAnimations: boolean;
  cursorAwareness: boolean;
  characterReactions: boolean;
}

export const DEFAULT_COMPANION_PREFERENCES: Readonly<CompanionPreferences> = Object.freeze({
  soundEffects: false, soundVolume: .2, lowPowerAnimations: false, cursorAwareness: true, characterReactions: true,
});

export function validateCompanionPreferences(value: unknown): CompanionPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid companion preferences.');
  const input = value as Record<string, unknown>;
  const keys = Object.keys(DEFAULT_COMPANION_PREFERENCES);
  if (Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) throw new Error('Invalid companion preference keys.');
  for (const key of ['soundEffects', 'lowPowerAnimations', 'cursorAwareness', 'characterReactions']) {
    if (typeof input[key] !== 'boolean') throw new Error('Companion switches must be booleans.');
  }
  if (typeof input['soundVolume'] !== 'number' || !Number.isFinite(input['soundVolume']) || input['soundVolume'] < 0 || input['soundVolume'] > .3) {
    throw new Error('Sound volume must be between 0 and 30%.');
  }
  return { soundEffects: input['soundEffects'] as boolean, soundVolume: input['soundVolume'],
    lowPowerAnimations: input['lowPowerAnimations'] as boolean, cursorAwareness: input['cursorAwareness'] as boolean,
    characterReactions: input['characterReactions'] as boolean };
}

export function restoreCompanionPreferences(value: unknown): CompanionPreferences {
  const defaults = { ...DEFAULT_COMPANION_PREFERENCES };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const input = value as Record<string, unknown>;
  for (const key of ['soundEffects', 'lowPowerAnimations', 'cursorAwareness', 'characterReactions'] as const) {
    if (typeof input[key] === 'boolean') defaults[key] = input[key];
  }
  if (typeof input['soundVolume'] === 'number' && Number.isFinite(input['soundVolume'])) defaults.soundVolume = Math.max(0, Math.min(.3, input['soundVolume']));
  return defaults;
}
