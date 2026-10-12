import { gsap } from 'gsap';

export type Point = { x: number; y: number };
export type Pose = 'swing' | 'ask' | 'happy' | 'point' | 'idle' | 'success';
export type Demo = ReturnType<typeof createDemo>;

export function createDemo() {
  const reminder = document.querySelector<HTMLElement>('#demo-reminder')!;
  const progress = document.querySelector<HTMLElement>('#demo-progress')!;
  const drank = document.querySelector<HTMLButtonElement>('#demo-drank')!;
  const later = document.querySelector<HTMLButtonElement>('#demo-later')!;
  const title = document.querySelector<HTMLElement>('[data-reminder-title]')!;
  const copy = document.querySelector<HTMLElement>('[data-reminder-copy]')!;
  const caption = document.querySelector<HTMLElement>('.demo-caption')!;
  const bottle = document.querySelector<HTMLElement>('.delivery-bottle')!;
  const bottleWeb = document.querySelector<SVGPathElement>('.bottle-web')!;
  const feedback = document.querySelector<HTMLElement>('.water-feedback')!;
  const abort = new AbortController();
  let reduced = false, phase = -1, manualSuccess = false, active = false, automaticPlayed = false;
  let hand: () => Point = () => ({ x: innerWidth * .6, y: innerHeight * .45 });
  let changed = () => {};
  let bottleAnimation: gsap.core.Timeline | undefined;
  let progressAnimation: gsap.core.Timeline | undefined, pendingProgress = false;
  const delivery = { length: 0, angle: 0 };

  function updateBottle() {
    const grip = hand();
    const x = grip.x + 10 + Math.sin(delivery.angle * Math.PI / 180) * delivery.length;
    const y = grip.y + Math.cos(delivery.angle * Math.PI / 180) * delivery.length;
    const width = innerWidth < 801 ? 64 : 90;
    gsap.set(bottle, { x: x - width / 2, y, rotation: delivery.angle, transformOrigin: '50% 0' });
    bottleWeb.setAttribute('d', `M${grip.x.toFixed(1)},${grip.y.toFixed(1)}Q${(grip.x + 8).toFixed(1)},${(grip.y + delivery.length * .5).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`);
  }
  function stopBottle() {
    bottleAnimation?.kill(); bottleAnimation = undefined;
    gsap.set([bottle, bottleWeb, feedback], { autoAlpha: 0 });
    bottleWeb.setAttribute('d', '');
  }
  function setProgress(percent: number) {
    const value = Math.round(percent);
    document.querySelector('[data-story-percent]')!.textContent = `${value}%`;
    document.querySelector('[data-story-water]')!.textContent = String(value * 20);
    gsap.set('.ring-fill', { strokeDashoffset: 100 - value });
    gsap.set('.mini-chart i', { scaleY: Math.max(.05, percent / 50) });
  }
  function celebrate() {
    stopBottle();
    title.textContent = 'Nice! One glass closer.';
    copy.textContent = 'A small sip. A little win. Keep going.';
    caption.textContent = 'Great choice! +250 ml in this preview.';
    drank.classList.add('is-celebrating');
    if (reduced) { setProgress(50); return; }
    bottle.style.width = innerWidth < 801 ? '64px' : '90px';
    delivery.length = 0; delivery.angle = 0;
    updateBottle();
    bottleAnimation = gsap.timeline({ onUpdate: updateBottle, onComplete: () => {
      drank.classList.remove('is-celebrating');
      if (pendingProgress && active) { pendingProgress = false; setPhase(2); }
    } });
    bottleAnimation.set(bottleWeb, { autoAlpha: .65, strokeDashoffset: 1 })
      .to(bottleWeb, { strokeDashoffset: 0, duration: .12 })
      .set(bottle, { autoAlpha: 1 })
      .fromTo(bottle, { scale: .6 }, { scale: 1, duration: .25, ease: 'back.out(1.3)' }, '<')
      .to(delivery, { length: innerWidth < 801 ? 54 : 85, duration: .3, ease: 'back.out(1.8)' }, '<')
      .to(delivery, { angle: 11, duration: .16, ease: 'sine.out' }, '-=.08')
      .to(delivery, { angle: -8, duration: .22, ease: 'sine.inOut' })
      .to(delivery, { angle: 5, duration: .22, ease: 'sine.inOut' })
      .to(delivery, { angle: -2.5, duration: .2, ease: 'sine.inOut' })
      .to(delivery, { angle: 0, duration: .18, ease: 'sine.out' })
      .fromTo(feedback, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .3 }, .45)
      .fromTo('.delivery-bottle i', { opacity: 0, x: 0, y: 0 }, { opacity: .8, x: i => [-35, 35, 22][i], y: i => [-25, -40, 30][i], duration: .35, stagger: .04 }, .45)
      .to('.delivery-bottle i', { opacity: 0, duration: .25 }, 1)
      .to(feedback, { autoAlpha: 0, y: -12, duration: .2 }, 1.05)
      .to(delivery, { length: 0, angle: 0, duration: .25, ease: 'power2.in' }, 1.2)
      .to(bottle, { autoAlpha: 0, scale: .5, duration: .2 }, 1.28)
      .to(bottleWeb, { strokeDashoffset: 1, autoAlpha: 0, duration: .18 }, 1.35);
    gsap.fromTo('.mini-progress span', { scaleX: .25 }, { scaleX: .5, duration: .5, overwrite: true });
  }
  function setPhase(next: number) {
    if (phase === next) return;
    // Let visitors read the success delivery before morphing the same mini-scene.
    if (next === 2 && bottleAnimation?.isActive()) { pendingProgress = true; return; }
    phase = next;
    document.querySelector('.how-section')!.setAttribute('data-demo-phase', String(phase));
    for (const [index, item] of [...document.querySelectorAll('.story-steps li')].entries()) item.classList.toggle('is-active', index === phase);
    if (!reduced) {
      const showProgress = phase === 2;
      reminder.inert = showProgress; progress.inert = !showProgress;
      reminder.setAttribute('aria-hidden', String(showProgress)); progress.setAttribute('aria-hidden', String(!showProgress));
      gsap.to(reminder, { autoAlpha: showProgress ? 0 : 1, scale: showProgress ? .96 : 1,
        x: showProgress ? -14 : 0, y: showProgress ? -8 : 0, duration: .35, overwrite: true });
      gsap.to(progress, { autoAlpha: showProgress ? 1 : 0, scale: showProgress ? 1 : .94,
        x: showProgress ? 0 : -14, y: showProgress ? 0 : 8, duration: .45, overwrite: true });
    }
    if (phase === 0) {
      pendingProgress = false; progressAnimation?.kill(); setProgress(0);
      title.textContent = 'Time to hydrate!'; copy.textContent = 'A little water. A little reset. Drink 250 ml?';
      caption.textContent = 'An interactive preview. Your real routine stays in the app.';
      gsap.set('.mini-progress span', { scaleX: .25 });
    }
    if (phase === 1 && !automaticPlayed) { automaticPlayed = true; celebrate(); }
    if (phase === 2) {
      stopBottle(); progressAnimation?.kill();
      const ring = { value: 0 };
      progressAnimation = gsap.timeline({ onUpdate: () => setProgress(ring.value) })
        .to(ring, { value: 25, duration: .35, ease: 'power1.out' })
        .to(ring, { value: 50, duration: .4, ease: 'sine.inOut' });
    }
    changed();
  }
  drank.addEventListener('click', () => { manualSuccess = true; automaticPlayed = true; setPhase(1); celebrate(); changed(); }, { signal: abort.signal });
  later.addEventListener('click', () => {
    stopBottle(); title.textContent = 'Okay, I’ll swing back.'; copy.textContent = 'A little reminder, when you’re ready.';
    caption.textContent = 'In the desktop app, Later uses your saved retry interval.';
  }, { signal: abort.signal });

  return {
    setScroll(value: number, inScene: boolean) {
      if (active !== inScene) document.querySelector('.how-section')!.toggleAttribute('data-active', inScene);
      active = inScene;
      if (!active) {
        if (bottleAnimation?.isActive()) stopBottle();
        if (value >= 1) { manualSuccess = false; setPhase(2); progressAnimation?.kill(); setProgress(50); }
        return;
      }
      if (value > .72) manualSuccess = false;
      setPhase(manualSuccess ? 1 : value < .36 ? 0 : value < .72 ? 1 : 2);
      if (value < .08 && !manualSuccess) automaticPlayed = false;
    },
    configureReduced(value: boolean) {
      reduced = value; stopBottle(); progressAnimation?.kill(); pendingProgress = false; phase = -1;
      reminder.inert = false; progress.inert = false;
      reminder.removeAttribute('aria-hidden'); progress.removeAttribute('aria-hidden');
      if (reduced) { gsap.set([reminder, progress], { clearProps: 'all' }); setProgress(50); }
    },
    pose: (): Pose => phase === 0 ? 'ask' : phase === 1 ? 'happy' : 'point',
    refreshAttachment() { if (bottleAnimation?.isActive()) updateBottle(); },
    handProvider(value: () => Point) { hand = value; },
    onChange(callback: () => void) { changed = callback; },
    pause(value: boolean) { bottleAnimation?.paused(value); progressAnimation?.paused(value); },
    destroy() { abort.abort(); stopBottle(); progressAnimation?.kill(); gsap.killTweensOf([reminder, progress, '.mini-progress span']); },
  };
}
