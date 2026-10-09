export enum CharacterState {
  Hidden = 'hidden',
  SwingingIn = 'swinging-in',
  Arriving = 'arriving',
  Reminder = 'reminder',
  Waiting = 'waiting',
  Success = 'success',
  DeliveringBottle = 'delivering-bottle',
  SwingingOutRight = 'swinging-out-right',
  SwingingBackLeft = 'swinging-back-left',
}

export type CharacterDirection = 'left' | 'right';
export type AnimationName = 'walkLeft' | 'walkRight' | 'idle' | 'turnLeft' | 'turnRight' | 'happy' | 'sad';

interface AnimationBase {
  src: string;
  loop: boolean;
  playbackRate: number;
  facing: CharacterDirection;
}

export interface SpriteAnimation extends AnimationBase {
  type: 'sprite';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  stride?: number;
}

export interface WebmAnimation extends AnimationBase {
  type: 'webm';
  durationMs?: number;
  /** Source-pixel distance travelled in one walk cycle, for playback-speed matching. */
  stride?: number;
  referenceHeight?: number;
}

export interface AnimationAsset {
  primary: SpriteAnimation | WebmAnimation;
  fallback: SpriteAnimation;
}

export interface CharacterConfig {
  height: number;
  aspectRatio: number;
  speed: number;
  margin: number;
  bottom: number;
  controlsHeight: number;
  developmentIdleMs: number;
  fallbackTurnMs: number;
  animations: Record<'walkLeft' | 'walkRight' | 'idle', AnimationAsset> & Partial<Record<'turnLeft' | 'turnRight' | 'happy' | 'sad', AnimationAsset>>;
}

const nextStates: Record<CharacterState, readonly CharacterState[]> = {
  [CharacterState.Hidden]: [CharacterState.SwingingIn],
  [CharacterState.SwingingIn]: [CharacterState.Arriving],
  [CharacterState.Arriving]: [CharacterState.Reminder],
  [CharacterState.Reminder]: [CharacterState.Waiting, CharacterState.Success],
  [CharacterState.Waiting]: [CharacterState.SwingingBackLeft, CharacterState.Success],
  [CharacterState.Success]: [CharacterState.DeliveringBottle],
  [CharacterState.DeliveringBottle]: [CharacterState.SwingingOutRight],
  [CharacterState.SwingingOutRight]: [CharacterState.Hidden],
  [CharacterState.SwingingBackLeft]: [CharacterState.Hidden],
};

export function canTransition(from: CharacterState, to: CharacterState): boolean {
  return nextStates[from].includes(to);
}
