/** Private parent/main control pipe; never included in the renderer preload bridge. */
export const DEV_RESTART_EXIT_CODE = 75;
export const DEV_PROFILE_CONFLICT_EXIT_CODE = 76;
export type DevelopmentCommand = 'slingsip:restart' | 'slingsip:quit' | 'slingsip:reload-assets';
