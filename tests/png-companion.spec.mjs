import { electron } from './helpers/existing-user-electron.mjs';
import assert from 'node:assert/strict';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodePng} from '../scripts/lib/png-rgba.mjs';
import {SLINGSIP_ASSET_ENTRIES} from '../src/app/features/companion/animation/slingsip-assets.ts';
import {pngAsset,pngPose,pngRenderPose,pngWebs,pngBottle} from '../src/app/features/companion/animation/slingsip-png-choreography.ts';
import {CharacterState as State} from '../src/app/features/companion/animation/character.model.ts';
import {entrySample,ENTRY_VARIANTS} from '../src/app/features/companion/animation/entry-variants.ts';
import {swingLayout,swingSample,artworkPoint} from '../src/app/features/companion/animation/swing-motion.ts';
import {connectionDistance} from './helpers/companion-visuals.mjs';

test('Production PNGs retain their original alpha and bytes; clipping excludes sheet captions and neighboring heads',async()=>{
  const audit=JSON.parse(await readFile('docs/slingsip-png-source-audit.json','utf8'));
  for(const[key,src]of Object.entries(SLINGSIP_ASSET_ENTRIES)){
    const bytes=await readFile('public/'+src),image=decodePng(bytes),asset=pngAsset(key);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(audit[key].sourceSha256);
    expect([image.width,image.height]).toEqual([asset.width,asset.height]);expect(asset.hasAuthoredAlpha).toBe(true);
    expect(asset.bounds.y+asset.bounds.height).toBeLessThan(asset.height-10);
    expect(asset.anchors.grip.x).toBeCloseTo(key==='bottle'?asset.bounds.width/2:125,8);
    expect(asset.anchors.grip.y).toBeCloseTo(key==='bottle'?0:22,8);
    const p=asset.anchors.hit,x=Math.round((p.x-asset.transform.x)/asset.transform.scale),y=Math.round((p.y-asset.transform.y)/asset.transform.scale);
    expect(image.rgba[(y*image.width+x)*4+3]).toBeGreaterThan(180);
  }
  const head=pngAsset('disappointed');expect(head.bounds.x).toBeGreaterThanOrEqual(98);expect(head.bounds.x+head.bounds.width).toBeLessThanOrEqual(243);
  expect(new Set(['swing1','swing2','swing3','swing4','swing5'].map(key=>pngAsset(key).sourceSha256)).size).toBe(5);
});

test('PNG poses follow the unchanged path progress, invert only once, release webs and attach a bounded damped bottle',()=>{
  for(const[w,h]of[[760,560],[1366,768],[1920,1032],[2560,1392]])for(const scale of[1,1.25,1.5]){
    const layout=swingLayout(w/scale,h/scale);
    for(const{id}of ENTRY_VARIANTS){
      const frames=[];let free=0;
      for(let i=0;i<=100;i++){
        const progress=i/100,pose=entrySample(layout,id,progress),before={...pose};
        const frame=pngPose(State.SwingingIn,progress,id),visual=pngRenderPose(pose,State.SwingingIn,progress,id),web=pngWebs(layout,pose,State.SwingingIn,progress,id);
        assert.deepEqual(pose,before);assert.deepEqual([visual.x,visual.y],[pose.x,pose.y]);
        assert.equal(web.main.opacity*web.old.opacity,0);if(web.stage==='free-flight')free++;
        if(web.stage==='web-1'||web.stage==='web-2')assert.deepEqual(web.main.b,artworkPoint(layout,visual,frame.anchors.grip.x,frame.anchors.grip.y));
        if(id==='upside-down'&&['web-1','web-2'].includes(web.stage))assert.equal(web.main.a.x,web.main.b.x);
        if(frames.at(-1)!==frame.key)frames.push(frame.key);
      }
      expect(free).toBeGreaterThan(0);expect(frames).toEqual(id==='upside-down'?['upsideDown']:['swing1','swing2','swing3','swing4','swing5']);
    }
    const pose=entrySample(layout,'classic',1),angles=[];
    for(let i=0;i<=100;i++){
      const t=i/100,bottle=pngBottle(layout,pose,State.DeliveringBottle,t,t,'classic'),hand=pngPose(State.DeliveringBottle,t,'classic').anchors.freeHand;
      assert.deepEqual(bottle.start,artworkPoint(layout,pose,hand.x,hand.y));assert.ok(bottle.y+bottle.size<=layout.height-16+.001);
      angles.push(Math.abs(bottle.rotation));assert.ok(Math.abs(bottle.rotation)<=10);
      for(const[phase,state]of[['right',State.SwingingOutRight],['left',State.SwingingBackLeft]]){
        const p=swingSample(layout,phase,t),web=pngWebs(layout,p,state,t,'classic');assert.equal(web.main.opacity*web.old.opacity,0);
        assert.equal(pngPose(state,t,'classic').mirror,phase==='left');
      }
    }
    expect(Math.max(...angles)).toBeGreaterThan(8);expect(pngBottle(layout,pose,State.DeliveringBottle,1,1,'classic').opacity).toBe(0);
  }
  expect(pngPose(State.Reminder,0,'classic').key).toBe('ask');expect(pngPose(State.Reminder,0,'upside-down').key).toBe('upsideDown');
  expect(pngPose(State.Waiting,0,'classic')).toMatchObject({key:'idle',head:'disappointed'});
});

