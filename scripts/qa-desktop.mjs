import { expect } from '@playwright/test';
import { electron } from '../tests/helpers/existing-user-electron.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

// Read-only runtime observation in an isolated profile. Never modifies normal data or startup.
const environment={...process.env};delete environment.ELECTRON_RUN_AS_NODE;delete environment.ELECTRON_RENDERER_URL;
const profile='qa-observe-'+randomUUID();
const captureOnly=process.argv.includes('--capture-only');
const reportFile=process.argv.find(arg=>arg.startsWith('--report='))?.slice('--report='.length)
  ?? (captureOnly?'docs/slingsip-final-qa-captures.json':'docs/slingsip-final-qa-performance.json');
const screenshotDirectory=path.resolve(process.argv.find(arg=>arg.startsWith('--screenshots='))?.slice('--screenshots='.length) ?? 'docs/previews/final-qa');
const app=await electron.launch({args:['.','--companion-test',`--companion-test-profile=${profile}`,'--companion-test-production'],env:environment,chromiumSandbox:true});
const ownedProcess=app.process();
const report={profile,createdAt:new Date().toISOString(),platform:process.platform,samples:[],cycles:[],errors:[],warnings:[]};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.on('window',page=>{page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());else if(message.type()==='warning')report.warnings.push(message.text());});});
let stderr='';app.process().stderr.on('data',chunk=>stderr+=chunk);
try{
  await expect.poll(()=>app.windows().length,{timeout:60000}).toBe(2);
  const dashboard=app.windows().find(page=>page.url().endsWith('#/dashboard')),overlay=app.windows().find(page=>page.url().endsWith('#/companion'));
  await expect(dashboard.getByTestId('dashboard')).toBeVisible();
  await overlay.evaluate(()=>{
    const raf=window.requestAnimationFrame.bind(window),set=window.setInterval.bind(window),clear=window.clearInterval.bind(window);
    window.__qaWork={raf:0,intervals:new Set()};
    window.requestAnimationFrame=callback=>{window.__qaWork.raf++;return raf(callback);};
    window.setInterval=(callback,delay,...args)=>{const id=set(callback,delay,...args);window.__qaWork.intervals.add(id);return id;};
    window.clearInterval=id=>{window.__qaWork.intervals.delete(id);return clear(id);};
  });
  const heapSession=await overlay.context().newCDPSession(overlay);
  const work=()=>overlay.evaluate(()=>({raf:window.__qaWork.raf,intervals:window.__qaWork.intervals.size,animations:document.getAnimations().filter(animation=>animation.playState==='running').length,images:document.querySelectorAll('image').length,mascots:document.querySelectorAll('app-slingsip-png-renderer').length}));
  const metrics=()=>app.evaluate(({app})=>app.getAppMetrics().map(({pid,type,cpu,memory})=>({pid,type,cpuPercent:cpu.percentCPUUsage,workingSetMB:memory.workingSetSize/1024,privateMB:(memory.privateBytes??0)/1024})));
  const sample=async(name,duration=5000)=>{const before=await work();await metrics();await sleep(duration);const processes=await metrics();const after=await work();const heap=await heapSession.send('Runtime.getHeapUsage');report.samples.push({name,durationMs:duration,rafDelta:after.raf-before.raf,work:after,cpuPercent:processes.reduce((sum,item)=>sum+item.cpuPercent,0),privateMB:processes.reduce((sum,item)=>sum+item.privateMB,0),workingSetMB:processes.reduce((sum,item)=>sum+item.workingSetMB,0),heapMB:heap.usedSize/1024/1024,processes});return after;};
  await mkdir(screenshotDirectory,{recursive:true});
  // Capture settled poses without waiting for the intentional infinite idle loop.
  const settleCapture=page=>page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation=>animation.finished.catch(()=>{})));});
  const capturePage=async(name,selector)=>{
    await expect(dashboard.locator(selector)).toBeVisible();
    await expect.poll(()=>dashboard.locator(selector).evaluate(node=>getComputedStyle(node).opacity)).toBe('1');
    await settleCapture(dashboard);
    await dashboard.screenshot({path:path.join(screenshotDirectory,name+'.png')});
  };
  await capturePage('overview','.page-content');
  await dashboard.getByRole('link',{name:'History',exact:true}).click();await capturePage('history','[data-testid="history-page"]');
  await dashboard.getByRole('link',{name:'Settings',exact:true}).click();await capturePage('settings','[data-testid="settings-page"]');
  await dashboard.getByRole('link',{name:'Overview',exact:true}).click();
  if(!captureOnly){
  const hidden=await sample('hidden/dashboard-open');expect(hidden.intervals).toBe(0);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('#/dashboard')).close());
  await expect.poll(()=>app.windows().length).toBe(1);
  const background=await sample('hidden/dashboard-closed',8000);expect(background.intervals).toBe(0);
  await app.evaluate(()=>globalThis.__slingSipTestTray.menu.getMenuItemById('open').click());await expect.poll(()=>app.windows().length,{timeout:60000}).toBe(2);
  const reopened=app.windows().find(page=>page.url().endsWith('#/dashboard'));
  for(let index=0;index<6;index++){
    await reopened.getByTestId('open-companion').click();await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    if(index===0){await settleCapture(overlay);await overlay.screenshot({path:path.join(screenshotDirectory,'reminder.png'),omitBackground:true});await sample('visible/hanging-idle');}
    await overlay.getByTestId('drank-it').click();
    if(index===0){await expect(overlay.getByTestId('companion-bottle')).toBeVisible();await settleCapture(overlay);await overlay.screenshot({path:path.join(screenshotDirectory,'success-bottle.png'),omitBackground:true});}
    await expect.poll(async()=>(await overlay.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    await heapSession.send('HeapProfiler.collectGarbage');
    report.cycles.push({cycle:index+1,heapMB:(await heapSession.send('Runtime.getHeapUsage')).usedSize/1024/1024,work:await work()});
  }
  const after=await sample('hidden/after-six-cycles',8000);expect(after.intervals).toBe(0);expect(after.mascots).toBe(0);expect(after.animations).toBe(0);
  expect(report.samples.filter(sample=>sample.name.startsWith('hidden')).every(sample=>sample.rafDelta===0)).toBe(true);
  report.finalState=await reopened.evaluate(()=>window.desktopCompanion.getSnapshot());
  expect(report.finalState.hydration.currentWater).toBe(1500);expect(report.errors).toEqual([]);
  report.security=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(window=>({role:window.webContents.getURL().split('#/')[1],preferences:window.webContents.getLastWebPreferences()})));
  }
}catch(error){report.failure=error instanceof Error?error.message:String(error);throw error;}
finally{
  report.stderr=stderr;await app.close();report.ownedProcessExited=ownedProcess.exitCode!==null;
  await mkdir(path.dirname(reportFile),{recursive:true});
  await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({samples:report.samples.map(({name,cpuPercent,privateMB,workingSetMB,heapMB,rafDelta})=>({name,cpuPercent,privateMB,workingSetMB,heapMB,rafDelta})),cycles:report.cycles,errors:report.errors,warnings:report.warnings,failure:report.failure},null,2));
}
