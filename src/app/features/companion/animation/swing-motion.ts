import { SWING_CONFIG as config } from './swing-config';
import { placeCompanion, type BubblePlacement, type VisualRectangle } from './companion-placement';

export interface Point { x: number; y: number }
export interface SwingLayout { width: number; height: number; characterHeight: number; characterWidth: number; reminder: Point; bubble: BubblePlacement; region: string }
export interface SwingSample extends Point {
  rotation: number; scarf: number; frontLeg: number; rearLeg: number; arm: number; head: number;
  anchor: Point;
  releasedWeb?: { anchor: Point; opacity: number; end?: Point };
  webEnd?: Point; webOpacity?: number; stage?: string;
}
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothStep = (t: number) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
const radians = (degrees: number) => degrees * Math.PI / 180;
const rotate = (point: Point, degrees: number): Point => ({
  x: point.x * Math.cos(radians(degrees)) - point.y * Math.sin(radians(degrees)),
  y: point.x * Math.sin(radians(degrees)) + point.y * Math.cos(radians(degrees)),
});

export function swingLayout(width: number, height: number, dashboard?: VisualRectangle | null): SwingLayout {
  const characterHeight = Math.min(config.characterHeight, Math.max(config.minCharacterHeight, height * config.heightRatio)) * config.characterScale;
  return { width, height, characterHeight, characterWidth: characterHeight * config.characterAspectRatio,
    ...placeCompanion(width, height, characterHeight, dashboard) };
}

/** A taut pendulum on entry and accelerating Bezier exits; the body renderer owns web release/casting. */
export function swingSample(layout: SwingLayout, phase: 'entry' | 'right' | 'left', progress: number, from?: SwingSample): SwingSample {
  const t = clamp(progress, 0, 1);
  const { width, height, characterWidth, characterHeight, reminder } = layout;
  let anchor = { x: width * (phase === 'entry' ? config.entryAnchorXRatio : phase === 'right' ? config.exitAnchorXRatio : config.backAnchorXRatio),
    y: -height * config.webAnchorOffsetRatio };
  let x: number, y: number, dx: number, dy: number;
  if (phase === 'entry') {
    // A shorter DIP viewport needs a shallower arc to keep the feet inside the work area.
    // A settle point in an outer gutter needs a higher virtual pivot to span the screen.
    // Preserve the same taut arc/timing; the renderer draws only its local web segment.
    const bottom = height - characterHeight * (1 - config.gripYRatio) - config.edgePadding;
    const span = reminder.x - anchor.x;
    const pivotY = (bottom ** 2 - reminder.y ** 2 - span ** 2) / (2 * Math.max(1, bottom - reminder.y));
    anchor.y = Math.min(anchor.y, pivotY - 1);
    const maxRadius = height - characterHeight * (1 - config.gripYRatio) - config.edgePadding - anchor.y;
    const verticalRadius = reminder.y - anchor.y;
    const maxHorizontalRadius = Math.sqrt(Math.max(0, maxRadius ** 2 - verticalRadius ** 2));
    anchor.x = Math.max(anchor.x, reminder.x - maxHorizontalRadius);
    const radius = Math.hypot(reminder.x - anchor.x, reminder.y - anchor.y);
    const start = -Math.asin(clamp((anchor.x + characterWidth * config.exitClearanceRatio) / radius, 0, .995));
    const end = Math.atan2(reminder.x - anchor.x, reminder.y - anchor.y);
    // Hermite timing builds momentum into the dip and reaches zero arrival speed.
    const m = config.entryInitialSpeed;
    const travel = (-2 + m) * t ** 3 + (3 - 2 * m) * t ** 2 + m * t;
    const angle = mix(start, end, travel);
    x = anchor.x + radius * Math.sin(angle); y = anchor.y + radius * Math.cos(angle);
    if (t === 1) { x = reminder.x; y = reminder.y; }
    dx = Math.cos(angle); dy = -Math.sin(angle);
  } else {
    const start = from ?? { ...reminder, rotation: 0, scarf: 0, frontLeg: 0, rearLeg: 0, arm: 0, head: 0,
      anchor: swingSample(layout, 'entry', 1).anchor };
    const sign = phase === 'right' ? 1 : -1;
    const end = { x: phase === 'right' ? width + characterWidth * config.exitClearanceRatio : -characterWidth * config.exitClearanceRatio,
      y: height * config.exitYRatio };
    const a = { x: start.x + sign * width * config.exitControlXRatio,
      y: Math.min(start.y + height * config.exitDropRatio, height - characterHeight * (1 - config.gripYRatio) - config.edgePadding) };
    const b = { x: end.x - sign * width * config.exitRiseXRatio, y: height * config.exitRiseYRatio };
    // Start travelling laterally promptly; stay opaque until the body clears the chosen edge.
    const u = .4 * t + .6 * t * t, v = 1 - u;
    x = v ** 3 * start.x + 3 * v ** 2 * u * a.x + 3 * v * u ** 2 * b.x + u ** 3 * end.x;
    y = v ** 3 * start.y + 3 * v ** 2 * u * a.y + 3 * v * u ** 2 * b.y + u ** 3 * end.y;
    dx = 3 * v ** 2 * (a.x - start.x) + 6 * v * u * (b.x - a.x) + 3 * u ** 2 * (end.x - b.x);
    dy = 3 * v ** 2 * (a.y - start.y) + 6 * v * u * (b.y - a.y) + 3 * u ** 2 * (end.y - b.y);
    const cast = smoothStep(t / config.webCastRatio);
    const releasedWeb = cast < 1 ? { anchor: start.anchor, opacity: 1 - cast } : undefined;
    // Grow the new strand from the grip, rather than snapping between anchors.
    anchor = { x: mix(x, anchor.x, cast), y: mix(y, anchor.y, cast) };
    const pose = bodyPose(t, dx, dy, phase);
    const blend = smoothStep(t / config.exitLeanRampRatio);
    return { x, y, anchor, releasedWeb, ...pose,
      rotation: mix(start.rotation, pose.rotation, blend), scarf: mix(start.scarf, pose.scarf, blend),
      frontLeg: mix(start.frontLeg, pose.frontLeg, blend), rearLeg: mix(start.rearLeg, pose.rearLeg, blend),
      arm: mix(start.arm, pose.arm, blend), head: mix(start.head, pose.head, blend) };
  }
  return { x, y, anchor, ...bodyPose(t, dx, dy, phase) };
}

