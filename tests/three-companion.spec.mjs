import { electron } from './helpers/existing-user-electron.mjs';
import{test,expect}from'@playwright/test';
import{readFile}from'node:fs/promises';
import{inflateSync}from'node:zlib';
import{useApprovedFallback,connectionDistance}from'./helpers/companion-visuals.mjs';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{Group,Mesh,MeshStandardMaterial,PlaneGeometry,SkinnedMesh}from'three';
import{CharacterModelController,disposeModel}from'../src/app/features/companion/three/character-model-controller.ts';
import{BottleController}from'../src/app/features/companion/three/bottle-controller.ts';
import{WebController}from'../src/app/features/companion/three/web-controller.ts';
const assets={character:'',bottle:'',temporary:true,characterHeight:2.2,nodes:{grip:'WebGrip',freeHand:'BottleGrip',boot:'Foot_L',head:'Head',chest:'Chest'},morphs:{blink:'blink',smile:'smile',frown:'frown'}};
const load=async path=>{const b=await readFile(path);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};

test('Local GLB is a skinned original rig with all clips, real skeletal movement and facial morphs',async()=>{
  const result=await load('public/assets/character/temporary-3d/guardian.glb');
  const model=new CharacterModelController(result.scene,result.animations,assets),skins=[];result.scene.traverse(n=>{if(n instanceof SkinnedMesh)skins.push(n);});
  expect(skins).toHaveLength(4);expect(skins[0].skeleton.bones).toHaveLength(17);expect(result.animations).toHaveLength(18);
  model.sample('swing-down',0);const first=model.socket('boot').clone(),grip=model.socket('grip').clone();
  model.sample('swing-down',.8);expect(model.socket('boot').distanceTo(first)).toBeGreaterThan(.02);expect(model.socket('grip').distanceTo(grip)).toBeLessThan(1e-8);
  model.sample('web-shot',.7);const hand=model.socket('freeHand');expect(hand.distanceTo(model.socket('grip'))).toBeGreaterThan(.3);
  model.expression(1,.5,1,{x:.5,y:.25},.1);
  expect(result.scene.getObjectByName('Eye_L').morphTargetInfluences[0]).toBe(1);
  expect(result.scene.getObjectByName('Mouth').morphTargetInfluences).toEqual([1,.5]);model.dispose();
});

test('Bottle is a real GLB prop and dynamic 3D web endpoints release without leftover geometry',async()=>{
  const result=await load('public/assets/character/temporary-3d/bottle.glb');expect(result.scene.getObjectByName('BottleLabel')).toBeTruthy();
  let translucent=0;result.scene.traverse(n=>{if(n.material?.transparent)translucent++;});expect(translucent).toBeGreaterThan(0);disposeModel(result.scene);
  const webs=new WebController();webs.set(0,{x:120,y:-30},{x:500,y:600},1);
  expect([...webs.root.children[0].geometry.getAttribute('position').array]).toEqual([120,30,1,500,-600,1]);
  const braid=webs.root.children[0].children[0],vertices=braid.geometry.getAttribute('position');
  const count=braid.geometry.drawRange.count/12;
  expect(count).toBeGreaterThan(1);expect([vertices.getX(0),vertices.getY(0)]).toEqual([120,30]);
  expect([vertices.getX(count*4),vertices.getY(count*4)]).toEqual([500,-600]);
  const buffers=vertices.array;webs.set(0,{x:120,y:-30},{x:500,y:600},.4);expect(braid.material.opacity).toBe(.4);expect(braid.geometry.getAttribute('position').array).toBe(buffers);
  let disposed=0;braid.geometry.addEventListener('dispose',()=>disposed++);braid.material.addEventListener('dispose',()=>disposed++);
  webs.set(0,{x:0,y:0},{x:0,y:0},0);expect(webs.root.children[0].visible).toBe(false);webs.dispose();
  expect(disposed).toBe(2);
  // A label/glass may be transparent even at full scalar opacity. Fades must
  // restore authored transparency, including on a final production prop.
  const source=new Group(),label=new MeshStandardMaterial({transparent:true}),cap=new MeshStandardMaterial();
  source.add(new Mesh(new PlaneGeometry(1,1),label),new Mesh(new PlaneGeometry(1,1),cap));
  const bottle=new BottleController(source,{...assets,temporary:false}),sample={x:100,y:200,size:80,rotation:10};
  bottle.present({...sample,opacity:1});expect(label.transparent).toBe(true);expect(cap.transparent).toBe(false);
  bottle.present({...sample,opacity:.3});expect(label.opacity).toBe(.3);expect(cap.transparent).toBe(true);
  bottle.present({...sample,opacity:1});expect(label.transparent).toBe(true);expect(label.opacity).toBe(1);expect(cap.transparent).toBe(false);
  bottle.present({...sample,opacity:0});expect(bottle.root.visible).toBe(false);bottle.dispose();
});

