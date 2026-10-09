import { readFile, writeFile } from 'node:fs/promises';
const flows = JSON.parse(await readFile('.cache/reference-captured-frames.json','utf8'));
const out = 'docs/previews/reference-style';
const screenshots = ['dashboard.png','companion-preferences.png','animation-lab.png','animation-lab-detail.png','animation-lab-minimum.png'];
// Save representative entry/prop frames even when screenshot sampling cannot
// collect four frames inside a short motion phase on software WebGL.
for (const flow of flows) {
  const frames = flow.frames.filter(frame => frame.state === 'swinging-in');
  const frame = frames.find(frame => frame.body === 'swing-bottom') ?? frames.at(-1);
  if (frame) {
    const name=flow.name.toLowerCase().replaceAll(' ','-')+'-entry.png';
    await writeFile(out+'/'+name,Buffer.from(frame.image.split(',')[1],'base64'));screenshots.push(name);
  }
  // Always derive the gallery from this capture's frames, rather than displaying
  // an older PNG left behind when a short phase was missed by screenshot sampling.
  for(const state of ['reminder','success','waiting','swinging-out-right','swinging-back-left']){
    const candidates=flow.frames.filter(frame=>frame.state===state),chosen=state==='reminder'?candidates.at(-1):candidates[0];
    if(!chosen)continue;
    const name=flow.name.toLowerCase().replaceAll(' ','-')+'-'+state+'.png';
    await writeFile(out+'/'+name,Buffer.from(chosen.image.split(',')[1],'base64'));screenshots.push(name);
  }
}
const bottleFrames = flows.find(flow => flow.name === 'Success').frames.filter(frame => frame.state === 'delivering-bottle' && frame.body === 'bottle-hold');
if (bottleFrames.length) {await writeFile(out+'/success-delivering-bottle.png',Buffer.from(bottleFrames[Math.floor(bottleFrames.length/2)].image.split(',')[1],'base64'));screenshots.push('success-delivering-bottle.png');}
const data = JSON.stringify(flows).replaceAll('<','\\u003c');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SlingSip — reference-style Motion Review</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#07111a;color:#eaf7f6;font:15px system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:28px}h1{font-size:28px;margin:0;color:#89f7d6}p{line-height:1.6;color:#adc0cb;margin:8px 0 20px}button,select,input{font:inherit}button,select{border:1px solid #37685f;border-radius:9px;color:#eaf7f6;background:#12272c;padding:9px 14px;cursor:pointer}button.selected,button:hover{background:#87f3d4;color:#08201d}nav,.controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:16px 0}.stage{border:1px solid #37685f;border-radius:14px;overflow:hidden;background:radial-gradient(at 55% 58%,#122e33,#09141e)}.stage.checker{background-color:#12222c;background-image:linear-gradient(45deg,#20343b 25%,transparent 25%),linear-gradient(-45deg,#20343b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#20343b 75%),linear-gradient(-45deg,transparent 75%,#20343b 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}canvas{display:block;width:100%;height:auto}#scrub{flex:1;min-width:160px;accent-color:#89f7d6}output{color:#89f7d6;min-width:280px;font-size:13px}label{display:flex;align-items:center;gap:6px;font-size:13px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.gallery a{color:#89f7d6;text-decoration:none;font-size:12px}.gallery img{display:block;width:100%;border:1px solid #28434d;border-radius:8px;background:#11212b;margin-bottom:6px}footer{color:#8ea6b4;margin-top:24px;font-size:12px}
</style><main><h1>SlingSip · reference-style motion review</h1><p>Native Electron screenshots of the temporary rig, four entries and real success/Later/Ignore flows. This is a development approximation of the supplied reference. Final character and bottle GLBs are still missing; the placeholder is not production artwork. The dashboard and bubble remain 2D. This sampled playback is a visual review artifact, not a frame-rate or CPU benchmark. Run <code>npm run dev</code> and open Animation lab for real-time motion and sound.</p>
<details><summary>Supplied visual reference</summary><img src="design-reference.png" style="width:100%;height:auto" alt="SlingSip character, bottle, expressions and desktop overlay visual reference"></details><nav id="flows" aria-label="Motion sequence"></nav><div class="stage" id="stage"><canvas id="view" width="1920" height="1032" aria-label="Sampled native companion playback"></canvas></div>
<div class="controls"><button id="play" type="button">Play</button><button id="restart" type="button">Restart</button><label>Speed<select id="speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label><label>View<select id="zoom"><option value="1">Full work area</option><option value="1.65">Reminder detail</option></select></label><label><input id="checker" type="checkbox">Transparency grid</label><input id="scrub" type="range" min="0" max="1" value="0" aria-label="Playback position"><output id="readout" aria-live="off"></output></div>
<p>Entry bubbles appear after settling. Canonical water updates before the success reaction; the bottle retracts before the right exit. Later uses the existing left exit/retry policy. No real user data was used.</p>
<div class="gallery">${screenshots.map(name => `<a href="${name}"><img src="${name}" loading="lazy" alt="${name.replaceAll('-',' ').replace('.png','')}">${name}</a>`).join('')}</div><footer>Primary work area capture. Geometry/DPI coverage and physical-display limitations are documented in <a href="../../slingsip-reference-style.md" style="color:#89f7d6">the reference-style report</a>. No deployment.</footer></main>
<script>
const flows=${data};
const canvas=document.getElementById('view'),ctx=canvas.getContext('2d'),scrub=document.getElementById('scrub'),play=document.getElementById('play'),readout=document.getElementById('readout');
let selected=0,playing=false,position=0,previous,raf,renderVersion=0,lastIndex=-1;const cache=new Map();
function stop(){playing=false;play.textContent='Play';cancelAnimationFrame(raf);previous=undefined;}
async function draw(){
 const flow=flows[selected],index=Math.max(0,flow.frames.findLastIndex(frame=>frame.time<=position)),frame=flow.frames[index];
 if(!frame)return;readout.textContent=flow.name+' · '+frame.state+' / '+frame.body+' / '+frame.web+' · '+(frame.time/1000).toFixed(2)+' s · frame '+(index+1)+'/'+flow.frames.length;
 scrub.value=String(position);if(index===lastIndex)return;lastIndex=index;const version=++renderVersion;
 let image=cache.get(index);if(!image){image=new Image();const ready=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});image.src=frame.image;await ready;if(version!==renderVersion)return;cache.set(index,image);if(cache.size>3)cache.delete(cache.keys().next().value);}
 if(version!==renderVersion)return;canvas.width=image.width;canvas.height=image.height;ctx.clearRect(0,0,canvas.width,canvas.height);
 const zoom=Number(document.getElementById('zoom').value),w=image.width/zoom,h=image.height/zoom;
 const x=zoom===1?0:Math.max(0,Math.min(image.width-w,image.width*.59-w/2));const y=zoom===1?0:Math.max(0,Math.min(image.height-h,image.height*.63-h/2));
 ctx.drawImage(image,x,y,w,h,0,0,canvas.width,canvas.height);
}
function tick(time){if(!playing)return;position=Math.min(flows[selected].frames.at(-1).time,position+(previous===undefined?0:time-previous)*Number(document.getElementById('speed').value));previous=time;void draw();if(position>=Number(scrub.max))stop();else raf=requestAnimationFrame(tick);}
function choose(index){stop();selected=index;position=0;lastIndex=-1;renderVersion++;cache.clear();scrub.max=String(flows[index].frames.at(-1).time);document.querySelectorAll('nav button').forEach((button,i)=>{button.classList.toggle('selected',i===index);button.setAttribute('aria-pressed',String(i===index));});void draw();}
flows.forEach((flow,index)=>{const button=document.createElement('button');button.textContent=flow.name;button.type='button';button.onclick=()=>choose(index);document.getElementById('flows').append(button);});
play.onclick=()=>{if(playing){stop();return;}if(position>=Number(scrub.max))position=0;playing=true;play.textContent='Pause';previous=undefined;raf=requestAnimationFrame(tick);};
document.getElementById('restart').onclick=()=>{stop();position=0;lastIndex=-1;void draw();};scrub.oninput=()=>{stop();position=Number(scrub.value);void draw();};document.getElementById('zoom').onchange=()=>{lastIndex=-1;void draw();};document.getElementById('checker').onchange=event=>document.getElementById('stage').classList.toggle('checker',event.target.checked);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});choose(0);
</script></html>`;
await writeFile(out+'/motion-review.html',html);
console.log(JSON.stringify({flows:flows.length,frames:flows.reduce((n,f)=>n+f.frames.length,0),screenshots:screenshots.length,htmlBytes:Buffer.byteLength(html)}));