async function launch(){
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app=await electron.launch({args:['.','--companion-test'],env,chromiumSandbox:true});
  await expect.poll(()=>app.windows().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
  const dashboard=app.windows().find(p=>p.url().endsWith('#/dashboard')),overlay=app.windows().find(p=>p.url().endsWith('#/companion'));
  await expect(overlay.getByTestId('character')).toHaveAttribute('data-renderer','png-2.5d');
  await dashboard.evaluate(async()=>{const s=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...s,glassSizeMl:175,workingStart:'00:00',workingEnd:'00:01'});});
  return{app,dashboard,overlay};
}
async function record(overlay){await overlay.evaluate(()=>{
  window.__pngFrames=[];window.__pngRaf=0;const request=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{window.__pngRaf++;return request(cb);};
  const character=document.querySelector('[data-testid=character]');new MutationObserver(()=>{
    const svg=document.querySelector('[data-testid=slingsip-png]'),bottle=document.querySelector('.bottle');
    window.__pngFrames.push({...character.dataset,pose:svg?.dataset.pose,frame:svg?.dataset.bodyFrame,bottle:!!bottle,rotation:bottle?.dataset.rotation});
  }).observe(character,{attributes:true,attributeFilter:['data-body-progress','data-state']});
});}

test('Native default uses five PNG swing frames, authored alpha/hit silhouettes, ask/happy, immediate water and PNG bottle; hidden work stops',async({},info)=>{
  const{app,dashboard,overlay}=await launch(),errors=[];overlay.on('pageerror',e=>errors.push(e.message));
  try{
    await record(overlay);await overlay.evaluate(()=>{Math.random=()=>.1;});
    await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());const character=overlay.getByTestId('character'),png=overlay.getByTestId('slingsip-png');
    await expect(character).toHaveAttribute('data-state','reminder');await expect(png).toHaveAttribute('data-pose','ask');
    expect(await overlay.locator('canvas,app-body-sprite-renderer').count()).toBe(0);expect(await overlay.locator('app-slingsip-png-renderer').count()).toBe(1);
    const entries=(await overlay.evaluate(()=>window.__pngFrames)).filter(f=>f.state==='swinging-in'&&f.pose?.startsWith('swing'));
    expect([...new Set(entries.map(f=>f.frame))]).toEqual(['0','1','2','3','4']);expect(Math.max(...entries.map(f=>+f.x))-Math.min(...entries.map(f=>+f.x))).toBeGreaterThan(500);
    await expect(overlay.getByRole('heading',{name:'Drink 175 ml',exact:true})).toBeVisible();
    expect(await connectionDistance(overlay,'grip')).toBeLessThan(.1);
    const hit=await png.evaluate(svg=>{const p=svg.createSVGPoint();p.x=Number(svg.dataset.hitX);p.y=Number(svg.dataset.hitY);const h=p.matrixTransform(svg.getScreenCTM());return{x:h.x,y:h.y,painted:!!document.elementFromPoint(h.x,h.y)?.closest('[data-overlay-interactive]'),empty:!!document.elementFromPoint(20,20)?.closest('[data-overlay-interactive]')};});
    expect(hit).toMatchObject({painted:true,empty:false});
    const shot=decodePng(await overlay.screenshot({path:info.outputPath('png-ask.png'),omitBackground:true}));
    expect(shot.rgba[(20*shot.width+20)*4+3]).toBe(0);expect(shot.rgba[(Math.round(hit.y)*shot.width+Math.round(hit.x))*4+3]).toBeGreaterThan(100);
    const raf=await overlay.evaluate(()=>window.__pngRaf),idle=await png.evaluate(svg=>getComputedStyle(svg).transform);await overlay.waitForTimeout(500);
    expect(await overlay.evaluate(()=>window.__pngRaf)).toBe(raf);expect(await png.evaluate(svg=>getComputedStyle(svg).transform)).not.toBe(idle);
    await overlay.getByTestId('drank-it').evaluate(b=>{b.click();b.click();});await expect(dashboard.getByTestId('dashboard-water')).toHaveText('175 / 2000 ml');
    await expect(png).toHaveAttribute('data-pose','happy');await expect(overlay.getByTestId('companion-bottle')).toHaveAttribute('data-delivery-stage','pendulum');
    await expect(overlay.getByTestId('companion-bottle')).toHaveAttribute('data-asset-pack','slingsip-production-png');await expect(overlay.getByTestId('bottle-water-feedback')).toHaveText('+175 ml');
    expect(await connectionDistance(overlay,'bottle')).toBeLessThan(.1);await overlay.screenshot({path:info.outputPath('png-bottle.png'),omitBackground:true});
    await expect(character).toHaveAttribute('data-state','hidden');const frames=await overlay.evaluate(()=>window.__pngFrames);
    expect(frames.some(f=>f.state==='swinging-out-right')).toBe(true);expect(frames.some(f=>f.state==='success'&&f.pose==='happy')).toBe(true);
    await expect(png).toHaveCount(0);expect(await overlay.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
    const hidden=await overlay.evaluate(()=>window.__pngRaf);await overlay.waitForTimeout(400);expect(await overlay.evaluate(()=>window.__pngRaf)).toBe(hidden);
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).hydration.currentWater).toBe(175);expect(errors).toEqual([]);
  }finally{await app.close();}
});

