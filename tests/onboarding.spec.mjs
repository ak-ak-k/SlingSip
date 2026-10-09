import { test, expect, _electron as nativeElectron } from '@playwright/test';
import { mkdir, readFile, writeFile, rename, rmdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateDisplayName, restoreUserProfile, profileInitials, greetingForHour } from '../shared/user-profile.ts';
import { positionTour } from '../src/app/features/onboarding/tour-position.ts';
import { DEFAULT_HYDRATION_SETTINGS } from '../shared/hydration-settings.ts';
import { localDateKey } from '../shared/hydration-schedule.ts';
import { historyEntry, previousDay } from '../shared/hydration-history.ts';

const captureDirectory = path.resolve('docs/previews/onboarding');
const profileDirectory = profile => path.join(tmpdir(), 'mizu-overlay-tests', profile);
const freshProfile = () => 'onboarding-' + randomUUID();
const snapshot = page => page.evaluate(() => window.desktopCompanion.getSnapshot());
const stableData = state => ({
  hydration: state.hydrationState, history: state.history, streaks: state.streaks,
  preferences: state.companionPreferences, startup: state.startup,
});

async function launch(profile, extra = []) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await nativeElectron.launch({ args:['.','--companion-test','--companion-test-profile=' + profile,...extra],env,chromiumSandbox:true });
  try {
    await expect.poll(() => app.windows().filter(page => page.url().endsWith('#/companion')).length,{timeout:60000}).toBe(1);
    if (!extra.includes('--autostart')) await expect.poll(() => app.windows().filter(page => page.url().endsWith('#/dashboard')).length,{timeout:60000}).toBe(1);
    return { app, dashboard:app.windows().find(page => page.url().endsWith('#/dashboard')), overlay:app.windows().find(page => page.url().endsWith('#/companion')) };
  } catch (error) { await app.close(); throw error; }
}
async function capture(page, name) {
  await mkdir(captureDirectory,{recursive:true});
  await page.screenshot({path:path.join(captureDirectory,name + '.png'),animations:'disabled'});
}
async function art(page, file) {
  const bytes = await readFile(path.join('public/assets/onboarding/slingsip',file));
  const image = page.getByTestId('onboarding-art');
  await expect(image).toHaveAttribute('src','assets/onboarding/slingsip/' + file);
  await expect.poll(() => image.evaluate(image => image.complete && image.naturalWidth)).toBe(bytes.readUInt32BE(16));
}
async function stage(page, value) { await expect(page.getByTestId('onboarding')).toHaveAttribute('data-stage',value); }
async function tourDismissed(page) {
  await expect(page.getByTestId('dashboard-tour')).toHaveCount(0);
  await expect(page.locator('app-dashboard-tour, .tour-layer, .spotlight, .shade')).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector(':modal') === null)).toBe(true);
}
async function memberSince(page) {
  await page.getByTestId('profile-chip').click();
  const value = await page.locator('.profile-popover dl div').filter({has:page.getByText('Member since',{exact:true})}).locator('dd').innerText();
  await page.keyboard.press('Escape');
  return value;
}
async function currentArtwork(page) {
  const urls = await page.locator('img, svg image').evaluateAll(images => images.map(image=>image.getAttribute('src') || image.getAttribute('href') || ''));
  expect(urls.some(url => /companion-guardian|temporary-body|mizu|guardian\.svg/i.test(url))).toBe(false);
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
}
async function reachTour(page, name = 'Aditya Kirtane') {
  await stage(page,'welcome'); await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-name').fill(name); await page.keyboard.press('Enter');
  await stage(page,'routine'); await page.getByTestId('onboarding-next').click();
  await stage(page,'intro'); await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('dashboard-tour')).toBeVisible();
}
async function resize(app, dashboard, width, height, zoom = 1) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('#/dashboard'));
    win.webContents.setZoomFactor(size[2]); win.setContentSize(size[0],size[1]);
  },[width,height,zoom]);
  await expect.poll(() => dashboard.evaluate(() => innerWidth)).toBe(Math.round(width/zoom));
}
async function bounded(page, selector) {
  // Native zoom/resize and the event-driven DOM measurement settle on a frame.
  await expect.poll(() => page.locator(selector).evaluate(element => {
    const r=element.getBoundingClientRect();
    return r.width>0 && r.left>=-1 && r.top>=-1 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1 && element.scrollWidth-element.clientWidth<=1;
  })).toBe(true);
  const result = await page.locator(selector).evaluate(element => {
    const r = element.getBoundingClientRect();
    return { left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:element.scrollWidth-element.clientWidth };
  });
  expect(result.left).toBeGreaterThanOrEqual(-1); expect(result.top).toBeGreaterThanOrEqual(-1);
  expect(result.right).toBeLessThanOrEqual(result.width+1); expect(result.bottom).toBeLessThanOrEqual(result.height+1);
  expect(result.overflow).toBeLessThanOrEqual(1);
}

