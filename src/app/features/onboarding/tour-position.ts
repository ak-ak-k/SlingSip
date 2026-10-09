export interface TourRect { x: number; y: number; width: number; height: number }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** DOM viewport coordinates, including compact windows and Windows page scaling. */
export function positionTour(width: number, height: number, cardWidth: number, cardHeight: number, target: TourRect | null) {
  const pad = 12, gap = 16;
  const maxX = Math.max(pad, width - cardWidth - pad), maxY = Math.max(pad, height - cardHeight - pad);
  if (!target) return { x: clamp((width-cardWidth)/2,pad,maxX), y: clamp((height-cardHeight)/2,pad,maxY) };
  const right = target.x+target.width+gap, left = target.x-cardWidth-gap;
  const below = target.y+target.height+gap, above = target.y-cardHeight-gap;
  if (right <= maxX) return { x:right, y:clamp(target.y,pad,maxY) };
  if (left >= pad) return { x:left, y:clamp(target.y,pad,maxY) };
  if (below <= maxY) return { x:clamp(target.x,pad,maxX), y:below };
  if (above >= pad) return { x:clamp(target.x,pad,maxX), y:above };
  return { x:maxX, y:maxY };
}
