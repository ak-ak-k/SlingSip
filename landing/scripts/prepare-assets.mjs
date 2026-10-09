import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SLINGSIP_SPRITE_GEOMETRY } from '../../src/app/features/companion/animation/slingsip-sprite-geometry.ts';

// Curated copies only. Never alter the desktop artwork or package the desktop app into this site.
const source = new URL('../../public/', import.meta.url);
const destination = new URL('../public/assets/', import.meta.url);
await mkdir(destination, { recursive: true });
const copies = {
  'logo.svg': 'slingsip-logo.svg',
  'swing.png': 'assets/onboarding/slingsip/welcome-hero.png',
  'ask.png': 'assets/onboarding/slingsip/routine-upside-down.png',
  'success.png': 'assets/onboarding/slingsip/success-ready.png',
  'point.png': 'assets/onboarding/slingsip/tour-dashboard.png',
  'idle.png': 'assets/onboarding/slingsip/profile-idle.png',
};
for (const [to, from] of Object.entries(copies)) await copyFile(new URL(from, source), new URL(to, destination));
const bottle = SLINGSIP_SPRITE_GEOMETRY.bottle;
const bytes = await readFile(new URL('assets/companion/slingsip/props/bottle.png', source));
const b = bottle.bounds;
await writeFile(new URL('bottle.svg', destination), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.width} ${b.height}"><defs><clipPath id="bottle"><path d="${bottle.clipPath}" clip-rule="evenodd"/></clipPath></defs><image href="data:image/png;base64,${bytes.toString('base64')}" width="${bottle.width}" height="${bottle.height}" clip-path="url(#bottle)"/></svg>`);
for (const water of [500, 1000, 1500]) {
  await copyFile(new URL(`../artwork/dashboard-${water}.png`, import.meta.url), new URL(`dashboard-${water}.png`, destination));
}
console.log(`Prepared approved SlingSip artwork and real dashboard captures in ${fileURLToPath(destination)}.`);
