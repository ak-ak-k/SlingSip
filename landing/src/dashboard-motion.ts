import { gsap } from 'gsap';

/** Animated facsimile of the same sample dashboard values, over the real captures. */
export function createDashboardMotion(reduced: boolean) {
  const surface = document.querySelector('.dashboard-image-stack')!;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('dashboard-live'); svg.setAttribute('viewBox', '0 0 1440 1000'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs><linearGradient id="live-water-bg"><stop stop-color="#192a38"/><stop offset="1" stop-color="#172836"/></linearGradient><linearGradient id="live-remaining-bg" x2="1" y2=".3"><stop stop-color="#172837"/><stop offset="1" stop-color="#152533"/></linearGradient><linearGradient id="live-streak-bg"><stop stop-color="#162737"/><stop offset="1" stop-color="#162634"/></linearGradient></defs>
    <circle cx="363" cy="539" r="79" fill="#1a2e3a"/>
    <circle cx="363" cy="539" r="71" fill="none" stroke="#2c4350" stroke-width="8"/>
    <circle class="dashboard-live-ring" cx="363" cy="539" r="71" fill="none" stroke="#86e2cf" stroke-width="8" stroke-linecap="round" pathLength="100" stroke-dasharray="100" transform="rotate(-90 363 539)"/>
    <use href="#i-drop" x="354" y="491" width="18" height="21" fill="none" stroke="#86e2cf" stroke-width="1.4"/>
    <text class="dashboard-live-percent" x="363" y="556" text-anchor="middle" font-size="34" font-weight="600">25%</text>
    <text x="363" y="585" text-anchor="middle" font-size="10">of your daily goal</text>
    <rect x="464" y="460" width="180" height="27" rx="3" fill="url(#live-water-bg)"/>
    <text class="dashboard-live-water" x="465" y="479" font-size="16" font-weight="600">500 / 2000 ml</text>
    <rect x="949" y="431" width="120" height="39" rx="3" fill="url(#live-remaining-bg)"/>
    <text class="dashboard-live-remaining" x="952" y="462" font-size="36" font-weight="600">1500</text>
    <text x="1033" y="462" font-size="12">ml</text>
    <rect x="662" y="807" width="133" height="38" rx="3" fill="url(#live-streak-bg)"/>
    <text class="dashboard-live-streak" x="665" y="836" font-size="32" font-weight="600">2</text>
    <text x="690" y="836" font-size="11">days</text>`;
  surface.append(svg);
  const state = { water: 500, streak: 2 };
  const ring = svg.querySelector('.dashboard-live-ring')!, percent = svg.querySelector('.dashboard-live-percent')!;
  const water = svg.querySelector('.dashboard-live-water')!, remaining = svg.querySelector('.dashboard-live-remaining')!, streak = svg.querySelector('.dashboard-live-streak')!;
  const floatWater = document.querySelector('[data-dashboard-water]')!, floatRemaining = document.querySelector('[data-dashboard-remaining]')!, floatPercent = document.querySelector('[data-dashboard-percent]')!;
  let entered = reduced, target = 500, tween: gsap.core.Tween | undefined;
  function render() {
    const ml = Math.round(state.water), pct = Math.round(ml / 20);
    ring.setAttribute('stroke-dashoffset', String(100 - ml / 20)); percent.textContent = `${pct}%`;
    water.textContent = `${ml} / 2000 ml`; remaining.textContent = String(2000 - ml); streak.textContent = String(Math.round(state.streak));
    floatWater.textContent = `${ml} / 2000 ml`; floatRemaining.textContent = `${2000 - ml} ml`; floatPercent.textContent = `${pct}%`;
  }
  function animate() {
    tween?.kill();
    tween = gsap.to(state, { water: target, streak: 2, duration: reduced ? 0 : .65, ease: 'power2.out', onUpdate: render });
  }
  render();
  return {
    set(value: number) { target = value; if (entered) animate(); },
    enter() { if (entered) return; entered = true; state.water = 0; state.streak = 0; animate(); },
    pause(value: boolean) { tween?.paused(value); },
    destroy() { tween?.kill(); svg.remove(); },
  };
}
