import { electron } from './helpers/existing-user-electron.mjs';
import assert from 'node:assert/strict';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {useApprovedFallback} from './helpers/companion-visuals.mjs';
import {TEMPORARY_BODY_PACK as pack} from '../src/app/features/companion/animation/temporary-body-pack.ts';
import {bodyCue,bodyWebs,bodyBottle,spriteFrame} from '../src/app/features/companion/animation/body-choreography.ts';
import {CharacterState as State} from '../src/app/features/companion/animation/character.model.ts';
import {entrySample,ENTRY_VARIANTS} from '../src/app/features/companion/animation/entry-variants.ts';
import {swingLayout,artworkPoint,swingSample} from '../src/app/features/companion/animation/swing-motion.ts';

test('Temporary pack supplies genuinely different body frames and authored anchors for all requested clips',async()=>{
  expect(pack.temporary).toBe(true);
  const assets=await readFile('public/assets/character/temporary-body/frames.svg','utf8');
  const required=['swing-grab','swing-down','swing-bottom','swing-up','release','mid-air','attach','settle','idle','success','web-shot','bottle-hold','retract'];
  expect(Object.keys(pack.clips)).toEqual(required);
  expect(Object.values(pack.clips).reduce((n,c)=>n+c.frames.length,0)).toBe(72);
  for(const name of required){
    const clip=pack.clips[name];expect(clip.frames.length).toBeGreaterThanOrEqual(4);
    const bodySources=new Set();
    for(const frame of clip.frames){
      for(const layer of [frame.body,frame.head])expect(assets).toContain('id="'+layer.src.split('#')[1]+'"');
      const id=frame.body.src.split('#')[1];bodySources.add(assets.split('id="'+id+'">')[1].split('<g id=')[0]);
      expect(frame.anchors.grip).toEqual({x:125,y:22});
      for(const p of Object.values(frame.anchors)){expect(Number.isFinite(p.x)&&Number.isFinite(p.y)).toBe(true);}
    }
    expect(bodySources.size).toBeGreaterThan(2);
  }
  expect(pack.clips.settle.durationMs).toBe(420);expect(pack.clips.idle.loop).toBe(true);
});

test('Two-web choreography clears the old strand before the next cast at all entry/exit variants and DIP sizes',()=>{
  for(const [w,h] of [[760,560],[1366,720],[1920,1032],[2560,1392]])for(const scale of [1,1.25,1.5]){
    const layout=swingLayout(w/scale,h/scale);
    for(const {id} of ENTRY_VARIANTS){
      const states=[];let free=0,retract=0,newWeb=0;const before=entrySample(layout,id,.37);
      for(let i=0;i<=250;i++){
        const t=i/250,pose=entrySample(layout,id,t),cue=bodyCue(State.SwingingIn,t),web=bodyWebs(layout,pose,State.SwingingIn,cue,id,pack);
        if(states.at(-1)!==cue.state)states.push(cue.state);
        assert.equal(web.old.opacity*web.main.opacity,0);
        if(web.stage==='free-flight'){free++;assert.equal(web.old.opacity+web.main.opacity,0);}
        if(web.stage==='retract-old')retract++;
        if(web.stage==='attach-web-2')newWeb++;
        assert.ok(spriteFrame(pack,cue).frame);
      }
      expect(states).toEqual(['swing-grab','swing-down','swing-bottom','swing-up','release','mid-air','attach','swing-down','swing-bottom','swing-up']);
      expect(free).toBeGreaterThan(0);expect(retract).toBeGreaterThan(0);expect(newWeb).toBeGreaterThan(0);
      // Rendering leaves every pre-existing trajectory sample untouched.
      expect(entrySample(layout,id,.37)).toEqual(before);
      for(const [phase,state] of [['right',State.SwingingOutRight],['left',State.SwingingBackLeft]])for(let i=0;i<=100;i++){
        const t=i/100,pose=swingSample(layout,phase,t),cue=bodyCue(state,t),web=bodyWebs(layout,pose,state,cue,id,pack);
        assert.equal(web.old.opacity*web.main.opacity,0);
      }
    }
  }
});

test('Bottle web uses each frame hand, drops before 10-degree damped swing, feedback, retract and stays on desktop',()=>{
  for(const [w,h] of [[760,560],[1366,720],[1920,1032],[2560,1392]])for(const scale of [1,1.25,1.5]){
    const layout=swingLayout(w/scale,h/scale),pose={...entrySample(layout,'classic',1),rotation:0};
    for(let i=0;i<=100;i++){
      const t=i/100,cue=bodyCue(State.DeliveringBottle,t),bottle=bodyBottle(layout,pose,t,cue,pack),hand=spriteFrame(pack,cue).frame.anchors.freeHand;
      assert.deepEqual(bottle.start,artworkPoint(layout,pose,hand.x,hand.y));
      assert.ok(bottle.y+bottle.size<=layout.height-16+.001);
      assert.ok(Math.abs(bottle.rotation)<=10);
      if(t<.16)assert.equal(bottle.opacity,0);
    }
    expect(bodyBottle(layout,pose,.38,bodyCue(State.DeliveringBottle,.38),pack).rotation).toBe(0);
    expect(Math.max(...Array.from({length:101},(_,i)=>Math.abs(bodyBottle(layout,pose,i/100,bodyCue(State.DeliveringBottle,i/100),pack).rotation)))).toBeGreaterThanOrEqual(8);
    expect(bodyBottle(layout,pose,.7,bodyCue(State.DeliveringBottle,.7),pack).feedback).toBe(1);
    const end=bodyBottle(layout,pose,1,bodyCue(State.DeliveringBottle,1),pack);
    expect(end.opacity+end.webOpacity+end.feedback).toBe(0);expect(end.x).toBe(end.start.x);expect(end.y).toBe(end.start.y);
  }
});

