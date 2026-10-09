import { type Rectangle } from '../shared/desktop-contract';

export function getCompanionBounds(workArea: Rectangle): Rectangle {
  // Electron work areas and BrowserWindow bounds are DIPs, including their origins.
  // A full usable-desktop canvas lets the same character cross both screen edges.
  return { ...workArea };
}
