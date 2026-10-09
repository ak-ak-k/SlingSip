export interface UserProfile {
  displayName: string;
  createdAt: string;
  hasCompletedOnboarding: boolean;
}

export const DISPLAY_NAME_LIMIT = 48;

/** Plain local display names, validated again at the main-process boundary. */
export function validateDisplayName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter your name.');
  const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!name || !/[\p{L}\p{N}]/u.test(name)) throw new Error('Enter a name containing a letter or number.');
  if (Array.from(name).length > DISPLAY_NAME_LIMIT) throw new Error('Keep your name to 48 characters or fewer.');
  if (/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name)) throw new Error('Use a plain text name without control characters.');
  return name;
}

export function restoreUserProfile(value: unknown): UserProfile | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid local profile.');
  const profile = value as Record<string, unknown>;
  if (typeof profile['createdAt'] !== 'string' || !Number.isFinite(Date.parse(profile['createdAt']))
    || typeof profile['hasCompletedOnboarding'] !== 'boolean') throw new Error('Invalid local profile.');
  return { displayName: validateDisplayName(profile['displayName']), createdAt: profile['createdAt'],
    hasCompletedOnboarding: profile['hasCompletedOnboarding'] };
}

export function profileInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return 'SS';
  const first = (word: string) => Array.from(word)[0] ?? '';
  return (first(words[0]) + (words.length > 1 ? first(words[words.length - 1]) : '')).toLocaleUpperCase();
}

export function greetingForHour(hour: number): string {
  return hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening';
}
