import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type SpriteAnimation } from './character.model';

@Component({
  selector: 'app-sprite-animation',
  template: `<div class="sprite" [class.playing]="frame() === null" [class.once]="!clip().loop"
    [style.width.px]="clip().frameWidth" [style.height.px]="clip().frameHeight"
    [style.background-image]="image()" [style.background-position-x.px]="-(frame() ?? 0) * clip().frameWidth"
    [style.--frame-width]="clip().frameWidth + 'px'" [style.--frame-count]="clip().frameCount"
    [style.animation-duration.s]="clip().frameCount / (clip().fps * clip().playbackRate)"
    [style.animation-timing-function]="steps()" [style.transform]="scale()" data-testid="sprite-player"
    [attr.data-frame]="frame()" [attr.data-src]="clip().src"></div>`,
  styles: `
    :host { display: block; position: absolute; inset: 0; background: transparent; pointer-events: none; }
    .sprite { position: absolute; top: 0; left: 0; transform-origin: top left; background-repeat: no-repeat; }
    .playing { animation-name: sprite-loop; animation-iteration-count: infinite; }
    .playing.once { animation-name: sprite-once; animation-iteration-count: 1; animation-fill-mode: forwards; }
    @keyframes sprite-loop { to { background-position-x: calc(-1 * var(--frame-width) * var(--frame-count)); } }
    @keyframes sprite-once { to { background-position-x: calc(-1 * var(--frame-width) * (var(--frame-count) - 1)); } }
    @media (prefers-reduced-motion: reduce) { .playing { animation: none !important; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpriteAnimationComponent {
  readonly clip = input.required<SpriteAnimation>();
  readonly frame = input<number | null>(null);
  readonly height = input.required<number>();
  readonly image = computed(() => `url("${this.clip().src}")`);
  readonly scale = computed(() => `scale(${this.height() / this.clip().frameHeight})`);
  readonly steps = computed(() => `steps(${Math.max(1, this.clip().loop ? this.clip().frameCount : this.clip().frameCount - 1)})`);
}
