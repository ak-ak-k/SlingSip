import { afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, InjectionToken, input } from '@angular/core';
import type { BodyAnimationPack, BodyAnimationState, BodyCue } from './body-animation.model';
import { TEMPORARY_BODY_PACK } from './temporary-body-pack';
import { spriteFrame } from './body-choreography';

/** Replace this provider with a final artwork pack; paths and business logic stay untouched. */
export const BODY_ANIMATION_PACK = new InjectionToken<BodyAnimationPack>('BODY_ANIMATION_PACK',{factory:()=>TEMPORARY_BODY_PACK});
@Component({
  selector:'app-body-sprite-renderer',changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<svg class="mascot" [attr.viewBox]="'0 0 '+pack.width+' '+pack.height" role="img" aria-label="Animated navy guardian with coral scarf and mint water emblem" [attr.data-asset-pack]="pack.id" [attr.data-temporary]="pack.temporary">
    <g class="controlled-frame">
      <use class="sprite-body"/><g class="head"><use class="sprite-head"/><image class="sprite-head-image" [attr.width]="pack.width" [attr.height]="pack.height"/></g>
      <image class="sprite-image" [attr.width]="pack.width" [attr.height]="pack.height"/>
      <path class="sprite-hit" fill="transparent"/>
    </g>
    @if (restClip(); as clip) {
      @for (frame of pack.clips[clip].frames;track $index) {
        <g class="rest-frame" [attr.data-rest-frame]="$index" style="opacity:0;visibility:hidden">
          @if (frame.body.kind === 'svg') { <use [attr.href]="frame.body.src"/> }
          @else { <image [attr.href]="frame.body.src" [attr.width]="pack.width" [attr.height]="pack.height"/> }
          @if (frame.head;as head) { <g class="head">@if (head.kind === 'svg') { <use [attr.href]="head.src"/> } @else { <image [attr.href]="head.src" [attr.width]="pack.width" [attr.height]="pack.height"/> }</g> }
          @if (frame.hitPath) { <path [attr.d]="frame.hitPath" fill="transparent" class="sprite-hit"/> }
        </g>
      }
    }
  </svg>`,
  styles:[`:host{display:block;width:100%;height:100%;pointer-events:none}
    .mascot{display:block;width:100%;height:100%;overflow:visible;transform-origin:78.125% 10%;filter:drop-shadow(0 5px 5px #06121d55);pointer-events:none}
    use,.sprite-hit{pointer-events:var(--painted-pointer,none)}image{pointer-events:none}
    .head{transform-origin:79px 91px;transform:rotate(var(--look-head,0deg));translate:var(--look-x,0px) var(--look-y,0px);transition:transform var(--cursor-time,160ms),translate var(--cursor-time,160ms)}
    :host(.hanging) .mascot{animation:hanging-sway var(--idle-sway-time,4200ms) ease-in-out infinite}
    :host(.paused) *{animation-play-state:paused!important}
    :host(.low-power) .mascot{filter:none}
    @keyframes hanging-sway{0%,100%{transform:rotate(0deg)}25%{transform:rotate(var(--idle-sway,.85deg))}75%{transform:rotate(calc(var(--idle-sway,.85deg)*-1))}}
    @media(prefers-reduced-motion:reduce){.mascot{animation:none!important}.head{transition:none}}
  `],
  host:{'[class.hanging]':"restClip() === 'idle' && !reduced()",'[class.paused]':'!active()','[class.low-power]':'lowPower()'},
})
export class BodySpriteRendererComponent {
  readonly pack = inject(BODY_ANIMATION_PACK);
  readonly restClip = input<BodyAnimationState | null>(null);
  readonly active = input(true); readonly reduced = input(false); readonly lowPower = input(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private effects:Animation[]=[];
  private restKey = '';
  private cue:BodyCue={state:'idle',progress:0,web:'second'};
  constructor() {
    afterRenderEffect(()=>{
      const clip = this.restClip(), reduced = this.reduced(), lowPower = this.lowPower(), active = this.active();
      const key = [clip,reduced,lowPower].join(':');
      if(key !== this.restKey) {this.restKey=key;this.startRest(clip,reduced||lowPower);}
      this.effects.forEach(effect=>{if(!active)effect.pause();else if(effect.playState==='paused')effect.play();});
      this.render(this.cue);
    });
    inject(DestroyRef).onDestroy(()=>this.effects.forEach(effect=>effect.cancel()));
  }
  /** Called by the existing finite motion clock. No second RAF or trajectory owner. */
  render(cue:BodyCue):void {
    this.cue=cue;
    const svg=this.host.nativeElement.querySelector('svg');if(!svg)return;
    const {frame,index}=spriteFrame(this.pack,cue);
    svg.dataset['bodyState']=cue.state;svg.dataset['bodyFrame']=String(index);
    svg.dataset['handX']=String(frame.anchors.freeHand.x);svg.dataset['handY']=String(frame.anchors.freeHand.y);
    svg.dataset['hitX']=String(frame.anchors.hit.x);svg.dataset['hitY']=String(frame.anchors.hit.y);
    svg.querySelector<SVGElement>('.controlled-frame')!.style.display=this.restClip()?'none':'';
    const body=svg.querySelector<SVGElement>('.sprite-body')!,head=svg.querySelector<SVGElement>('.sprite-head')!,headImage=svg.querySelector<SVGElement>('.sprite-head-image')!,image=svg.querySelector<SVGElement>('.sprite-image')!;
    body.style.display=frame.body.kind==='svg'?'':'none';image.style.display=frame.body.kind==='image'?'':'none';
    const source=frame.body.kind==='svg'?body:image;
    if(source.getAttribute('href')!==frame.body.src)source.setAttribute('href',frame.body.src);
    head.style.display=frame.head?.kind==='svg'?'':'none';headImage.style.display=frame.head?.kind==='image'?'':'none';
    const headSource=frame.head?.kind==='svg'?head:headImage;
    if(frame.head&&headSource.getAttribute('href')!==frame.head.src)headSource.setAttribute('href',frame.head.src);
    svg.querySelector('.sprite-hit')!.setAttribute('d',frame.hitPath??'');
  }
  private startRest(state:BodyAnimationState|null,still:boolean):void {
    this.effects.forEach(effect=>effect.cancel());this.effects=[];
    if(!state)return;
    const clip=this.pack.clips[state],nodes=this.host.nativeElement.querySelectorAll<SVGElement>('.rest-frame');
    nodes.forEach((node,i)=>{
      node.style.opacity=still?(i===0?'1':'0'):'0';node.style.visibility=still&&i===0?'visible':'hidden';if(still)return;
      const effect=clip.loop ? node.animate([{opacity:1,visibility:'visible',offset:0,easing:'steps(1,end)'},{opacity:0,visibility:'hidden',offset:1/clip.frames.length},{opacity:0,visibility:'hidden',offset:1}],
        {duration:clip.durationMs,delay:i*clip.durationMs/clip.frames.length,iterations:Infinity,easing:'linear',fill:'none'}) :
        node.animate([{opacity:1,visibility:'visible'},{opacity:i===nodes.length-1?1:0,visibility:i===nodes.length-1?'visible':'hidden'}],{duration:clip.durationMs/clip.frames.length,delay:i*clip.durationMs/clip.frames.length,easing:'steps(1,end)',fill:i===nodes.length-1?'forwards':'none'});
      this.effects.push(effect);
    });
  }
}
