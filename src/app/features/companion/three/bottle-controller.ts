import { Box3, CanvasTexture, Group, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeModel } from './character-model-controller';
import type { Companion3DAssets } from './companion-3d-assets';

export class BottleController {
  readonly root:Object3D;
  readonly warnings:string[]=[];
  readonly anchorMapping:string;
  private constructor(source:Object3D,readonly assets:Companion3DAssets){
    this.root=source;this.anchorMapping='exported root origin';
    if(assets.normalize){
      const bounds=new Box3().setFromObject(source),height=bounds.getSize(new Vector3()).y;
      if(!Number.isFinite(height)||height<=0)throw new Error('Bottle has no usable model height.');
      const anchor=[assets.bottleAnchor,'BottleWebGrip','BottleTop','WebAttachment','BottleAnchor'].filter(Boolean).map(name=>source.getObjectByName(name!)).find(Boolean);
      const top=anchor?anchor.getWorldPosition(new Vector3()):new Vector3((bounds.min.x+bounds.max.x)/2,bounds.max.y,(bounds.min.z+bounds.max.z)/2);
      this.anchorMapping=anchor?.name??'bounds top centre (approximate)';
      if(!anchor)this.warnings.push('No bottle top attachment node; using the model bounds top centre.');
      const alignment=new Group();this.root=new Group();this.root.add(alignment);alignment.add(source);
      alignment.scale.setScalar(1/height);alignment.position.copy(top).multiplyScalar(-1/height);
    }
    // Production labels/materials remain authored in the GLB.
    if(!assets.temporary)return;
    const root=this.root;
    const label=root.getObjectByName('BottleLabel');
    if(label instanceof Mesh){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=768;const ctx=canvas.getContext('2d')!;
      // Transparent label: the bottle remains glass, with the reference's drop and wordmark.
      ctx.fillStyle='#8bf8ff';ctx.beginPath();ctx.moveTo(256,100);ctx.bezierCurveTo(215,182,156,254,156,307);ctx.bezierCurveTo(156,440,356,440,356,307);ctx.bezierCurveTo(356,254,297,182,256,100);ctx.fill();
      ctx.fillStyle='#087788';ctx.beginPath();ctx.moveTo(256,215);ctx.bezierCurveTo(240,259,212,282,212,314);ctx.bezierCurveTo(212,372,300,372,300,314);ctx.bezierCurveTo(300,282,272,259,256,215);ctx.fill();
      ctx.fillStyle='#ffffff';ctx.font='bold 92px system-ui';ctx.textAlign='center';ctx.fillText('SlingSip',256,556);
      const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
      const material=label.material as MeshStandardMaterial;material.map=texture;material.needsUpdate=true;
    }
  }
  static async load(assets:Companion3DAssets):Promise<BottleController>{
    try{
      const result=await new GLTFLoader().loadAsync(assets.bottle);
      try{return new BottleController(result.scene,assets);}catch(error){disposeModel(result.scene);throw error;}
    }catch(error){
      if(!assets.fallback)throw error;
      const bottle=await BottleController.load(assets.fallback);
      bottle.warnings.unshift('Preferred bottle '+assets.bottle+' unavailable/incompatible: '+(error instanceof Error?error.message:String(error))+'. Using explicitly temporary '+bottle.assets.bottle);
      return bottle;
    }
  }
  present(sample:{x:number;y:number;size:number;rotation:number;opacity:number}):void{
    this.root.visible=sample.opacity>.001;this.root.position.set(sample.x,-sample.y,3);this.root.scale.setScalar(sample.size);this.root.rotation.z=-sample.rotation*Math.PI/180;
    this.root.traverse(node=>{if(node instanceof Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material]){
      material.userData['baseOpacity']??=material.opacity;material.userData['baseTransparent']??=material.transparent;
      material.opacity=Number(material.userData['baseOpacity'])*sample.opacity;
      const transparent=Boolean(material.userData['baseTransparent'])||material.opacity<1;
      if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
    }});
  }
  dispose():void{disposeModel(this.root);}
}
