import { SWING_CONFIG as config } from './swing-config';
import { artworkPoint, clamp, smoothStep, swingSample, type SwingLayout, type SwingSample } from './swing-motion';
export type EntryVariant = 'classic' | 'high' | 'zip' | 'upside-down';
export const ENTRY_VARIANTS = Object.freeze([
  { id: 'classic' as const, label: 'Classic Swing', weight: .45 },
  { id: 'high' as const, label: 'High Swing', weight: .20 },
  { id: 'zip' as const, label: 'Fast Zip', weight: .20 },
  { id: 'upside-down' as const, label: 'Upside Down', weight: .15 },
]);
/** Condition the authored weights on the previous variant to prevent immediate repeats. */
export function chooseEntryVariant(random = Math.random(), previous?: EntryVariant): EntryVariant {
  const choices = ENTRY_VARIANTS.filter(v => v.id !== previous);
  let sample = clamp(random, 0, .999999999) * choices.reduce((sum, v) => sum + v.weight, 0);
  for (const choice of choices) { sample -= choice.weight; if (sample < 0) return choice.id; }
  return choices.at(-1)!.id;
}
export function entryDuration(variant: EntryVariant): number {
  return variant === 'high' ? config.highDurationMs : variant === 'zip' ? config.zipDurationMs : variant === 'upside-down' ? config.dropDurationMs : config.entryDurationMs;
}
export function entrySample(layout: SwingLayout, variant: EntryVariant, progress: number): SwingSample {
  if (variant === 'classic') return { ...swingSample(layout, 'entry', progress), stage: 'attached' };
  const t = clamp(progress, 0, 1), u = smoothStep(t), v = 1 - u;
  const { width: w, height: h, characterHeight: ch, characterWidth: cw, reminder: end } = layout;
  const drop = variant === 'upside-down';
  const start = { x: drop ? end.x + cw * .2 : -cw * config.exitClearanceRatio, y: drop ? -ch * 2 : h * (variant === 'high' ? .04 : .25) };
  const a = { x: drop ? end.x + cw * .2 : w * .14, y: drop ? h * .26 : h * .10 };
  const b = { x: end.x + (drop ? -cw * .15 : -w * .04), y: end.y + (drop ? 0 : h * .025) };
  const x = v ** 3 * start.x + 3 * v ** 2 * u * a.x + 3 * v * u ** 2 * b.x + u ** 3 * end.x;
  const y = v ** 3 * start.y + 3 * v ** 2 * u * a.y + 3 * v * u ** 2 * b.y + u ** 3 * end.y;
  const dx = 3 * v ** 2 * (a.x - start.x) + 6 * v * u * (b.x - a.x) + 3 * u ** 2 * (end.x - b.x);
  const dy = 3 * v ** 2 * (a.y - start.y) + 6 * v * u * (b.y - a.y) + 3 * u ** 2 * (end.y - b.y);
  const roll = smoothStep((t - .55) / .37), energy = Math.sin(Math.PI * t);
  const rotation = drop ? 180 * (1 - roll) : clamp(Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI * config.tangentRotationFactor, -config.rotationMaxDegrees, config.rotationMaxDegrees);
  const anchor = { x: w * (variant === 'high' ? .57 : variant === 'zip' ? .66 : end.x / w), y: -h * config.webAnchorOffsetRatio };
  const pose: SwingSample = { x, y, anchor, rotation, scarf: -config.scarfMaxDegrees * energy,
    frontLeg: drop ? 0 : -config.frontLegDegrees * energy, rearLeg: config.rearLegDegrees * energy,
    arm: config.armDegrees * energy, head: -config.headDegrees * energy, stage: 'attached' };
  if (drop && roll < 1) {
    const foot = artworkPoint(layout, pose, 54, 204);
    // Hang from the front boot first, then cast from the raised hand while rolling upright.
    pose.webEnd = foot;
    if (roll > 0) { pose.webEnd = undefined; pose.releasedWeb = { anchor, end: foot, opacity: 1 - roll };
      pose.anchor = { x: x + (anchor.x - x) * roll, y: y + (anchor.y - y) * roll }; pose.stage = 'attaching'; }
  }
  if (variant === 'high' && t < .60) {
    const old = { x: w * .18, y: -h * .09 };
    if (t < .34) { pose.anchor = old; pose.stage = 'attached'; }
    else if (t < .43) { pose.anchor = old; pose.webOpacity = 1 - smoothStep((t - .34) / .09); pose.stage = 'releasing'; }
    else if (t < .48) { pose.webOpacity = 0; pose.stage = 'free'; }
    else { const cast = smoothStep((t - .48) / .12); pose.anchor = { x: x + (anchor.x - x) * cast, y: y + (anchor.y - y) * cast }; pose.stage = 'attaching'; }
  }
  return pose;
}
