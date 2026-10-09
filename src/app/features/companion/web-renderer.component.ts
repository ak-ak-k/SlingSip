import { afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { SwingAnimationService } from './animation/swing-animation.service';
import { SlingSipAssetLoader } from './animation/slingsip-asset-loader.service';
import { pngBottle, pngWebs } from './animation/slingsip-png-choreography';
import { webPath } from './animation/web-geometry';

@Component({
  selector: 'app-web-renderer', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (motion.state.visible()) {
    <svg class="web-canvas" aria-hidden="true" [attr.viewBox]="'0 0 ' + motion.viewport().width + ' ' + motion.viewport().height">
      <path class="web-shadow"/><path class="swing-web" data-testid="swing-web"/>
      <path class="released-web"/><path class="bottle-web"/>
    </svg>
  }`,
  styles: [`:host { display:contents;pointer-events:none } .web-canvas { position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none }
    path { fill:none;stroke:var(--slingsip-web);stroke-width:1.5;stroke-linecap:round;pointer-events:none } .web-shadow { stroke:var(--slingsip-shadow);stroke-width:3 } .bottle-web { stroke:var(--slingsip-web);stroke-width:1.4 }`],
})
export class WebRendererComponent {
  readonly motion = inject(SwingAnimationService);
  private readonly assets = inject(SlingSipAssetLoader);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  constructor() {
    const unsubscribe = this.motion.onFrame(() => this.render());
    inject(DestroyRef).onDestroy(unsubscribe);
    afterRenderEffect(() => { this.motion.state.current(); this.motion.viewport(); this.motion.preferences(); this.motion.reducedMotion(); this.assets.failedKeys(); this.render(); });
  }
  private render(): void {
    const { pose, bottleProgress, progress } = this.motion.frame();
    const webs = pngWebs(this.motion.layout(),pose,this.motion.state.current(),progress,this.motion.variant(),this.motion.reducedMotion(),key=>this.assets.select(key));
    const low = this.motion.preferences().lowPowerAnimations;
    const strand = (selector: string, a: { x:number;y:number }, b: { x:number;y:number }, opacity: number, curvature = 1) => {
      const node = this.host.nativeElement.querySelector(selector); if (!node) return;
      node.setAttribute('d', webPath(a, b, low || this.motion.reducedMotion() ? 0 : curvature));
      // Keep endpoint metadata for diagnostics; SVG geometry uses the curved path above.
      for (const [key,value] of Object.entries({ x1:a.x,y1:a.y,x2:b.x,y2:b.y,opacity })) node.setAttribute(key, String(value));
    };
    const bend = this.motion.state.direction() === 'left' ? -1 : 1;
    strand('.swing-web', webs.main.a, webs.main.b, webs.main.opacity * this.motion.config.webOpacity, bend);
    strand('.web-shadow', webs.main.a, webs.main.b, low ? 0 : webs.main.opacity * .16, bend);
    strand('.released-web', webs.old.a, webs.old.b, webs.old.opacity * .4, -bend);
    const bottle = pngBottle(this.motion.layout(),pose,this.motion.state.current(),progress,bottleProgress,this.motion.variant(),key=>this.assets.select(key));
    strand('.bottle-web', bottle.start, bottle, this.assets.select('bottle') ? bottle.webOpacity * .72 : 0, .45 * (Math.sign(bottle.rotation) || 1));
  }
}
