import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect, chromium } from '@playwright/test';
import { EventEmitter } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RestartController } from '../electron/restart-controller.ts';
import { DevelopmentWorkflow } from '../scripts/dev-workflow.mjs';
import { DEV_RESTART_EXIT_CODE } from '../shared/development-contract.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';
import { historyEntry, previousDay } from '../shared/hydration-history.ts';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { DEFAULT_COMPANION_PREFERENCES } from '../shared/companion-preferences.ts';

test('Restart persists before cleanup, schedules one replacement and exits once; failed persistence keeps the session',()=>{
  const order=[];let fail=true,controller;
  controller=new RestartController({
    persist:()=>{order.push('persist');if(fail)throw new Error('disk unavailable');},
    cleanup:()=>{order.push('cleanup');expect(controller.restart()).toBe(false);},
    relaunch:()=>order.push('relaunch'),exit:()=>order.push('exit'),failed:()=>order.push('failed'),
  });
  expect(controller.restart()).toBe(false);expect(order).toEqual(['persist','failed']);
  fail=false;expect(controller.restart()).toBe(true);expect(controller.restart()).toBe(false);
  expect(order).toEqual(['persist','failed','persist','cleanup','relaunch','exit']);
});

function fakeDevelopment(build=async()=>{}){
  const children=[],stops=[],messages=[];
  const workflow=new DevelopmentWorkflow({build,prepareAssets:async()=>{},stopServer:code=>stops.push(code),log:()=>{},debounceMs:0,
    launch:()=>{const child=new EventEmitter();child.connected=true;child.send=(message,callback)=>{messages.push(message.type);callback?.();};child.kill=()=>child.emit('exit',0);children.push(child);queueMicrotask(()=>child.emit('message',{type:'slingsip:ready',pid:children.length}));return child;},
  });
  workflow.start();return{workflow,children,stops,messages};
}

test('Development compilation failure keeps the old child; assets refresh only renderers and quit is graceful',async()=>{
  const f=fakeDevelopment(async()=>{throw new Error('bad main source');});await Promise.resolve();
  f.workflow.pending.add('electron');await f.workflow.flush();expect(f.children).toHaveLength(1);expect(f.messages).toEqual([]);
  f.workflow.pending.add('assets');await f.workflow.flush();f.workflow.angularBuilt();expect(f.messages).toEqual(['slingsip:reload-assets']);
  f.workflow.stop();expect(f.messages.at(-1)).toBe('slingsip:quit');f.children[0].emit('exit',0);expect(f.stops).toEqual([0]);
});

test('Development holds a manual restart during rebuilding and starts one child after the old process exits',async()=>{
  let release;const f=fakeDevelopment(()=>new Promise(resolve=>release=resolve));await Promise.resolve();
  f.workflow.pending.add('electron');const work=f.workflow.flush();f.children[0].emit('exit',DEV_RESTART_EXIT_CODE);
  expect(f.children).toHaveLength(1);release();await work;await Promise.resolve();
  expect(f.children).toHaveLength(2);expect(f.workflow.child).toBe(f.children[1]);
  f.workflow.stop();f.children[1].emit('exit',0);
});

async function freePort(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
async function reconnect(port){
  let browser;
  await expect.poll(async()=>{try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);return true;}catch{return false;}},{timeout:60000,intervals:[250,500,1000]}).toBe(true);
  await expect.poll(()=>browser.contexts()[0].pages().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
  return{browser,dashboard:browser.contexts()[0].pages().find(p=>p.url().endsWith('#/dashboard')),overlay:browser.contexts()[0].pages().find(p=>p.url().endsWith('#/companion'))};
}

