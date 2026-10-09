import { _electron as electron, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const out = 'docs/previews/reference-style';
await mkdir(out, {recursive:true});
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
const app = await electron.launch({args:['.','--companion-test'],env,chromiumSandbox:true});
const errors = [], flows = [];
const motionExpect = expect.configure({timeout:30000});
try {
  await expect.poll(() => app.windows().filter(p => /#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
  const dashboard = app.windows().find(p => p.url().endsWith('#/dashboard'));
  const overlay = app.windows().find(p => p.url().endsWith('#/companion'));
  await expect(overlay.getByTestId('companion-3d')).toHaveAttribute('data-model-ready','true',{timeout:30000});
  dashboard.on('pageerror',e => errors.push(e.message));overlay.on('pageerror',e => errors.push(e.message));
  // Isolated capture profile: avoid a real clock slot while recording previews.
  await dashboard.evaluate(async () => {const settings=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...settings,workingStart:'00:00',workingEnd:'00:01'});});
  for (const [name, random, action] of [['Classic',.1],['High',0],['Fast Zip',.65],['Upside Down',.95],['Success',.1,'success'],['Later',0,'later'],['Ignore',.1,'ignore']]) {
    await overlay.evaluate(value => {Math.random = () => value;},random);
    const frames = [], saved = new Set();let complete = false;
    const start = performance.now();
    await dashboard.evaluate(() => window.desktopCompanion.triggerDevelopmentReminder());
    const capture = (async () => {
      while (!complete) {
        const character = overlay.getByTestId('character'), state = await character.getAttribute('data-state');
        const visual = await overlay.getByTestId('companion-3d').evaluate(canvas => ({...canvas.dataset}));
        if (state === 'hidden' && frames.length) break;
        let bytes;
        try {bytes = await overlay.screenshot({omitBackground:true,timeout:1500});}
        catch (error) {if (await character.getAttribute('data-state') === 'hidden') break;throw error;}
        frames.push({time:Math.round(performance.now()-start),state,body:visual.clip,web:visual.webStage,expression:visual.expression,bottleOpacity:Number(visual.bottleOpacity),bottleRotation:Number(visual.bottleRotation),image:'data:image/png;base64,'+bytes.toString('base64')});
        const stateCount = frames.filter(f => f.state === state).length;
        const key = state === 'swinging-in' ? name.toLowerCase().replaceAll(' ','-') : state;
        if (!saved.has(state) && stateCount >= (state === 'delivering-bottle' ? 4 : state === 'swinging-in' ? 4 : 2)) {saved.add(state);await writeFile(out+'/'+name.toLowerCase().replaceAll(' ','-')+'-'+key+'.png',bytes);}
        await new Promise(resolve => setTimeout(resolve,70));
      }
    })();
    await motionExpect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    await overlay.waitForTimeout(action ? 500 : 900);
    if (action === 'success') await overlay.getByTestId('drank-it').evaluate(button => button.click());
    if (action === 'ignore') await motionExpect(overlay.getByTestId('character')).toHaveAttribute('data-state','waiting');
    if (action === 'later') await overlay.getByRole('button',{name:'Remind me later',exact:true}).evaluate(button => button.click());
    if (action) await motionExpect(overlay.getByTestId('character')).toHaveAttribute('data-state','hidden');
    complete = true;await capture;
    await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
    flows.push({name,frames});
  }
  await writeFile('.cache/reference-captured-frames.json',JSON.stringify(flows));
  await app.evaluate(({BrowserWindow}) => {const window=BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('#/dashboard'));window.show();window.focus();});
  await dashboard.screenshot({path:out+'/dashboard.png'});
  await dashboard.getByRole('link',{name:'Settings',exact:true}).click();
  await dashboard.locator('app-companion-preferences').scrollIntoViewIfNeeded();
  await dashboard.screenshot({path:out+'/companion-preferences.png'});
  await dashboard.getByRole('link',{name:'Overview',exact:true}).click();
  await dashboard.getByTestId('animation-lab-open').click();
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('#/dashboard')).focus());
  await dashboard.getByTestId('lab-classic').click();await motionExpect(dashboard.getByTestId('character')).toHaveAttribute('data-state','reminder');
  await dashboard.waitForTimeout(350);await dashboard.screenshot({path:out+'/animation-lab.png'});
  await dashboard.getByTestId('animation-lab-stage').screenshot({path:out+'/animation-lab-detail.png'});
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('#/dashboard')).setSize(760,560));
  await expect.poll(() => dashboard.getByTestId('animation-lab-stage').evaluate(stage => getComputedStyle(stage).height)).toBe('420px');
  await dashboard.getByTestId('animation-lab-stage').scrollIntoViewIfNeeded();
  const bounds=await dashboard.evaluate(() => ({stage:document.querySelector('.lab-stage').getBoundingClientRect().toJSON(),art:document.querySelector('[data-testid="character"]').getBoundingClientRect().toJSON()}));
  expect(bounds.art.bottom).toBeLessThan(bounds.stage.bottom);
  await dashboard.screenshot({path:out+'/animation-lab-minimum.png'});
  await writeFile('.cache/reference-captured-frames.json',JSON.stringify(flows));
  await writeFile('.cache/reference-capture-errors.json',JSON.stringify(errors));
  expect(errors).toEqual([]);
  console.log(JSON.stringify(flows.map(f => ({name:f.name,frames:f.frames.length,durationMs:f.frames.at(-1)?.time,states:[...new Set(f.frames.map(s => s.state))]}))));
} finally {await app.close();}
