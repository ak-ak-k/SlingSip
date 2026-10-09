import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Original, replaceable Phase 3 development art. All frames share a 240×320 canvas
// and a 310px foot baseline. The stance foot advances opposite screen movement.
const output = path.resolve('public/assets/character/development');
const tau = Math.PI * 2;
const n = (value) => Number(value.toFixed(2));
const p = (point) => `${n(point.x)} ${n(point.y)}`;

function knee(hip, ankle, boneLength) {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const distance = Math.hypot(dx, dy);
  const bend = Math.sqrt(Math.max(0, boneLength ** 2 - (distance / 2) ** 2));
  return { x: (hip.x + ankle.x) / 2 - dy / distance * bend, y: (hip.y + ankle.y) / 2 + dx / distance * bend };
}

function foot(phase) {
  const stride = 110;
  if (phase < .6) return { x: -33 + stride * phase, lift: 0 };
  const swing = (phase - .6) / .4;
  return { x: 33 - 66 * swing, lift: Math.sin(Math.PI * swing) * 25 };
}

function leg(hip, ankle, foreground, walking) {
  const joint = knee(hip, ankle, walking ? 61 : 51);
  return `<g stroke-linecap="round" stroke-linejoin="round">
    <path d="M${p(hip)} L${p(joint)} L${p(ankle)}" stroke="#182e37" stroke-width="25" fill="none"/>
    <path d="M${p(hip)} L${p(joint)} L${p(ankle)}" stroke="${foreground ? '#405d68' : '#293e4b'}" stroke-width="19" fill="none"/>
    <path d="M${n(ankle.x + 9)} ${n(ankle.y - 6)} L${n(ankle.x + 10)} ${n(ankle.y + 8)} Q${n(ankle.x - 2)} ${n(ankle.y + 12)} ${n(ankle.x - 24)} ${n(ankle.y + 8)} L${n(ankle.x - 25)} ${n(ankle.y + 2)} L${n(ankle.x - 9)} ${n(ankle.y - 4)} Z" fill="${foreground ? '#24454b' : '#193339'}" stroke="#142b31" stroke-width="2"/>
    <path d="M${n(ankle.x - 23)} ${n(ankle.y + 8)} H${n(ankle.x + 8)}" stroke="#648579" stroke-width="3"/>
    <path d="M${n(ankle.x - 7)} ${n(ankle.y - 4)} L${n(ankle.x + 6)} ${n(ankle.y - 4)}" stroke="#93ae99" stroke-width="2"/>
  </g>`;
}

function arm(phase, bob, foreground, walking) {
  const swing = walking ? Math.sin(phase * tau) * 18 : Math.sin(phase * tau) * 1.3;
  const shoulder = { x: foreground ? 113 : 134, y: 127 + bob };
  const elbow = { x: shoulder.x + swing * .45, y: 157 + bob };
  const hand = { x: shoulder.x + swing, y: 184 + bob };
  return `<g stroke-linecap="round" stroke-linejoin="round">
    <path d="M${p(shoulder)} L${p(elbow)} L${p(hand)}" stroke="#26483e" stroke-width="22" fill="none"/>
    <path d="M${p(shoulder)} L${p(elbow)} L${p(hand)}" stroke="${foreground ? '#77ac8c' : '#477c64'}" stroke-width="17" fill="none"/>
    <path d="M${n(hand.x - 8)} ${n(hand.y - 6)} L${n(hand.x + 8)} ${n(hand.y - 6)}" stroke="#d9e8c3" stroke-width="5"/>
    <ellipse cx="${n(hand.x)}" cy="${n(hand.y + 4)}" rx="8" ry="10" fill="#e7c49e" stroke="#9b876d" stroke-width="1.5"/>
  </g>`;
}

