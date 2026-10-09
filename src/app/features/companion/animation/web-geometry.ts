import { SWING_CONFIG as config } from './swing-config';
import type { Point, SwingLayout } from './swing-motion';

/** A visible strand stays local to its moving socket; distant trajectory anchors remain mathematical. */
export function localWebAnchor(layout: SwingLayout, grip: Point, target: Point): Point {
  const dx = target.x - grip.x, dy = target.y - grip.y, length = Math.hypot(dx, dy);
  const ratio = length ? Math.min(1, layout.characterHeight * config.webLengthRatio / length) : 0;
  return { x: grip.x + dx * ratio, y: grip.y + dy * ratio };
}

/** Quadratic SVG strand. The exact endpoints remain the actual hand/prop sockets. */
export function webPath(a: Point, b: Point, curvature = 1): string {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  const bend = Math.min(9, length * .032) * curvature;
  const control = { x: (a.x + b.x) / 2 - (length ? dy / length : 0) * bend,
    y: (a.y + b.y) / 2 + (length ? dx / length : 0) * bend };
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} Q${control.x.toFixed(2)},${control.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}
