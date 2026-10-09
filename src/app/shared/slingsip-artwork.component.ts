import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SlingSipAssetLoader } from '../features/companion/animation/slingsip-asset-loader.service';
import type { SlingSipAssetKey } from '../features/companion/animation/slingsip-assets';
import { pngAsset } from '../features/companion/animation/slingsip-png-choreography';

let nextArtwork=0;
/** Static decorative use of the same approved PNGs and clipping as the companion. */
@Component({
  selector:'app-slingsip-artwork',changeDetection:ChangeDetectionStrategy.OnPush,
  template:`@if (art(); as image) {
    <svg class="approved-art" [attr.viewBox]="viewBox()" aria-hidden="true" data-testid="slingsip-hero-mascot" [attr.data-asset-key]="image.key" [attr.data-source-hash]="image.sourceSha256">
      <defs><clipPath [attr.id]="mask"><path [attr.d]="image.clipPath" clip-rule="evenodd"/></clipPath></defs>
      <image [attr.href]="image.src" [attr.width]="image.width" [attr.height]="image.height" [attr.clip-path]="'url(#'+mask+')'" (error)="loader.fail(image.key)"/>
    </svg>
  } @else { <img class="brand-fallback" src="slingsip-logo.svg" alt="" aria-hidden="true"/> }`,
  styles:[`:host{display:block;pointer-events:none}.approved-art{display:block;width:100%;height:100%;filter:drop-shadow(0 6px 6px var(--slingsip-shadow)) drop-shadow(0 0 6px var(--slingsip-glow-primary))}.brand-fallback{display:block;width:64px;height:64px;margin:50px auto}`],
})
export class SlingSipArtworkComponent {
  readonly loader=inject(SlingSipAssetLoader);
  readonly pose=input<SlingSipAssetKey>('idle');
  readonly mask='slingsip-artwork-'+nextArtwork++;
  readonly art=computed(()=>{const key=this.loader.select(this.pose());return key?pngAsset(key):null;});
  readonly viewBox=computed(()=>{const b=this.art()?.bounds;return b?`${b.x-12} ${b.y-12} ${b.width+24} ${b.height+24}`:'0 0 160 220';});
  constructor(){void this.loader.load();}
}
