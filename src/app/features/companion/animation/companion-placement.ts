import { SWING_CONFIG as config } from './swing-config';

export interface VisualRectangle { x: number; y: number; width: number; height: number }
export interface BubblePlacement { left: number; top: number; width: number; tail: number; side: boolean }
export interface ReminderPlacement { reminder: { x: number; y: number }; bubble: BubblePlacement; region: string }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Overlay-local CSS pixels derived from Electron's workArea; no physical-resolution assumptions. */
export function placeCompanion(width: number, height: number, characterHeight: number, dashboard?: VisualRectangle | null): ReminderPlacement {
  const pad = config.edgePadding, gap = config.bubbleGap;
  const bubbleWidth = Math.min(config.bubbleWidth, Math.max(0, width - 2 * pad));
  // Include approved-pose overhang and idle sway, rather than just the SVG viewBox.
  const bodyLeft = characterHeight * .60, bodyRight = characterHeight * .55;
  const bodyTop = characterHeight * .12, bodyBottom = characterHeight * .96;
  const stackWidth = Math.max(bubbleWidth, 2 * Math.max(bodyLeft, bodyRight));
  const stackHeight = config.bubbleHeight + gap + bodyTop + bodyBottom;
  const sideWidth = bubbleWidth + gap + bodyLeft + bodyRight;
  const fit = (area: VisualRectangle) => area.width >= stackWidth && area.height >= stackHeight;
  const vertical = (area: VisualRectangle, region: string): ReminderPlacement => {
    const x = clamp(width * config.reminderXRatio, area.x + stackWidth / 2, area.x + area.width - stackWidth / 2);
    const y = clamp(height * config.reminderYRatio, area.y + config.bubbleHeight + gap + bodyTop, area.y + area.height - bodyBottom);
    const left = clamp(x - bubbleWidth / 2, pad, Math.max(pad, width - bubbleWidth - pad));
    return { reminder: { x, y }, bubble: { left, top: Math.max(pad, y - bodyTop - config.bubbleHeight - gap), width: bubbleWidth,
      tail: clamp(x - left, 20, Math.max(20, bubbleWidth - 20)), side: false }, region };
  };
  const usable = { x: pad, y: pad, width: Math.max(0, width - 2 * pad), height: Math.max(0, height - 2 * pad) };
  const outside = dashboard && dashboard.x < width && dashboard.y < height && dashboard.x + dashboard.width > 0 && dashboard.y + dashboard.height > 0;
  if (outside && dashboard) {
    const right = clamp(dashboard.x + dashboard.width + pad, pad, width - pad);
    const leftEdge = clamp(dashboard.x - pad, pad, width - pad);
    const gutters = [
      { region: 'right-gutter', area: { ...usable, x: right, width: Math.max(0, width - pad - right) } },
      { region: 'left-gutter', area: { ...usable, width: Math.max(0, leftEdge - pad) } },
    ];
    for (const { area, region } of gutters) if (fit(area)) return vertical(area, region);
    // A large/maximized dashboard has no gutter. Use its header/hero, above all action cards.
    // The bubble sits beside the body here; its slot includes the existing bottom-aligned panel.
    const sidebar = dashboard.width <= 900 ? 176 : 214;
    const contentLeft = Math.max(pad, dashboard.x + sidebar + 22);
    const contentRight = Math.min(width - pad, dashboard.x + dashboard.width - 24);
    const heroTop = Math.max(pad, dashboard.y + 66 + 22);
    const heroBottom = Math.min(height - pad, heroTop + (dashboard.width <= 1000 ? 215 : 232));
    const x = Math.max(bodyLeft + pad, contentRight - bodyRight);
    const y = clamp(heroBottom - bodyBottom - 8, pad + bodyTop, Math.max(pad + bodyTop, height - bodyBottom - pad));
    const left = clamp(x - bodyLeft - gap - bubbleWidth, pad, Math.max(pad, width - bubbleWidth - pad));
    if (contentRight - contentLeft >= sideWidth) return { reminder: { x, y }, bubble: { left, top: Math.max(pad, heroBottom - config.bubbleHeight - 8),
      width: bubbleWidth, tail: Math.max(20, bubbleWidth - 20), side: true }, region: 'dashboard-hero' };
  }
  if (fit(usable)) return vertical(usable, 'desktop-edge');
  // Very short/tiny work areas need side-by-side placement instead of an overflowing stack.
  const x = Math.max(pad + bodyLeft, width - pad - bodyRight);
  const y = clamp(height * .30, pad + bodyTop, Math.max(pad + bodyTop, height - bodyBottom - pad));
  return { reminder: { x, y }, bubble: { left: pad, top: clamp(y - bodyTop, pad, Math.max(pad, height - config.bubbleHeight - pad)),
    width: Math.min(bubbleWidth, Math.max(0, x - bodyLeft - gap - pad)), tail: Math.max(20, bubbleWidth - 20), side: true }, region: 'compact-edge' };
}
