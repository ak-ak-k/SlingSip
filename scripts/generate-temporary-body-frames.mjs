// Development artwork only. Generates distinct, fully posed vector frames;
// nothing here drives screen motion or hydration/reminder logic.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const directory = resolve('public/assets/character/temporary-body');
mkdirSync(directory, {recursive:true});
const original = readFileSync('public/assets/character/companion-guardian.svg','utf8');
const head = original.slice(original.indexOf('<path d="M59 90'), original.lastIndexOf('</svg>'));
const gradients = original.slice(original.indexOf('<defs>') + 6, original.indexOf('</defs>'));
// Pose: crouch, split, free-hand x/y, head lean, scarf lift, torso stretch.
const poses = {
  'swing-grab': [[0,0,30,125,-2,0,0],[8,8,32,115,-5,5,-2],[16,12,36,103,-6,12,-4]],
  'swing-down': [[16,12,36,103,-6,12,-4],[30,20,44,93,-9,22,-8],[40,26,51,89,-10,27,-10]],
  'swing-bottom': [[40,26,51,89,-10,27,-10],[48,28,45,84,-6,30,-13],[40,22,34,90,0,24,-10]],
  'swing-up': [[40,22,34,90,0,24,-10],[26,14,24,109,5,16,-5],[12,8,20,124,8,8,0]],
  release: [[12,8,20,124,8,8,0],[24,22,23,111,10,20,-6],[35,29,37,93,8,28,-10]],
  'mid-air': [[35,29,37,93,8,28,-10],[46,32,49,83,2,30,-12],[34,22,42,89,-7,24,-8]],
  attach: [[34,22,42,89,-7,24,-8],[24,16,30,102,-5,17,-5],[16,12,36,103,-6,12,-4]],
  settle: [[12,8,20,124,8,8,0],[8,-4,28,126,-5,4,-5],[-2,3,31,123,3,-2,2],[0,0,30,125,0,0,0]],
  idle: [[0,0,30,125,0,0,0],[1,1,30,125,1,1,1],[0,0,30,125,0,0,0],[-1,-1,30,125,-1,-1,-1],[0,0,30,125,0,0,0]],
  success: [[0,0,30,125,0,0,0],[12,10,27,94,-5,12,-4],[16,16,28,82,-7,15,-6],[8,8,27,94,-3,8,-3]],
  'web-shot': [[8,8,27,94,-3,8,-3],[7,7,22,101,-5,10,-3],[5,5,18,110,-6,9,-2]],
  'bottle-hold': [[5,5,18,110,-6,9,-2],[3,4,18,110,-4,5,-1],[2,2,18,110,-3,3,0]],
  retract: [[2,2,18,110,-3,3,0],[10,8,24,98,-5,8,-4],[16,12,36,103,-6,12,-4]],
};
const counts = {'swing-grab':4,'swing-down':6,'swing-bottom':6,'swing-up':6,release:4,'mid-air':6,attach:4,settle:8,idle:8,success:6,'web-shot':4,'bottle-hold':6,retract:4};
const durations = {'swing-grab':170,'swing-down':306,'swing-bottom':204,'swing-up':204,release:153,'mid-air':119,attach:170,settle:420,idle:4200,success:450,'web-shot':216,'bottle-hold':816,retract:168};
const mix = (a,b,t) => a + (b-a)*t;
const rounded = v => Number(v.toFixed(3));
function draw(p) {
  const [c,s,hx,hy,lean,r,stretch] = p;
  const hipY = 151 + stretch, knee1 = [61 - s*.6,177-c*.9], knee2 = [97+s*.7,174-c*.8];
  const boot1 = [54-s*.36,204-c*.54], boot2 = [100+s*.4,200-c*.62];
  const bodyY = stretch*.15;
  const segment = (a,b,colour,width) => `<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const limb = (a,b,c,w) => segment(a,b,'#0c1526',w+5)+segment(b,c,'#0c1526',w+3)+segment(a,b,'#273449',w)+segment(b,c,'#1a2b40',w-2);
  const boot = (point,flip) => `<path d="M${point[0]-7} ${point[1]-7} q8 -3 15 1 l${flip*6} 8 q-10 9 -23 4Z" fill="#e65369" stroke="#101a2b" stroke-width="3"/><path d="M${point[0]-8} ${point[1]+5} l16 0" stroke="#a8e6d2" stroke-width="2"/>`;
  const body = `<g stroke-linejoin="round">
    <path d="M76 94 Q${38-r} ${86-r} 6 ${72-r*.4} L17 ${96-r*.3} L5 ${107-r*.3} Q40 ${115-r*.4} 77 102Z" fill="url(#guardian-scarf)" stroke="#172236" stroke-width="2.5"/>
    <path d="M75 97 Q${38+r*.4} ${119-r*.7} 23 ${136-r*.4} L44 128 L51 142 Q64 118 86 107Z" fill="#a82f49" stroke="#172236" stroke-width="2.5"/>
    ${limb([84,hipY],knee2,boot2,17)}${boot(boot2,1)}${limb([67,hipY],knee1,boot1,19)}${boot(boot1,-1)}
    ${limb([58,91+bodyY],[mix(48,hx,.4),mix(101,hy,.5)],[hx,hy],13)}<circle cx="${hx}" cy="${hy}" r="6" fill="#e65369" stroke="#0c1526" stroke-width="2"/>
    <path d="M62 ${88+bodyY} Q77 ${81+bodyY} 94 ${92+bodyY} L105 ${123+stretch*.5} L93 ${158+stretch} Q75 ${172+stretch} 53 ${155+stretch} L52 ${119+stretch*.5}Z" fill="url(#guardian-suit)" stroke="#101a2b" stroke-width="4"/>
    <path d="M61 104 L58 ${137+stretch*.6} M93 107 L98 ${130+stretch*.6}" stroke="#8adbc7" stroke-width="3" stroke-linecap="round"/>
    <path d="M55 ${147+stretch} Q76 ${154+stretch} 96 ${145+stretch}" fill="none" stroke="#e4546c" stroke-width="7"/>
    <g transform="translate(0 ${stretch*.5})"><circle cx="77" cy="121" r="15" fill="#172b35" stroke="#67bfae" stroke-width="1.5"/><path d="M77 110 Q68 120 69 125 A8 8 0 0 0 85 125 Q86 120 77 110Z" fill="#a5eed7"/><path d="M73 126 Q74 130 78 130" fill="none" stroke="#28594e" stroke-width="2"/></g>
    <path d="M94 ${92+bodyY} Q${109+c*.12} ${83-c*.2} 114 62 L119 35 Q112 25 119 19 Q126 14 132 22 L134 31 L130 66 Q${122+c*.08} ${93+bodyY} 108 ${106+bodyY}Z" fill="url(#guardian-suit)" stroke="#101a2b" stroke-width="4"/>
    <path d="M117 39 L131 41" stroke="#eb5368" stroke-width="8"/><path d="M124 18 L126 27" stroke="#b5f7e3" stroke-width="2.5"/>
  </g>`;
  return {body,head:`<g transform="translate(0 ${bodyY}) rotate(${lean} 79 91)">${head}</g>`, anchors:{grip:{x:125,y:22},freeHand:{x:hx,y:hy},boot:{x:boot1[0],y:boot1[1]},head:{x:80,y:55+bodyY},hit:{x:77,y:121+stretch*.5}}};
}
let symbols = '';
const clips = {};
for (const [state,keys] of Object.entries(poses)) {
  const frames = [];
  for (let i=0;i<counts[state];i++) {
    const position = i/(counts[state]-1)*(keys.length-1), index = Math.min(keys.length-2,Math.floor(position));
    const pose = keys[index].map((v,j)=>rounded(mix(v,keys[index+1][j],position-index)));
    const art = draw(pose), name = `${state}-${i}`;
    symbols += `<g id="${name}-body">${art.body}</g><g id="${name}-head">${art.head}</g>\n`;
    frames.push({body:{kind:'svg',src:`assets/character/temporary-body/frames.svg#${name}-body`},head:{kind:'svg',src:`assets/character/temporary-body/frames.svg#${name}-head`},anchors:art.anchors});
  }
  clips[state] = {frames,durationMs:durations[state],...(state==='idle'?{loop:true}:{})};
}
writeFileSync(`${directory}/frames.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220" viewBox="0 0 160 220"><title>Temporary SlingSip body animation frames</title><defs>${gradients}\n${symbols}</defs></svg>\n`);
const manifest = {id:'temporary-guardian-body-v1',temporary:true,width:160,height:220,clips};
writeFileSync('src/app/features/companion/animation/temporary-body-pack.ts',`// Generated by scripts/generate-temporary-body-frames.mjs. Replace the pack, not motion logic.\nimport type { BodyAnimationPack } from './body-animation.model';\nexport const TEMPORARY_BODY_PACK: BodyAnimationPack = ${JSON.stringify(manifest,null,2)};\n`);
writeFileSync(`${directory}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${Object.values(clips).reduce((n,c)=>n+c.frames.length,0)} distinct temporary frames across ${Object.keys(clips).length} clips.`);
