import { gsap } from 'gsap';

/** Browser-only close/reopen preview. Never contacts the real desktop application. */
export function createTrayPreview() {
  const abort = new AbortController();
  const close = document.querySelector<HTMLButtonElement>('.window-close')!;
  const open = document.querySelector<HTMLButtonElement>('.tray-open')!;
  const window = document.querySelector<HTMLElement>('.tray-window')!;
  let reduced = false, manual: boolean | null = null, closed = false;
  function show(value: boolean) {
    closed = value;
    window.inert = value;
    gsap.to(window, { scale: value ? .16 : 1, x: value ? 100 : 0, y: value ? 125 : 0,
      autoAlpha: value ? 0 : 1, duration: reduced ? 0 : .5, ease: 'power2.inOut', overwrite: true });
    gsap.to('.tray-reminder', { autoAlpha: value ? 1 : 0, y: value ? 0 : 10,
      duration: reduced ? 0 : .4, delay: value && !reduced ? .35 : 0, overwrite: true });
    document.querySelector('[data-tray-status]')!.textContent = value ? 'Window closed. Your sidekick stays in the tray.' : 'Try closing this little dashboard →';
    document.querySelector('.desktop-demo')!.setAttribute('data-tray-state', value ? 'closed' : 'open');
  }
  close.addEventListener('click', () => { manual = true; show(true); open.focus({ preventScroll: true }); }, { signal: abort.signal });
  open.addEventListener('click', () => { manual = false; show(false); }, { signal: abort.signal });
  return {
    configureReduced(value: boolean) { reduced = value; show(closed); },
    setProgress(value: number) { const next = value > .5; if (manual === null && next !== closed) show(next); },
    resetAuto() { manual = null; show(false); },
    pause(value: boolean) { for (const tween of gsap.getTweensOf([window, '.tray-reminder'])) tween.paused(value); },
    destroy() { abort.abort(); gsap.killTweensOf([window, '.tray-reminder']); },
  };
}
export type TrayPreview = ReturnType<typeof createTrayPreview>;
