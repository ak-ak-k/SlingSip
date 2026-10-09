import { electron } from './helpers/existing-user-electron.mjs';
import {expectBottleVisible} from './helpers/companion-visuals.mjs';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ENTRY_VARIANTS, chooseEntryVariant, entrySample, entryDuration } from '../src/app/features/companion/animation/entry-variants.ts';
import { swingLayout, artworkPoint } from '../src/app/features/companion/animation/swing-motion.ts';
import { SWING_CONFIG } from '../src/app/features/companion/animation/swing-config.ts';
import { SwingController } from '../src/app/features/companion/animation/swing-controller.ts';
import { DEFAULT_COMPANION_PREFERENCES, restoreCompanionPreferences, validateCompanionPreferences } from '../shared/companion-preferences.ts';

test('Four authored entry weights are conditional on the last variant and never repeat', () => {
  expect(ENTRY_VARIANTS.map(v => v.weight)).toEqual([.45,.20,.20,.15]);
  const counts = Object.fromEntries(ENTRY_VARIANTS.map(v => [v.id,0]));
  for (let i = 0; i < 10000; i++) counts[chooseEntryVariant((i + .5) / 10000)]++;
  expect(Object.values(counts)).toEqual([4500,2000,2000,1500]);
  for (const previous of ENTRY_VARIANTS) for (let i = 0; i <= 100; i++) expect(chooseEntryVariant(i / 100,previous.id)).not.toBe(previous.id);
});

test('All four paths settle at one local-DIP reminder and keep web grips anatomical at desktop/DPI sizes', () => {
  const distinct = new Set();
  for (const [w,h] of [[1366,720],[1920,1032],[2560,1392]]) for (const scale of [1,1.25,1.5]) {
    const layout = swingLayout(w / scale,h / scale);
    for (const {id} of ENTRY_VARIANTS) {
      const first = entrySample(layout,id,0), last = entrySample(layout,id,1);
      expect(first.x < 0 || first.y < 0).toBe(true);
      expect(last.x).toBe(layout.reminder.x); expect(last.y).toBe(layout.reminder.y);
      expect(last.webEnd).toBeUndefined(); expect(last.releasedWeb).toBeUndefined();
      expect(last.anchor.y).toBeLessThan(0); expect(entryDuration(id)).toBeGreaterThan(1000);
      for (let i = 0; i <= 100; i++) {
        const pose = entrySample(layout,id,i / 100);
        for (const value of [pose.x,pose.y,pose.rotation,pose.anchor.x,pose.anchor.y]) expect(Number.isFinite(value)).toBe(true);
        if (id !== 'upside-down') expect(Math.abs(pose.rotation)).toBeLessThanOrEqual(SWING_CONFIG.rotationMaxDegrees);
        // Fully visible poses keep the feet inside the usable desktop, excluding offscreen entry.
        for (const point of [[50,214],[105,208]]) expect(artworkPoint(layout,pose,...point).y).toBeLessThan(layout.height - 2);
      }
      if (id === 'upside-down') {
        const inverted = entrySample(layout,id,.4); expect(inverted.rotation).toBe(180);
        expect(inverted.webEnd).toEqual(artworkPoint(layout,inverted,54,204));
      }
      if (id === 'high') expect(entrySample(layout,id,.45).webOpacity).toBe(0);
      const sample = entrySample(layout,id,.5); distinct.add([id,sample.x,sample.y,sample.rotation].join(':'));
    }
  }
  expect(distinct.size).toBe(36);
  expect(SWING_CONFIG.settleDurationMs).toBeGreaterThanOrEqual(300); expect(SWING_CONFIG.settleDurationMs).toBeLessThanOrEqual(500);
  expect(SWING_CONFIG.bubbleAppearMs).toBeGreaterThanOrEqual(200); expect(SWING_CONFIG.bubbleAppearMs).toBeLessThanOrEqual(300);
});

