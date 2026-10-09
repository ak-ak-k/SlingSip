import { Box3, Group, Mesh, Object3D, Quaternion, SkinnedMesh, Texture, Vector3, type AnimationClip, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Companion3DAssets } from './companion-3d-assets';
import { CharacterAnimationController, normalizeAssetName } from './character-animation-controller';
import { CharacterFacialController, type FacialExpression } from './character-facial-controller';

const socketAliases:Record<keyof Companion3DAssets['nodes'],readonly string[]>={
  grip:['WebGrip','WebSocket_R','socket-web-right','RightHand','Hand_R','HandR'],
  freeHand:['BottleGrip','BottleSocket','socket-bottle','LeftHand','Hand_L','HandL'],
  boot:['Foot_L','LeftFoot','FootL'],head:['Head','head-bone'],chest:['Chest','Spine2','Spine1','Spine'],
};

/** Owns only loaded art, clips, rig sockets and expressions. */
export class CharacterModelController {
  readonly root:Object3D;
  readonly animation:CharacterAnimationController;
  readonly face:CharacterFacialController;
  readonly height:number;
  readonly warnings:string[]=[];
  readonly socketMapping:Record<string,string>={};
  readonly sockets:Record<keyof Companion3DAssets['nodes'],Object3D>;
  private alignment?:Group;
  private baseHead?:Quaternion;
  private baseChest?:Vector3;
  private baseChestScale?:Vector3;
  private readonly pupils:{node:Object3D;x:number;scaleY:number}[]=[];
  private readonly eyes:{node:Object3D;base:Quaternion}[]=[];
  constructor(source:Object3D,readonly clips:AnimationClip[],readonly assets:Companion3DAssets){
    let skinned=false;source.traverse(node=>{if(node instanceof SkinnedMesh&&node.skeleton.bones.length)skinned=true;});
    if(!skinned)throw new Error('Character GLB is not a rigged skinned model.');
    this.root=source;
    this.height=assets.characterHeight;
    if(assets.normalize){
      this.height=new Box3().setFromObject(source).getSize(new Vector3()).y;
      if(!Number.isFinite(this.height)||this.height<=0)throw new Error('Character has no usable model height.');
      this.root=new Group();this.alignment=new Group();this.root.add(this.alignment);this.alignment.add(source);
    }
    const nodes:Object3D[]=[];source.traverse(node=>nodes.push(node));
    this.sockets=Object.fromEntries(Object.entries(assets.nodes).map(([key,name])=>{
      const candidates=[name,...(assets.nodeAliases?.[key as keyof typeof socketAliases]??[]),...socketAliases[key as keyof typeof socketAliases]];
      const node=candidates.map(candidate=>source.getObjectByName(candidate)).find(Boolean)??candidates.flatMap(candidate=>nodes.filter(node=>normalizeAssetName(node.name)===normalizeAssetName(candidate)))[0];
      if(!node)throw new Error('Missing 3D rig socket/bone for '+key+': '+name);
      this.socketMapping[key]=node.name;
      if(node.name!==name)this.warnings.push('Socket '+name+' uses '+node.name+(key==='grip'||key==='freeHand'?' at its exported origin; add a fingertip socket for precise attachment.':'.'));
      return[key,node];
    })) as Record<keyof Companion3DAssets['nodes'],Object3D>;
    this.animation=new CharacterAnimationController(source,clips,assets.clips,assets.rootMotionNodes??['Armature','RigRoot','RootMotion']);
    this.face=new CharacterFacialController(source,{blink:[assets.morphs.blink],smile:[assets.morphs.smile],disappointed:[assets.morphs.frown],...assets.morphAliases});
    this.warnings.push(...this.animation.warnings,...this.face.missing.filter(role=>role!=='neutral').map(role=>'No dedicated '+role+' morph target.'));
    source.traverse(node=>{if(/pupil/i.test(node.name))this.pupils.push({node,x:node.position.x,scaleY:node.scale.y});});
    source.traverse(node=>{if(node.type==='Bone'&&['eyel','eyer','lefteye','righteye','eyeleft','eyeright'].includes(normalizeAssetName(node.name)))this.eyes.push({node,base:node.quaternion.clone()});});
    this.alignGrip();
  }
  get mixer(){return this.animation.mixer;}
  static async load(assets:Companion3DAssets):Promise<CharacterModelController>{
    try{
      const result=await new GLTFLoader().loadAsync(assets.character);
      try{return new CharacterModelController(result.scene,result.animations,assets);}
      catch(error){disposeModel(result.scene);throw error;}
    }catch(error){
      if(!assets.fallback)throw error;
      const model=await CharacterModelController.load(assets.fallback);
      model.warnings.unshift('Preferred character '+assets.character+' unavailable/incompatible: '+(error instanceof Error?error.message:String(error))+'. Using explicitly temporary '+model.assets.character);
      return model;
    }
  }
  sample(name:string,progress:number,keepGrip=true):string{
    // Restore the preceding clip result before applying new additive gaze/breath.
    // Mixer property caching must not accumulate our post-animation offsets.
    if(this.baseHead)this.sockets.head.quaternion.copy(this.baseHead);
    if(this.baseChest)this.sockets.chest.position.copy(this.baseChest);
    if(this.baseChestScale)this.sockets.chest.scale.copy(this.baseChestScale);
    this.eyes.forEach(eye=>eye.node.quaternion.copy(eye.base));
    const resolved=this.animation.sample(name,progress);
    this.baseHead=this.sockets.head.quaternion.clone();this.baseChest=this.sockets.chest.position.clone();this.baseChestScale=this.sockets.chest.scale.clone();
    this.eyes.forEach(eye=>eye.base.copy(eye.node.quaternion));
    if(keepGrip)this.alignGrip();return resolved;
  }
  expression(happy:number,waiting:number,blink:number,look: {x:number;y:number},reaction:number):void{
    this.face.weights(happy,waiting,blink);this.lookAt(look,reaction,blink);
  }
  mood(expression:FacialExpression,blink:number,look:{x:number;y:number},reaction:number,intensity=1):void{
    this.face.apply(expression,blink,intensity);this.lookAt(look,reaction,blink);
    // Only the development pack opts into stylized white eyes versus visible pupils.
    if(this.assets.temporary)this.pupils.forEach(({node})=>{
      const moods=node.userData['temporaryExpressionVisibility'];
      if(Array.isArray(moods))node.visible=moods.includes(expression);
    });
  }
  private lookAt(look:{x:number;y:number},reaction:number,blink:number):void{
    const head=this.sockets.head;
    head.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),look.x*.12));
    head.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),look.y*.06+reaction));
    this.pupils.forEach(({node,x,scaleY})=>{node.scale.y=scaleY*(1-blink*.95);node.position.x=x+look.x*.025;});
    this.eyes.forEach(({node})=>{node.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),look.x*.08));node.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),look.y*.04));});
  }
  private alignGrip():void{
    if(!this.alignment)return;
    this.root.updateMatrixWorld(true);
    const grip=this.root.worldToLocal(this.sockets.grip.getWorldPosition(new Vector3()));
    this.alignment.position.sub(grip);this.root.updateMatrixWorld(true);
  }
  socket(name:keyof Companion3DAssets['nodes']):Vector3{return this.sockets[name].getWorldPosition(new Vector3());}
  prepareHitTest():void{this.root.updateMatrixWorld(true);this.root.traverse(node=>{if(node instanceof SkinnedMesh)node.computeBoundingSphere();});}
  dispose():void{this.animation.dispose();disposeModel(this.root);}
}
export function disposeModel(root:Object3D):void{
  const geometries=new Set(),materials=new Set<Material>(),textures=new Set<Texture>(),skeletons=new Set<SkinnedMesh['skeleton']>();
  root.traverse(node=>{if(node instanceof Mesh){geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof Texture)textures.add(value);}if(node instanceof SkinnedMesh)skeletons.add(node.skeleton);}});
  skeletons.forEach(skeleton=>skeleton.dispose());
  for(const geometry of geometries)(geometry as {dispose():void}).dispose();
  for(const texture of textures){texture.dispose();if(typeof ImageBitmap!=='undefined'&&texture.image instanceof ImageBitmap)texture.image.close();}
  materials.forEach(material=>material.dispose());root.removeFromParent();
}
