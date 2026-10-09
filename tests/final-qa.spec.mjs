import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';
import { historyEntry, previousDay } from '../shared/hydration-history.ts';

test('Production completion is independent of dev counters; double Drank records one glass, background survives and goal completion suppresses reminders', async () => {
  const profile='final-qa-'+randomUUID(),directory=path.join(tmpdir(),'mizu-overlay-tests',profile);
  const settings={...DEFAULT_HYDRATION_SETTINGS};
  const yesterday=historyEntry(previousDay(localDateKey(new Date())),4000,4000);
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'hydration.json'),JSON.stringify({schemaVersion:2,date:localDateKey(new Date()),currentWaterMl:750,settings,history:[yesterday]}));
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const args=['.','--companion-test',`--companion-test-profile=${profile}`,'--companion-test-production'];
  let app=await electron.launch({args,env,chromiumSandbox:true});
  const errors=[];app.on('window',page=>page.on('pageerror',error=>errors.push(error.message)));
  try {
    await expect.poll(()=>app.windows().filter(page=>/#\/(dashboard|companion)$/.test(page.url())).length,{timeout:60000}).toBe(2);
    let dashboard=app.windows().find(page=>page.url().endsWith('#/dashboard'));
    const overlay=app.windows().find(page=>page.url().endsWith('#/companion'));
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('750 / 2000 ml');
    await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    const originalProfile=(await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).userProfile;
    expect(originalProfile.hasCompletedOnboarding).toBe(true);
    await expect(dashboard.getByTestId('toggle-overlay')).toHaveCount(0);
    await expect(dashboard.getByTestId('animation-lab-open')).toHaveCount(0);
    await expect(dashboard.getByTestId('delayed-reminder')).toHaveCount(0);
    const security=await dashboard.evaluate(()=>({csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,raw:['require','process','ipcRenderer','fs'].filter(name=>window[name]!==undefined)}));
    expect(security.csp).toContain("connect-src 'self';");expect(security.csp).not.toMatch(/localhost|127\.0\.0\.1|ws:/);expect(security.raw).toEqual([]);
    const debug=await dashboard.evaluate(async()=>{try{await window.desktopCompanion.resetTestClicks();return 'allowed';}catch(error){return error.message;}});
    expect(debug).toContain('disabled in production');
    await dashboard.getByTestId('open-companion').click();
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    const counter=await overlay.evaluate(async()=>{try{await window.desktopCompanion.recordTestClick();return 'allowed';}catch(error){return error.message;}});
    expect(counter).toContain('disabled in production');
    // Both DOM submissions occur before Angular can render the new disabled state.
    await overlay.getByTestId('drank-it').evaluate(button=>{button.click();button.click();});
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('1000 / 2000 ml');
    await expect(overlay.getByTestId('companion-bottle')).toBeVisible();
    await expect.poll(async()=>(await overlay.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    expect((await overlay.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.testClicks).toBe(0);
    expect(JSON.parse(await readFile(path.join(directory,'hydration.json'),'utf8')).currentWaterMl).toBe(1000);
    // Native X close destroys the view, while canonical state/tray/scheduler remain.
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().includes('#/dashboard')).close());
    await expect.poll(()=>app.windows().length).toBe(1);
    await app.evaluate(()=>globalThis.__slingSipTestTray.menu.getMenuItemById('open').click());
    await expect.poll(()=>app.windows().length,{timeout:60000}).toBe(2);
    dashboard=app.windows().find(page=>page.url().endsWith('#/dashboard'));
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('1000 / 2000 ml');
    for(let n=0;n<4;n++)await dashboard.getByTestId('drink-water').click();
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('2000 / 2000 ml');
    const complete=await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot());
    expect(complete.hydration.currentWater).toBe(2000);expect(complete.scheduler.nextReminderAt).toBeNull();
    expect(complete.hydrationState.history.find(day=>day.date===yesterday.date)).toEqual(yesterday);
    expect(complete.userProfile).toEqual(originalProfile);
    await expect(dashboard.getByTestId('progress-percent')).toHaveText('100%');
    expect(complete.scheduler.reminderActive).toBe(false);expect(complete.tray.available).toBe(true);
    await dashboard.evaluate(()=>window.desktopCompanion.openCompanion());
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    expect(errors).toEqual([]);
    await app.close();app=await electron.launch({args,env,chromiumSandbox:true});
    await expect.poll(()=>app.windows().length,{timeout:60000}).toBe(2);
    dashboard=app.windows().find(page=>page.url().endsWith('#/dashboard'));
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('2000 / 2000 ml');
    const restored=await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot());
    expect(restored.scheduler.nextReminderAt).toBeNull();expect(restored.streaks.currentStreak).toBe(2);
    expect(restored.hydrationState.history.find(day=>day.date===yesterday.date)).toEqual(yesterday);
    expect(restored.userProfile).toEqual(originalProfile);
    await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    expect(await app.evaluate(()=>globalThis.__slingSipTestTray.menu.getMenuItemById('next').label)).toBe('Daily goal complete');
    await dashboard.evaluate(()=>window.desktopCompanion.openCompanion());
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
  } finally { await app.close(); }
});

test('Failure of optional development completion telemetry cannot keep a successful reminder visible',async()=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app=await electron.launch({args:['.','--companion-test'],env,chromiumSandbox:true});
  try{
    await expect.poll(()=>app.windows().length,{timeout:60000}).toBe(2);
    const dashboard=app.windows().find(page=>page.url().endsWith('#/dashboard')),overlay=app.windows().find(page=>page.url().endsWith('#/companion'));
    await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('desktop:test-click');ipcMain.handle('desktop:test-click',()=>{throw new Error('QA telemetry unavailable');});});
    await dashboard.getByTestId('toggle-overlay').click();await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    await overlay.getByTestId('drank-it').click();
    await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await expect.poll(async()=>(await overlay.evaluate(()=>window.desktopCompanion.getSnapshot())).overlay.visible).toBe(false);
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getSnapshot())).hydration.currentWater).toBe(250);
  }finally{await app.close();}
});