// Native screenshot alpha check without another dependency.
function png(buffer){let w,h,colour,data=[];for(let p=8;p<buffer.length;){const length=buffer.readUInt32BE(p),type=buffer.toString('ascii',p+4,p+8),chunk=buffer.subarray(p+8,p+8+length);if(type==='IHDR'){w=chunk.readUInt32BE(0);h=chunk.readUInt32BE(4);colour=chunk[9];}if(type==='IDAT')data.push(chunk);p+=12+length;}
  if(colour!==6)throw new Error('Expected native RGBA PNG');const raw=inflateSync(Buffer.concat(data)),stride=w*4,out=Buffer.alloc(w*h*4);let offset=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<h;y++){const filter=raw[offset++];for(let x=0;x<stride;x++){const index=y*stride+x,a=x>=4?out[index-4]:0,b=y?out[index-stride]:0,c=y&&x>=4?out[index-stride-4]:0;out[index]=(raw[offset++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
  return{x:w,y:h,alpha:(x,y)=>out[(Math.round(y)*w+Math.round(x))*4+3]};
}

// Historical GLB controllers remain testable offline, but never supply app artwork.
test('Native approved-only fallback retains alpha, body phases, two webs, one glass and hidden cleanup',async({},testInfo)=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app=await electron.launch({args:['.','--companion-test'],env,chromiumSandbox:true});const errors=[];
  try{
    await expect.poll(()=>app.windows().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
    const dashboard=app.windows().find(p=>p.url().endsWith('#/dashboard')),overlay=app.windows().find(p=>p.url().endsWith('#/companion'));
    overlay.on('pageerror',e=>errors.push(e.message));await useApprovedFallback(overlay);
    await dashboard.evaluate(async()=>{const s=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...s,glassSizeMl:175,workingStart:'00:00',workingEnd:'00:01'});});
    await overlay.evaluate(()=>{
      Math.random=()=>.1;window.__sceneFrames=[];const character=document.querySelector('[data-testid=character]');
      new MutationObserver(()=>{window.__sceneFrames.push({...character.dataset,mainOpacity:document.querySelector('.swing-web')?.getAttribute('opacity'),oldOpacity:document.querySelector('.released-web')?.getAttribute('opacity')});}).observe(character,{attributes:true,attributeFilter:['data-body-progress']});
    });
    await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());
    const character=overlay.getByTestId('character'),art=overlay.getByTestId('slingsip-png');await expect(character).toHaveAttribute('data-state','reminder');
    await expect(character).toHaveAttribute('data-renderer','png-2.5d');await expect(art).toHaveAttribute('data-pose','ask');
    const frames=await overlay.evaluate(()=>window.__sceneFrames),order=[];frames.forEach(f=>{if(order.at(-1)!==f.bodyState)order.push(f.bodyState);});
    expect(order).toEqual(['swing-grab','swing-down','swing-bottom','swing-up','release','mid-air','attach','swing-down','swing-bottom','swing-up','settle','idle']);
    expect(frames.some(f=>f.webStage==='free-flight')).toBe(true);for(const f of frames)expect(Number(f.mainOpacity)*Number(f.oldOpacity)).toBe(0);
    expect(await connectionDistance(overlay,'grip')).toBeLessThan(3);
    const hit=await art.evaluate(svg=>{const p=svg.createSVGPoint();p.x=+svg.dataset.hitX;p.y=+svg.dataset.hitY;const h=p.matrixTransform(svg.getScreenCTM());return{x:h.x,y:h.y};});
    const image=png(await overlay.screenshot({path:testInfo.outputPath('approved-reminder.png'),omitBackground:true}));expect(image.alpha(20,20)).toBe(0);expect(image.alpha(hit.x,hit.y)).toBeGreaterThan(0);
    // A Happy failure uses another approved full-body pose, with its actual hand socket.
    await overlay.getByTestId('drank-it').evaluate(b=>{b.click();b.click();});await expect(art).toHaveAttribute('data-pose','happy');
    await overlay.locator('.current-pose .pose-image').dispatchEvent('error');await expect(art).toHaveAttribute('data-pose','ask');
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('175 / 2000 ml');
    const bottle=overlay.getByTestId('companion-bottle');await expect(bottle).toHaveAttribute('data-delivery-stage','pendulum');
    expect(Math.abs(Number(await bottle.getAttribute('data-rotation')))).toBeLessThanOrEqual(10);expect(await connectionDistance(overlay,'bottle')).toBeLessThan(.1);
    await expect(overlay.getByTestId('bottle-water-feedback')).toHaveText('+175 ml');
    await overlay.screenshot({path:testInfo.outputPath('approved-bottle.png'),omitBackground:true});
    await expect(character).toHaveAttribute('data-state','hidden',{timeout:30000});await expect(art).toHaveCount(0);await expect(bottle).toHaveCount(0);
    expect(await overlay.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).hydration.currentWater).toBe(175);expect(errors).toEqual([]);
    expect(await overlay.locator('canvas,app-body-sprite-renderer')).toHaveCount(0);
  }finally{await app.close();}
});