test('Local names normalize international text, reject invalid input and generate deterministic initials/greetings', () => {
  expect(validateDisplayName('  Aditya   Kirtane  ')).toBe('Aditya Kirtane');
  expect(validateDisplayName('  Zo\u0065\u0308 O\u2019Neil  ')).toBe('Zo\u00eb O\u2019Neil');
  expect(validateDisplayName('\u0906\u0926\u093f\u0924\u094d\u092f')).toBe('\u0906\u0926\u093f\u0924\u094d\u092f');
  for (const input of ['', '   ', '---', '<script>name</script>', 'A\u202eB', 'A'.repeat(49), 4, null, {}]) expect(() => validateDisplayName(input)).toThrow();
  expect(profileInitials('Aditya Kirtane')).toBe('AK'); expect(profileInitials('Zoe')).toBe('Z'); expect(profileInitials('')).toBe('SS');
  expect([0,4,5,11,12,16,17,23].map(greetingForHour)).toEqual(['Good evening','Good evening','Good morning','Good morning','Good afternoon','Good afternoon','Good evening','Good evening']);
  expect(restoreUserProfile(undefined)).toBeNull();
  const profile = {displayName:'  Aditya  ',createdAt:'2026-10-08T00:00:00.000Z',hasCompletedOnboarding:false};
  expect(restoreUserProfile(profile)).toEqual({...profile,displayName:'Aditya'});
  for (const input of [{...profile,createdAt:'invalid'},{...profile,hasCompletedOnboarding:'yes'},[]]) expect(() => restoreUserProfile(input)).toThrow();
});

test('Tour geometry stays inside compact and scaled viewports including missing and edge targets', () => {
  for (const [width,height] of [[760,560],[1366,768],[1920,1080],[2560,1440],[507,373]]) {
    for (const target of [null,{x:8,y:8,width:150,height:140},{x:width-178,y:height-90,width:170,height:82},{x:8,y:8,width:width-16,height:height-16}]) {
      const position = positionTour(width,height,340,260,target);
      expect(position.x).toBeGreaterThanOrEqual(12); expect(position.y).toBeGreaterThanOrEqual(12);
      expect(position.x+340).toBeLessThanOrEqual(width-12); expect(position.y+260).toBeLessThanOrEqual(height-12);
    }
  }
});

