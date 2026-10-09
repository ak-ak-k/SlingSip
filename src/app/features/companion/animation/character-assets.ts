import { type CharacterConfig, type SpriteAnimation } from './character.model';

// PHASE 3 DEVELOPMENT ASSETS ONLY. Replace primary clips; keep these as load-error fallbacks.
const walk: SpriteAnimation = {
  type: 'sprite', src: 'assets/character/development/walk.svg',
  frameWidth: 240, frameHeight: 320, frameCount: 12, fps: 18,
  stride: 110, loop: true, playbackRate: 1, facing: 'left',
};
const idle: SpriteAnimation = {
  type: 'sprite', src: 'assets/character/development/idle.svg',
  frameWidth: 240, frameHeight: 320, frameCount: 16, fps: 8,
  loop: true, playbackRate: 1, facing: 'left',
};

export const CHARACTER_ANIMATIONS: CharacterConfig['animations'] = {
  walkLeft: { primary: walk, fallback: walk },
  walkRight: { primary: walk, fallback: walk },
  idle: { primary: idle, fallback: idle },
};

export const CHARACTER_CONFIG: CharacterConfig = {
  height: 280,
  aspectRatio: 240 / 320,
  speed: 145,
  margin: 32,
  bottom: 12,
  controlsHeight: 204,
  // PHASE 3 DEVELOPMENT TEST ONLY. Future interactions replace this dwell policy.
  developmentIdleMs: 3000,
  fallbackTurnMs: 280,
  animations: CHARACTER_ANIMATIONS,
};
