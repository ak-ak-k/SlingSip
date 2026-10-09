import type { Point } from './swing-motion';

/** Visual states are independent of the reminder/business state machine. */
export type BodyAnimationState = 'swing-grab' | 'swing-down' | 'swing-bottom' | 'swing-up' |
  'release' | 'mid-air' | 'attach' | 'settle' | 'idle' | 'success' | 'web-shot' | 'bottle-hold' | 'retract';
export interface SpriteLayer { kind: 'svg' | 'image'; src: string }
export interface BodySpriteFrame {
  body: SpriteLayer;
  head?: SpriteLayer;
  /** Alpha silhouette for bitmap artwork; bitmap rectangles never intercept empty pixels. */
  hitPath?: string;
  /** Coordinates in the common 160 × 220 artwork space. */
  anchors: { grip: Point; freeHand: Point; boot: Point; head: Point; hit: Point };
}
export interface BodyAnimationClip { frames: readonly BodySpriteFrame[]; durationMs: number; loop?: boolean }
export interface BodyAnimationPack {
  id: string; temporary: boolean; width: number; height: number;
  clips: Record<BodyAnimationState, BodyAnimationClip>;
}
export interface BodyCue { state: BodyAnimationState; progress: number; web: 'first' | 'retract-first' | 'none' | 'attach-second' | 'second' }