function pose(index, count, walking) {
  const phase = index / count;
  const bob = walking ? -Math.abs(Math.sin(phase * tau)) * 3 : -Math.sin(phase * tau) * 1.5;
  const a = walking ? foot(phase) : { x: -9, lift: 0 };
  const b = walking ? foot((phase + .5) % 1) : { x: 10, lift: 0 };
  const blink = !walking && (index === 11 || index === 12);
  const flutter = Math.sin(phase * tau + .7) * (walking ? 5 : 1.7);
  const backHip = { x: 132, y: 202 + bob };
  const frontHip = { x: 118, y: 202 + bob };
  const backAnkle = { x: 130 + b.x, y: 300 - b.lift };
  const frontAnkle = { x: 118 + a.x, y: 300 - a.lift };
  return `<g>
    <ellipse cx="122" cy="312" rx="49" ry="4" fill="#23382e" opacity=".18"/>
    ${leg(backHip, backAnkle, false, walking)}
    ${arm((phase + .5) % 1, bob, false, walking)}
    <g transform="translate(0 ${n(bob)})">
      <path d="M127 114 Q151 129 151 162 L${n(165 + flutter)} 204 L143 222 L117 202 Z" fill="#365c50" stroke="#26433d" stroke-width="2"/>
      <g transform="rotate(${n(-17 + flutter * .6)} 138 190)">
        <path d="M137 173 L147 173 L151 285 Q144 294 138 285 Z" fill="#274449" stroke="#172f36" stroke-width="3"/>
        <path d="M145 182 L146 278" stroke="#607b75" stroke-width="2"/>
        <path d="M135 169 L145 169 L144 141 L135 141 Z" fill="#3d655d" stroke="#173d39" stroke-width="2"/>
        <path d="M135 145 L144 149 M135 153 L144 157 M135 161 L144 165" stroke="#c5d2ad" stroke-width="2"/>
        <path d="M128 172 L151 172" stroke="#c7be8b" stroke-width="6" stroke-linecap="round"/>
      </g>
    </g>
    ${leg(frontHip, frontAnkle, true, walking)}
    <g transform="translate(0 ${n(bob)})">
      <path d="M102 116 Q116 108 135 116 L145 182 L${n(147 + flutter * .4)} 214 L120 207 L97 214 L95 183 Z" fill="#6b9f80" stroke="#28493e" stroke-width="2.5"/>
      <path d="M106 119 L100 179 L100 198 L113 195 L113 130 Z" fill="#a2c7a5" opacity=".6"/>
      <path d="M121 127 L125 193 L133 205" fill="none" stroke="#3d715a" stroke-width="3"/>
      <path d="M96 189 Q119 195 143 188 L144 199 Q122 205 96 199 Z" fill="#29493f"/>
      <rect x="116" y="190" width="14" height="12" rx="2" fill="#cebe83"/><rect x="120" y="193" width="6" height="6" rx="1" fill="#496b51"/>
      <path d="M114 148 Q108 155 108 160 A8 8 0 0 0 124 160 Q124 155 116 145 Z" fill="#c6f0d5" opacity=".9"/>
      <path d="M108 100 L130 100 L129 118 L113 124 L104 114 Z" fill="#d6b58d" stroke="#aa9277" stroke-width="1.5"/>
      <path d="M101 114 L109 104 L125 111 L137 108 L137 124 L120 128 L106 122 Z" fill="#dce8cd" stroke="#527d66" stroke-width="2"/>
      <path d="M129 118 Q142 119 ${n(160 + flutter)} 134 L${n(159 + flutter)} 145 L139 133 Z" fill="#9de0bc" stroke="#679d81" stroke-width="1.5"/>
      <path d="M99 56 Q111 42 132 49 Q150 55 151 74 L141 99 Q122 110 104 96 L99 86 L90 79 L97 74 Z" fill="#e8c69e" stroke="#9b886e" stroke-width="2"/>
      <ellipse cx="141" cy="77" rx="7" ry="10" fill="#dcb58d" stroke="#a18a70" stroke-width="1.5"/>
      <path d="M140 74 Q145 72 143 81" fill="none" stroke="#b28d70" stroke-width="1.5"/>
      <path d="M99 59 L91 57 L99 40 L106 41 L105 31 L116 35 L128 28 L132 37 L146 35 L146 44 L158 51 L151 62 L156 77 L144 94 L137 84 L139 64 L127 60 L119 48 L111 65 L104 57 Z" fill="#234447" stroke="#183739" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M103 44 L110 41 L116 40 M126 38 L137 43 L147 48 M144 59 L148 69" stroke="#527c70" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M137 94 Q143 102 ${n(151 + flutter)} 105 L144 97" fill="#25484a" stroke="#183739" stroke-width="2"/>
      <path d="M100 68 L111 66" stroke="#3b4a3c" stroke-width="2" stroke-linecap="round"/>
      ${blink ? '<path d="M100 76 L109 76" stroke="#253d39" stroke-width="2" stroke-linecap="round"/>' : '<ellipse cx="105" cy="75" rx="3.5" ry="5" fill="#25423e"/><circle cx="104" cy="73" r="1.2" fill="#f8f6da"/>'}
      <path d="M98 88 Q105 91 110 87" stroke="#9b7359" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      <ellipse cx="111" cy="85" rx="5" ry="2.5" fill="#d89178" opacity=".35"/>
    </g>
    ${arm(phase, bob, true, walking)}
  </g>`;
}

await mkdir(output, { recursive: true });
for (const [name, count, walking] of [['walk', 12, true], ['idle', 16, false]]) {
  const frames = Array.from({ length: count }, (_, index) => `<g transform="translate(${index * 240} 0)">${pose(index, count, walking)}</g>`).join('\n');
  await writeFile(path.join(output, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${240 * count}" height="320" viewBox="0 0 ${240 * count} 320"><title>SlingSip Phase 3 development ${name} sprite sheet</title>${frames}</svg>\n`, 'utf8');
}
console.log('Generated original development walk/idle sprite sheets.');
