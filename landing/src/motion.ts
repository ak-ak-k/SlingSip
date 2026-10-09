import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Demo, Point, Pose } from './demo';
import type { TrayPreview } from './tray';

gsap.registerPlugin(ScrollTrigger);

type Frame = { at: number; x: number; y: number; scale: number; rotation: number; pose: Pose; tone: number; web: number };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const sockets: Record<Pose, Point> = {
  swing: { x: .86, y: .13 }, ask: { x: .52, y: .24 },
  point: { x: .89, y: .30 }, idle: { x: .76, y: .58 }, success: { x: .87, y: .31 },
};

/** One traveler owns the whole page journey. No section creates its own moving mascot. */
export function initMotion(demo: Demo, tray: TrayPreview) {
  const root = document.documentElement;
  const traveler = document.querySelector<HTMLElement>('.traveler')!;
  const art = document.querySelector<HTMLImageElement>('.traveler-art')!;
  const web = document.querySelector<SVGPathElement>('.active-web')!;
  const oldWeb = document.querySelector<SVGPathElement>('.old-web')!;
  const media = gsap.matchMedia();
  let refresh = () => {};
  let pause = (_value: boolean) => {};
  root.classList.add('enhanced');

  media.add({ all: '(min-width: 0px)', reduced: '(prefers-reduced-motion: reduce)',
    desktop: '(min-width: 801px)', pointer: '(hover: hover) and (pointer: fine)' }, context => {
    const reduced = !!context.conditions?.reduced;
    const desktop = !!context.conditions?.desktop;
    const finePointer = !!context.conditions?.pointer;
    const abort = new AbortController();
    root.classList.toggle('reduced-motion', reduced);
    demo.configureReduced(reduced);
    tray.configureReduced(reduced);
    let width = innerWidth, height = innerHeight;
    let size = parseFloat(getComputedStyle(root).getPropertyValue('--mascot-size'));
    let currentPose: Pose = (traveler.dataset.pose as Pose) || 'swing';
    const actor = { x: width * (desktop ? .78 : .64), y: height * (desktop ? .45 : .84),
      scale: 1, rotation: -5, tone: 1, web: 1 };
    const poseImages = new Map<Pose, HTMLImageElement>();
    for (const pose of Object.keys(sockets) as Pose[]) {
      const image = new Image(); image.fetchPriority = pose === 'swing' ? 'high' : 'low';
      // Assets are served relative to the page, including static subdirectory deployments.
      image.src = new URL(`assets/${pose}.png`, document.baseURI).href;
      poseImages.set(pose, image);
    }
    art.addEventListener('error', () => { art.src = new URL('assets/logo.svg', document.baseURI).href; }, { once: true, signal: abort.signal });

    function setPose(pose: Pose) {
      if (pose === currentPose) return;
      const image = poseImages.get(pose)!;
      if (!image.complete || !image.naturalWidth) return;
      currentPose = pose; art.src = image.src; traveler.dataset.pose = pose;
    }
    function hand(socket: Point = sockets[currentPose]): Point {
      const x = (socket.x - .5) * size * actor.scale;
      const y = (socket.y - .5) * size * actor.scale;
      const angle = actor.rotation * Math.PI / 180;
      return { x: actor.x + x * Math.cos(angle) - y * Math.sin(angle),
        y: actor.y + x * Math.sin(angle) + y * Math.cos(angle) };
    }
    demo.handProvider(() => hand(currentPose === 'point' ? { x: .22, y: .6 } : sockets[currentPose]));
    function drawActor(direction = 1) {
      gsap.set(traveler, { x: actor.x - size / 2, y: actor.y - size / 2,
        scale: actor.scale, rotation: actor.rotation });
      art.style.filter = `brightness(${actor.tone.toFixed(3)}) drop-shadow(0 15px 26px #0008)`;
      const grip = hand();
      // The supplied swing art already includes a short web up to its upper edge.
      // Continue that strand rather than drawing a second rope across the existing one.
      if (currentPose === 'swing' || currentPose === 'ask') {
        const exit = currentPose === 'swing' ? { x: .92, y: 0 } : { x: .52, y: 0 };
        const angle = actor.rotation * Math.PI / 180;
        const x = (exit.x - .5) * size * actor.scale, y = (exit.y - .5) * size * actor.scale;
        grip.x = actor.x + x * Math.cos(angle) - y * Math.sin(angle);
        grip.y = actor.y + x * Math.sin(angle) + y * Math.cos(angle);
      }
      // Local directional anchors keep the web out of unrelated text and UI.
      const anchorDirection = !desktop && currentPose === 'swing' ? 1 : direction;
      const anchorX = clamp(grip.x + anchorDirection * Math.min(170, width * .14), -20, width + 20);
      const anchorY = Math.max(-30, grip.y - Math.min(300, height * .4));
      web.setAttribute('d', `M${anchorX.toFixed(1)},${anchorY.toFixed(1)}Q${lerp(anchorX, grip.x, .45).toFixed(1)},${(grip.y - 60).toFixed(1)} ${grip.x.toFixed(1)},${grip.y.toFixed(1)}`);
      web.style.strokeOpacity = actor.web.toFixed(2);
    }
    drawActor();
    if (reduced) {
      setPose('swing');
      demo.onChange(() => {});
      refresh = () => {};
      pause = () => {};
      return () => abort.abort();
    }

    let frames: Frame[] = [], maximum = 1, howStart = 0, howEnd = 1;
    let intro: gsap.core.Timeline | undefined;
    let pin: ScrollTrigger | undefined;
    let lastSegment = -1, lastScroll = scrollY;
    const top = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top + scrollY;
    const frame = (at: number, x: number, y: number, scale: number, rotation: number, pose: Pose, webOpacity = 1, tone = 1): Frame =>
      ({ at: Math.max(0, at), x, y, scale, rotation, pose, web: webOpacity, tone });

    function rebuildFrames() {
      width = innerWidth; height = innerHeight;
      size = parseFloat(getComputedStyle(root).getPropertyValue('--mascot-size'));
      maximum = Math.max(1, ScrollTrigger.maxScroll(window));
      const heroBottom = top('.bridge');
      const howTop = top('.how-section');
      const dashboardTop = top('.dashboard-section');
      const featuresTop = top('.features-section');
      const trayTop = top('.tray-section');
      const futureTop = top('.future-section');
      const downloadTop = top('.download-section');
      howStart = desktop ? pin!.start : howTop + 180;
      howEnd = desktop ? pin!.end : Math.max(howStart + 300, dashboardTop - height * .55);
      const howDuration = howEnd - howStart;
      frames = desktop ? [
        frame(0, .78, .45, 1, -5, 'swing'),
        frame(heroBottom * .38, .78, .46, 1, -2, 'swing'),
        frame(heroBottom - height * .2, .83, .68, .65, 9, 'swing'),
        frame(howStart - height * .42, .63, .4, .72, -9, 'swing'),
        frame(howStart, .58, .51, .73, 2, 'ask'),
        frame(howStart + howDuration * .36, .57, .5, .73, -2, 'ask'),
        frame(howStart + howDuration * .52, .55, .48, .7, 0, 'point'),
        frame(howStart + howDuration * .78, .58, .47, .66, -3, 'point', .2),
        frame(howEnd, .59, .45, .64, 0, 'point', .1),
        frame(dashboardTop - height * .35, .89, .3, .42, 5, 'swing'),
        frame(dashboardTop + height * .35, .89, .68, .36, -5, 'point', .1),
        frame(featuresTop - height * .2, .82, .36, .36, 4, 'swing'),
        frame(featuresTop + height * .1, .69, .48, .28, -4, 'point', .2),
        frame(featuresTop + height * .35, .47, .55, .28, 5, 'swing'),
        frame(featuresTop + height * .55, .26, .48, .28, -3, 'point', .2),
        frame(trayTop - height * .2, .8, .49, .38, 7, 'swing'),
        frame(trayTop + height * .3, .83, .72, .3, 0, 'idle', .3),
        frame(futureTop - height * .3, .88, .32, .54, -5, 'point', .15, .22),
        frame(futureTop + height * .38, .87, .28, .5, -2, 'point', .1, .25),
        frame(downloadTop - height * .2, .86, .35, .78, 9, 'swing'),
        frame(downloadTop + height * .25, .77, .53, .98, -4, 'success', .15),
        frame(maximum, .8, .64, .83, 0, 'success', 0),
      ] : [
        frame(0, .64, .84, 1, -5, 'swing'), frame(heroBottom - height * .7, .7, .73, .95, 0, 'swing'),
        frame(howStart - height * .55, .84, .78, .48, 7, 'swing'),
        frame(howStart, .18, .7, .5, 2, 'ask'), frame(howEnd, .18, .57, .45, -2, 'point', .2),
        frame(dashboardTop - height * .25, .9, .23, .35, 5, 'point', .1),
        frame(featuresTop, .89, .23, .3, -5, 'swing'), frame(trayTop - height * .1, .85, .25, .34, 0, 'idle', .2),
        frame(trayTop + height * .4, .8, .72, .33, 0, 'idle', .2),
        frame(futureTop - height * .1, .9, .2, .31, 0, 'point', .1, .25),
        frame(downloadTop, .84, .19, .35, -6, 'swing'),
        frame(lerp(downloadTop, maximum, .7), .62, .79, .92, -4, 'success', .2),
        frame(maximum, .66, .72, .9, 0, 'success', 0),
      ];
      frames.sort((a, b) => a.at - b.at);
    }

    function reconnect() {
      oldWeb.setAttribute('d', web.getAttribute('d') ?? '');
      gsap.fromTo(oldWeb, { autoAlpha: .4, strokeDashoffset: 0 }, { autoAlpha: 0, strokeDashoffset: 1,
        duration: .18, overwrite: true, onComplete: () => oldWeb.setAttribute('d', '') });
      gsap.fromTo(web, { autoAlpha: 0, strokeDashoffset: 1 }, { autoAlpha: .56, strokeDashoffset: 0,
        duration: .28, delay: .19, overwrite: true });
    }
    function renderJourney(scroll: number) {
      if (document.hidden || frames.length < 2) return;
      lastScroll = scroll;
      if (intro?.isActive() && scrollY < 8) return;
      if (intro?.isActive()) intro.kill();
      const index = Math.max(0, frames.findIndex((item, i) => i < frames.length - 1 && scroll >= item.at && scroll < frames[i + 1].at));
      const segment = scroll >= frames.at(-1)!.at ? frames.length - 2 : index;
      const from = frames[segment], to = frames[segment + 1];
      const t = smooth(clamp((scroll - from.at) / Math.max(1, to.at - from.at)));
      actor.x = lerp(from.x, to.x, t) * width;
      // A shallow quadratic dip makes hops feel like swings, without spinning the body.
      actor.y = (lerp(from.y, to.y, t) + Math.sin(t * Math.PI) * Math.min(.075, Math.abs(to.x - from.x) * .3)) * height;
      actor.scale = lerp(from.scale, to.scale, t); actor.rotation = lerp(from.rotation, to.rotation, t);
      actor.tone = lerp(from.tone, to.tone, t); actor.web = lerp(from.web, to.web, t);
      const inHow = scroll >= howStart && scroll <= howEnd;
      const progress = clamp((scroll - howStart) / Math.max(1, howEnd - howStart));
      demo.setScroll(progress, inHow);
      setPose(inHow ? demo.pose() : t < .5 ? from.pose : to.pose);
      drawActor(to.x >= from.x ? 1 : -1);
      if (segment !== lastSegment) { lastSegment = segment; reconnect(); }
      gsap.set('.story-scroll-fill', { scaleX: progress });
    }
    demo.onChange(() => renderJourney(lastScroll));

    if (desktop) pin = ScrollTrigger.create({ trigger: '.how-section', pin: '.story-pin',
      start: 'top top', end: () => '+=' + innerHeight * 2.15, pinSpacing: true, anticipatePin: 1, invalidateOnRefresh: true });
    rebuildFrames();
    const scrollState = { value: 0 };
    const journey = gsap.fromTo(scrollState, { value: 0 }, { value: 1, duration: 1, ease: 'none',
      onUpdate: () => renderJourney(scrollState.value * maximum),
      scrollTrigger: { start: 0, end: 'max', scrub: .55, invalidateOnRefresh: true, onRefresh: rebuildFrames } });

    for (const item of document.querySelectorAll('[data-reveal]')) gsap.from(item, { y: 19, autoAlpha: 0,
      duration: .8, ease: 'power2.out', scrollTrigger: { trigger: item, start: 'top 91%', once: true } });
    gsap.to('.hero-copy', { y: -45, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 35%', scrub: true } });
    gsap.to('.city', { opacity: .14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.from('.bridge-thread path', { strokeDashoffset: 1, scrollTrigger: { trigger: '.bridge', start: 'top 85%', end: 'bottom 20%', scrub: true } });
    gsap.fromTo('.dashboard-preview', { rotationX: 8, rotationY: -6, y: 90, autoAlpha: .3 },
      { rotationX: 0, rotationY: 0, y: 0, autoAlpha: 1, ease: 'power1.out', scrollTrigger: { trigger: '.dashboard-section', start: 'top 80%', end: 'top 9%', scrub: .7 } });
    gsap.to('.layer-progress', { z: 22, y: -3, ease: 'none', scrollTrigger: { trigger: '.dashboard-perspective', start: 'top 80%', end: 'bottom 20%', scrub: .6 } });
    gsap.to('.layer-metrics', { z: 11, y: -1, ease: 'none', scrollTrigger: { trigger: '.dashboard-perspective', start: 'top 80%', end: 'bottom 20%', scrub: .6 } });
    let dashboardValue = 0;
    ScrollTrigger.create({ trigger: '.dashboard-perspective', start: 'top 82%', end: 'bottom 20%',
      onUpdate: self => {
        const value = [500, 1000, 1500][Math.min(2, Math.floor(self.progress * 3))];
        if (dashboardValue === value) return;
        dashboardValue = value;
        for (const image of document.querySelectorAll<HTMLImageElement>('.dashboard-image-stack img')) image.src = new URL(`assets/dashboard-${value}.png`, document.baseURI).href;
        document.querySelector('[data-dashboard-water]')!.textContent = `${value} / 2000 ml`;
        document.querySelector('[data-dashboard-remaining]')!.textContent = `${2000 - value} ml`;
        document.querySelector('[data-dashboard-percent]')!.textContent = `${value / 20}%`;
      } });

    gsap.from('.feature-card', { y: 16, autoAlpha: 0, duration: .6, stagger: .12, scrollTrigger: { trigger: '.feature-grid', start: 'top 85%', once: true } });
    gsap.fromTo('.feature-bell', { rotation: -8 }, { rotation: 8, duration: .16, repeat: 3, yoyo: true,
      transformOrigin: '50% 20%', ease: 'sine.inOut', scrollTrigger: { trigger: '[data-feature="reminders"]', start: 'top 82%', once: true } });
    gsap.from('.feature-bars i', { scaleY: .1, duration: .7, stagger: .08, ease: 'power2.out', scrollTrigger: { trigger: '[data-feature="progress"]', start: 'top 82%', once: true } });
    gsap.fromTo('.feature-flame', { opacity: .5, scale: .94 }, { opacity: 1, scale: 1.06, duration: .6, repeat: 1, yoyo: true, ease: 'sine.inOut', scrollTrigger: { trigger: '[data-feature="streaks"]', start: 'top 82%', once: true } });
    gsap.to('.feature-tray .icon', { color: '#8ce8ca', duration: .35, stagger: .23, scrollTrigger: { trigger: '[data-feature="tray"]', start: 'top 82%', once: true } });
    gsap.from('.future-card', { y: 12, autoAlpha: 0, stagger: .16, duration: .7, scrollTrigger: { trigger: '.future-grid', start: 'top 85%', once: true } });
    gsap.fromTo('.future-scan', { y: 0, opacity: 0 }, { y: () => document.querySelector('.future-section')!.clientHeight, opacity: .9,
      ease: 'none', scrollTrigger: { trigger: '.future-section', start: 'top 80%', end: 'bottom 20%', scrub: true } });

    ScrollTrigger.create({ trigger: '.desktop-demo', start: 'top 78%', end: 'bottom 25%', onUpdate: self => {
      tray.setProgress(self.progress);
    }, onLeaveBack: () => tray.resetAuto() });

    if (scrollY < 12) {
      const destination = { ...actor };
      const flight = { progress: 0 };
      const departure = { x: width + size / 2, y: -size / 2 };
      const bend = { x: width * .98, y: height * (desktop ? .8 : .98) };
      actor.x = departure.x; actor.y = departure.y; actor.rotation = -16;
      drawActor(-1);
      intro = gsap.timeline();
      intro.to(flight, { progress: 1, duration: 1.25, ease: 'power3.out', onUpdate: () => {
        const t = flight.progress, inverse = 1 - t;
        actor.x = inverse * inverse * departure.x + 2 * inverse * t * bend.x + t * t * destination.x;
        actor.y = inverse * inverse * departure.y + 2 * inverse * t * bend.y + t * t * destination.y;
        actor.rotation = lerp(-16, destination.rotation, smooth(t));
        drawActor(-1);
      } })
        .to(actor, { y: destination.y + 11, rotation: -2, duration: .16, onUpdate: () => drawActor(-1) })
        .to(actor, { y: destination.y, rotation: -5, duration: .35, ease: 'back.out(1.2)', onUpdate: () => drawActor(-1) });
      gsap.fromTo(web, { strokeDashoffset: 1, autoAlpha: 0 }, { strokeDashoffset: 0, autoAlpha: .56, duration: .7, ease: 'power2.out', overwrite: true });
      gsap.timeline({ defaults: { ease: 'power2.out' } })
        .from('.site-header .wordmark', { autoAlpha: 0, y: -8, duration: .5 }, .6)
        .from('.hero-eyebrow', { autoAlpha: 0, y: 10, duration: .5 }, .8)
        .from('.headline-line>span', { autoAlpha: 0, y: 21, duration: .65, stagger: .12 }, 1)
        .from('.hero-description', { autoAlpha: 0, y: 12, duration: .65 }, 1.45)
        .from('.hero-actions', { autoAlpha: 0, y: 10, duration: .6 }, 1.7)
        .from(['.hero-meta', '.hero-unsigned'], { autoAlpha: 0, duration: .5 }, 1.9)
        .from('.hero-note', { autoAlpha: 0, y: 10, duration: .6 }, 1.65);
    } else renderJourney(scrollY);

    let raf = 0, hidden = document.hidden;
    const target = { x: 0, y: 0, clientX: width / 2, clientY: height / 2 };
    const pointer = { ...target };
    let card: HTMLElement | null = null, cardBounds: DOMRect | null = null;
    function cursorFrame() {
      raf = 0;
      if (hidden) return;
      pointer.x = lerp(pointer.x, target.x, .085); pointer.y = lerp(pointer.y, target.y, .085);
      pointer.clientX = lerp(pointer.clientX, target.clientX, .12); pointer.clientY = lerp(pointer.clientY, target.clientY, .12);
      gsap.set('.traveler-parallax', { x: pointer.x * 10, y: pointer.y * 8, rotation: pointer.x * .65 });
      gsap.set('.traveler-glow', { x: pointer.x * 12, y: pointer.y * 10 });
      gsap.set('.ambient-halo', { x: pointer.x * -7, y: pointer.y * -5 });
      gsap.set('.city', { x: pointer.x * -3, y: pointer.y * -2 });
      gsap.set('.dashboard-perspective', { rotationY: pointer.x * 2.4, rotationX: pointer.y * -2.2 });
      if (card && cardBounds) {
        const x = clamp((pointer.clientX - cardBounds.left) / cardBounds.width);
        const y = clamp((pointer.clientY - cardBounds.top) / cardBounds.height);
        card.style.setProperty('--glow-x', `${x * 100}%`); card.style.setProperty('--glow-y', `${y * 100}%`);
        gsap.set(card, { x: (x - .5) * 4, y: (y - .5) * 4 });
      }
      if (Math.abs(target.x - pointer.x) + Math.abs(target.y - pointer.y) > .001
        || Math.abs(target.clientX - pointer.clientX) + Math.abs(target.clientY - pointer.clientY) > .1) raf = requestAnimationFrame(cursorFrame);
    }
    function wakeCursor() { if (finePointer && desktop && !raf && !hidden) raf = requestAnimationFrame(cursorFrame); }
    if (finePointer && desktop) {
      window.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        target.x = clamp(event.clientX / width * 2 - 1, -1, 1); target.y = clamp(event.clientY / height * 2 - 1, -1, 1);
        target.clientX = event.clientX; target.clientY = event.clientY; wakeCursor();
      }, { passive: true, signal: abort.signal });
      document.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; wakeCursor(); }, { signal: abort.signal });
      for (const item of document.querySelectorAll<HTMLElement>('.feature-card')) {
        item.addEventListener('pointerenter', () => { card = item; cardBounds = item.getBoundingClientRect(); wakeCursor(); }, { signal: abort.signal });
        item.addEventListener('pointerleave', () => { gsap.to(item, { x: 0, y: 0, duration: .3, overwrite: 'auto' }); if (card === item) { card = null; cardBounds = null; } }, { signal: abort.signal });
      }
    }
    refresh = () => { ScrollTrigger.refresh(); rebuildFrames(); renderJourney(scrollY); };
    pause = value => { hidden = value; journey.paused(value); intro?.paused(value); if (value) { cancelAnimationFrame(raf); raf = 0; } else { refresh(); wakeCursor(); } };
    window.addEventListener('resize', () => { cardBounds = card?.getBoundingClientRect() ?? null; }, { passive: true, signal: abort.signal });
    void document.fonts.ready.then(() => { if (!abort.signal.aborted) refresh(); });
    return () => {
      abort.abort(); cancelAnimationFrame(raf); intro?.kill(); demo.onChange(() => {});
      gsap.killTweensOf([web, oldWeb]); oldWeb.setAttribute('d', '');
    };
  });

  return { refresh: () => refresh(), pause: (value: boolean) => pause(value), destroy: () => media.revert() };
}