test('Native approved-pose fallback changes body frames while the existing path moves, idles without JS RAF and delivers dynamic water feedback',async({ },testInfo)=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app=await electron.launch({args:['.','--companion-test'],env,chromiumSandbox:true});const errors=[];
  try{
    await expect.poll(()=>app.windows().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
    const dashboard=app.windows().find(p=>p.url().endsWith('#/dashboard')),overlay=app.windows().find(p=>p.url().endsWith('#/companion'));
    await useApprovedFallback(overlay);
    await expect(overlay.locator('canvas, app-body-sprite-renderer')).toHaveCount(0);
    overlay.on('pageerror',e=>errors.push(e.message));
    await dashboard.evaluate(async()=>{const s=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...s,glassSizeMl:175,workingStart:'00:00',workingEnd:'00:01'});});
    await overlay.evaluate(()=>{
      Math.random=()=>.1;window.__bodyFrames=[];window.__renderRaf=0;
      const request=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{window.__renderRaf++;return request(cb);};
      const character=document.querySelector('[data-testid="character"]');
      new MutationObserver(()=>{
        const svg=document.querySelector('.mascot');if(!svg)return;
        const main=document.querySelector('.swing-web'),old=document.querySelector('.released-web');
        window.__bodyFrames.push({state:character.dataset.state,body:character.dataset.bodyState,frame:svg.dataset.bodyFrame,x:Number(character.dataset.x),web:character.dataset.webStage,main:Number(main?.getAttribute('opacity')),old:Number(old?.getAttribute('opacity'))});
      }).observe(character,{attributes:true,attributeFilter:['data-body-state','data-body-progress']});
    });
    await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());const character=overlay.getByTestId('character');
    await expect(character).toHaveAttribute('data-state','reminder');
    const frames=await overlay.evaluate(()=>window.__bodyFrames),entry=frames.filter(f=>f.state==='swinging-in' && f.body!=='settle');
    const order=[];entry.forEach(f=>{if(order.at(-1)!==f.body)order.push(f.body);});
    expect(order).toEqual(['swing-grab','swing-down','swing-bottom','swing-up','release','mid-air','attach','swing-down','swing-bottom','swing-up']);
    expect(frames.some(f=>f.body==='settle')).toBe(true);expect(frames.some(f=>f.body==='idle')).toBe(true);
    expect(new Set(entry.map(f=>f.frame)).size).toBe(5);
    expect(entry.filter(f=>f.web==='free-flight').length).toBeGreaterThan(0);entry.forEach(f=>expect(f.main*f.old).toBe(0));
    expect(Math.max(...entry.map(f=>f.x))-Math.min(...entry.map(f=>f.x))).toBeGreaterThan(500);
    const idleTransform=()=>overlay.locator('.mascot').evaluate(node=>getComputedStyle(node).transform);
    const first=await idleTransform(),raf=await overlay.evaluate(()=>window.__renderRaf);
    await overlay.waitForTimeout(650);expect(await idleTransform()).not.toBe(first);expect(await overlay.evaluate(()=>window.__renderRaf)).toBe(raf);
    await expect(overlay.locator('.current-pose .pose-image')).toHaveAttribute('href','assets/companion/slingsip/poses/ask.png');
    await overlay.screenshot({path:testInfo.outputPath('animated-idle.png'),omitBackground:true});
    await overlay.getByTestId('drank-it').evaluate(b=>b.click());await expect(dashboard.getByTestId('dashboard-water')).toHaveText('175 / 2000 ml');
    await expect(character).toHaveAttribute('data-state','delivering-bottle');
    await expect(overlay.getByTestId('bottle-water-feedback')).toHaveText('+175 ml');
    await expect(overlay.getByTestId('companion-bottle')).toHaveAttribute('data-delivery-stage','pendulum');
    await overlay.screenshot({path:testInfo.outputPath('sprite-bottle-delivery.png'),omitBackground:true});
    await expect(character).toHaveAttribute('data-state','hidden');
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).hydration.currentWater).toBe(175);
    await expect(overlay.locator('app-body-sprite-renderer')).toHaveCount(0);await expect(overlay.locator('.bottle-web')).toHaveCount(0);
    const hidden=await overlay.evaluate(()=>window.__renderRaf);await overlay.waitForTimeout(300);expect(await overlay.evaluate(()=>window.__renderRaf)).toBe(hidden);
    expect(errors).toEqual([]);
  }finally{await app.close();}
});
