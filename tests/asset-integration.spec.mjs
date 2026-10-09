import { electron } from './helpers/existing-user-electron.mjs';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {failBodyArtwork} from './helpers/companion-visuals.mjs';
import {Bone,Mesh,Group,VectorKeyframeTrack} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterAnimationController} from '../src/app/features/companion/three/character-animation-controller.ts';
import {CharacterFacialController} from '../src/app/features/companion/three/character-facial-controller.ts';
import {CharacterModelController,disposeModel} from '../src/app/features/companion/three/character-model-controller.ts';
import {characterAnimationSequence} from '../src/app/features/companion/three/character-animation-sequence.ts';
import {bodyCue} from '../src/app/features/companion/animation/body-choreography.ts';
import {CharacterState as State} from '../src/app/features/companion/animation/character.model.ts';

const assets={temporary:false,normalize:true,character:'',bottle:'',characterHeight:2.2,nodes:{grip:'WebGrip',freeHand:'BottleGrip',boot:'Foot_L',head:'Head',chest:'Chest'},morphs:{blink:'blink',smile:'smile',frown:'frown'}};
const load=async()=>{const bytes=await readFile('public/assets/character/temporary-3d/guardian.glb');return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};

test('Named production-style clips map without eighteen placeholder-specific names, and root travel is removed',async()=>{
  const result=await load(),original=result.animations.find(clip=>clip.name==='swing-down');
  const clip=original.clone();clip.name='Armature|SwingIn';
  clip.tracks.push(new VectorKeyframeTrack(result.scene.uuid+'.position',[0,1],[0,0,0,50,30,20]));
  clip.tracks.push(new VectorKeyframeTrack('MissingExportBone.position',[0,1],[0,0,0,1,0,0]));
  const controller=new CharacterAnimationController(result.scene,[clip]);
  expect(controller.mapping.SwingIn).toBe('Armature|SwingIn');expect(controller.mapping.SwingExitLeft).toBe('Armature|SwingIn');
  expect(controller.missing).toContain('AskGesture');expect(controller.strippedTracks).toContain(result.scene.uuid+'.position');expect(controller.unboundTracks).toEqual(['MissingExportBone.position']);
  const foot=result.scene.getObjectByName('Foot_L');controller.sample('SwingIn',.1);const a=foot.getWorldPosition(foot.position.clone());
  controller.sample('SwingIn',.8);expect(foot.getWorldPosition(foot.position.clone()).distanceTo(a)).toBeGreaterThan(.02);
  expect(result.scene.position.toArray()).toEqual([0,0,0]);expect(()=>controller.sample('AskGesture',.5)).not.toThrow();controller.dispose();disposeModel(result.scene);
});

test('Web grip aliases and model normalization keep the attachment fixed while real limbs move',async()=>{
  const result=await load();result.scene.getObjectByName('WebGrip').name='socket-web-right';
  const eye=new Bone();eye.name='LeftEye';result.scene.getObjectByName('Head').add(eye);
  const model=new CharacterModelController(result.scene,result.animations,assets);expect(model.socketMapping.grip).toBe('socket-web-right');expect(model.height).toBeGreaterThan(1);
  model.sample('swing-down',.1);const first=model.socket('boot');expect(model.socket('grip').length()).toBeLessThan(1e-6);
  model.sample('swing-down',.8);expect(model.socket('grip').length()).toBeLessThan(1e-6);expect(model.socket('boot').distanceTo(first)).toBeGreaterThan(.02);
  model.sample('release',.8,false);expect(model.socket('grip').length()).toBeGreaterThan(.02);
  model.sample('Idle',.1);const neutralHead=model.sockets.head.quaternion.clone();model.mood('curious',0,{x:1,y:.5},0);
  const head=model.sockets.head.quaternion.clone(),eyePose=eye.quaternion.clone();expect(head.angleTo(neutralHead)).toBeGreaterThan(.05);expect(eyePose.angleTo(new Bone().quaternion)).toBeGreaterThan(.03);
  for(let i=0;i<20;i++){model.sample('Idle',.1);model.mood('curious',0,{x:1,y:.5},0);}
  expect(model.sockets.head.quaternion.angleTo(head)).toBeLessThan(1e-6);expect(eye.quaternion.angleTo(eyePose)).toBeLessThan(1e-6);model.dispose();
});

