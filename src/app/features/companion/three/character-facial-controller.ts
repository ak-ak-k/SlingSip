import { Mesh, type Object3D } from 'three';
import { normalizeAssetName } from './character-animation-controller';

export type FacialExpression='neutral'|'blink'|'smile'|'happy'|'curious'|'waiting'|'disappointed'|'excited';
const aliases:Record<FacialExpression,readonly string[]>={
  neutral:['neutral','face-neutral'],blink:['blink','eyeBlinkLeft','eyeBlinkRight','blink-left','blink-right'],
  smile:['smile','mouthSmileLeft','mouthSmileRight','smile-left','smile-right'],
  happy:['happy','face-happy'],curious:['curious','browInnerUp','brow-raise','face-curious'],
  waiting:['waiting','face-waiting'],disappointed:['disappointed','frown','sad','mouthFrownLeft','mouthFrownRight'],
  excited:['excited','face-excited'],
};
type Binding={mesh:Mesh;index:number;name:string};
/** Facial moods compose with a blink; absent targets are reported, never invented. */
export class CharacterFacialController {
  readonly mapping:Record<FacialExpression,string[]>={neutral:[],blink:[],smile:[],happy:[],curious:[],waiting:[],disappointed:[],excited:[]};
  readonly missing:FacialExpression[]=[];
  private readonly bindings:Partial<Record<FacialExpression,Binding[]>>={};
  private readonly controlled=new Map<Mesh,Set<number>>();
  constructor(root:Object3D,overrides:Partial<Record<string,readonly string[]>>={}){
    for(const role of Object.keys(aliases) as FacialExpression[]){
      const names=new Set([...(overrides[role]??[]),...aliases[role]].map(normalizeAssetName));const found:Binding[]=[];
      root.traverse(node=>{if(node instanceof Mesh&&node.morphTargetInfluences)for(const[name,index]of Object.entries(node.morphTargetDictionary??{})){
        if(names.has(normalizeAssetName(name)))found.push({mesh:node,index,name:(node.name||node.uuid)+':'+name});
      }});
      this.bindings[role]=found;this.mapping[role]=found.map(binding=>binding.name);
      if(!found.length)this.missing.push(role);
      for(const {mesh,index} of found){const indices=this.controlled.get(mesh)??new Set<number>();indices.add(index);this.controlled.set(mesh,indices);}
    }
  }
  private set(role:FacialExpression,weight:number):boolean{
    const found=this.bindings[role]??[];
    for(const{mesh,index}of found)mesh.morphTargetInfluences![index]=Math.max(mesh.morphTargetInfluences![index],Math.max(0,Math.min(1,weight)));
    return !!found.length;
  }
  apply(expression:FacialExpression,blink=0,intensity=1):void{
    this.reset();
    if(!this.set(expression,intensity)){
      if(expression==='happy')this.set('smile',intensity);
      else if(expression==='excited'){if(!this.set('happy',intensity))this.set('smile',intensity);}
      else if(expression==='waiting'){if(!this.set('curious',intensity*.35))this.set('disappointed',intensity*.25);}
      // Curious without a brow target still has the additive head/eye glance.
    }
    this.set('blink',blink);
  }
  /** Compatibility for independently weighted expression callers. */
  weights(smile:number,disappointed:number,blink:number):void{this.reset();this.set('smile',smile);this.set('disappointed',disappointed);this.set('blink',blink);}
  private reset():void{for(const[mesh,indices]of this.controlled)for(const index of indices)mesh.morphTargetInfluences![index]=0;}
}