for(const restartState of ['active','idle','paused'])test(`Real production tray restart from ${restartState} exits old Electron, restores data/preferences/history and retains one window pair`,async()=>{
  const profile='restart-'+randomUUID(),directory=path.join(tmpdir(),'mizu-overlay-tests',profile),port=await freePort();
  const today=localDateKey(new Date()),history=[historyEntry(previousDay(today),2000,2000)];
  const settings={...DEFAULT_HYDRATION_SETTINGS,dailyGoalMl:2400,glassSizeMl:300,workingStart:'00:00',workingEnd:'00:01'};
  const preferences={...DEFAULT_COMPANION_PREFERENCES,lowPowerAnimations:true,cursorAwareness:false};
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'hydration.json'),JSON.stringify({schemaVersion:2,date:today,currentWaterMl:600,settings,history}));
  await writeFile(path.join(directory,'companion-preferences.json'),JSON.stringify({schemaVersion:1,preferences}));
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  let app=await electron.launch({args:['.','--companion-test',`--companion-test-profile=${profile}`,'--companion-test-production','--companion-test-login-items',`--remote-debugging-port=${port}`],env,chromiumSandbox:true});let successor;
  try{
    await expect.poll(()=>app.windows().filter(p=>/#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
    const dashboard=app.windows().find(p=>p.url().endsWith('#/dashboard')),overlay=app.windows().find(p=>p.url().endsWith('#/companion'));
    await dashboard.evaluate(()=>window.desktopCompanion.updateDisplayName('Restart User'));
    await dashboard.getByTestId('drink-water').click();await expect(dashboard.getByTestId('dashboard-water')).toHaveText('900 / 2400 ml');
    if(process.platform==='win32'){
      settings.launchAtStartup=true;
      await dashboard.evaluate(settings=>window.desktopCompanion.updateHydrationSettings(settings),settings);
    }
    if(restartState==='active'){
      await dashboard.getByTestId('open-companion').click();await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    }else if(restartState==='paused'){
      await dashboard.getByTestId('pause-reminders').click();
      expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).scheduler.remindersPaused).toBe(true);
    }
    const before=await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot());expect(before.tray.available).toBe(true);
    expect(await app.evaluate(()=>globalThis.__slingSipTestTray.menu.getMenuItemById('restart').label)).toBe('Restart SlingSip');
    const closed=app.waitForEvent('close');
    await app.evaluate(()=>{setImmediate(()=>globalThis.__slingSipTestTray.menu.getMenuItemById('restart').click());});
    await closed;app=undefined;successor=await reconnect(port);
    const state=await successor.dashboard.evaluate(()=>window.desktopCompanion.getSnapshot());
    expect(state.hydration.currentWater).toBe(900);expect(state.hydrationState.settings).toEqual(settings);expect(state.history).toEqual(before.history);expect(state.streaks).toEqual(before.streaks);
    expect(state.companionPreferences).toEqual(preferences);expect(state.tray.available).toBe(true);expect(state.startup).toEqual(before.startup);
    expect(state.userProfile).toEqual(before.userProfile);
    await expect(successor.dashboard.getByTestId('profile-chip')).toContainText('Restart User');
    expect(state.overlay.visible).toBe(false);expect(state.reminderRetry.pending).toBe(false);
    expect(state.scheduler).toMatchObject({reminderActive:false,remindersPaused:false,remindersEnabled:true,nextReminderAt:null,todaySchedule:before.scheduler.todaySchedule});
    expect(state.scheduler.todaySchedule).toHaveLength(8);
    await expect(successor.dashboard.getByTestId('slingsip-hero-mascot')).toHaveAttribute('data-asset-key','idle');
    const bytes=JSON.parse(await readFile(path.join(directory,'hydration.json'),'utf8'));expect(bytes.currentWaterMl).toBe(900);expect(bytes.history).toEqual(history);
    // A second process with the same profile must exit and reuse this owner.
    const duplicate=spawn(electronPath,['.','--companion-test',`--companion-test-profile=${profile}`,'--companion-test-production'],{env,windowsHide:true});
    await new Promise((resolve,reject)=>{duplicate.once('exit',resolve);duplicate.once('error',reject);});expect(duplicate.exitCode).toBe(0);
    expect(successor.browser.contexts()[0].pages().filter(p=>/#\/(dashboard|companion)$/.test(p.url()))).toHaveLength(2);
    await successor.dashboard.getByTestId('open-companion').click();await expect(successor.overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    expect((await successor.dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).hydration.currentWater).toBe(900);
  }finally{
    if(process.platform==='win32')try{execFileSync('reg.exe',['delete','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','/v',`Mizu-Test-${profile}`,'/f'],{stdio:'ignore',windowsHide:true});}catch{/* Only the unique test registration is eligible. */}
    if(app)await app.close();
    if(successor){await successor.dashboard.evaluate(()=>window.desktopCompanion.quit()).catch(()=>{});await successor.browser.close().catch(()=>{});}
  }
});