test('Native approved fallback pause, reduced motion, retry and isolated lab preserve dashboard and saved water',async()=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app=await electron.launch({args:['.','--companion-test'],env,chromiumSandbox:true});
  try{
    await expect.poll(()=>app.windows().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
    const dashboard=app.windows().find(p=>p.url().endsWith('#/dashboard')),overlay=app.windows().find(p=>p.url().endsWith('#/companion'));
    await useApprovedFallback(overlay);
    await dashboard.evaluate(async()=>{const s=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...s,workingStart:'00:00',workingEnd:'00:01'});});
    const character=overlay.getByTestId('character'),art=overlay.getByTestId('slingsip-png');
    expect(await dashboard.locator('canvas').count()).toBe(0);await dashboard.getByTestId('toggle-overlay').click();await expect(character).toHaveAttribute('data-state','reminder');
    await app.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));await expect(character).toHaveClass(/is-inactive/);await overlay.waitForTimeout(100);
    const pose=await art.evaluate(n=>getComputedStyle(n).transform);await overlay.waitForTimeout(350);expect(await art.evaluate(n=>getComputedStyle(n).transform)).toBe(pose);
    await app.evaluate(({powerMonitor})=>powerMonitor.emit('resume'));await expect(character).not.toHaveClass(/is-inactive/);
    await overlay.emulateMedia({reducedMotion:'reduce'});await overlay.waitForTimeout(100);
    expect(await art.evaluate(n=>n.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
    await overlay.getByRole('button',{name:'Remind me later',exact:true}).evaluate(b=>b.click());await expect(character).toHaveAttribute('data-state','hidden');
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).reminderRetry.pending).toBe(true);
    await dashboard.evaluate(()=>window.desktopCompanion.setOverlayVisible(false));await overlay.emulateMedia({reducedMotion:'no-preference'});
    await dashboard.getByTestId('toggle-overlay').click();await expect(character).toHaveAttribute('data-state','reminder');
    await overlay.getByRole('button',{name:'Remind me later',exact:true}).evaluate(b=>b.click());await expect(art).toHaveAttribute('data-pose','disappointed');await expect(character).toHaveAttribute('data-state','hidden');
    await dashboard.evaluate(()=>window.desktopCompanion.setRemindersPaused(true));const water=await dashboard.evaluate(()=>window.desktopCompanion.getHydrationState());
    await dashboard.getByTestId('animation-lab-open').click();await useApprovedFallback(dashboard);await dashboard.getByTestId('lab-classic').click();await expect(dashboard.getByTestId('character')).toHaveAttribute('data-state','reminder');
    await dashboard.getByTestId('close-animation-lab').click();await expect(dashboard.locator('canvas,app-slingsip-png-renderer')).toHaveCount(0);
    expect(await dashboard.evaluate(()=>window.desktopCompanion.getHydrationState())).toEqual(water);
  }finally{await app.close();}
});