test('Fresh onboarding reuses settings, persists only final completion, and safely supports edit, replay, reset and relaunch', async () => {
  const profile = freshProfile(), directory = profileDirectory(profile), today = localDateKey(new Date());
  const settings = {...DEFAULT_HYDRATION_SETTINGS,retryIntervalMinutes:7,workingStart:'00:00',workingEnd:'00:01'};
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'hydration.json'),JSON.stringify({schemaVersion:2,date:today,currentWaterMl:750,settings,history:[historyEntry(previousDay(today),2000,2000)]}));
  let session = await launch(profile), errors = [], assetErrors = [], oldArtworkRequests = [];
  const watch = page => {
    page.on('pageerror',error => errors.push(error.message));
    page.on('response',response => { if (response.status() >= 400 && /onboarding\/slingsip\//.test(response.url())) assetErrors.push(response.url()); });
    page.on('requestfailed',request => { if (/onboarding\/slingsip\//.test(request.url())) assetErrors.push(request.url()); });
    page.on('request',request => { if (/companion-guardian|temporary-body|guardian\.svg/i.test(request.url())) oldArtworkRequests.push(request.url()); });
  };
  try {
    let {app,dashboard} = session; watch(dashboard); watch(session.overlay);
    const baseline = await snapshot(dashboard);
    await stage(dashboard,'welcome'); await art(dashboard,'welcome-hero.png'); await capture(dashboard,'01-welcome');
    await expect(dashboard.getByRole('list',{name:'Setup progress'}).locator('li')).toContainText(['Welcome','Your name','Your routine','Meet SlingSip']);
    expect(baseline.userProfile).toBeNull(); expect(baseline.hydration.currentWater).toBe(750);
    await expect(dashboard.locator('[data-testid="dashboard"]')).toHaveAttribute('inert','');
    await dashboard.keyboard.press('Enter'); await stage(dashboard,'profile');
    await art(dashboard,'profile-idle.png'); await expect(dashboard.getByTestId('onboarding-name')).toBeFocused();
    await dashboard.getByTestId('onboarding-name').fill('   '); await dashboard.keyboard.press('Enter');
    await stage(dashboard,'profile'); await expect(dashboard.locator('#name-hint')).toHaveAttribute('role','alert');
    await dashboard.getByTestId('onboarding-name').fill('  Aditya   Kirtane  ');
    await expect(dashboard.locator('.profile-preview strong')).toHaveText('Aditya Kirtane');
    await expect(dashboard.locator('.profile-preview .avatar')).toHaveText('AK'); await capture(dashboard,'02-profile');
    await dashboard.keyboard.press('Enter'); await stage(dashboard,'routine'); await art(dashboard,'routine-upside-down.png');
    let current = await snapshot(dashboard);
    expect(current.userProfile).toMatchObject({displayName:'Aditya Kirtane',hasCompletedOnboarding:false});
    expect(stableData(current)).toEqual(stableData(baseline));
    await expect(dashboard.getByTestId('onboarding-goal')).toHaveValue('2000');
    await expect(dashboard.getByTestId('onboarding-glass')).toHaveValue('250');
    await dashboard.getByTestId('onboarding-goal').fill('100'); await expect(dashboard.getByTestId('onboarding-next')).toBeDisabled();
    await dashboard.getByTestId('onboarding-goal').fill('2400'); await dashboard.getByTestId('onboarding-glass').fill('300');
    await capture(dashboard,'03-routine'); await dashboard.getByTestId('onboarding-next').click(); await stage(dashboard,'intro');
    const configured = await snapshot(dashboard);
    expect(configured.hydrationState.settings).toEqual({...settings,dailyGoalMl:2400,glassSizeMl:300});
    expect(configured.hydration.currentWater).toBe(750);
    expect(configured.hydrationState.history).toEqual(baseline.hydrationState.history);
    expect(configured.history.filter(day=>day.date!==today)).toEqual(baseline.history.filter(day=>day.date!==today));
    expect(configured.streaks).toEqual(baseline.streaks);
    await art(dashboard,'profile-idle.png'); await capture(dashboard,'04-meet'); await dashboard.getByTestId('onboarding-next').click();
    await expect(dashboard.getByTestId('dashboard-tour')).toBeVisible();
    expect(await dashboard.locator('.tour-card').evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    const tourBytes = await readFile('public/assets/onboarding/slingsip/tour-dashboard.png');
    await expect.poll(() => dashboard.locator('.tour-card img').evaluate(image => image.complete && image.naturalWidth)).toBe(tourBytes.readUInt32BE(16));
    const titles = ["Today's Progress",'Next Water Break','History','Settings','Your Profile','Quietly in Your Tray'];
    for (let index=0;index<titles.length;index++) {
      await expect(dashboard.locator('#tour-heading')).toHaveText(titles[index]);
      await bounded(dashboard,'.tour-card');
      if (index===0) {
        await expect(dashboard.getByTestId('tour-spotlight')).toBeVisible(); await capture(dashboard,'05-tour-progress');
        for (let tab=0;tab<6;tab++) {
          await dashboard.keyboard.press('Tab');
          expect(await dashboard.evaluate(() => document.querySelector('[data-testid="dashboard-tour"]').contains(document.activeElement))).toBe(true);
        }
      }
      if (index===1) {
        await dashboard.getByRole('button',{name:'Back',exact:true}).click(); await expect(dashboard.locator('#tour-heading')).toHaveText(titles[0]);
        await dashboard.getByTestId('tour-next').click(); await expect(dashboard.locator('#tour-heading')).toHaveText(titles[1]);
      }
      if (index===4) await capture(dashboard,'06-tour-profile');
      if (index===5) { await expect(dashboard.getByTestId('tour-spotlight')).toHaveCount(0); await capture(dashboard,'07-tour-tray'); }
      await dashboard.getByTestId('tour-next').click();
    }
    await stage(dashboard,'ready'); await art(dashboard,'success-ready.png'); await capture(dashboard,'08-ready');
    await tourDismissed(dashboard); await expect(dashboard.locator('.quote')).toHaveText('Keep moving. Keep sipping.');
    expect((await snapshot(dashboard)).userProfile.hasCompletedOnboarding).toBe(false);
    const persisted = JSON.parse(await readFile(path.join(directory,'user-profile.json'),'utf8'));
    expect(persisted.profile.hasCompletedOnboarding).toBe(false);
    await dashboard.getByTestId('onboarding-next').click(); await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    const completed = await snapshot(dashboard); expect(completed.userProfile.hasCompletedOnboarding).toBe(true);
    const membership = await memberSince(dashboard);
    const completedFile = JSON.parse(await readFile(path.join(directory,'user-profile.json'),'utf8'));
    expect(completedFile).toEqual({schemaVersion:1,profile:completed.userProfile});
    await app.close(); session = await launch(profile); ({app,dashboard}=session); watch(dashboard); watch(session.overlay);
    await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    await expect(dashboard.getByTestId('profile-chip')).toContainText('Aditya Kirtane');
    await expect(dashboard.getByTestId('profile-greeting')).toHaveText(/Good (morning|afternoon|evening), Aditya Kirtane\./);
    const restored = await snapshot(dashboard);
    expect(restored.userProfile).toEqual(completed.userProfile); expect(stableData(restored)).toEqual(stableData(completed));
    expect(await memberSince(dashboard)).toBe(membership);
    await currentArtwork(dashboard); await currentArtwork(session.overlay);
    await capture(dashboard,'09-personalized-dashboard');
    await dashboard.getByTestId('profile-chip').click(); await expect(dashboard.getByTestId('profile-popover')).toBeVisible();
    await expect(dashboard.getByTestId('profile-popover')).toContainText('2400 ml'); await capture(dashboard,'10-profile-menu');
    await dashboard.getByTestId('edit-profile').click(); await expect(dashboard.getByTestId('edit-display-name')).toBeFocused();
    await dashboard.getByTestId('edit-display-name').fill('  Aditi   Rao  '); await dashboard.keyboard.press('Enter');
    await expect(dashboard.getByTestId('profile-chip')).toContainText('Aditi Rao'); await expect(dashboard.locator('.profile-chip .avatar')).toHaveText('AR');
    await expect(dashboard.getByTestId('profile-greeting')).toContainText('Aditi Rao.');
    const edited = await snapshot(dashboard);
    expect(edited.userProfile.createdAt).toBe(completed.userProfile.createdAt); expect(stableData(edited)).toEqual(stableData(completed));
    const hydrationFile = await readFile(path.join(directory,'hydration.json'),'utf8');
    await dashboard.keyboard.press('Escape');
    await dashboard.getByRole('link',{name:'History',exact:true}).click();
    await expect(dashboard.getByTestId('history-page')).toBeVisible();
    await dashboard.getByTestId('profile-chip').click();
    await dashboard.getByTestId('replay-tour').click(); await expect(dashboard.getByTestId('dashboard-tour')).toBeVisible();
    expect(dashboard.url()).toMatch(/#\/dashboard$/);
    await dashboard.keyboard.press('Escape');
    await tourDismissed(dashboard); await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    expect((await snapshot(dashboard)).userProfile).toEqual(edited.userProfile);
    expect(stableData(await snapshot(dashboard))).toEqual(stableData(edited));
    // Repeated replay covers Skip and Finish, in addition to Escape above.
    for (const dismissal of ['skip','finish']) {
      await dashboard.getByTestId('profile-chip').click(); await dashboard.getByTestId('replay-tour').click();
      await expect(dashboard.getByTestId('dashboard-tour')).toBeVisible();
      await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
      if (dismissal==='skip') await dashboard.getByTestId('tour-skip').click();
      else for (let step=0;step<6;step++) { await expect(dashboard.getByTestId('tour-next')).toBeFocused(); await dashboard.keyboard.press('Enter'); }
      await tourDismissed(dashboard);
      await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
      expect(await dashboard.getByTestId('dashboard').evaluate(element => element.inert)).toBe(false);
      expect((await snapshot(dashboard)).userProfile).toEqual(edited.userProfile);
      expect(stableData(await snapshot(dashboard))).toEqual(stableData(edited));
      expect(await readFile(path.join(directory,'hydration.json'),'utf8')).toBe(hydrationFile);
    }
    await dashboard.getByTestId('profile-chip').click(); await dashboard.getByTestId('reset-onboarding').click();
    await expect(dashboard.getByTestId('cancel-profile-reset')).toBeFocused(); await dashboard.getByTestId('cancel-profile-reset').click();
    expect((await snapshot(dashboard)).userProfile.hasCompletedOnboarding).toBe(true);
    await dashboard.getByTestId('reset-onboarding').click(); await dashboard.getByTestId('confirm-profile-reset').click();
    await expect(dashboard.getByTestId('profile-popover')).toContainText('next launch');
    const reset = await snapshot(dashboard); expect(reset.userProfile).toEqual({...edited.userProfile,hasCompletedOnboarding:false});
    expect(stableData(reset)).toEqual(stableData(edited)); await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    expect(await readFile(path.join(directory,'hydration.json'),'utf8')).toBe(hydrationFile);
    expect((await readdir(directory)).filter(file=>/profile|onboarding/i.test(file))).toEqual(['user-profile.json']);
    expect(await dashboard.evaluate(() => Object.keys(localStorage).filter(key=>/profile|onboarding/i.test(key)))).toEqual([]);
    await app.close(); session = await launch(profile); dashboard = session.dashboard; watch(dashboard);
    await stage(dashboard,'welcome'); await dashboard.getByTestId('onboarding-next').click();
    await expect(dashboard.getByTestId('onboarding-name')).toHaveValue('Aditi Rao');
    await dashboard.keyboard.press('Enter'); await stage(dashboard,'routine');
    await expect(dashboard.getByTestId('onboarding-goal')).toHaveValue('2400'); await expect(dashboard.getByTestId('onboarding-glass')).toHaveValue('300');
    expect(stableData(await snapshot(dashboard))).toEqual(stableData(edited)); expect(errors).toEqual([]);
    expect(assetErrors).toEqual([]); expect(oldArtworkRequests).toEqual([]);
  } finally { await session.app.close(); }
});

test('Fresh onboarding deferral and Escape never create a profile or completion and return on dashboard reopen', async () => {
  const profile = freshProfile(), directory = profileDirectory(profile);
  const {app,overlay,dashboard} = await launch(profile);
  try {
    await stage(dashboard,'welcome'); const before = await snapshot(dashboard);
    await dashboard.getByRole('button',{name:/Set up later/}).click();
    await expect(dashboard.getByTestId('onboarding')).toHaveCount(0); await tourDismissed(dashboard);
    expect((await snapshot(dashboard)).userProfile).toBeNull();
    expect(stableData(await snapshot(dashboard))).toEqual(stableData(before));
    expect((await readdir(directory)).filter(file=>/profile|onboarding/i.test(file))).toEqual([]);
    await dashboard.getByTestId('profile-chip').click(); await dashboard.getByRole('button',{name:/Continue setup/}).click();
    await stage(dashboard,'welcome'); await dashboard.keyboard.press('Escape');
    await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    expect((await snapshot(dashboard)).userProfile).toBeNull();
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().find(win=>win.webContents.getURL().includes('#/dashboard')).close());
    await expect.poll(()=>app.windows().filter(page=>page.url().endsWith('#/dashboard')).length).toBe(0);
    await overlay.evaluate(()=>window.desktopCompanion.openDashboard());
    await expect.poll(()=>app.windows().filter(page=>page.url().endsWith('#/dashboard')).length).toBe(1);
    const reopened = app.windows().find(page=>page.url().endsWith('#/dashboard'));
    await stage(reopened,'welcome');
    expect((await snapshot(reopened)).userProfile).toBeNull();
    expect(stableData(await snapshot(reopened))).toEqual(stableData(before));
    expect((await readdir(directory)).filter(file=>/profile|onboarding/i.test(file))).toEqual([]);
  } finally { await app.close(); }
});

test('Incomplete setup can be deferred, skip leads to final CTA, and a failed disk write never marks completion', async () => {
  const profile = freshProfile(), directory = profileDirectory(profile);
  let session = await launch(profile), blocked = false;
  const file = path.join(directory,'user-profile.json'), backup = path.join(directory,'profile-save-test.json');
  try {
    let {dashboard} = session; await reachTour(dashboard,'Zoe');
    await dashboard.getByTestId('tour-skip').click(); await stage(dashboard,'ready');
    await tourDismissed(dashboard);
    expect((await snapshot(dashboard)).userProfile.hasCompletedOnboarding).toBe(false);
    await session.app.close(); session = await launch(profile); dashboard = session.dashboard;
    await stage(dashboard,'welcome'); await dashboard.getByRole('button',{name:/Set up later/}).click();
    await expect(dashboard.getByTestId('onboarding')).toHaveCount(0); await expect(dashboard.getByTestId('profile-chip')).toContainText('Zoe');
    expect((await snapshot(dashboard)).userProfile.hasCompletedOnboarding).toBe(false);
    await dashboard.getByTestId('profile-chip').click(); await dashboard.getByRole('button',{name:/Continue setup/}).click();
    await reachTour(dashboard,'Zoe'); await dashboard.keyboard.press('Escape'); await stage(dashboard,'ready');
    await tourDismissed(dashboard);
    const before = await snapshot(dashboard);
    // A real isolated storage-path failure, rather than replacing the production IPC handler.
    await rename(file,backup); await mkdir(file); blocked = true;
    await dashboard.getByTestId('onboarding-next').click(); await stage(dashboard,'ready');
    await expect(dashboard.locator('.save-error')).toContainText('could not be saved locally');
    expect((await snapshot(dashboard)).userProfile.hasCompletedOnboarding).toBe(false);
    expect(stableData(await snapshot(dashboard))).toEqual(stableData(before));
    await rmdir(file); await rename(backup,file); blocked = false;
    await dashboard.getByTestId('onboarding-next').click(); await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    expect((await snapshot(dashboard)).userProfile.hasCompletedOnboarding).toBe(true);
  } finally {
    if (blocked) { await rmdir(file); await rename(backup,file); }
    await session.app.close();
  }
});

test('Onboarding, tour and profile fit desktop sizes/scaling, honor reduced motion, and clean up when dismissed', async () => {
  const {app,dashboard} = await launch(freshProfile()), errors = [];
  dashboard.on('pageerror',error => errors.push(error.message));
  try {
    await stage(dashboard,'welcome');
    for (const [width,height,zoom] of [[1366,768,1],[1920,1080,1],[2560,1440,1],[760,560,1],[1366,768,1.25],[1366,768,1.5],[760,560,1.5]]) {
      await resize(app,dashboard,width,height,zoom);
      expect(await dashboard.getByTestId('onboarding').evaluate(el => el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
      await dashboard.getByTestId('onboarding-next').scrollIntoViewIfNeeded(); await bounded(dashboard,'[data-testid="onboarding-next"]');
      if (width===760 && zoom===1) await capture(dashboard,'11-welcome-minimum');
      if (zoom===1.5 && width===1366) await capture(dashboard,'12-welcome-scaled');
    }
    await resize(app,dashboard,1366,768);
    await dashboard.emulateMedia({reducedMotion:'reduce'});
    expect(await dashboard.locator('.setup-mascot').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await dashboard.getByTestId('onboarding-art').dispatchEvent('error');
    await expect(dashboard.locator('.asset-fallback')).toBeVisible();
    await reachTour(dashboard);
    expect(await dashboard.locator('.tour-card').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    for (const [width,height,zoom] of [[1366,768,1],[1920,1080,1],[2560,1440,1],[760,560,1],[1366,768,1.5],[760,560,1.5]]) {
      await resize(app,dashboard,width,height,zoom); await bounded(dashboard,'.tour-card');
      if (width===760 && zoom===1) await capture(dashboard,'13-tour-minimum');
    }
    await dashboard.locator('.next-break').evaluate(element => element.remove());
    await dashboard.getByTestId('tour-next').click(); await expect(dashboard.locator('#tour-heading')).toHaveText('Next Water Break');
    await expect(dashboard.getByTestId('tour-spotlight')).toHaveCount(0); await bounded(dashboard,'.tour-card');
    await dashboard.getByTestId('tour-skip').click(); await stage(dashboard,'ready');
    await tourDismissed(dashboard);
    await dashboard.getByTestId('onboarding-next').click(); await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    const longName = 'W'.repeat(48);
    await dashboard.evaluate(name=>window.desktopCompanion.updateDisplayName(name),longName);
    await expect(dashboard.getByTestId('profile-chip')).toHaveAttribute('aria-label','Open profile for '+longName);
    for (const [width,height,zoom] of [[760,560,1],[760,560,1.5],[1366,768,1.5],[1920,1080,1],[2560,1440,1]]) {
      await resize(app,dashboard,width,height,zoom); await dashboard.getByTestId('profile-chip').click();
      await bounded(dashboard,'[data-testid="profile-popover"]');
      expect(await dashboard.locator('.main-content').evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);
      await dashboard.keyboard.press('Escape'); await expect(dashboard.getByTestId('profile-popover')).not.toBeVisible();
      await expect(dashboard.getByTestId('profile-chip')).toBeFocused();
    }
    await dashboard.getByTestId('profile-chip').click();
    await dashboard.getByTestId('drink-water').focus(); await dashboard.keyboard.press('Escape');
    await expect(dashboard.getByTestId('profile-popover')).not.toBeVisible();
    await dashboard.evaluate(() => {
      window.__afterTourRaf=0; const raf=window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame=callback => { window.__afterTourRaf++; return raf(callback); };
    });
    await dashboard.waitForTimeout(400); expect(await dashboard.evaluate(() => window.__afterTourRaf)).toBe(0);
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test('Profile IPC rejects companion writes and malformed input; corrupt profile never erases hydration', async () => {
  const profile = freshProfile(), directory = profileDirectory(profile), today = localDateKey(new Date());
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'user-profile.json'),JSON.stringify({schemaVersion:1,profile:{displayName:'Old user',createdAt:'bad',hasCompletedOnboarding:true}}));
  await writeFile(path.join(directory,'hydration.json'),JSON.stringify({schemaVersion:2,date:today,currentWaterMl:500,settings:DEFAULT_HYDRATION_SETTINGS,history:[historyEntry(previousDay(today),2000,1750)]}));
  const {app,dashboard,overlay} = await launch(profile);
  try {
    await stage(dashboard,'welcome'); const before = await snapshot(dashboard);
    expect(before.userProfile).toBeNull(); expect(before.userProfileError).toContain('could not be read');
    expect(before.hydration.currentWater).toBe(500);
    const rejected = await overlay.evaluate(async () => {
      const results=[];
      for (const action of [() => window.desktopCompanion.updateDisplayName('Fake'),() => window.desktopCompanion.completeOnboarding(),() => window.desktopCompanion.resetOnboarding()]) {
        try { await action(); results.push('allowed'); } catch (error) { results.push(error.message); }
      }
      return results;
    });
    for (const error of rejected) expect(error).toContain('not available to the requesting frame');
    for (const invalid of ['   ','<script>Name</script>',null,12,{}]) {
      const error = await dashboard.evaluate(async input => { try { await window.desktopCompanion.updateDisplayName(input); return ''; } catch(error) { return error.message; } },invalid);
      expect(error).not.toBe('');
    }
    await dashboard.evaluate(() => window.desktopCompanion.updateDisplayName('Recovered User'));
    const recovered = await snapshot(dashboard);
    expect(recovered.userProfile).toMatchObject({displayName:'Recovered User',hasCompletedOnboarding:false});
    expect(recovered.userProfileError).toBeNull(); expect(stableData(recovered)).toEqual(stableData(before));
    expect(await dashboard.evaluate(() => ({require:typeof window.require,ipc:typeof window.ipcRenderer}))).toEqual({require:'undefined',ipc:'undefined'});
  } finally { await app.close(); }
});

test('Autostart opens onboarding when incomplete and preserves quiet tray startup when complete', async () => {
  const profile = freshProfile(); let session = await launch(profile,['--autostart']);
  try {
    await expect.poll(() => session.app.windows().filter(page => page.url().endsWith('#/dashboard')).length,{timeout:60000}).toBe(1);
    const dashboard = session.app.windows().find(page => page.url().endsWith('#/dashboard'));
    await stage(dashboard,'welcome');
    await reachTour(dashboard,'Local User'); await dashboard.getByTestId('tour-skip').click();
    await dashboard.getByTestId('onboarding-next').click(); await expect(dashboard.getByTestId('onboarding')).toHaveCount(0);
    await session.app.close(); session = await launch(profile,['--autostart']);
    await session.overlay.waitForTimeout(500);
    expect(session.app.windows().filter(page => page.url().endsWith('#/dashboard'))).toHaveLength(0);
    const state = await snapshot(session.overlay); expect(state.userProfile.hasCompletedOnboarding).toBe(true); expect(state.tray.available).toBe(true);
    await session.overlay.evaluate(() => window.desktopCompanion.openDashboard());
    await expect.poll(() => session.app.windows().filter(page => page.url().endsWith('#/dashboard')).length).toBe(1);
    await expect(session.app.windows().find(page => page.url().endsWith('#/dashboard')).getByTestId('profile-chip')).toContainText('Local User');
  } finally { await session.app.close(); }
});
