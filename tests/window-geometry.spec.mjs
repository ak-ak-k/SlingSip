import { test, expect } from '@playwright/test';
import { getCompanionBounds } from '../electron/window-geometry.ts';

for (const [physicalWidth, physicalHeight] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
  for (const scale of [1, 1.25, 1.5]) {
    test(`Work area: ${physicalWidth} × ${physicalHeight} at ${scale * 100}%`, () => {
      // Fixtures model the DIP work area Electron supplies, with a 48 DIP taskbar.
      const area = { x: -320, y: 40, width: Math.round(physicalWidth / scale), height: Math.round(physicalHeight / scale) - 48 };
      const bounds = getCompanionBounds(area);
      expect(bounds).toEqual(area);
    });
  }
}

test('Work-area offsets account for taskbars on any edge and a primary monitor with a negative origin', () => {
  for (const area of [
    { x: -1920, y: -1080, width: 1920, height: 1032 },
    { x: 48, y: 0, width: 1872, height: 1080 },
    { x: 0, y: 48, width: 1920, height: 1032 },
    { x: 0, y: 0, width: 1872, height: 1080 },
  ]) {
    const bounds = getCompanionBounds(area);
    expect(bounds).toEqual(area);
  }
});

test('An unusually small work area contains the entire native window', () => {
  for (const area of [{ x: 25, y: -30, width: 320, height: 360 }, { x: 0, y: 0, width: 1, height: 1 }]) {
    const bounds = getCompanionBounds(area);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.x).toBeGreaterThanOrEqual(area.x);
    expect(bounds.y).toBeGreaterThanOrEqual(area.y);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.x + area.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.y + area.height);
  }
});
