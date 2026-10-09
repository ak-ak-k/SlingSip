import { SLINGSIP_ASSET_ENTRIES, SLINGSIP_SOURCE_POINTS, type SlingSipAssetKey } from './slingsip-assets';
import { SLINGSIP_SPRITE_GEOMETRY } from './slingsip-sprite-geometry';
import { CharacterState } from './character.model';
import type { EntryVariant } from './entry-variants';
import { bodyCue, bottlePresentation, webChoreography } from './body-choreography';
import { artworkPoint, clamp, smoothStep, type SwingLayout, type SwingSample } from './swing-motion';
import { localWebAnchor } from './web-geometry';

export const PNG_SWING_FRAMES:readonly SlingSipAssetKey[]=['swing1','swing2','swing3','swing4','swing5'];
export function pngAsset(key:SlingSipAssetKey){return{key,src:SLINGSIP_ASSET_ENTRIES[key],...SLINGSIP_SPRITE_GEOMETRY[key]};}
export type PngAssetResolver=(key:SlingSipAssetKey)=>SlingSipAssetKey|null;
export function pngPose(state:CharacterState,progress:number,variant:EntryVariant,reduced=false,resolve:PngAssetResolver=key=>key){
  let key:SlingSipAssetKey='idle',head:SlingSipAssetKey|null=null,index=-1;
  if(state===CharacterState.SwingingIn){
    if(variant==='upside-down')key='upsideDown';
    else{index=reduced?4:Math.min(4,Math.floor(clamp(progress,0,1)*5));key=PNG_SWING_FRAMES[index];}
  }else if(state===CharacterState.Arriving){key=variant==='upside-down'?'upsideDown':'swing5';index=variant==='upside-down'?-1:4;}
  else if(state===CharacterState.Reminder)key=variant==='upside-down'?'upsideDown':'ask';
  else if(state===CharacterState.Success||state===CharacterState.DeliveringBottle)key='happy';
  else if(state===CharacterState.Waiting){key='idle';head='disappointed';}
  else if(state===CharacterState.SwingingOutRight||state===CharacterState.SwingingBackLeft){index=reduced?4:Math.min(4,Math.floor(clamp(progress,0,1)*5));key=PNG_SWING_FRAMES[index];}
  const selected=resolve(key),missing=selected===null;
  key=selected??'idle';head=head&&!missing?resolve(head):null;
  const mirror=state===CharacterState.SwingingBackLeft;
  const geometry=pngAsset(key),reflection=(point:{x:number;y:number})=>({x:mirror?250-point.x:point.x,y:point.y});
  // Keep the artwork's trajectory pivot separate from its visible hand socket.
  const hand=missing?undefined:SLINGSIP_SOURCE_POINTS[key].webHand;
  const webGrip=hand?{x:geometry.transform.x+hand[0]*geometry.transform.scale,y:geometry.transform.y+hand[1]*geometry.transform.scale}:geometry.anchors.grip;
  return{key,head,index,mirror,missing,geometry,anchors:{grip:reflection(geometry.anchors.grip),webGrip:reflection(webGrip),freeHand:reflection(geometry.anchors.freeHand),hit:reflection(missing?{x:125,y:72}:geometry.anchors.hit)}};
}
/** The upside-down PNG is already inverted; don't apply the upright-art 180° roll again. */
export function pngRenderPose(pose:SwingSample,state:CharacterState,progress:number,variant:EntryVariant):SwingSample{
  return state===CharacterState.SwingingIn&&variant==='upside-down'?{...pose,rotation:pose.rotation-180*(1-smoothStep((progress-.55)/.37))}:pose;
}
export function pngWebs(layout:SwingLayout,pose:SwingSample,state:CharacterState,progress:number,variant:EntryVariant,reduced=false,resolve?:PngAssetResolver){
  const frame=pngPose(state,progress,variant,reduced,resolve),visual=pngRenderPose(pose,state,progress,variant);
  const grip=artworkPoint(layout,visual,frame.anchors.webGrip.x,frame.anchors.webGrip.y);
  const exiting=state===CharacterState.SwingingOutRight||state===CharacterState.SwingingBackLeft;
  const direction=state===CharacterState.SwingingBackLeft?-1:1,ch=layout.characterHeight;
  // Cast outward from the holding hand so the resting strand does not cut across the hood.
  const handSide=Math.sign(grip.x-visual.x)||direction;
  const arrival={x:grip.x+handSide*ch*.24,y:Math.max(16,grip.y-ch*.94)};
  const leading={x:grip.x+direction*ch*.62,y:grip.y-ch*.94};
  const previous=localWebAnchor(layout,grip,exiting?arrival:leading);
  const next=localWebAnchor(layout,grip,exiting?leading:arrival);
  const webs=webChoreography(layout,visual,state,bodyCue(state,progress,reduced),variant,grip,grip,{previous,next});
  if(variant==='upside-down'&&[CharacterState.SwingingIn,CharacterState.Arriving,CharacterState.Reminder].includes(state)){
    if(webs.stage==='web-1'||webs.stage==='web-2')webs.main.a={...webs.main.a,x:grip.x};
  }
  return webs;
}
export function pngBottle(layout:SwingLayout,pose:SwingSample,state:CharacterState,progress:number,bottleProgress:number|null,variant:EntryVariant,resolve?:PngAssetResolver){
  const frame=pngPose(state,progress,variant,false,resolve),visual=pngRenderPose(pose,state,progress,variant);
  return bottlePresentation(layout,bottleProgress,artworkPoint(layout,visual,frame.anchors.freeHand.x,frame.anchors.freeHand.y));
}
