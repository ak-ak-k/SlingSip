import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Demo, Point, Pose } from './demo';
import type { TrayPreview } from './tray';
import { createCharacterRig } from './character-rig';
import { sampleSwing } from './swing-path';
import { createDashboardMotion } from './dashboard-motion';

gsap.registerPlugin(ScrollTrigger);

type Frame = { at: number; x: number; y: number; scale: number; rotation: number; pose: Pose; tone: number; web: number };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

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
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const lowPower = !desktop || !!connection?.saveData || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
    const rig = createCharacterRig(document.querySelector<HTMLElement>('.traveler-parallax')!, reduced, lowPower);
    const dashboard = createDashboardMotion(reduced);
    const actor = { x: width * (desktop ? .78 : .64), y: height * (desktop ? .45 : .84),
      scale: 1, rotation: -5, tone: 1, web: 1 };
    const target = { x: 0, y: 0, clientX: width / 2, clientY: height / 2 };
    const pointer = { ...target }, velocity = { x: 0, y: 0 }, previous = { x: actor.x, y: actor.y };
    let speed = 0, heading = -1, lastTick = 0, hidden = document.hidden;
    let webAnchor: Point | undefined, webTimeline: gsap.core.Timeline | undefined;
    const tether = { draw: 0 };
    art.addEventListener('error', () => { art.src = new URL('assets/logo.svg', document.baseURI).href; }, { once: true, signal: abort.signal });

    function setPose(pose: Pose) {
      if (rig.setPose(pose)) reconnect();
    }
    function hand(kind: 'grip' | 'free' = 'grip'): Point {
      const socket = rig.socket(kind);
      const x = ((socket.x - .5) * size + pointer.x * 10) * actor.scale;
      const y = ((socket.y - .5) * size + pointer.y * 8) * actor.scale;
      const angle = actor.rotation * Math.PI / 180;
      return { x: actor.x + x * Math.cos(angle) - y * Math.sin(angle),
        y: actor.y + x * Math.sin(angle) + y * Math.cos(angle) };
    }
    demo.handProvider(() => hand('free'));
    function drawActor(direction = heading, updateRoot = true) {
      heading = direction;
      if (updateRoot) gsap.set(traveler, { x: actor.x - size / 2, y: actor.y - size / 2,
        scale: actor.scale, rotation: actor.rotation });
      const grip = hand();
      const hanging = rig.pose() === 'swing' || rig.pose() === 'ask';
      if (reduced || !webAnchor || actor.web < .055 || (!hanging && speed < .08)) {
        if (web.getAttribute('d')) web.setAttribute('d', '');
        return;
      }
      if (Math.hypot(grip.x - webAnchor.x, grip.y - webAnchor.y) > 360 && !webTimeline?.isActive()) reconnect();
      // The hand includes joint, breathing, arrival and pointer transforms. The anchor
      // remains fixed during each short swing; fast travel tightens the curve.
      const sag = lerp(20, 4, speed);
      const d = `M${grip.x.toFixed(1)},${grip.y.toFixed(1)}Q${((grip.x + webAnchor.x) * .5 - velocity.x * .012).toFixed(1)},${((grip.y + webAnchor.y) * .5 + sag).toFixed(1)} ${webAnchor.x.toFixed(1)},${webAnchor.y.toFixed(1)}`;
      if (web.getAttribute('d') !== d) web.setAttribute('d', d);
      web.style.strokeOpacity = (actor.web * .65).toFixed(2);
      web.style.strokeDashoffset = String(1 - tether.draw);
    }
    drawActor();
    if (reduced) {
      setPose('swing');
      demo.onChange(() => {});
      refresh = () => {};
      pause = () => {};
      return () => { abort.abort(); rig.destroy(); dashboard.destroy(); };
    }

    let frames: Frame[] = [], maximum = 1, howStart = 0, howEnd = 1, refreshing = false;
    let intro: gsap.core.Timeline | undefined;
    let pin: ScrollTrigger | undefined;
    let lastSegment = -1, lastScroll = scrollY, arrivedFor = -1;
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

    function reconnect(anchor?: Point) {
      if (reduced) return;
      webTimeline?.kill();
      oldWeb.setAttribute('d', web.getAttribute('d') ?? '');
      web.style.opacity = '0'; tether.draw = 0;
      webTimeline = gsap.timeline().fromTo(oldWeb, { autoAlpha: .28, strokeDashoffset: 0 },
        { autoAlpha: 0, strokeDashoffset: 1, duration: .1, onComplete: () => oldWeb.setAttribute('d', '') })
        .call(() => {
          const grip = hand();
          const reach = rig.pose() === 'ask' ? 32 : Math.min(160, width * .14);
          webAnchor = anchor ?? { x: clamp(grip.x + heading * reach, -20, width + 20),
            y: Math.max(-30, grip.y - Math.min(240, height * .3)) };
          web.style.opacity = '.56';
        }).to(tether, { draw: 1, duration: .18, ease: 'power2.out' });
    }
    function renderJourney(scroll: number) {
      if (refreshing || document.hidden || frames.length < 2) return;
      lastScroll = scroll;
      if (intro && intro.progress() < 1 && scrollY < 8) return;
      if (intro && intro.progress() < 1) intro.kill();
      const index = Math.max(0, frames.findIndex((item, i) => i < frames.length - 1 && scroll >= item.at && scroll < frames[i + 1].at));
      const segment = scroll >= frames.at(-1)!.at ? frames.length - 2 : index;
      const from = frames[segment], to = frames[segment + 1];
      const progressOnArc = clamp((scroll - from.at) / Math.max(1, to.at - from.at));
      const swing = sampleSwing({ x: from.x * width, y: from.y * height }, { x: to.x * width, y: to.y * height },
        progressOnArc, height * Math.min(desktop ? .09 : .035, Math.abs(to.x - from.x) * .3));
      const t = swing.t;
      actor.x = swing.x; actor.y = swing.y;
      actor.scale = lerp(from.scale, to.scale, t); actor.rotation = lerp(from.rotation, to.rotation, t);
      actor.rotation += swing.rotation;
      actor.tone = lerp(from.tone, to.tone, t); actor.web = lerp(from.web, to.web, t);
      const inHow = scroll >= howStart && scroll <= howEnd;
      const progress = clamp((scroll - howStart) / Math.max(1, howEnd - howStart));
      // Native pinning can expose a clickable reminder before the scrubbed
      // traveler catches up. Do not cancel that click's delivery in the gap.
      const reminderVisible = scrollY >= howStart - height * .15 && scrollY <= howEnd;
      demo.setScroll(progress, inHow || reminderVisible);
      setPose(inHow ? demo.pose() : t < .5 ? from.pose : to.pose);
      drawActor(to.x >= from.x ? 1 : -1);
      if (segment !== lastSegment) { lastSegment = segment; reconnect(); }
      if (progressOnArc > .94 && arrivedFor !== segment) { arrivedFor = segment; rig.react('arrive', heading); }
      gsap.set('.story-scroll-fill', { scaleX: progress });
    }
    let lastDemoPose: Pose = 'ask';
    demo.onChange(() => {
      const pose = demo.pose();
      if (pose !== lastDemoPose) { rig.react(pose === 'happy' ? 'happy' : pose === 'point' ? 'point' : 'waiting'); lastDemoPose = pose; }
      renderJourney(lastScroll);
    });

    // Refresh temporarily reverts pin geometry and scrubs animations while it
    // measures. Those intermediate positions must never select story states.
    const beginRefresh = () => { refreshing = true; };
    const endRefresh = () => { rebuildFrames(); refreshing = false; renderJourney(scrollY); };
    ScrollTrigger.addEventListener('refreshInit', beginRefresh);
    ScrollTrigger.addEventListener('refresh', endRefresh);

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
    gsap.to('.dashboard-float', { y: -8, ease: 'none', scrollTrigger: { trigger: '.dashboard-perspective', start: 'top 80%', end: 'bottom 20%', scrub: .65 } });
    let dashboardValue = 0;
    ScrollTrigger.create({ trigger: '.dashboard-perspective', start: 'top 82%', end: 'bottom 20%',
      onEnter: () => dashboard.enter(), onEnterBack: () => dashboard.enter(),
      onUpdate: self => {
        const value = [500, 1000, 1500][Math.min(2, Math.floor(self.progress * 3))];
        if (dashboardValue === value) return;
        dashboardValue = value;
        for (const image of document.querySelectorAll<HTMLImageElement>('.dashboard-image-stack img')) image.src = new URL(`assets/dashboard-${value}.png`, document.baseURI).href;
        dashboard.set(value);
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
      const bend = { x: width * .92, y: height * (desktop ? .83 : .98) };
      actor.x = departure.x; actor.y = departure.y; actor.rotation = -16;
      drawActor(-1);
      reconnect({ x: width * .86, y: -25 });
      intro = gsap.timeline({ onComplete: () => rig.react('arrive', -1) });
      intro.to(flight, { progress: 1, duration: 1.22, ease: 'sine.inOut', onUpdate: () => {
        const t = flight.progress, inverse = 1 - t;
        actor.x = inverse * inverse * departure.x + 2 * inverse * t * bend.x + t * t * destination.x;
        actor.y = inverse * inverse * departure.y + 2 * inverse * t * bend.y + t * t * destination.y;
        const dx = 2 * inverse * (bend.x - departure.x) + 2 * t * (destination.x - bend.x);
        const dy = 2 * inverse * (bend.y - departure.y) + 2 * t * (destination.y - bend.y);
        actor.rotation = lerp(-16, destination.rotation, smooth(t)) + clamp((Math.atan2(dy, -dx) * 180 / Math.PI - 30) * .14, -8, 8) * Math.sin(t * Math.PI);
        drawActor(-1);
      } }, .1);
      gsap.timeline({ defaults: { ease: 'power2.out' } })
        .from('.site-header .wordmark', { autoAlpha: 0, y: -8, duration: .4 }, .18)
        .from('.hero-eyebrow', { autoAlpha: 0, y: 10, duration: .45 }, .28)
        .from('.headline-line>span', { autoAlpha: 0, y: 21, duration: .6, stagger: .09 }, .38)
        .from('.hero-description', { autoAlpha: 0, y: 12, duration: .5 }, .8)
        .from('.hero-note', { autoAlpha: 0, y: 10, duration: .5 }, .92)
        .from('.hero-actions', { autoAlpha: 0, y: 10, duration: .5 }, 1.1)
        .from(['.hero-meta', '.hero-unsigned'], { autoAlpha: 0, duration: .4 }, 1.28);
    } else renderJourney(scrollY);

    let card: HTMLElement | null = null, cardBounds: DOMRect | null = null;
    function cursorFrame() {
      if (!finePointer || !desktop) return;
      pointer.x = lerp(pointer.x, target.x, .085); pointer.y = lerp(pointer.y, target.y, .085);
      pointer.clientX = lerp(pointer.clientX, target.clientX, .12); pointer.clientY = lerp(pointer.clientY, target.clientY, .12);
      gsap.set('.traveler-parallax', { x: pointer.x * 10, y: pointer.y * 8 });
      gsap.set('.traveler-glow', { x: pointer.x * 12, y: pointer.y * 10 });
      gsap.set('.ambient-halo', { x: pointer.x * -5, y: pointer.y * -4 });
      gsap.set('.city', { x: pointer.x * -4, y: pointer.y * -3 });
      gsap.set('.dashboard-perspective', { rotationY: pointer.x * 2.4, rotationX: pointer.y * -2.2 });
      if (card && cardBounds) {
        const x = clamp((pointer.clientX - cardBounds.left) / cardBounds.width);
        const y = clamp((pointer.clientY - cardBounds.top) / cardBounds.height);
        card.style.setProperty('--glow-x', `${x * 100}%`); card.style.setProperty('--glow-y', `${y * 100}%`);
        gsap.set(card, { x: (x - .5) * 4, y: (y - .5) * 4 });
      }
    }
    // One shared GSAP ticker owns character life, joints, sockets and smoothed
    // pointer input. No layout measurement, Angular work or extra RAF loop here.
    function lifeFrame(_time: number, elapsedMs: number) {
      if (hidden) return;
      lastTick += elapsedMs;
      if (lowPower && lastTick < 32) return;
      const dt = lastTick / 1000; lastTick = 0;
      velocity.x = lerp(velocity.x, clamp((actor.x - previous.x) / dt, -1100, 1100), .18);
      velocity.y = lerp(velocity.y, clamp((actor.y - previous.y) / dt, -1100, 1100), .18);
      previous.x = actor.x; previous.y = actor.y;
      speed = clamp(Math.hypot(velocity.x, velocity.y) / 500);
      if (Math.abs(target.x - pointer.x) + Math.abs(target.y - pointer.y) > .001 || card) cursorFrame();
      rig.update(dt, velocity, speed, size, pointer, actor.tone);
      demo.refreshAttachment(); drawActor(heading, false);
      traveler.dataset.motion = speed > .08 ? 'travel' : 'idle';
    }
    gsap.ticker.add(lifeFrame);
    if (finePointer && desktop) {
      window.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        target.x = clamp(event.clientX / width * 2 - 1, -1, 1); target.y = clamp(event.clientY / height * 2 - 1, -1, 1);
        target.clientX = event.clientX; target.clientY = event.clientY;
      }, { passive: true, signal: abort.signal });
      document.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; }, { signal: abort.signal });
      for (const item of document.querySelectorAll<HTMLElement>('.feature-card')) {
        item.addEventListener('pointerenter', () => { card = item; cardBounds = item.getBoundingClientRect(); }, { signal: abort.signal });
        item.addEventListener('pointerleave', () => { gsap.to(item, { x: 0, y: 0, duration: .3, overwrite: 'auto' }); if (card === item) { card = null; cardBounds = null; } }, { signal: abort.signal });
      }
    }
    refresh = () => { ScrollTrigger.refresh(); rebuildFrames(); renderJourney(scrollY); };
    pause = value => {
      hidden = value; journey.paused(value); intro?.paused(value); webTimeline?.paused(value); rig.pause(value); dashboard.pause(value);
      if (value) gsap.ticker.remove(lifeFrame);
      else { lastTick = 0; previous.x = actor.x; previous.y = actor.y; refresh(); gsap.ticker.add(lifeFrame); }
    };
    window.addEventListener('resize', () => { cardBounds = card?.getBoundingClientRect() ?? null; }, { passive: true, signal: abort.signal });
    void document.fonts.ready.then(() => { if (!abort.signal.aborted) refresh(); });
    return () => {
      abort.abort(); gsap.ticker.remove(lifeFrame); intro?.kill(); webTimeline?.kill(); rig.destroy(); dashboard.destroy(); demo.onChange(() => {});
      ScrollTrigger.removeEventListener('refreshInit', beginRefresh);
      ScrollTrigger.removeEventListener('refresh', endRefresh);
      gsap.killTweensOf([web, oldWeb]); oldWeb.setAttribute('d', '');
    };
  });

  return { refresh: () => refresh(), pause: (value: boolean) => pause(value), destroy: () => media.revert() };
}