test('Finite frame owner pauses without RAF or time jumps, caps rendering and aborts cleanly', async () => {
  let id = 0; const pending = new Map(), frames = [];
  const driver = new SwingController({request:cb => {pending.set(++id,cb);return id;},cancel:i => pending.delete(i)});
  const tick = time => { const callbacks = [...pending.values()];pending.clear();callbacks.forEach(cb => cb(time)); };
  const abort = new AbortController(), run = driver.run(1000,abort.signal,t => frames.push(t),30);
  tick(0);tick(10);tick(20);tick(40); expect(frames.length).toBe(3);
  driver.setActive(false);expect(pending.size).toBe(0); const progress = frames.at(-1);
  driver.setActive(true);tick(9000); expect(frames.at(-1)).toBe(progress);
  tick(9500);expect(frames.at(-1)).toBeCloseTo(.54);tick(10000);await run;
  expect(frames.at(-1)).toBe(1);expect(pending.size).toBe(0);
  const second = new AbortController(), cancelled = driver.run(1000,second.signal,() => {});
  const rejection = expect(cancelled).rejects.toHaveProperty('name','AbortError'); second.abort(); await rejection; expect(pending.size).toBe(0);
  const completed = [], third = driver.run(1000,new AbortController().signal,t => completed.push(t));
  tick(11000); driver.complete(); await third; expect(completed.at(-1)).toBe(1); expect(pending.size).toBe(0);
});

test('Visual/audio preferences validate independently, restore safely and start muted', () => {
  expect(DEFAULT_COMPANION_PREFERENCES.soundEffects).toBe(false);
  expect(validateCompanionPreferences({...DEFAULT_COMPANION_PREFERENCES,soundEffects:true,soundVolume:.3})).toHaveProperty('soundVolume',.3);
  for (const invalid of [{...DEFAULT_COMPANION_PREFERENCES,soundVolume:.31},{...DEFAULT_COMPANION_PREFERENCES,soundVolume:NaN},{...DEFAULT_COMPANION_PREFERENCES,soundEffects:'yes'},{...DEFAULT_COMPANION_PREFERENCES,arbitrary:1},{}]) expect(() => validateCompanionPreferences(invalid)).toThrow();
  expect(restoreCompanionPreferences(null)).toEqual(DEFAULT_COMPANION_PREFERENCES);
  expect(restoreCompanionPreferences({soundVolume:10,cursorAwareness:false})).toEqual({...DEFAULT_COMPANION_PREFERENCES,soundVolume:.3,cursorAwareness:false});
});