function bodyPose(t: number, dx: number, dy: number, phase: 'entry' | 'left' | 'right') {
  const sign = Math.sign(dx), energy = Math.sin(Math.PI * t);
  const rotation = clamp(Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI * config.tangentRotationFactor * sign,
    -config.rotationMaxDegrees, config.rotationMaxDegrees);
  const lag = Math.sin(Math.PI * clamp(t - config.scarfLagRatio, 0, 1));
  return { rotation, scarf: -sign * config.scarfMaxDegrees * lag * (1 + config.scarfFlutterRatio * Math.sin(2 * config.scarfFlutterCycles * Math.PI * t)),
    frontLeg: -sign * config.frontLegDegrees * energy + rotation * config.frontLegLeanRatio,
    rearLeg: sign * config.rearLegDegrees * energy + rotation * config.rearLegLeanRatio,
    arm: sign * config.armDegrees * energy,
    head: rotation * config.headLeanRatio + (phase === 'entry' ? -1 : sign) * config.headDegrees * energy };
}

/** Damped recoil stabilizes the grip and every articulated joint with continuous endpoints. */
export function settleSample(layout: SwingLayout, from: SwingSample, progress: number): SwingSample {
  const t = clamp(progress, 0, 1), fade = 1 - smoothStep(t);
  if (t === 1) return { ...from, ...layout.reminder, rotation: 0, scarf: 0, frontLeg: 0, rearLeg: 0, arm: 0, head: 0 };
  const recoil = Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t) * (1 - t);
  return { ...from, ...layout.reminder, y: layout.reminder.y + recoil * layout.characterHeight * config.settleOffsetRatio,
    rotation: from.rotation * fade + recoil * config.settleRotationDegrees,
    scarf: from.scarf * fade, frontLeg: from.frontLeg * fade, rearLeg: from.rearLeg * fade,
    arm: from.arm * fade, head: from.head * fade };
}

export function deliveryPose(from: SwingSample, progress: number): SwingSample {
  const gesture = Math.sin(Math.PI * clamp(progress, 0, 1));
  return { ...from, arm: from.arm + config.bottleArmDegrees * gesture, head: from.head + config.bottleHeadDegrees * gesture };
}

/** Attach the secondary strand to the free hand, accounting for shoulder and body rotation. */
export function bottleSample(layout: SwingLayout, pose: SwingSample, progress: number | null) {
  const size = layout.characterHeight * config.bottleScale, scale = layout.characterHeight / config.artworkHeight;
  const hand = rotate({ x: config.bottleHandX - config.armPivotX, y: config.bottleHandY - config.armPivotY }, pose.arm);
  const relative = rotate({ x: (hand.x + config.armPivotX - config.gripXRatio * 160) * scale,
    y: (hand.y + config.armPivotY - config.gripYRatio * config.artworkHeight) * scale }, pose.rotation);
  const start = { x: pose.x + relative.x, y: pose.y + relative.y };
  if (progress === null) return { visible: false, start, ...start, rotation: 0, opacity: 0, size };
  const t = clamp(progress, 0, 1);
  const cast = 1 - (1 - clamp(t / config.bottleCastRatio, 0, 1)) ** 3;
  const lower = smoothStep(t / config.bottleLowerRatio);
  const sway = Math.sin(2 * config.bottleSwayCycles * Math.PI * t) * (1 - t) * config.bottleRotationDegrees;
  const angle = radians(config.bottleAngleDegrees + sway);
  const available = Math.max(0, layout.height - start.y - size - config.edgePadding);
  const retract = 1 - smoothStep((t - (1 - config.bottleFadeRatio)) / config.bottleFadeRatio);
  const length = retract * Math.min(layout.characterHeight * config.bottleReachRatio, available / Math.cos(angle)) * cast * (config.bottleCastLengthRatio + (1 - config.bottleCastLengthRatio) * lower);
  return { visible: true, start, x: start.x + Math.sin(angle) * length, y: start.y + Math.cos(angle) * length,
    rotation: sway, opacity: Math.min(1, t / config.bottleFadeRatio, (1 - t) / config.bottleFadeRatio), size };
}

/** Dropped frames advance elapsed time rather than slowing the motion. */
export function advanceSwing(elapsedMs: number, deltaMs: number, durationMs: number): number {
  return Math.min(durationMs, elapsedMs + Math.max(0, deltaMs));
}

/** An artwork point expressed in overlay-local DIPs, around the raised grip. */
export function artworkPoint(layout: SwingLayout, pose: SwingSample, x: number, y: number): Point {
  const scale = layout.characterHeight / config.artworkHeight;
  const relative = rotate({ x: (x - config.gripXRatio * config.characterAspectRatio * config.artworkHeight) * scale, y: (y - config.gripYRatio * config.artworkHeight) * scale }, pose.rotation);
  return { x: pose.x + relative.x, y: pose.y + relative.y };
}
