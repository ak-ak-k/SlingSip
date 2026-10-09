import { AnimationMixer, LoopOnce, PropertyBinding, type AnimationAction, type AnimationClip, type Object3D } from 'three';

export const ANIMATION_ALIASES = {
  SwingIn:['SwingIn','swing-in','swing','swing-down'],
  ArriveSettle:['ArriveSettle','arrive-settle','settle','arrive'],
  AskGesture:['AskGesture','ask-gesture','asking','ask'],
  Smile:['Smile','smile-pose','success','happy'],
  WebShoot:['WebShoot','web-shoot','web-shot'],
  BottlePresent:['BottlePresent','bottle-present','bottle-hold'],
  Success:['Success','celebrate','celebration','happy'],
  SwingExitRight:['SwingExitRight','exit-right','exit-swing','swing-out-right'],
  SwingExitLeft:['SwingExitLeft','exit-left','exit-swing','swing-back-left'],
  Wait:['Wait','waiting','hanging','idle'],
  Disappointed:['Disappointed','sad','disappointment'],
  Idle:['Idle','hanging','idle'],
  'swing-grab':['swing-grab','SwingGrab'],
  'swing-down':['swing-down','SwingDown'],
  'swing-bottom':['swing-bottom','SwingBottom'],
  'swing-up':['swing-up','SwingUp'],
  release:['release','SwingRelease'],
  'mid-air':['mid-air','FreeFlight','MidAir'],
  attach:['attach','WebAttach'],
  retract:['retract','WebRetract'],
  hanging:['hanging','Idle','Wait'],
} as const;
export type CharacterAnimationRole = keyof typeof ANIMATION_ALIASES;
export const normalizeAssetName=(name:string)=>name.split(/[|:]/).at(-1)!.replace(/[^a-z0-9]/gi,'').toLowerCase();
const alternatives:Partial<Record<CharacterAnimationRole,CharacterAnimationRole[]>>={
  ArriveSettle:['Idle'],AskGesture:['Idle'],Smile:['Success','Idle'],WebShoot:['AskGesture','Idle'],
  BottlePresent:['AskGesture','Idle'],Success:['Smile','Idle'],Wait:['Idle'],Disappointed:['Wait','Idle'],
  SwingExitRight:['SwingIn'],SwingExitLeft:['SwingExitRight','SwingIn'],Idle:['Wait','AskGesture','SwingIn'],
  'swing-grab':['SwingIn'],'swing-down':['SwingIn'],'swing-bottom':['SwingIn'],'swing-up':['SwingIn'],
  release:['SwingIn'],'mid-air':['SwingIn'],attach:['SwingIn'],retract:['BottlePresent'],hanging:['Idle'],
};

/** Samples in-place body clips against the existing motion clock; never moves the overlay. */
export class CharacterAnimationController {
  readonly mixer:AnimationMixer;
  readonly mapping:Partial<Record<CharacterAnimationRole,string>>={};
  readonly missing:CharacterAnimationRole[]=[];
  readonly strippedTracks:string[]=[];
  readonly unboundTracks:string[]=[];
  readonly warnings:string[]=[];
  private readonly actions=new Map<string,AnimationAction>();
  private current?:AnimationAction;
  constructor(readonly root:Object3D,clips:readonly AnimationClip[],aliases:Partial<Record<string,readonly string[]>>={},rootMotionNodes:readonly string[]=[]){
    this.mixer=new AnimationMixer(root);
    const rootNames=new Set(rootMotionNodes.map(normalizeAssetName));
    // Preserve hips/limb animation. Only scene/export roots lose baked transforms.
    const roots=new Set<Object3D>([root]);
    root.traverse(node=>{if(rootNames.has(normalizeAssetName(node.name)))roots.add(node);});
    for(const source of clips){
      const clip=source.clone();
      clip.tracks=clip.tracks.filter(track=>{
        const parsed=PropertyBinding.parseTrackName(track.name);
        const node=PropertyBinding.findNode(root,parsed.nodeName) as Object3D|null;
        if(!node){this.unboundTracks.push(track.name);return false;}
        if(roots.has(node)&&['position','quaternion','scale'].includes(parsed.propertyName)){this.strippedTracks.push(track.name);return false;}
        return true;
      });
      if(!clip.tracks.length){this.warnings.push('No usable in-place tracks in '+source.name);continue;}
      if(this.actions.has(source.name)){this.warnings.push('Duplicate clip name: '+source.name);continue;}
      this.actions.set(source.name,this.mixer.clipAction(clip).setLoop(LoopOnce,1));
    }
    if(!this.actions.size)throw new Error('Character has no usable in-place animation clips.');
    for(const role of Object.keys(ANIMATION_ALIASES) as CharacterAnimationRole[]){
      const candidates=[...(aliases[role]??[]),...ANIMATION_ALIASES[role]];
      let found:string|undefined;
      for(const candidate of candidates){
        if(this.actions.has(candidate)){found=candidate;break;}
        const matches=[...this.actions.keys()].filter(key=>normalizeAssetName(key)===normalizeAssetName(candidate));
        if(matches.length){found=matches[0];if(matches.length>1)this.warnings.push('Ambiguous '+role+' alias '+candidate+': '+matches.join(', ')+'; using '+found);break;}
      }
      if(found)this.mapping[role]=found;else this.missing.push(role);
    }
    if(!this.mapping.SwingIn)throw new Error('Missing body swing animation (SwingIn or swing-down).');
    for(let i=0;i<3;i++)for(const role of this.missing){
      if(!this.mapping[role])this.mapping[role]=(alternatives[role]??[]).map(key=>this.mapping[key]).find(Boolean);
    }
    for(const role of this.missing)this.warnings.push('Missing '+role+'; '+(this.mapping[role]?'using '+this.mapping[role]:'no compatible pose'));
  }
  hasSpecific(role:CharacterAnimationRole):boolean{return !!this.mapping[role]&&!this.missing.includes(role);}
  sample(role:CharacterAnimationRole|string,progress:number):string{
    const name=this.mapping[role as CharacterAnimationRole]??(this.actions.has(role)?role:this.mapping.Idle)??this.mapping.SwingIn!;
    const action=this.actions.get(name)!;
    if(this.current!==action){this.current?.stop();this.current=action;action.reset();action.clampWhenFinished=true;action.play();}
    action.paused=false;action.time=Math.max(0,Math.min(.999999,progress))*action.getClip().duration;
    this.mixer.update(0);return name;
  }
  dispose():void{this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);}
}