async function launch(profile = randomUUID(),production = false) {
  const env = {...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({args:['.','--companion-test',`--companion-test-profile=${profile}`,...(production ? ['--companion-test-production'] : [])],env,chromiumSandbox:true});
  try {
    await expect.poll(() => app.windows().filter(p => /#\/(dashboard|companion)$/.test(p.url())).length,{timeout:60000}).toBe(2);
    const dashboard = app.windows().find(p => p.url().endsWith('#/dashboard')), overlay = app.windows().find(p => p.url().endsWith('#/companion'));
    await expect(dashboard.getByTestId('dashboard')).toBeVisible();return {app,dashboard,overlay};
  } catch (error) { await app.close();throw error; }
}

test('Lab previews every variant, local cursor/reactions and exits without water or scheduler side effects', async ({},testInfo) => {
  const {app,dashboard,overlay} = await launch(); const errors=[];dashboard.on('pageerror',e => errors.push(e.message));
  try {
    await dashboard.evaluate(() => window.desktopCompanion.setRemindersPaused(true));
    const before = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    await dashboard.getByTestId('animation-lab-open').click();
    const character = dashboard.getByTestId('character');
    for (const {id} of ENTRY_VARIANTS) {
      await dashboard.getByTestId('lab-' + id).click();await expect(character).toHaveAttribute('data-state','swinging-in');
      await expect(character).toHaveAttribute('data-variant',id);await expect(character).toHaveAttribute('data-state','reminder');
      await dashboard.screenshot({path:testInfo.outputPath('lab-' + id + '.png')});
    }
    await dashboard.getByTestId('lab-cursor').click();await expect(character).not.toHaveAttribute('data-look','0,0');
    await dashboard.getByTestId('animation-lab-stage').dispatchEvent('mouseleave');await expect(character).toHaveAttribute('data-look','0,0');
    const interaction = character.locator('.character-interaction');
    await interaction.dispatchEvent('click');await expect(character).toHaveAttribute('data-reaction','nod');
    await interaction.dispatchEvent('click');await expect(character).toHaveAttribute('data-reaction','playful');
    await interaction.dispatchEvent('click');await expect(character).toHaveAttribute('data-reaction','annoyed');
    await dashboard.getByTestId('lab-success').click();await expect(character).toHaveAttribute('data-state','delivering-bottle');
    await expectBottleVisible(dashboard);await expect(character).toHaveAttribute('data-state','hidden');
    await dashboard.getByTestId('lab-classic').click();await expect(character).toHaveAttribute('data-state','reminder');
    await dashboard.getByTestId('lab-retry').click();await expect(character).toHaveAttribute('data-state','hidden');
    await dashboard.getByTestId('close-animation-lab').click();await expect(dashboard.getByRole('dialog')).toHaveCount(0);
    const after = await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());
    expect(after.hydrationState).toEqual(before.hydrationState);expect(after.overlay.visibilityRevision).toBe(before.overlay.visibilityRevision);
    expect(after.scheduler.reminderActive).toBe(false);expect(after.reminderRetry.pending).toBe(false);
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','hidden');expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test('Native preferences save/restart, painted hit targets, cursor, sound gating, display suspension and cleanup', async () => {
  const profile = randomUUID();let context = await launch(profile);const errors=[];
  try {
    const {app,dashboard,overlay} = context; overlay.on('pageerror',e => errors.push(e.message));
    await expect(overlay.getByTestId('character')).toHaveAttribute('data-renderer','png-2.5d');
    await dashboard.evaluate(async()=>{const settings=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...settings,workingStart:'00:00',workingEnd:'00:01'});});
    await overlay.evaluate(() => {
      const Original = window.AudioContext; window.__audioCount=0;window.__audioContexts=[];window.__rafCount=0;
      window.AudioContext=class extends Original {constructor(...args) {super(...args);window.__audioCount++;window.__audioContexts.push(this);}};
      const request=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb => {window.__rafCount++;return request(cb);};
    });
    const preferences={...DEFAULT_COMPANION_PREFERENCES,soundEffects:true,soundVolume:0,lowPowerAnimations:false};
    await dashboard.evaluate(p => window.desktopCompanion.updateCompanionPreferences(p),preferences);
    await expect(overlay.evaluate(p => window.desktopCompanion.updateCompanionPreferences(p),preferences)).rejects.toThrow();
    await expect(dashboard.evaluate(p => window.desktopCompanion.updateCompanionPreferences({...p,soundVolume:1}),preferences)).rejects.toThrow();
    await dashboard.getByTestId('toggle-overlay').click();const character=overlay.getByTestId('character');await expect(character).toHaveAttribute('data-state','reminder');
    const variant=await character.getAttribute('data-variant');
    const hit=await overlay.evaluate(() => {
      let body,painted,empty;
      if(document.querySelector('[data-testid="character"]').dataset.renderer==='three-webgl'){
        const canvas=document.querySelector('.companion-3d'),bounds=canvas.getBoundingClientRect();body={x:bounds.left+Number(canvas.dataset.hitX),y:bounds.top+Number(canvas.dataset.hitY)};
        const character=document.querySelector('[data-testid="character"]');document.dispatchEvent(new MouseEvent('click',{clientX:body.x,clientY:body.y,bubbles:true}));painted=character.dataset.reaction==='nod';
        const before=character.dataset.reaction;document.dispatchEvent(new MouseEvent('click',{clientX:innerWidth-20,clientY:innerHeight-20,bubbles:true}));empty=character.dataset.reaction!==before;
      }else{
        const svg=document.querySelector('.mascot'),point=svg.createSVGPoint();point.x=Number(svg.dataset.hitX??77);point.y=Number(svg.dataset.hitY??121);
        const mapped=point.matrixTransform(svg.getScreenCTM());body={x:mapped.x,y:mapped.y};
        painted=!!document.elementFromPoint(body.x,body.y)?.closest('[data-overlay-interactive]');empty=!!document.elementFromPoint(innerWidth-20,innerHeight-20)?.closest('[data-overlay-interactive]');
      }
      document.dispatchEvent(new MouseEvent('mousemove',{clientX:body.x+70,clientY:body.y-50,bubbles:true}));return {painted,empty,body};
    });expect({painted:hit.painted,empty:hit.empty}).toEqual({painted:true,empty:false});
    await expect.poll(()=>overlay.evaluate(body=>{document.dispatchEvent(new MouseEvent('mousemove',{clientX:body.x+70,clientY:body.y-50,bubbles:true}));return document.querySelector('[data-testid="character"]').dataset.look;},hit.body)).not.toBe('0,0');
    await character.locator('.character-interaction').dispatchEvent('click');
    expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).hydration.currentWater).toBe(0);
    expect(await overlay.evaluate(() => window.__audioCount)).toBe(0);
    await overlay.getByRole('button',{name:'Remind me later',exact:true}).evaluate(b => b.click());
    await expect(character).toHaveAttribute('data-state','hidden');await expect(character).toHaveAttribute('data-state','reminder',{timeout:20000});
    expect(await character.getAttribute('data-variant')).not.toBe(variant);
    await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
    await dashboard.evaluate(p => window.desktopCompanion.updateCompanionPreferences(p),{...preferences,soundVolume:.1,soundEffects:true});
    await dashboard.getByTestId('toggle-overlay').click();await expect(character).toHaveAttribute('data-state','swinging-in');
    await expect.poll(() => overlay.evaluate(() => window.__audioCount)).toBe(1);
    await app.evaluate(({powerMonitor}) => powerMonitor.emit('suspend'));
    await expect.poll(() => dashboard.evaluate(async () => (await window.desktopCompanion.getSnapshot()).displayActive)).toBe(false);
    await expect.poll(() => overlay.evaluate(() => window.__audioContexts.every(context => context.state === 'suspended'))).toBe(true);
    await overlay.waitForTimeout(100);const raf=await overlay.evaluate(() => window.__rafCount),x=await character.getAttribute('data-x');
    await overlay.waitForTimeout(400);expect(await overlay.evaluate(() => window.__rafCount)).toBe(raf);expect(await character.getAttribute('data-x')).toBe(x);
    await app.evaluate(({powerMonitor}) => powerMonitor.emit('resume'));await expect(character).toHaveAttribute('data-state','reminder');
    await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));await expect(character).toHaveAttribute('data-state','hidden');
    await expect.poll(() => overlay.evaluate(() => window.__audioContexts.every(context => context.state === 'suspended'))).toBe(true);
    const idle=await overlay.evaluate(() => window.__rafCount);await overlay.waitForTimeout(400);expect(await overlay.evaluate(() => window.__rafCount)).toBe(idle);
    await dashboard.evaluate(p => window.desktopCompanion.updateCompanionPreferences(p),{...preferences,soundEffects:false,lowPowerAnimations:true});
    await dashboard.getByTestId('toggle-overlay').click();await expect(character).toHaveAttribute('data-state','reminder');
    await expect(character).toHaveClass(/is-low-power/);
    await overlay.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove',{clientX:innerWidth * .6,clientY:innerHeight * .6,bubbles:true})));
    await expect(character).toHaveAttribute('data-look','0,0');
    if (await character.getAttribute('data-renderer') !== 'three-webgl') expect(await overlay.locator('.web-shadow').getAttribute('opacity')).toBe('0');
    else expect(await overlay.getByTestId('companion-3d').evaluate(c => c.width / innerWidth)).toBeLessThanOrEqual(.65);
    await dashboard.evaluate(() => window.desktopCompanion.setOverlayVisible(false));
    const persisted=await dashboard.evaluate(() => window.desktopCompanion.getSnapshot());expect(errors).toEqual([]);
    await app.close();context=await launch(profile);
    expect((await context.dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).companionPreferences).toEqual(persisted.companionPreferences);
    await context.dashboard.getByRole('link',{name:'Settings',exact:true}).click();await expect(context.dashboard.getByTestId('sound-effects')).not.toBeChecked();await expect(context.dashboard.getByTestId('low-power')).toBeChecked();
    // The preferences file is separate from the existing hydration schema/file.
    const userData=await context.app.evaluate(({app}) => app.getPath('userData'));
    const stored=JSON.parse(await readFile(userData + '/companion-preferences.json','utf8'));expect(stored.preferences).toEqual(persisted.companionPreferences);
    const waterBefore = await context.dashboard.evaluate(() => window.desktopCompanion.getHydrationState());
    await context.dashboard.getByTestId('low-power').uncheck();await context.dashboard.getByTestId('character-reactions').uncheck();
    await context.dashboard.getByTestId('save-companion-preferences').click();
    await expect(context.dashboard.getByText('Companion preferences saved.',{exact:true})).toBeVisible();
    expect((await context.dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).companionPreferences).toMatchObject({soundEffects:false,lowPowerAnimations:false,characterReactions:false});
    expect(await context.dashboard.evaluate(() => window.desktopCompanion.getHydrationState())).toEqual(waterBefore);
  } finally { await context.app.close(); }
});

test('Production behavior hides the animation lab and rejects development triggers', async () => {
  const {app,dashboard} = await launch(randomUUID(),true);
  try {
    expect((await dashboard.evaluate(() => window.desktopCompanion.getSnapshot())).developmentMode).toBe(false);
    await expect(dashboard.getByTestId('animation-lab-open')).toHaveCount(0);await expect(dashboard.locator('app-animation-lab')).toHaveCount(0);
    await expect(dashboard.evaluate(() => window.desktopCompanion.triggerDevelopmentReminder())).rejects.toThrow();
  } finally { await app.close(); }
});
