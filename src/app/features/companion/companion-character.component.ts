import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { SwingAnimationService } from './animation/swing-animation.service';
import { bodyCue } from './animation/body-choreography';
import { CharacterState } from './animation/character.model';
import { WebRendererComponent } from './web-renderer.component';
import { SlingSipPngRendererComponent } from './animation/slingsip-png-renderer.component';
import { SlingSipAssetLoader } from './animation/slingsip-asset-loader.service';
import { SLINGSIP_ASSETS } from './animation/slingsip-assets';
import { pngAsset, pngBottle, pngRenderPose, pngWebs } from './animation/slingsip-png-choreography';

@Component({ selector: 'app-companion-character', imports: [WebRendererComponent, SlingSipPngRendererComponent], templateUrl: './companion-character.component.html', styleUrl: './companion-character.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class CompanionCharacterComponent {
  readonly animation = inject(SwingAnimationService);
  readonly assets = inject(SlingSipAssetLoader);
  readonly assetProbe = SLINGSIP_ASSETS.idle;
  readonly pngReady = computed(() => this.assets.status() !== 'loading');
  readonly bottleAsset = pngAsset('bottle');
  readonly waterFeedback = input('+water');
  readonly feedback = computed(() => this.waterFeedback().match(/\+\d+\s*ml/)?.[0] ?? '+water');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly grip = computed(() => ({ x: this.animation.dimensions().width * this.animation.config.gripXRatio, y: this.animation.dimensions().height * this.animation.config.gripYRatio }));
  readonly transform = computed(() => { const pose = this.visualPose(), grip = this.grip(); return `translate3d(${pose.x - grip.x}px, ${pose.y - grip.y}px, 0) rotate(${pose.rotation}deg)`; });
  private clickEffects: Animation[] = [];
  private reactionTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    void this.assets.load();
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => { if(this.reactionTimer!==undefined)clearTimeout(this.reactionTimer);this.clickEffects.forEach(effect=>effect.cancel()); });
    destroy.onDestroy(this.animation.onFrame(() => this.render()));
    destroy.onDestroy(this.animation.onView((look, reaction) => {
      const character = this.host.nativeElement.querySelector<HTMLElement>('.character'); if (!character) return;
      character.style.setProperty('--look-head', look.x * this.animation.config.cursorHeadDegrees + 'deg');
      character.style.setProperty('--look-x', look.x * this.animation.config.cursorLensPx + 'px');
      character.style.setProperty('--look-y', look.y * this.animation.config.cursorLensPx + 'px');
      character.dataset['look'] = look.x + ',' + look.y;
      if (reaction) {
        if(this.reactionTimer!==undefined)clearTimeout(this.reactionTimer);
        this.reactionTimer=setTimeout(()=>{delete character.dataset['reaction'];this.reactionTimer=undefined;},this.animation.config.reactionMs);
        character.dataset['reaction'] = reaction;
        this.clickEffects.forEach(effect => effect.cancel()); this.clickEffects = [];
        if (!this.animation.reducedMotion()) {
          const degrees = reaction === 'nod' ? this.animation.config.clickNodDegrees : reaction === 'playful' ? this.animation.config.clickPlayfulDegrees : this.animation.config.clickAnnoyedDegrees;
          this.clickEffects = Array.from(character.querySelectorAll<SVGElement>('.head')).map(head => head.animate([{ transform:'rotate(0deg)' },{ transform:'rotate(' + degrees + 'deg)' },{ transform:'rotate(0deg)' }], { duration:this.animation.config.reactionMs,easing:'ease-in-out' }));
          if (this.clickEffects[0]) this.clickEffects[0].onfinish = () => { delete character.dataset['reaction']; };
        }
      }
    }));
    afterRenderEffect(() => { this.animation.state.current(); this.animation.viewport(); this.animation.bottleProgress();
      this.animation.reducedMotion(); this.pngReady(); this.assets.failedKeys();
      this.clickEffects.forEach(effect => { if (!this.animation.active()) effect.pause(); else if (effect.playState === 'paused') effect.play(); if (!this.animation.state.visible()) effect.cancel(); });
      this.render(); });
    afterNextRender(() => {
      const stage = this.host.nativeElement.parentElement!;
      const resize = () => this.animation.resize(stage.clientWidth, stage.clientHeight);
      resize(); const observer = new ResizeObserver(resize); observer.observe(stage);
      destroy.onDestroy(() => { observer.disconnect(); this.animation.cancelCurrentAnimation(); });
    });
  }
  private visualPose() {
    const frame = this.animation.frame();
    return this.pngReady() ? pngRenderPose(frame.pose, this.animation.state.current(), frame.progress, this.animation.variant()) : this.animation.pose();
  }
  private render(): void {
    const { pose, bottleProgress, progress } = this.animation.frame(), grip = this.grip();
    const visual = this.pngReady() ? pngRenderPose(pose, this.animation.state.current(), progress, this.animation.variant()) : pose;
    const cue = bodyCue(this.animation.state.current(), progress, this.animation.reducedMotion());
    const character = this.host.nativeElement.querySelector<HTMLElement>('.character'); if (!character) return;
    character.style.transform = `translate3d(${visual.x - grip.x}px, ${visual.y - grip.y}px, 0) rotate(${visual.rotation}deg)`;
    character.dataset['x'] = String(pose.x); character.dataset['y'] = String(pose.y); character.dataset['rotation'] = String(visual.rotation);
    character.dataset['bodyState'] = cue.state; character.dataset['bodyProgress'] = String(cue.progress);
    character.dataset['webStage'] = pngWebs(this.animation.layout(), pose, this.animation.state.current(), progress, this.animation.variant(), this.animation.reducedMotion(), key => this.assets.select(key)).stage;
    const bottle = pngBottle(this.animation.layout(), pose, this.animation.state.current(), progress, bottleProgress, this.animation.variant(), key => this.assets.select(key)), node = this.host.nativeElement.querySelector<SVGElement>('.bottle');
    const aspect = this.bottleAsset.bounds.width / this.bottleAsset.bounds.height;
    if (node) { node.style.width = bottle.size * aspect + 'px'; node.style.height = bottle.size + 'px'; node.style.left = bottle.x - bottle.size * aspect / 2 + 'px'; node.style.top = bottle.y + 'px'; node.style.opacity = String(bottle.opacity); node.style.transform = 'rotate(' + bottle.rotation + 'deg)'; node.dataset['rotation'] = String(bottle.rotation); }
    if (node) node.dataset['deliveryStage'] = bottle.stage;
    const feedback = this.host.nativeElement.querySelector<HTMLElement>('.water-feedback');
    if (feedback) { feedback.style.left = bottle.x + 'px'; feedback.style.top = bottle.y - 22 + 'px'; feedback.style.opacity = String(bottle.feedback); feedback.style.transform = 'translate(-50%, ' + (-12*bottle.feedback) + 'px)'; }
  }
}
