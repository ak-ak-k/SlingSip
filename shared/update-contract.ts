export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';

/** Read-only, main-owned state. No feed URL, token, installer path or native API crosses IPC. */
export interface UpdateSnapshot {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  downloadProgress: number | null;
  releaseName: string | null;
  releaseNotes: string | null;
  errorMessage: string | null;
  failureStage: 'check' | 'download' | 'install' | null;
  lastCheckedAt: string | null;
  enabled: boolean;
  automaticChecking: boolean;
  disabledReason: string | null;
  channel: 'stable';
  installing: boolean;
}

export function initialUpdateSnapshot(currentVersion: string, enabled: boolean, disabledReason: string | null,
  automaticChecking = enabled): UpdateSnapshot {
  return { status: 'idle', currentVersion, availableVersion: null, downloadProgress: null, releaseName: null,
    releaseNotes: null, errorMessage: null, failureStage: null, lastCheckedAt: null, enabled, automaticChecking,
    disabledReason, channel: 'stable', installing: false };
}
