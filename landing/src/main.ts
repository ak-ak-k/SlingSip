import { initDownloads } from './download';
import { createDemo } from './demo';
import { initMotion } from './motion';
import { createTrayPreview } from './tray';
import { gsap } from 'gsap';

const demo = createDemo();
const tray = createTrayPreview();
const motion = initMotion(demo, tray);
const stopDownloads = initDownloads();
const abort = new AbortController();
for (const link of document.querySelectorAll<HTMLElement>('.download-link')) link.addEventListener('click', () => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(link, { scale: .98 }, { scale: 1, duration: .2, ease: 'power2.out', clearProps: 'transform', overwrite: true });
  const strand = link.querySelector('.button-web path');
  if (strand) gsap.fromTo(strand, { strokeDashoffset: 0 }, { strokeDashoffset: 1, duration: .25, clearProps: 'strokeDashoffset', overwrite: true });
}, { signal: abort.signal });
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('page-hidden', document.hidden);
  motion.pause(document.hidden); demo.pause(document.hidden); tray.pause(document.hidden);
}, { signal: abort.signal });
window.addEventListener('pageshow', event => {
  if (event.persisted) { document.body.classList.toggle('page-hidden', document.hidden); motion.pause(document.hidden); demo.pause(document.hidden); tray.pause(document.hidden); }
}, { signal: abort.signal });
window.addEventListener('pagehide', event => {
  if (event.persisted) { motion.pause(true); demo.pause(true); tray.pause(true); return; }
  abort.abort(); stopDownloads(); motion.destroy(); demo.destroy(); tray.destroy();
  gsap.killTweensOf(['.download-link', '.button-web path']);
}, { signal: abort.signal });