test('Facial moods compose with blink, reset to neutral and discover independent left/right channels',()=>{
  const root=new Group(),face=new Mesh();face.name='Face';
  face.morphTargetDictionary={eyeBlinkLeft:0,eyeBlinkRight:1,mouthSmileLeft:2,mouthSmileRight:3,curious:4,waiting:5,frown:6,excited:7,unmanaged:8};face.morphTargetInfluences=Array(9).fill(0);face.morphTargetInfluences[8]=.4;root.add(face);
  const controller=new CharacterFacialController(root);controller.apply('happy',.8);
  expect(face.morphTargetInfluences.slice(0,4)).toEqual([.8,.8,1,1]);controller.apply('curious',.2);expect(face.morphTargetInfluences[4]).toBe(1);expect(face.morphTargetInfluences[2]).toBe(0);
  controller.apply('waiting');expect(face.morphTargetInfluences[5]).toBe(1);controller.apply('disappointed',0,.75);expect(face.morphTargetInfluences[6]).toBe(.75);
  controller.apply('excited',.1);expect(face.morphTargetInfluences[7]).toBe(1);expect(face.morphTargetInfluences[6]).toBe(0);
  controller.apply('neutral');expect(face.morphTargetInfluences.slice(0,8)).toEqual(Array(8).fill(0));expect(face.morphTargetInfluences[8]).toBe(.4);expect(controller.missing).toContain('happy');disposeModel(root);
});

test('Success, Later and Ignore body sequences fit the existing business phases and continuously sample generic SwingIn',()=>{
  const named=new Set(['SwingIn','ArriveSettle','AskGesture','Smile','WebShoot','BottlePresent','Success','SwingExitRight','SwingExitLeft','Wait','Disappointed','Idle']);
  const visual=(state,progress=0,elapsed=0)=>characterAnimationSequence(state,bodyCue(state,progress),progress,elapsed,false,role=>named.has(role));
  const success=[[State.SwingingIn,.4],[State.Arriving,.5],[State.Reminder,0,.2],[State.Success,0,.2],[State.DeliveringBottle,.1],[State.DeliveringBottle,.5],[State.DeliveringBottle,.8],[State.SwingingOutRight,.7]].map(args=>visual(...args).role);
  expect(success).toEqual(['SwingIn','ArriveSettle','AskGesture','Smile','WebShoot','BottlePresent','Success','SwingExitRight']);
  expect(visual(State.Waiting,0,.7)).toMatchObject({role:'Disappointed',expression:'disappointed'});expect(visual(State.SwingingBackLeft,.7).role).toBe('SwingExitLeft');
  expect(visual(State.Reminder,0,3).role).toBe('Wait');
  for(const progress of [.1,.3,.55,.65,.85,.99])expect(visual(State.SwingingIn,progress).progress).toBe(progress);
});

test('All missing body PNGs use only the brand mark; missing bottle keeps real drink feedback and no alternate mascot',async()=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
  const app=await electron.launch({args:['.','--companion-test'],env,chromiumSandbox:true});
  try{
    await expect.poll(()=>app.windows().filter(page=>/#\/(dashboard|companion)$/.test(page.url())).length,{timeout:60000}).toBe(2);
    const dashboard=app.windows().find(page=>page.url().endsWith('#/dashboard')),overlay=app.windows().find(page=>page.url().endsWith('#/companion'));
    await dashboard.evaluate(async()=>{const s=await window.desktopCompanion.getHydrationSettings();await window.desktopCompanion.updateHydrationSettings({...s,workingStart:'00:00',workingEnd:'00:01'});});
    await dashboard.getByTestId('open-companion').click();await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','reminder');
    await failBodyArtwork(overlay);
    expect(await overlay.locator('canvas,app-body-sprite-renderer,app-companion-3d').count()).toBe(0);
    const fallback=overlay.locator('.current-pose .brand-fallback');await expect(fallback).toHaveAttribute('href','slingsip-logo.svg');
    const hit=await overlay.getByTestId('slingsip-png').evaluate(svg=>{const p=svg.createSVGPoint();p.x=125;p.y=72;const h=p.matrixTransform(svg.getScreenCTM());return !!document.elementFromPoint(h.x,h.y)?.closest('[data-overlay-interactive]');});expect(hit).toBe(true);
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getHydrationState())).currentWaterMl).toBe(0);
    await overlay.getByTestId('drank-it').evaluate(b=>b.click());await expect(dashboard.getByTestId('dashboard-water')).toHaveText('250 / 2000 ml');
    await expect(overlay.getByTestId('companion-bottle')).toBeVisible();await overlay.locator('.bottle image').dispatchEvent('error');await expect(overlay.getByTestId('companion-bottle')).toHaveCount(0);
    await expect(overlay.getByTestId('bottle-water-feedback')).toHaveText('+250 ml');await expect(overlay.getByTestId('character')).toHaveAttribute('data-state','hidden');
    expect((await dashboard.evaluate(()=>window.desktopCompanion.getHydrationState())).currentWaterMl).toBe(250);expect(await dashboard.locator('canvas').count()).toBe(0);
  }finally{await app.close();}
});
