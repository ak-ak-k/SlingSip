import { _electron as electron, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Screenshot fixtures only; the app reads/calculates them through its normal store.
const DEFAULT_HYDRATION_SETTINGS={dailyGoalMl:2000,glassSizeMl:250,workingStart:'10:00',workingEnd:'18:00',retryIntervalMinutes:5,remindersEnabled:true,launchAtStartup:false};
const localDateKey=date=>date.toLocaleDateString('sv-SE');
const previousDay=key=>{const [y,m,d]=key.split('-').map(Number);return localDateKey(new Date(y,m-1,d-1));};
const historyEntry=(date,goalMl,consumedMl)=>({date,goalMl,consumedMl,percentage:Math.min(100,Math.round(consumedMl/goalMl*100)),completed:consumedMl>=goalMl});

const out='docs/previews/unified-identity',profile='identity-capture-'+randomUUID();
const directory=path.join(tmpdir(),'mizu-overlay-tests',profile),today=localDateKey(new Date()),yesterday=previousDay(today);
await mkdir(out,{recursive:true});await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,'hydration.json'),JSON.stringify({schemaVersion:2,date:today,currentWaterMl:1250,settings:DEFAULT_HYDRATION_SETTINGS,history:[historyEntry(yesterday,2000,2000),historyEntry(previousDay(yesterday),2000,1500)]}));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
const app=await electron.launch({args:['.','--companion-test',`--companion-test-profile=${profile}`],env,chromiumSandbox:true});
const errors=[],screens=[];
const save=async(page,file,label)=>{await page.screenshot({path:out+'/'+file,omitBackground:true});screens.push({file,label});};
const resize=async(width,height)=>{
  await app.evaluate(({BrowserWindow},size)=>{const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('#/dashboard'));window.setContentSize(...size);window.show();window.focus();},[width,height]);
};
try{
  await expect.poll(()=>app.windows().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
  const dashboard=app.windows().find(p=>p.url().endsWith('#/dashboard')),overlay=app.windows().find(p=>p.url().endsWith('#/companion'));
  dashboard.on('pageerror',e=>errors.push(e.message));overlay.on('pageerror',e=>errors.push(e.message));
  await expect(dashboard.getByTestId('dashboard-water')).toHaveText('1250 / 2000 ml');
  await expect(dashboard.getByTestId('slingsip-hero-mascot')).toHaveAttribute('data-asset-key','idle');
  for(const [width,height]of[[1366,768],[1920,1080],[2560,1440],[760,560]]){
    await resize(width,height);await expect.poll(()=>dashboard.evaluate(()=>innerWidth)).toBe(width);
    await dashboard.locator('.main-content').evaluate(n=>n.scrollTop=0);await dashboard.waitForTimeout(120);
    await save(dashboard,`overview-${width}.png`,`Overview ${width} x ${height}`);
  }
  await resize(1366,900);
  await dashboard.getByRole('link',{name:'History',exact:true}).click();await expect(dashboard.getByTestId('history-page')).toBeVisible();await save(dashboard,'history.png','History');
  await dashboard.getByRole('link',{name:'Settings',exact:true}).click();await expect(dashboard.getByTestId('settings-page')).toBeVisible();await save(dashboard,'settings.png','Settings');
  await dashboard.locator('app-companion-preferences').scrollIntoViewIfNeeded();await save(dashboard,'preferences.png','Sidekick preferences');
  await dashboard.getByRole('link',{name:'Overview',exact:true}).click();
  await overlay.evaluate(()=>{Math.random=()=>.1;});await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());
  await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');await save(overlay,'reminder.png','Transparent desktop reminder');
  await overlay.getByTestId('drank-it').evaluate(b=>b.click());await expect(overlay.getByTestId('companion-bottle')).toHaveAttribute('data-delivery-stage','pendulum');await save(overlay,'success-bottle.png','Approved Happy and bottle delivery');
  await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','hidden',{timeout:30000});
  await dashboard.evaluate(()=>window.desktopCompanion.triggerDevelopmentReminder());await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
  await overlay.getByRole('button',{name:'Remind me later',exact:true}).evaluate(b=>b.click());await expect(overlay.getByTestId('slingsip-png')).toHaveAttribute('data-pose','disappointed');await save(overlay,'later.png','Approved disappointed head and Later bubble');
  await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','hidden',{timeout:30000});await dashboard.evaluate(()=>window.desktopCompanion.setOverlayVisible(false));
  await dashboard.getByTestId('animation-lab-open').click();await dashboard.getByTestId('lab-classic').click();await expect(dashboard.getByTestId('character')).toHaveAttribute('data-state','reminder');await resize(1366,900);await save(dashboard,'animation-lab.png','Animation lab in shared theme');
  await dashboard.getByTestId('close-animation-lab').click();expect(errors).toEqual([]);
  const gallery=screens.map(({file,label})=>`<figure><a href="${file}"><img src="${file}" alt="${label}" loading="lazy"></a><figcaption>${label}</figcaption></figure>`).join('');
  await writeFile(out+'/index.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SlingSip visual identity review</title><style>body{margin:0;padding:32px;background:#09121c;color:#eff7fb;font:15px/1.6 system-ui}h1{color:#8ce8ca}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,500px),1fr));gap:24px}figure{margin:0;padding:12px;background:#13212e;border:1px solid #29424e;border-radius:18px}img{width:100%;display:block;background:repeating-conic-gradient(#13212e 0% 25%,#1b2d3d 0% 50%) 0/24px 24px}figcaption{padding:10px 0}a{color:#39d7e5}</style><h1>SlingSip: one mascot, one theme</h1><p>Native Angular + Electron captures from an isolated test profile. Click to view full resolution. Desktop alpha is shown over a checker pattern here; the application remains transparent.</p><main>${gallery}</main></html>`);
  await writeFile(out+'/capture.json',JSON.stringify({date:new Date().toISOString(),isolatedProfile:profile,fixtureWaterMl:1250,screens,errors},null,2));
  console.log(JSON.stringify({screens:screens.length,errors}));
}finally{await app.close();}
