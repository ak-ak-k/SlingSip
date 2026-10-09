import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { swingLayout, swingSample } from '../src/app/features/companion/animation/swing-motion.ts';
import { pngWebs, pngBottle, pngPose } from '../src/app/features/companion/animation/slingsip-png-choreography.ts';
import { webPath } from '../src/app/features/companion/animation/web-geometry.ts';
import { CharacterState as State } from '../src/app/features/companion/animation/character.model.ts';
import { connectionDistance } from './helpers/companion-visuals.mjs';

test('Larger work-area layouts prefer free dashboard gutters and keep fallback panels above action cards', () => {
  const intersects = (a, b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
  for (const [pixelsW,pixelsH] of [[1366,720],[1920,1032],[2560,1392]]) for (const scale of [1,1.25,1.5]) {
    const w=pixelsW/scale,h=pixelsH/scale, dashboard={x:(w-Math.min(1160,w))/2,y:(h-Math.min(820,h))/2,width:Math.min(1160,w),height:Math.min(820,h)};
    for(const bounds of [dashboard,{...dashboard,x:0,width:w,y:0,height:h}]){
      const layout=swingLayout(w,h,bounds),bubble=layout.bubble;
      expect(layout.characterHeight).toBeCloseTo(Math.min(196,Math.max(112,h*.26))*1.2,7);
      expect(layout.characterWidth/layout.characterHeight).toBeCloseTo(160/220,7);
      expect(bubble.left).toBeGreaterThanOrEqual(16);expect(bubble.left+bubble.width).toBeLessThanOrEqual(w-16+.01);
      expect(bubble.top+236).toBeLessThanOrEqual(h-16+.01);
      if(layout.region.endsWith('gutter'))expect(intersects({x:bubble.left,y:bubble.top,width:bubble.width,height:236},bounds)).toBe(false);
      else if(layout.region==='dashboard-hero')expect(bubble.top+236).toBeLessThan(bounds.y+66+30+(bounds.width<=1000?215:232));
    }
  }
});

test('Exit paths travel monotonically toward their chosen edge, retain opacity and clear the full mascot', () => {
  for(const[w,h]of[[760,560],[1366,720],[1920,1032],[2560,1392]]){
    const layout=swingLayout(w,h);
    for(const phase of ['left','right']){
      const samples=Array.from({length:101},(_,i)=>swingSample(layout,phase,i/100));
      const sign=phase==='right'?1:-1;
      expect(sign*(samples[25].x-samples[0].x)).toBeGreaterThan(35);
      for(let i=1;i<samples.length;i++)expect(sign*(samples[i].x-samples[i-1].x)).toBeGreaterThanOrEqual(0);
      if(phase==='left')expect(samples.at(-1).x+layout.characterWidth*1.2).toBeLessThan(0);
      else expect(samples.at(-1).x-layout.characterWidth*1.2).toBeGreaterThan(w);
    }
  }
});

test('Local curved webs retain their sockets and release order; bottle visibility is 984ms with an 816ms opaque hold', () => {
  const layout=swingLayout(1920,1032);
  const ask=pngPose(State.Reminder,0,'classic'),happy=pngPose(State.Success,0,'classic');
  expect(ask.anchors.webGrip).toEqual(ask.anchors.freeHand);
  expect(ask.anchors.webGrip.y).toBeGreaterThan(ask.anchors.grip.y+80);
  expect(happy.anchors.webGrip.x).toBeGreaterThan(happy.anchors.freeHand.x+80);
  for(const[phase,state]of[['entry',State.SwingingIn],['left',State.SwingingBackLeft],['right',State.SwingingOutRight]])for(let i=0;i<=100;i++){
    const t=i/100,pose=swingSample(layout,phase,t),webs=pngWebs(layout,pose,state,t,'classic');
    expect(webs.main.opacity*webs.old.opacity).toBe(0);
    expect(Math.hypot(webs.main.a.x-webs.main.b.x,webs.main.a.y-webs.main.b.y)).toBeLessThanOrEqual(layout.characterHeight*1.12+.001);
    expect(webPath(webs.main.a,webs.main.b)).toContain(' Q');
  }
  const pose={...swingSample(layout,'entry',1),rotation:0},samples=Array.from({length:1201},(_,ms)=>pngBottle(layout,pose,State.DeliveringBottle,ms/1200,ms/1200,'classic'));
  expect(samples.filter(sample=>sample.opacity>0).length).toBeGreaterThanOrEqual(980);
  expect(samples.filter(sample=>sample.opacity>0).length).toBeLessThanOrEqual(1000);
  expect(samples.filter(sample=>sample.opacity===1).length).toBeGreaterThanOrEqual(800);
  expect(samples[600].size/(196*.46)).toBeCloseTo(1.5,7);
  expect(Math.max(...samples.map(sample=>Math.abs(sample.rotation)))).toBeGreaterThan(8);
  for(const sample of samples)expect(sample.y+sample.size).toBeLessThanOrEqual(layout.height-16+.001);
});

test('Native visual polish keeps real drink immediate, curved socket attachment, explicit exits and hidden cleanup', async ({},info) => {
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app=await electron.launch({args:['.','--companion-test',`--companion-test-profile=polish-${randomUUID()}`,'--companion-test-production'],env,chromiumSandbox:true});
  const errors=[];app.on('window',page=>page.on('pageerror',error=>errors.push(error.message)));
  try{
    await expect.poll(()=>app.windows().filter(page=>/#\/(dashboard|companion)$/.test(page.url())).length,{timeout:60000}).toBe(2);
    const dashboard=app.windows().find(page=>page.url().endsWith('#/dashboard')),overlay=app.windows().find(page=>page.url().endsWith('#/companion'));
    await overlay.evaluate(()=>{Math.random=()=>.01;window.__polishFrames=[];window.__polishRaf=0;const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>{window.__polishRaf++;return raf(fn);};
      const character=document.querySelector('[data-testid=character]');new MutationObserver(()=>window.__polishFrames.push({state:character.dataset.state,x:Number(character.dataset.x),y:Number(character.dataset.y),t:Number(character.dataset.bodyProgress)})).observe(character,{attributes:true,attributeFilter:['data-x','data-state']});});
    const directory=path.resolve('docs/previews/companion-polish');await mkdir(directory,{recursive:true});
    const assertProtected=async snapshot=>{
    const protectedRects=await dashboard.locator('app-today-progress, app-reminder-status, app-streak-card, button').evaluateAll(nodes=>nodes.map(node=>{
      const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};
    }).filter(r=>r.width>0&&r.height>0));
    const occupied=await overlay.locator('.speech-bubble, .current-pose .body-art').evaluateAll(nodes=>nodes.map(node=>{
      const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};
    }));
    const area=snapshot.display.workArea,bounds=snapshot.dashboardBounds;
    for(const rect of protectedRects)for(const body of occupied){
      const absolute={...rect,x:rect.x+bounds.x-area.x,y:rect.y+bounds.y-area.y};
      expect(body.x<absolute.x+absolute.width&&body.x+body.width>absolute.x&&body.y<absolute.y+absolute.height&&body.y+body.height>absolute.y).toBe(false);
    }
    };
    await dashboard.screenshot({path:path.join(directory,'dashboard.png')});
    await dashboard.evaluate(()=>window.desktopCompanion.openCompanion());await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    await expect.poll(()=>connectionDistance(overlay,'grip')).toBeLessThan(2);
    await expect(overlay.getByTestId('swing-web')).toHaveAttribute('d',/ Q/);
    await overlay.screenshot({path:path.join(directory,'reminder.png'),omitBackground:true});
    const before=await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot());
    await assertProtected(before);
    await overlay.getByTestId('drank-it').click();await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await expect.poll(()=>overlay.getByTestId('companion-bottle').evaluate(node=>Number(node.style.opacity))).toBe(1);
    await expect.poll(()=>connectionDistance(overlay,'hand')).toBeLessThan(2);
    await overlay.screenshot({path:path.join(directory,'bottle.png'),omitBackground:true});
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','swinging-out-right');
    await expect.poll(()=>overlay.getByTestId('slingsip-png').getAttribute('data-phase-progress').then(Number)).toBeGreaterThan(.35);
    await overlay.screenshot({path:path.join(directory,'exit-right.png'),omitBackground:true});
    await expect.poll(async()=>(await overlay.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    const right=await overlay.evaluate(()=>window.__polishFrames.filter(frame=>frame.state==='swinging-out-right'));expect(right.length).toBeGreaterThan(5);expect(right.at(-1).x-right[0].x).toBeGreaterThan(100);
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('#/dashboard')).maximize());
    await dashboard.waitForTimeout(300);
    await dashboard.screenshot({path:path.join(directory,'dashboard-maximized.png')});
    await dashboard.evaluate(()=>window.desktopCompanion.openCompanion());await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    const maximized=await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot());
    await assertProtected(maximized);
    await expect.poll(()=>connectionDistance(overlay,'grip')).toBeLessThan(2);
    await overlay.screenshot({path:path.join(directory,'reminder-maximized.png'),omitBackground:true});
    await expect.poll(()=>connectionDistance(overlay,'grip')).toBeLessThan(2);
    await overlay.getByRole('button',{name:'Remind me later',exact:true}).click();await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','swinging-back-left');
    await expect.poll(()=>overlay.getByTestId('slingsip-png').getAttribute('data-phase-progress').then(Number)).toBeGreaterThan(.35);
    await overlay.screenshot({path:path.join(directory,'exit-left.png'),omitBackground:true});
    await expect.poll(async()=>(await overlay.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    const left=await overlay.evaluate(()=>window.__polishFrames.filter(frame=>frame.state==='swinging-back-left'));expect(left.length).toBeGreaterThan(5);expect(left[0].x-left.at(-1).x).toBeGreaterThan(100);
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).hydration.currentWater).toBe(250);
    await dashboard.evaluate(()=>window.desktopCompanion.setOverlayVisible(false));
    const raf=await overlay.evaluate(()=>window.__polishRaf);await overlay.waitForTimeout(350);expect(await overlay.evaluate(()=>window.__polishRaf)).toBe(raf);
    expect(await overlay.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running').length)).toBe(0);
    expect(errors).toEqual([]);
    await writeFile(path.join(directory,'capture.json'),JSON.stringify({dashboard:before.dashboardBounds,maximizedDashboard:maximized.dashboardBounds,workArea:before.display.workArea,right,left},null,2)+'\n');
  }finally{await app.close();}
});
