import type { Point } from './demo';

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Scroll chooses arc progress; cosine timing speeds through the bottom of a quadratic swing. */
export function sampleSwing(from: Point, to: Point, progress: number, dip: number) {
  const t = .5 - Math.cos(clamp(progress, 0, 1) * Math.PI) * .5;
  const inverse = 1 - t;
  const bend = { x: (from.x + to.x) * .5, y: (from.y + to.y) * .5 + dip * 2 };
  const dx = 2 * inverse * (bend.x - from.x) + 2 * t * (to.x - bend.x);
  const dy = 2 * inverse * (bend.y - from.y) + 2 * t * (to.y - bend.y);
  const chord = Math.atan2(to.y - from.y, to.x - from.x);
  const difference = Math.atan2(Math.sin(Math.atan2(dy, dx) - chord), Math.cos(Math.atan2(dy, dx) - chord));
  return {
    x: inverse * inverse * from.x + 2 * inverse * t * bend.x + t * t * to.x,
    y: inverse * inverse * from.y + 2 * inverse * t * bend.y + t * t * to.y,
    rotation: clamp(difference * 180 / Math.PI * .32, -12, 12) * Math.sin(t * Math.PI), t,
  };
}
