import { InjectionToken } from '@angular/core';

export interface Companion3DAssets {
  character: string; bottle: string; temporary: boolean;
  /** Model coordinates: Y up, Z toward viewer; origin is the raised web hand. */
  characterHeight: number;
  nodes: {grip:string;freeHand:string;boot:string;head:string;chest:string};
  morphs: {blink:string;smile:string;frown:string};
  /** Discover aliases without coupling model export names to reminder states. */
  clips?: Partial<Record<string,readonly string[]>>;
  nodeAliases?: Partial<Record<keyof Companion3DAssets['nodes'],readonly string[]>>;
  morphAliases?: Partial<Record<string,readonly string[]>>;
  rootMotionNodes?: readonly string[];
  normalize?: boolean;
  bottleAnchor?: string;
  fallback?: Companion3DAssets;
}
export const PLACEHOLDER_3D_ASSETS:Companion3DAssets={
  character:'assets/character/temporary-3d/guardian.glb',bottle:'assets/character/temporary-3d/bottle.glb',temporary:true,
  characterHeight:2.2,nodes:{grip:'WebGrip',freeHand:'BottleGrip',boot:'Foot_L',head:'Head',chest:'Chest'},
  morphs:{blink:'blink',smile:'smile',frown:'frown'},
};
export const SLINGSIP_3D_ASSETS:Companion3DAssets={
  ...PLACEHOLDER_3D_ASSETS,
  character:'assets/3d/character/slingsip-character.glb',
  bottle:'assets/3d/props/slingsip-bottle.glb',
  temporary:false,normalize:true,fallback:PLACEHOLDER_3D_ASSETS,
};
export const COMPANION_3D_ASSETS=new InjectionToken<Companion3DAssets>('COMPANION_3D_ASSETS',{factory:()=>SLINGSIP_3D_ASSETS});
