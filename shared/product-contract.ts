export type DashboardPage = 'overview' | 'history' | 'settings';
export interface StartupStatus { supported: boolean; enabled: boolean; error: string | null; }
export interface TrayStatus { available: boolean; error: string | null; }
