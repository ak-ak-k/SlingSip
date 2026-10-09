import { DirectionalLight, HemisphereLight, Object3D, OrthographicCamera, Raycaster, Scene, SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import { CharacterState } from '../animation/character.model';
import { bottlePresentation, bodyCue, webChoreography } from '../animation/body-choreography';
import { type Point, type SwingLayout } from '../animation/swing-motion';
import type { MotionFrame } from '../animation/companion-motion.service';
import type { EntryVariant } from '../animation/entry-variants';
import type { Companion3DAssets } from './companion-3d-assets';
import { CharacterModelController } from './character-model-controller';
import { BottleController } from './bottle-controller';
import { WebController } from './web-controller';
import { characterAnimationSequence } from './character-animation-sequence';

export interface Companion3DFrame extends MotionFrame {
  state:CharacterState;variant:EntryVariant;layout:SwingLayout;active:boolean;reduced:boolean;lowPower:boolean;reactions:boolean;
}
const restStates=new Set([CharacterState.Reminder,CharacterState.Waiting,CharacterState.Success]);
const screen=(point:{x:number;y:number}):Point=>({x:point.x,y:-point.y});
/** Orthographic DIP scene: screen motion still comes exclusively from CompanionMotionService. */
export class Companion3DSceneController {
  readonly scene=new Scene();
  readonly camera=new OrthographicCamera(0,1,0,-1,.1,3000);
  readonly renderer:WebGLRenderer;
  readonly webs=new WebController();
  private character?:CharacterModelController;
  private bottle?:BottleController;
  private frame?:Companion3DFrame;
  private timer?:ReturnType<typeof setTimeout>;
  private elapsed=0;private previousTime?:number;
  private look:Point={x:0,y:0};private reaction?:{start:number;angle:number};
  private disposed=false;private renderedHidden=false;private renders=0;private sizing='';
  private readonly raycaster=new Raycaster();
  constructor(readonly canvas:HTMLCanvasElement,private readonly assets:Companion3DAssets,private readonly present:(bottle:ReturnType<typeof bottlePresentation>)=>void){
    const context=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});
    if(!context)throw new Error('WebGL2 unavailable; using the sprite renderer.');
    this.renderer=new WebGLRenderer({canvas,context,alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.shadowMap.enabled=false;
    this.camera.position.z=1000;this.camera.updateMatrixWorld(true);
    this.scene.add(this.webs.root,new HemisphereLight(0xd9fff2,0x14233b,2));
    const light=new DirectionalLight(0xf3fbff,2);light.position.set(-200,300,900);this.scene.add(light);
    canvas.addEventListener('webglcontextlost',this.contextLost);
  }
  onFailure?: (reason:string)=>void;
  private readonly contextLost=(event:Event)=>{event.preventDefault();this.onFailure?.('3D graphics context lost; using the sprite renderer.');this.dispose();};
  async load():Promise<boolean>{
    const results=await Promise.allSettled([CharacterModelController.load(this.assets),BottleController.load(this.assets)]);
    if(this.disposed||results.some(result=>result.status==='rejected')){
      results.forEach(result=>{if(result.status==='fulfilled')result.value.dispose();});
      if(!this.disposed)throw new Error(results.find(result=>result.status==='rejected')?.reason?.message??'3D asset could not load.');return false;
    }
    this.character=(results[0] as PromiseFulfilledResult<CharacterModelController>).value;this.bottle=(results[1] as PromiseFulfilledResult<BottleController>).value;
    this.scene.add(this.character.root,this.bottle.root);this.canvas.dataset['modelReady']='true';this.canvas.dataset['temporary']=String(this.character.assets.temporary||this.bottle.assets.temporary);
    this.canvas.dataset['clipCount']=String(this.character.clips.length);this.canvas.dataset['renderer']='three-webgl';
    this.canvas.dataset['characterSource']=this.character.assets.character;this.canvas.dataset['bottleSource']=this.bottle.assets.bottle;
    this.canvas.dataset['characterTemporary']=String(this.character.assets.temporary);this.canvas.dataset['bottleTemporary']=String(this.bottle.assets.temporary);
    this.canvas.dataset['animationMapping']=JSON.stringify(this.character.animation.mapping);this.canvas.dataset['morphMapping']=JSON.stringify(this.character.face.mapping);
    this.canvas.dataset['socketMapping']=JSON.stringify(this.character.socketMapping);this.canvas.dataset['bottleAnchor']=this.bottle.anchorMapping;
    this.canvas.dataset['assetWarnings']=JSON.stringify([...this.character.warnings,...this.bottle.warnings]);
    this.canvas.dataset['strippedRootTracks']=JSON.stringify(this.character.animation.strippedTracks);
    this.canvas.dataset['unboundTracks']=JSON.stringify(this.character.animation.unboundTracks);
    if(this.frame)this.update(this.frame);
    return !this.disposed;
  }
  update(frame:Companion3DFrame):void{
    if(this.disposed)return;
    const changed=this.frame?.state!==frame.state;
    if(changed){this.elapsed=0;this.previousTime=undefined;this.reaction=undefined;}
    if(this.frame?.active!==frame.active)this.previousTime=undefined;
    this.frame=frame;this.size(frame);this.draw();this.schedule();
  }
  view(look:Point,reaction?:string):void{
    if(!reaction&&look.x===this.look.x&&look.y===this.look.y)return;
    this.look=look;if(reaction)this.reaction={start:this.elapsed,angle:reaction==='nod'?.10:reaction==='playful'?-.17:.07};
    if(this.frame?.state===CharacterState.Reminder&&this.frame.active)this.draw();
  }
  hit(clientX:number,clientY:number):boolean{
    const frame=this.frame;if(this.disposed||!this.character||!frame?.active||!frame.reactions||frame.state!==CharacterState.Reminder)return false;
    const bounds=this.canvas.getBoundingClientRect(),x=clientX-bounds.left,y=clientY-bounds.top;
    if(x<0||y<0||x>bounds.width||y>bounds.height)return false;
    this.character.prepareHitTest();this.raycaster.setFromCamera(new Vector2(x/bounds.width*2-1,1-y/bounds.height*2),this.camera);
    return this.raycaster.intersectObject(this.character.root,true).some(hit=>hit.object.visible);
  }
  private size(frame:Companion3DFrame):void{
    const {width,height}=frame.layout,ratio=Math.min(devicePixelRatio||1,frame.lowPower?.65:1,1600/Math.max(1,width));
    const key=[width,height,ratio].join(':');if(key===this.sizing)return;this.sizing=key;
    this.renderer.setPixelRatio(ratio);this.renderer.setSize(Math.max(1,width),Math.max(1,height),false);
    this.camera.right=width;this.camera.bottom=-height;this.camera.updateProjectionMatrix();this.renderedHidden=false;
  }
  private draw():void{
    try{this.drawUnsafe();}catch(error){this.onFailure?.('3D render failed: '+(error instanceof Error?error.message:'graphics unavailable'));this.dispose();}
  }
  private drawUnsafe():void{
    const frame=this.frame;if(!frame||!this.character||!this.bottle||this.disposed)return;
    if(frame.state===CharacterState.Hidden){if(!this.renderedHidden){this.renderer.clear();this.present(bottlePresentation(frame.layout,null,frame.pose));this.renderedHidden=true;this.canvas.dataset['renderCount']=String(++this.renders);for(const key of ['bottleOpacity','mainOpacity','oldOpacity','feedback'])this.canvas.dataset[key]='0';}return;}
    if(!frame.active)return;this.renderedHidden=false;
    const cue=bodyCue(frame.state,frame.progress,frame.reduced);
    const sequence=characterAnimationSequence(frame.state,cue,frame.progress,this.elapsed,frame.reduced,role=>this.character!.animation.hasSpecific(role));
    const clip=this.character.sample(sequence.role,sequence.progress,cue.web!=='none'&&cue.web!=='retract-first');
    const root=this.character.root,scale=frame.layout.characterHeight/this.character.height;
    root.position.set(frame.pose.x,-frame.pose.y,0);root.scale.setScalar(scale);root.rotation.set(0,frame.reduced?0:Math.sin(cue.progress*Math.PI)*.10,-frame.pose.rotation*Math.PI/180);
    if(restStates.has(frame.state)&&!frame.reduced){
      // Grip stays fixed; the chest/head shift below it by 2–3 px.
      this.character.sockets.chest.position.x+=Math.sin(this.elapsed*Math.PI/2.1)*2.5/scale;
      this.character.sockets.chest.scale.y*=1+Math.sin(this.elapsed*Math.PI/1.6)*.008;
    }
    const blinkT=this.elapsed%7.2,blink=frame.reduced?0:Math.max(0,1-Math.abs(blinkT-3.12)/.10);
    const reactT=this.reaction?(this.elapsed-this.reaction.start)/.38:1,reaction=reactT<1?Math.sin(reactT*Math.PI)*this.reaction!.angle:0;
    const happy=['smile','happy','excited'].includes(sequence.expression);
    const expression=sequence.expression==='neutral'&&(Math.abs(this.look.x)+Math.abs(this.look.y)>.05)&&!frame.reduced?'curious':sequence.expression;
    this.character.mood(expression,blink,this.look,frame.reduced?0:reaction,sequence.intensity);
    this.scene.updateMatrixWorld(true);
    const grip=screen(this.character.socket('grip')),hand=screen(this.character.socket('freeHand')),boot=screen(this.character.socket('boot'));
    const webs=webChoreography(frame.layout,frame.pose,frame.state,cue,frame.variant,grip,boot);
    this.webs.set(0,webs.main.a,webs.main.b,webs.main.opacity);this.webs.set(1,webs.old.a,webs.old.b,webs.old.opacity);
    const bottle=bottlePresentation(frame.layout,frame.bottleProgress,hand);
    this.webs.set(2,bottle.start,bottle,bottle.webOpacity);this.bottle.present(bottle);this.present(bottle);
    this.renderer.render(this.scene,this.camera);
    const chest=screen(this.character.socket('chest'));
    const diagnostics={renderCount:++this.renders,bodyState:cue.state,animationRole:sequence.role,facialExpression:expression,clip,clipTime:sequence.progress,webStage:webs.stage,
      mainOpacity:webs.main.opacity,oldOpacity:webs.old.opacity,gripX:grip.x,gripY:grip.y,webEndX:webs.main.b.x,webEndY:webs.main.b.y,
      handX:hand.x,handY:hand.y,bottleStartX:bottle.start.x,bottleStartY:bottle.start.y,bottleX:bottle.x,bottleY:bottle.y,bottleOpacity:bottle.opacity,
      bottleRotation:bottle.rotation,deliveryStage:bottle.stage,feedback:bottle.feedback,hitX:chest.x,hitY:chest.y,chestX:chest.x,blink,smile:happy?1:0,frown:sequence.expression==='disappointed'?.75:0,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};
    for(const [key,value]of Object.entries(diagnostics))this.canvas.dataset[key]=String(value);
  }
  private schedule():void{
    if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;
    const frame=this.frame;if(this.disposed||!this.character||!frame?.active||frame.reduced||!restStates.has(frame.state))return;
    const fps=frame.lowPower?8:frame.state===CharacterState.Success?24:15;
    this.previousTime??=performance.now();
    this.timer=setTimeout(()=>{this.timer=undefined;const now=performance.now();this.elapsed+=Math.min(.2,(now-this.previousTime!)/1000);this.previousTime=now;this.draw();this.schedule();},1000/fps);
  }
  dispose():void{
    if(this.disposed)return;this.disposed=true;if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;
    this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.character?.dispose();this.bottle?.dispose();this.webs.dispose();this.renderer.dispose();this.renderer.forceContextLoss();
  }
}
