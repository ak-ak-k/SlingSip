import { gsap } from 'gsap';
import type { Point, Pose } from './demo';
import { rasterizeCharacter, type RasterLayer } from './character-raster';

type Joint = 'scarf' | 'legs' | 'torso' | 'head' | 'grip' | 'free';
type Cut = { path: string; pivot: Point };
type RigPose = { cuts: Record<Exclude<Joint, 'torso'>, Cut>; chest: Point; eyes: [string, string];
  eyeCenters: [Point, Point]; grip: Point; free: Point; rope?: string };
const point = (x: number, y: number): Point => ({ x, y });
const cut = (path: string, x: number, y: number): Cut => ({ path, pivot: point(x, y) });

// Coordinates describe masks over approved, unmodified 1000 x 1000 artwork.
// These are constrained 2.5D partitions, not an authored skeletal asset pack.
const basePoses: Record<Exclude<Pose, 'happy'>, RigPose> = {
  swing: { chest: point(568, 590), grip: point(859, 144), free: point(213, 565),
    rope: 'M872 0H1000V112H885L847 107Z',
    cuts: {
      scarf: cut('M0 285H290L375 450L411 499L290 520L250 479L227 450L180 447L151 501H0Z', 348, 469),
      legs: cut('M451 622L604 607L763 589L918 724L893 959H270L266 826Z', 552, 650),
      head: cut('M302 488Q275 354 329 235L435 117Q598 128 730 238L773 327Q785 382 702 464Q661 508 595 517Q437 528 302 488Z', 545, 503),
      grip: cut('M671 503L719 373L760 272L779 178L783 78H940V276L852 472L745 554Z', 681, 522),
      free: cut('M500 508L500 593L360 638L205 682L85 638L65 520L173 440L288 498Z', 496, 545),
    }, eyes: ['M391 379Q443 329 534 405L536 444Q444 402 415 462L382 438Z', 'M560 331Q614 265 678 297L699 354Q636 332 586 397L559 375Z'],
    eyeCenters: [point(458, 411), point(625, 342)] },
  ask: { chest: point(568, 458), grip: point(519, 203), free: point(727, 710),
    rope: 'M495 0H552V183L532 197L500 180Z',
    cuts: {
      scarf: cut('M72 487H329L405 556L359 728H76Z', 352, 575),
      legs: cut('M252 18H797V356L714 422L594 351L492 380L320 370L250 276Z', 538, 332),
      head: cut('M305 505Q415 450 555 505Q641 551 695 644L716 765Q630 865 360 879L291 783L284 617Z', 533, 520),
      grip: cut('M433 177L491 142L568 154L583 286L556 391L507 471L420 472L429 379L472 304Z', 514, 442),
      free: cut('M662 527L812 578L864 674L835 767L713 813L653 726L666 671L632 593Z', 663, 553),
    }, eyes: ['M380 570Q444 515 498 600L502 648Q439 604 399 646L377 620Z', 'M513 677Q592 623 646 670L650 720Q598 686 566 748L528 731Z'],
    eyeCenters: [point(439, 601), point(586, 695)] },
  point: { chest: point(550, 536), grip: point(895, 277), free: point(223, 585),
    cuts: {
      scarf: cut('M0 245H263L359 378L400 478L292 515L202 500L115 490L0 494Z', 358, 429),
      legs: cut('M389 585L572 590L680 620L723 844L633 1000H253L243 814Z', 534, 633),
      head: cut('M242 399Q215 263 271 140L350 21Q560 21 679 178L737 253Q726 366 622 431Q454 471 242 435Z', 521, 438),
      grip: cut('M612 407L697 351L743 278L960 192L986 264L912 376L790 424L694 488L620 482Z', 627, 438),
      free: cut('M446 454L479 532L422 576L327 659L168 686L95 642L105 538L164 478L241 506L333 487Z', 446, 494),
    }, eyes: ['M319 303Q393 250 486 340L481 379Q410 344 351 395L320 371Z', 'M529 245Q587 185 630 222L650 292Q585 269 550 324L522 304Z'],
    eyeCenters: [point(405, 335), point(586, 271)] },
  idle: { chest: point(553, 531), grip: point(772, 701), free: point(233, 525),
    cuts: {
      scarf: cut('M65 315H305L393 400L409 461L333 483L271 457L190 469L65 517Z', 373, 440),
      legs: cut('M400 630L573 650L678 641L792 1000H277L301 824Z', 541, 670),
      head: cut('M282 351Q290 137 481 19Q669 42 789 280L793 335Q723 416 616 448Q456 470 322 419Z', 544, 445),
      grip: cut('M651 455L698 494L753 568L811 657L838 745L779 794L708 741L702 670L654 602L626 516Z', 645, 489),
      free: cut('M435 449L490 478L457 539L377 582L278 617L168 622L128 564L155 498L206 413L270 481Z', 458, 482),
    }, eyes: ['M379 289Q451 243 515 319L522 350Q457 326 411 366L378 345Z', 'M570 247Q640 194 681 247L686 306Q625 285 580 337L565 312Z'],
    eyeCenters: [point(447, 318), point(628, 277)] },
  success: { chest: point(585, 554), grip: point(837, 107), free: point(320, 518),
    cuts: {
      scarf: cut('M0 270H320L403 428L421 482L305 502L232 466L116 500L0 478Z', 380, 451),
      legs: cut('M431 611L607 605L755 589L807 840L652 1000H256L280 813Z', 563, 638),
      head: cut('M313 421Q278 288 356 160L432 91Q623 93 747 227L789 303Q745 411 625 468Q469 487 324 457Z', 562, 468),
      grip: cut('M671 424L753 334L765 181L744 26H1000V409L872 453L786 508L690 502Z', 683, 458),
      free: cut('M518 481L535 557L416 617L305 642L224 589L222 474L285 403L340 478Z', 509, 521),
    }, eyes: ['M398 327Q450 287 532 359L538 397Q457 357 427 421L399 403Z', 'M578 286Q646 222 678 261L695 319Q639 301 607 355L577 334Z'],
    eyeCenters: [point(468, 357), point(639, 293)] },
};
// The approved relaxed pose already smiles. A joyful reaction supplies its
// success gesture; the bottle remains a separate prop rather than being baked in.
const poses: Record<Pose, RigPose> = { ...basePoses, happy: basePoses.idle };

