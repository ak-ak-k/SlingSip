import { CharacterState } from './character.model';
import type { BodyAnimationPack, BodyCue } from './body-animation.model';
import type { EntryVariant } from './entry-variants';
import { entrySample } from './entry-variants';
import { artworkPoint, clamp, smoothStep, type Point, type SwingLayout, type SwingSample } from './swing-motion';
import { SWING_CONFIG } from './swing-config';

const segment = (state: BodyCue['state'], t: number, a: number, b: number, web: BodyCue['web']): BodyCue => ({ state, progress:clamp((t-a)/(b-a),0,1), web });
/** Samples artwork only. It never supplies positions to the existing trajectory. */
export function bodyCue(phase: CharacterState, progress: number, reduced = false): BodyCue {
  const t = clamp(progress,0,1);
  if (reduced) return {state:'idle',progress:0,web:'second'};
  if (phase === CharacterState.Arriving) return segment('settle',t,0,1,'second');
  if (phase === CharacterState.Success) return segment('success',t,0,1,'second');
  if (phase === CharacterState.DeliveringBottle) {
    if (t < .18) return segment('web-shot',t,0,.18,'second');
    if (t < .86) return segment('bottle-hold',t,.18,.86,'second');
    return segment('retract',t,.86,1,'second');
  }
  if (phase === CharacterState.SwingingOutRight || phase === CharacterState.SwingingBackLeft) {
    if (t < .13) return segment('release',t,0,.13,'retract-first');
    if (t < .20) return segment('mid-air',t,.13,.20,'none');
    if (t < .32) return segment('attach',t,.20,.32,'attach-second');
    if (t < .58) return segment('swing-down',t,.32,.58,'second');
    if (t < .74) return segment('swing-bottom',t,.58,.74,'second');
    return segment('swing-up',t,.74,1,'second');
  }
  if (phase !== CharacterState.SwingingIn) return {state:'idle',progress:0,web:'second'};
  if (t < .10) return segment('swing-grab',t,0,.10,'first');
  if (t < .28) return segment('swing-down',t,.10,.28,'first');
  if (t < .40) return segment('swing-bottom',t,.28,.40,'first');
  if (t < .52) return segment('swing-up',t,.40,.52,'first');
  if (t < .61) return segment('release',t,.52,.61,'retract-first');
  if (t < .68) return segment('mid-air',t,.61,.68,'none');
  if (t < .78) return segment('attach',t,.68,.78,'attach-second');
  if (t < .86) return segment('swing-down',t,.78,.86,'second');
  if (t < .92) return segment('swing-bottom',t,.86,.92,'second');
  return segment('swing-up',t,.92,1,'second');
}
export function spriteFrame(pack: BodyAnimationPack, cue: BodyCue) {
  const clip = pack.clips[cue.state], index = Math.min(clip.frames.length-1,Math.floor(cue.progress*clip.frames.length));
  return {index,frame:clip.frames[index]};
}
const lerpPoint = (a:Point,b:Point,t:number):Point => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
/** A release always ends before a cast starts, including exit casts. */
export function bodyWebs(layout: SwingLayout, pose: SwingSample, phase: CharacterState, cue: BodyCue, variant: EntryVariant, pack: BodyAnimationPack) {
  const frame = spriteFrame(pack,cue).frame;
  const grip = artworkPoint(layout,pose,frame.anchors.grip.x,frame.anchors.grip.y);
  const boot = artworkPoint(layout,pose,frame.anchors.boot.x,frame.anchors.boot.y);
  return webChoreography(layout,pose,phase,cue,variant,grip,boot);
}
/** Shared choreography accepts actual world sockets from any character renderer. */
export function webChoreography(layout: SwingLayout, pose: SwingSample, phase: CharacterState, cue: BodyCue, variant: EntryVariant, grip:Point, boot:Point=grip,
  visualAnchors?: { previous: Point; next: Point }) {
  const exiting = phase === CharacterState.SwingingOutRight || phase === CharacterState.SwingingBackLeft;
  const arrivalAnchor = {x:layout.width*.62,y:-layout.height*SWING_CONFIG.webAnchorOffsetRatio};
  const oldAnchor = visualAnchors?.previous ?? (exiting ? arrivalAnchor : entrySample(layout,variant,0).anchor);
  const nextAnchor = visualAnchors?.next ?? (exiting ? {x:layout.width*(phase === CharacterState.SwingingOutRight ? SWING_CONFIG.exitAnchorXRatio : SWING_CONFIG.backAnchorXRatio),y:arrivalAnchor.y} : arrivalAnchor);
  const oldEnd = variant === 'upside-down' && !exiting && (cue.web === 'first' || cue.web === 'retract-first') ? boot : grip;
  const empty = {a:grip,b:grip,opacity:0};
  if (cue.web === 'none') return {main:empty,old:empty,stage:'free-flight'};
  if (cue.web === 'retract-first') return {main:empty,old:{a:oldAnchor,b:lerpPoint(oldEnd,oldAnchor,smoothStep(cue.progress)),opacity:1-cue.progress},stage:'retract-old'};
  if (cue.web === 'attach-second') return {main:{a:lerpPoint(grip,nextAnchor,smoothStep(cue.progress)),b:grip,opacity:cue.progress},old:empty,stage:'attach-web-2'};
  return {main:{a:cue.web === 'first' ? oldAnchor : nextAnchor,b:cue.web === 'first' ? oldEnd : grip,opacity:1},old:empty,stage:cue.web === 'first' ? 'web-1' : 'web-2'};
}
/** Bottle presentation uses the sprite's authored hand anchor, never a stale limb transform. */
export function bodyBottle(layout: SwingLayout, pose: SwingSample, progress: number | null, cue: BodyCue, pack: BodyAnimationPack, handOverride?:Point) {
  const hand = spriteFrame(pack,cue).frame.anchors.freeHand;
  return bottlePresentation(layout,progress,handOverride ?? artworkPoint(layout,pose,hand.x,hand.y));
}
export function bottlePresentation(layout:SwingLayout,progress:number|null,start:Point) {
  const size = Math.min(layout.characterHeight*SWING_CONFIG.bottleScale,Math.max(0,layout.height-start.y-SWING_CONFIG.edgePadding));
  if (progress === null) return {start,...start,size,rotation:0,opacity:0,webOpacity:0,feedback:0,stage:'none'};
  const t = clamp(progress,0,1), cast = smoothStep(t/.18), drop = smoothStep((t-.16)/.22);
  const swingT = clamp((t-.38)/.48,0,1), rotation = t < .38 ? 0 : 10*Math.sin(3*Math.PI*swingT)*Math.exp(-1.2*swingT);
  const angle = (SWING_CONFIG.bottleAngleDegrees+rotation)*Math.PI/180;
  const available = Math.max(0,layout.height-start.y-size-SWING_CONFIG.edgePadding);
  const retract = 1-smoothStep((t-SWING_CONFIG.bottleRetractRatio)/(1-SWING_CONFIG.bottleRetractRatio));
  const length = Math.min(layout.characterHeight*SWING_CONFIG.bottleReachRatio,available/Math.cos(angle))*cast*(.2+.8*drop)*retract;
  return {start,x:start.x+Math.sin(angle)*length,y:start.y+Math.cos(angle)*length,size,rotation,
    opacity:smoothStep((t-SWING_CONFIG.bottleRevealRatio)/SWING_CONFIG.bottleRevealRampRatio)*retract,webOpacity:cast*retract,
    feedback:smoothStep((t-.52)/.1)*(1-smoothStep((t-.8)/.06)),
    stage:t<.18?'web-shot':t<.38?'bottle-drop':t<SWING_CONFIG.bottleRetractRatio?'pendulum':'retract'};
}
