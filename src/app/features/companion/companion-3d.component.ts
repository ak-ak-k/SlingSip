import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { SwingAnimationService } from './animation/swing-animation.service';
import { COMPANION_3D_ASSETS } from './three/companion-3d-assets';
import { CompanionVisualHitTestService } from './three/companion-visual-hit-test.service';
import type { Companion3DSceneController } from './three/companion-3d-scene';

@Component({selector:'app-companion-3d',changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<canvas #canvas class="companion-3d" data-testid="companion-3d" role="img" aria-label="SlingSip rigged 3D hydration sidekick" [class.is-arriving]="motion.reducedMotion() && motion.state.current() === 'reminder'" [class.is-exiting]="motion.reducedMotion() && (motion.state.current() === 'swinging-out-right' || motion.state.current() === 'swinging-back-left')" (contextmenu)="$event.preventDefault()"></canvas><span #feedback class="water-feedback" aria-hidden="true" data-testid="3d-water-feedback">{{waterFeedback()}}</span>`,
  styles:[`:host{position:absolute;inset:0;display:block;pointer-events:none}.companion-3d{position:absolute;inset:0;width:100%;height:100%;background:transparent;pointer-events:none}.water-feedback{position:absolute;opacity:0;white-space:nowrap;color:#a7ffe4;font:700 17px system-ui;text-shadow:0 1px 5px #071c24;pointer-events:none}.is-arriving{animation:three-arrival 260ms ease-out both;animation-duration:260ms!important}.is-exiting{animation:three-exit 260ms ease-in both;animation-duration:260ms!important}@keyframes three-arrival{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}@keyframes three-exit{to{opacity:0;translate:0 -10px}}`],
})
export class Companion3DComponent {
  readonly waterFeedback=input('+water');readonly readyChange=output<boolean>();
  readonly motion=inject(SwingAnimationService);private readonly assets=inject(COMPANION_3D_ASSETS);
  private readonly hitTest=inject(CompanionVisualHitTestService);private readonly destroy=inject(DestroyRef);
  private readonly canvas=viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');private readonly feedback=viewChild.required<ElementRef<HTMLElement>>('feedback');
  private scene?:Companion3DSceneController;
  constructor(){
    this.destroy.onDestroy(this.motion.onFrame(()=>this.update()));
    this.destroy.onDestroy(this.motion.onView((look,reaction)=>this.scene?.view(look,reaction)));
    afterRenderEffect(()=>{this.motion.state.current();this.motion.viewport();this.motion.active();this.motion.preferences();this.motion.reducedMotion();this.update();});
    afterNextRender(()=>{void this.initialize();});
    const click=(event:MouseEvent)=>{if(event.target instanceof Element&&event.target.closest('[data-overlay-interactive]'))return;if(this.scene?.hit(event.clientX,event.clientY))this.motion.reactToClick();};
    document.addEventListener('click',click);this.destroy.onDestroy(()=>document.removeEventListener('click',click));
    this.destroy.onDestroy(()=>this.scene?.dispose());
  }
  private async initialize():Promise<void>{
    try{
      const {Companion3DSceneController}=await import('./three/companion-3d-scene');if(this.destroy.destroyed)return;
      this.scene=new Companion3DSceneController(this.canvas().nativeElement,this.assets,bottle=>{
        const node=this.feedback().nativeElement;node.style.left=bottle.x+'px';node.style.top=bottle.y-22+'px';node.style.opacity=String(bottle.feedback);node.style.transform='translate(-50%, '+(-12*bottle.feedback)+'px)';
      });
      this.scene.onFailure=reason=>{this.canvas().nativeElement.dataset['fallbackReason']=reason;this.readyChange.emit(false);};
      this.update();const loaded=await this.scene.load();if(this.destroy.destroyed||!loaded)return;
      this.destroy.onDestroy(this.hitTest.register((x,y)=>this.scene?.hit(x,y)??false));this.readyChange.emit(true);this.update();
    }catch(error){if(this.destroy.destroyed)return;this.scene?.dispose();this.canvas().nativeElement.dataset['fallbackReason']=error instanceof Error?error.message:'3D unavailable';this.readyChange.emit(false);}
  }
  private update():void{
    this.scene?.update({...this.motion.frame(),state:this.motion.state.current(),variant:this.motion.variant(),layout:this.motion.layout(),active:this.motion.active(),reduced:this.motion.reducedMotion(),lowPower:this.motion.preferences().lowPowerAnimations,reactions:this.motion.preferences().characterReactions});
  }
}
