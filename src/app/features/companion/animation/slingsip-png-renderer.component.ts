import { afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { SwingAnimationService } from './swing-animation.service';
import { CharacterState } from './character.model';
import { SLINGSIP_ASSET_ENTRIES, type SlingSipAssetKey } from './slingsip-assets';
import { SlingSipAssetLoader } from './slingsip-asset-loader.service';
import { pngAsset, pngPose } from './slingsip-png-choreography';

let nextMask=0;
@Component({
  selector:'app-slingsip-png-renderer',changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<svg class="mascot slingsip-png" viewBox="0 0 160 220" role="img" aria-label="SlingSip hooded hydration sidekick" data-testid="slingsip-png" data-asset-pack="slingsip-production-png" data-temporary="false">
    <defs>
      @for(asset of assets;track asset.key){<clipPath [attr.id]="mask+asset.key" clipPathUnits="userSpaceOnUse"><path [attr.d]="asset.clipPath" clip-rule="evenodd"/></clipPath>}
      <clipPath [attr.id]="mask+'body-cut'"><rect x="-150" y="120" width="600" height="200"/></clipPath>
    </defs>
    <g class="head png-look">
      <g class="previous-pose" style="opacity:0;visibility:hidden"></g>
      <g class="current-pose">
        <g class="body-cut"><g class="body-art"><image class="pose-image" (error)="failed($event)"/></g></g>
        <g class="disappointed-head"><g class="face-art"><image class="face-image" (error)="failed($event)"/></g></g>
        <image class="brand-fallback" href="slingsip-logo.svg" x="85" y="32" width="80" height="80" style="display:none"/>
        <path class="body-hit sprite-hit" fill="transparent"/>
        <path class="face-hit sprite-hit" fill="transparent"/>
      </g>
    </g>
  </svg>`,
  styles:[`:host{display:block;width:100%;height:100%;pointer-events:none}
    .mascot{display:block;width:100%;height:100%;overflow:visible;pointer-events:none;transform-origin:78.125% 10%;filter:drop-shadow(0 5px 5px var(--slingsip-shadow)) drop-shadow(0 0 2px var(--slingsip-glow-primary))}
    image{pointer-events:none}.sprite-hit{pointer-events:var(--painted-pointer,none);fill-rule:evenodd}
    .png-look{transform-box:view-box;transform-origin:var(--web-grip-x,125px) var(--web-grip-y,22px);transform:rotate(calc(var(--look-head,0deg)*.18));transition:transform var(--cursor-time,160ms)}
    :host(.low-power) .mascot{filter:none}:host(.waiting) .disappointed-head{transform-box:view-box;transform-origin:125px 110px;animation:disappointed-nod 380ms ease-in-out}
    @keyframes disappointed-nod{0%,100%{transform:rotate(0deg)}50%{transform:rotate(2deg)}}
    :host(.inactive) *{animation-play-state:paused!important}
    @media(prefers-reduced-motion:reduce){.png-look{transition:none}.disappointed-head{animation:none!important}}`],
  host:{'[class.low-power]':'motion.preferences().lowPowerAnimations','[class.inactive]':'!motion.active()','[class.waiting]':"motion.state.current() === 'waiting'"},
})
export class SlingSipPngRendererComponent {
  readonly motion=inject(SwingAnimationService);private readonly loader=inject(SlingSipAssetLoader);
  readonly mask='slingsip-mask-'+nextMask+++'-';readonly assets=Object.keys(SLINGSIP_ASSET_ENTRIES).map(key=>pngAsset(key as SlingSipAssetKey));
  private readonly host=inject<ElementRef<HTMLElement>>(ElementRef);
  private key='';private idle?:Animation;private fades:Animation[]=[];private restKey='';
  constructor(){
    inject(DestroyRef).onDestroy(this.motion.onFrame(()=>this.render()));
    afterRenderEffect(()=>{this.motion.state.current();this.motion.active();this.motion.preferences();this.motion.reducedMotion();this.loader.failedKeys();this.render();this.rest();});
    inject(DestroyRef).onDestroy(()=>{this.idle?.cancel();this.fades.forEach(effect=>effect.cancel());});
  }
  failed(event:Event):void{
    const key=(event.target as SVGImageElement).dataset['assetKey'] as SlingSipAssetKey|undefined;
    if(key)this.loader.fail(key,'Rendered SlingSip PNG failed to load.');
  }
  render():void{
    const svg=this.host.nativeElement.querySelector<SVGSVGElement>('svg');if(!svg)return;
    const sample=this.motion.frame(),frame=pngPose(this.motion.state.current(),sample.progress,this.motion.variant(),this.motion.reducedMotion(),key=>this.loader.select(key));
    Object.assign(svg.dataset,{pose:frame.head??frame.key,bodyFrame:String(frame.index),phaseProgress:String(sample.progress),handX:String(frame.anchors.freeHand.x),handY:String(frame.anchors.freeHand.y),gripX:'125',gripY:'22',webGripX:String(frame.anchors.webGrip.x),webGripY:String(frame.anchors.webGrip.y),hitX:String(frame.anchors.hit.x),hitY:String(frame.anchors.hit.y)});
    svg.style.setProperty('--web-grip-x',`${frame.anchors.webGrip.x}px`);svg.style.setProperty('--web-grip-y',`${frame.anchors.webGrip.y}px`);
    svg.style.transformOrigin=`${frame.anchors.webGrip.x/160*100}% ${frame.anchors.webGrip.y/220*100}%`;
    const key=[frame.key,frame.head,frame.mirror,frame.missing].join(':');if(key===this.key)return;
    const current=svg.querySelector<SVGGElement>('.current-pose')!,previous=svg.querySelector<SVGGElement>('.previous-pose')!;
    this.fades.forEach(effect=>effect.cancel());this.fades=[];
    previous.replaceChildren(...Array.from(current.children).map(node=>node.cloneNode(true)));
    previous.querySelectorAll('.sprite-hit').forEach(node=>node.remove());previous.style.pointerEvents='none';previous.style.visibility=this.key?'visible':'hidden';
    previous.setAttribute('transform',current.getAttribute('transform')??'');
    current.setAttribute('transform',frame.mirror?'translate(250 0) scale(-1 1)':'');
    const apply=(selector:string,key:SlingSipAssetKey)=>{
      const geometry=pngAsset(key),group=current.querySelector<SVGGElement>(selector)!;
      group.setAttribute('transform',`translate(${geometry.transform.x} ${geometry.transform.y}) scale(${geometry.transform.scale})`);
      group.setAttribute('clip-path',`url(#${this.mask+key})`);
      const image=group.querySelector('image')!;image.setAttribute('href',geometry.src);image.setAttribute('data-asset-key',key);image.setAttribute('width',String(geometry.width));image.setAttribute('height',String(geometry.height));
    };
    current.querySelector<SVGGElement>('.body-cut')!.style.display=frame.missing?'none':'';
    current.querySelector<SVGImageElement>('.brand-fallback')!.style.display=frame.missing?'':'none';
    if(!frame.missing)apply('.body-art',frame.key);
    current.querySelector('.body-cut')!.setAttribute('clip-path',frame.head?`url(#${this.mask}body-cut)`:'');
    current.querySelector('.body-hit')!.setAttribute('d',frame.missing?'M125 38a34 34 0 1 0 0 68a34 34 0 1 0 0-68Z':frame.geometry.hitPath);
    current.querySelector('.body-hit')!.setAttribute('clip-path',frame.head?`url(#${this.mask}body-cut)`:'');
    const head=current.querySelector<SVGGElement>('.disappointed-head')!,headHit=current.querySelector<SVGPathElement>('.face-hit')!;
    head.style.display=frame.head?'':'none';headHit.style.display=frame.head?'':'none';
    if(frame.head){apply('.face-art',frame.head);headHit.setAttribute('d',pngAsset(frame.head).hitPath);}
    if(this.key&&!this.motion.reducedMotion()&&!this.motion.preferences().lowPowerAnimations){
      this.fades=[previous.animate([{opacity:1},{opacity:0}],{duration:90,fill:'forwards'}),current.animate([{opacity:0},{opacity:1}],{duration:90,fill:'forwards'})];
      this.fades[0].onfinish=()=>{previous.style.visibility='hidden';};
    }else{previous.style.visibility='hidden';current.style.opacity='1';}
    this.key=key;
  }
  private rest():void{
    const state=this.motion.state.current(),low=this.motion.preferences().lowPowerAnimations;
    const key=[state,this.motion.reducedMotion(),low].join(':');
    if(key!==this.restKey){this.restKey=key;this.idle?.cancel();this.idle=undefined;
      if(state===CharacterState.Reminder&&!this.motion.reducedMotion()){
        const svg=this.host.nativeElement.querySelector('svg')!,angle=this.motion.config.idleSwayDegrees*(low ? .65 : 1),breath=low?1.003:this.motion.config.idleBreathScale;
        this.idle=svg.animate([{transform:'rotate(0deg) scale(1)'},{transform:`rotate(${angle}deg) scale(${breath})`},{transform:'rotate(0deg) scale(1.002)'},{transform:`rotate(${-angle}deg) scale(${breath})`},{transform:'rotate(0deg) scale(1)'}],{duration:this.motion.config.idleSwayMs,iterations:Infinity,easing:'ease-in-out'});
      }
    }
    [this.idle,...this.fades].forEach(effect=>{if(!effect)return;if(!this.motion.active())effect.pause();else if(effect.playState==='paused')effect.play();});
  }
}