type Spring = { value: number; velocity: number };
function spring(state: Spring, target: number, dt: number, stiffness: number, damping: number) {
  state.velocity += ((target - state.value) * stiffness - state.velocity * damping) * dt;
  state.value += state.velocity * dt;
}
const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
function around(p: Point, pivot: Point, angle: number, scaleY = 1): Point {
  const radians = angle * Math.PI / 180, x = p.x - pivot.x, y = (p.y - pivot.y) * scaleY;
  return point(pivot.x + x * Math.cos(radians) - y * Math.sin(radians), pivot.y + x * Math.sin(radians) + y * Math.cos(radians));
}

export function createCharacterRig(host: HTMLElement, reduced: boolean, lowPower: boolean) {
  const abort = new AbortController();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('character-rig'); svg.setAttribute('viewBox', '0 0 1000 1000'); svg.setAttribute('aria-hidden', 'true');
  svg.classList.toggle('rig-low-power', lowPower);
  const order: Exclude<Joint, 'torso'>[] = ['scarf', 'legs', 'head', 'grip', 'free'];
  const definitions: string[] = [], banks = new Map<Pose, SVGGElement>(), images = new Map<Pose, HTMLImageElement>();
  const rasterCache = new Map<RigPose, Promise<Map<string, RasterLayer>>>(), urls = new Set<string>();
  const maximumDisplaySize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mascot-max-size'));
  const rasterSize = Math.min(1000, Math.ceil((maximumDisplaySize || 440) * (devicePixelRatio || 1)));
  let destroyed = false;
  for (const [pose, config] of Object.entries(poses) as [Pose, RigPose][]) {
    const id = 'landing-rig-' + pose;
    const uri = new URL(`assets/${pose === 'happy' ? 'idle' : pose}.png`, document.baseURI).href;
    definitions.push(`<g id="${id}-source"${config.rope ? ` mask="url(#${id}-rope)"` : ''}><image href="${uri}" width="1000" height="1000"/></g>`);
    if (config.rope) definitions.push(`<mask id="${id}-rope" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1200" height="1200"><rect x="-100" y="-100" width="1200" height="1200" fill="white"/><path d="${config.rope}" fill="black"/></mask>`);
    definitions.push(`<mask id="${id}-body" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1200" height="1200"><rect width="1000" height="1000" fill="white"/>${order.map(joint => `<path d="${config.cuts[joint].path}" fill="black" stroke="white" stroke-width="12" stroke-linejoin="round"/>`).join('')}</mask>`);
    for (const [index, joint] of order.entries()) {
      definitions.push(`<mask id="${id}-${joint}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1200" height="1200"><path d="${config.cuts[joint].path}" fill="white"/>${order.slice(index + 1).map(next => `<path d="${config.cuts[next].path}" fill="black"/>`).join('')}${joint === 'head' ? config.eyes.map(d => `<path d="${d}" fill="black"/>`).join('') : ''}</mask>`);
    }
    config.eyes.forEach((d, i) => definitions.push(`<clipPath id="${id}-eye-${i}"><path d="${d}"/></clipPath>`));
  }
  svg.innerHTML = `<defs>${definitions.join('')}</defs>`;
  const life = document.createElementNS(svg.namespaceURI, 'g') as SVGGElement;
  life.classList.add('rig-life'); svg.append(life);
  for (const [pose, config] of Object.entries(poses) as [Pose, RigPose][]) {
    const id = 'landing-rig-' + pose;
    const bank = document.createElementNS(svg.namespaceURI, 'g') as SVGGElement;
    bank.classList.add('rig-pose'); bank.dataset.rigPose = pose; bank.style.opacity = '0'; bank.style.visibility = 'hidden';
    const layer = (joint: Exclude<Joint, 'torso'>) => `<g class="rig-${joint}" data-joint="${joint}"><use data-raster-key="${joint}" href="#${id}-source" mask="url(#${id}-${joint})"/>${joint === 'head' ? config.eyes.map((d, i) => `<path d="${d}" fill="#101319"/><g class="rig-eye" data-eye="${i}"><use data-raster-key="eye-${i}" href="#${id}-source" clip-path="url(#${id}-eye-${i})"/></g>`).join('') : ''}</g>`;
    bank.innerHTML = `<g class="rig-torso" data-joint="torso">${layer('scarf')}${layer('legs')}<use data-raster-key="body" href="#${id}-source" mask="url(#${id}-body)"/>${layer('head')}${layer('grip')}${layer('free')}</g>`;
    life.append(bank); banks.set(pose, bank);
    for (const joint of ['torso', ...order] as Joint[]) {
      const node = bank.querySelector<SVGGElement>(`.rig-${joint}`)!;
      const pivot = joint === 'torso' ? config.chest : config.cuts[joint].pivot;
      node.style.transformOrigin = `${pivot.x}px ${pivot.y}px`;
    }
    bank.querySelectorAll<SVGGElement>('.rig-eye').forEach((node, i) => {
      node.style.transformOrigin = `${config.eyeCenters[i].x}px ${config.eyeCenters[i].y}px`;
    });
    const image = new Image(); images.set(pose, image); image.src = new URL(`assets/${pose === 'happy' ? 'idle' : pose}.png`, document.baseURI).href;
    image.addEventListener('load', () => {
      // Pose selection must remain immediate even before its cache finishes.
      // Replace each original mask progressively with identical cached pixels.
      if (pose === desired) setPose(pose);
      if (!rasterCache.has(config)) rasterCache.set(config, rasterizeCharacter(image, config, url => {
        if (destroyed) URL.revokeObjectURL(url); else urls.add(url);
      }, abort.signal, (key, part) => {
        if (destroyed) return;
        for (const [otherPose, otherBank] of banks) {
          if (poses[otherPose] !== config) continue;
          const use = otherBank.querySelector<SVGUseElement>(`[data-raster-key="${key}"]`);
          if (!use) continue;
          const cached = document.createElementNS(svg.namespaceURI, 'image');
          for (const [key, value] of Object.entries({ href: part.url, x: part.x, y: part.y, width: part.width, height: part.height })) cached.setAttribute(key, String(value));
          use.replaceWith(cached);
        }
      }, rasterSize));
      void rasterCache.get(config)!.then(() => {
        if (destroyed) return;
        bank.dataset.rasterReady = 'true';
      }).catch(() => { /* Keep approved SVG partitions when caching is unsupported. */ });
    }, { signal: abort.signal });
  }
  host.append(svg);
  const shadow = document.createElement('div'); shadow.className = 'traveler-shadow'; host.append(shadow);
  const joints = Object.fromEntries((['torso', ...order] as Joint[]).map(name => [name, { value: 0, velocity: 0 }])) as Record<Joint, Spring>;
  const reaction = { x: 0, y: 0, scaleY: 1, head: 0, hand: 0 };
  let pose: Pose = 'swing', desired: Pose = 'swing', started = false, blend: gsap.core.Tween | undefined;
  let reactionTimeline: gsap.core.Timeline | undefined;
  let breath = 0, unit = 1, time = 0, nextBlink = 3.3 + Math.random() * 2.5, blink = 0;
  let cursor = point(0, 0);
  const nodes = new Map<Pose, Record<Joint, SVGGElement>>();
  const eyeNodes = new Map<Pose, SVGGElement[]>();
  for (const [key, bank] of banks) nodes.set(key, Object.fromEntries((['torso', ...order] as Joint[]).map(joint => [joint, bank.querySelector(`.rig-${joint}`)])) as Record<Joint, SVGGElement>);
  for (const [key, bank] of banks) eyeNodes.set(key, [...bank.querySelectorAll<SVGGElement>('.rig-eye')]);
  function setPose(next: Pose) {
    desired = next;
    const image = images.get(next)!;
    if (!image.complete || !image.naturalWidth || destroyed) return false;
    if (started && pose === next) return false;
    blend?.kill();
    const previous = banks.get(pose)!; pose = next;
    const current = banks.get(pose)!;
    for (const bank of banks.values()) if (bank !== previous && bank !== current) { gsap.set(bank, { autoAlpha: 0 }); bank.classList.remove('rig-active'); }
    current.classList.add('rig-active');
    if (started && previous !== current && !reduced) {
      gsap.set(current, { autoAlpha: 0 });
      blend = gsap.to([previous, current], { opacity: i => i === 0 ? 0 : 1, duration: .13, overwrite: true,
        onStart: () => { current.style.visibility = 'visible'; }, onComplete: () => { previous.style.visibility = 'hidden'; previous.classList.remove('rig-active'); } });
    } else gsap.set(current, { autoAlpha: 1 });
    started = true; host.classList.add('rig-ready'); host.parentElement!.dataset.pose = pose;
    return true;
  }
  function react(kind: 'arrive' | 'happy' | 'point' | 'waiting', direction = 1) {
    if (reduced) return;
    reactionTimeline?.kill(); gsap.set(reaction, { x: 0, y: 0, scaleY: 1, head: 0, hand: 0 });
    svg.dataset.reaction = kind;
    reactionTimeline = gsap.timeline({ onComplete: () => { svg.dataset.reaction = 'idle'; } });
    if (kind === 'arrive') reactionTimeline
      .to(reaction, { x: direction * 7, y: 3, scaleY: .97, duration: .12, ease: 'power2.out' })
      .to(reaction, { x: -direction * 2, y: -1, scaleY: 1.02, duration: .15, ease: 'sine.inOut' })
      .to(reaction, { x: 0, y: 0, scaleY: 1, duration: .2, ease: 'sine.out' });
    else reactionTimeline.to(reaction, { head: kind === 'waiting' ? 2 : -2.5, hand: kind === 'happy' ? -4 : 2,
      scaleY: kind === 'happy' ? 1.012 : 1, duration: .2, ease: 'power2.out' })
      .to(reaction, { head: 0, hand: 0, scaleY: 1, duration: .45, ease: 'sine.inOut' });
  }
  function update(dt: number, velocity: Point, travel: number, size: number, pointer: Point, tone: number) {
    if (reduced || destroyed) return;
    time += dt; unit = 1000 / size; cursor = pointer;
    // Keep blinking/breathing on elapsed time, but bound the spring integration
    // step so a slow frame cannot destabilize a joint.
    const springDt = Math.min(dt, .034);
    const resting = Math.max(0, 1 - travel);
    breath = Math.sin(time * Math.PI * .54) * 2.2 * unit * resting;
    const targets: Record<Joint, number> = {
      torso: clamp(-velocity.x * .004, 2.8) + Math.sin(time * 1.3) * .18 * resting,
      head: clamp(-velocity.x * .003, 2.5) + cursor.x * 1.2 + Math.sin(time * .92) * 1.1 * resting + reaction.head,
      scarf: clamp(-velocity.x * .018 + velocity.y * .003, 8) + Math.sin(time * 1.45 - .8) * 1.6 * resting,
      legs: clamp(-velocity.x * .009 - velocity.y * .002, 4.5) + Math.sin(time * 1.2 - .5) * .35 * resting,
      grip: -joints.torso.value * .65 + Math.sin(time * 1.4 + .5) * .3 * resting,
      free: clamp(velocity.x * .004, 2.2) + reaction.hand + Math.sin(time * 1.16) * .65 * resting,
    };
    for (const joint of ['torso', ...order] as Joint[]) spring(joints[joint], targets[joint], springDt, joint === 'scarf' ? 43 : joint === 'head' ? 95 : 135, joint === 'scarf' ? 10 : 18);
    if (time >= nextBlink) {
      const elapsed = time - nextBlink;
      blink = elapsed < .075 ? elapsed / .075 : Math.max(0, 1 - (elapsed - .075) / .12);
      if (elapsed > .195) { blink = 0; nextBlink = time + 3.3 + Math.random() * 2.5; }
    }
    svg.dataset.blink = blink > .2 ? 'closed' : 'open';
    life.style.transform = `translate3d(${(reaction.x * unit).toFixed(2)}px,${(reaction.y * unit).toFixed(2)}px,0)`;
    life.style.opacity = String(Math.max(.28, tone));
    for (const [key, bank] of banks) {
      if (bank.style.visibility === 'hidden') continue;
      for (const joint of ['torso', ...order] as Joint[]) {
        const node = nodes.get(key)![joint];
        node.style.transform = joint === 'torso' ? `translate3d(0,${breath.toFixed(2)}px,0) rotate(${joints.torso.value.toFixed(3)}deg) scaleY(${reaction.scaleY.toFixed(4)})` : `rotate(${joints[joint].value.toFixed(3)}deg)`;
      }
      eyeNodes.get(key)!.forEach((node, i) => {
        node.style.transform = `translate(${(cursor.x * 1.8).toFixed(2)}px,${(cursor.y * 1.2).toFixed(2)}px) scaleY(${Math.max(.035, 1 - blink * (i ? .96 : .97)).toFixed(3)})`;
      });
    }
    shadow.style.opacity = String((pose === 'idle' ? .22 : .06) * resting);
    shadow.style.transform = `scale(${(1 - Math.abs(breath) * .001).toFixed(3)},1)`;
  }
  function socket(kind: 'grip' | 'free' = 'grip'): Point {
    const config = poses[pose];
    let p = around(config[kind], config.cuts[kind].pivot, joints[kind].value);
    p = around(p, config.chest, joints.torso.value, reaction.scaleY);
    return point((p.x + reaction.x * unit) / 1000, (p.y + breath + reaction.y * unit) / 1000);
  }
  setPose('swing');
  return {
    setPose, update, socket, react, pose: () => pose,
    pause(value: boolean) { blend?.paused(value); reactionTimeline?.paused(value); svg.classList.toggle('rig-paused', value); },
    destroy() { destroyed = true; abort.abort(); blend?.kill(); reactionTimeline?.kill();
      gsap.killTweensOf([...banks.values(), reaction]); svg.remove(); shadow.remove(); host.classList.remove('rig-ready');
      for (const url of urls) URL.revokeObjectURL(url); urls.clear(); },
  };
}