test('Native inverted PNG stays inverted, pauses idle, returns to normal success; lab stays isolated and reduced motion skips frame cycling',async({},info)=>{
  const{app,dashboard,overlay}=await launch();
  try{
    await overlay.evaluate(()=>{Math.random=()=>.95;});await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());
    const character=overlay.getByTestId('character'),png=overlay.getByTestId('slingsip-png');await expect(character).toHaveAttribute('data-state','reminder');await expect(png).toHaveAttribute('data-pose','upsideDown');
    const line=overlay.getByTestId('swing-web');expect(Number(await line.getAttribute('x1'))).toBeCloseTo(Number(await line.getAttribute('x2')),5);
    expect(Math.abs(Number(await character.getAttribute('data-rotation')))).toBeLessThan(10);await overlay.screenshot({path:info.outputPath('png-inverted.png'),omitBackground:true});
    await app.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));await expect(character).toHaveClass(/is-inactive/);
    await overlay.waitForTimeout(100);const paused=await png.evaluate(svg=>getComputedStyle(svg).transform);await overlay.waitForTimeout(350);expect(await png.evaluate(svg=>getComputedStyle(svg).transform)).toBe(paused);
    await app.evaluate(({powerMonitor})=>powerMonitor.emit('resume'));await overlay.getByTestId('drank-it').evaluate(b=>b.click());await expect(png).toHaveAttribute('data-pose','happy');await expect(character).toHaveAttribute('data-state','hidden');
    const water=await dashboard.evaluate(()=>window.desktopCompanion.getHydrationState());await dashboard.getByTestId('animation-lab-open').click();
    await dashboard.getByTestId('lab-classic').click();await expect(dashboard.getByTestId('slingsip-png')).toHaveAttribute('data-pose','ask');
    expect(await dashboard.locator('canvas').count()).toBe(0);await dashboard.getByTestId('close-animation-lab').click();expect(await dashboard.evaluate(()=>window.desktopCompanion.getHydrationState())).toEqual(water);
    await overlay.emulateMedia({reducedMotion:'reduce'});await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());await expect(character).toHaveAttribute('data-state','reminder');
    expect(await png.evaluate(svg=>svg.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);await overlay.getByRole('button',{name:'Remind me later',exact:true}).evaluate(b=>b.click());await expect(character).toHaveAttribute('data-state','hidden');
  }finally{await app.close();}
});

test('Native Later and Ignore show the supplied disappointed head, exit left, preserve retry/window and cancel without extra water',async({},info)=>{
  const{app,dashboard,overlay}=await launch();
  try{
    await record(overlay);await overlay.evaluate(()=>{Math.random=()=>.1;});const character=overlay.getByTestId('character'),png=overlay.getByTestId('slingsip-png');
    const id=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#/companion')).id);
    await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());await expect(character).toHaveAttribute('data-state','reminder');
    await overlay.getByRole('button',{name:'Remind me later',exact:true}).evaluate(b=>b.click());await expect(png).toHaveAttribute('data-pose','disappointed');await overlay.screenshot({path:info.outputPath('png-later.png'),omitBackground:true});
    await expect(character).toHaveAttribute('data-state','hidden');expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).reminderRetry.pending).toBe(true);
    await expect(character).toHaveAttribute('data-state','reminder',{timeout:15000});
    await expect(png).toHaveAttribute('data-pose','disappointed',{timeout:15000});await expect(character).toHaveAttribute('data-state','hidden');
    const frames=await overlay.evaluate(()=>window.__pngFrames);expect(frames.filter(f=>f.state==='waiting'&&f.pose==='disappointed').length).toBeGreaterThan(0);expect(frames.some(f=>f.state==='swinging-back-left')).toBe(true);
    expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#/companion')).id)).toBe(id);
    const snapshot=await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot());expect(snapshot.hydration.currentWater).toBe(0);expect(snapshot.overlay).toMatchObject({visible:false,interactive:false});
    await dashboard.evaluate(()=>window.desktopCompanion.setRemindersPaused(true));expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).reminderRetry.pending).toBe(false);
  }finally{await app.close();}
});
