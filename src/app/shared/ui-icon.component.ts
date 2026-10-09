import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const paths = {
  drop: 'M12 3C9 7 5 10 5 14a7 7 0 0 0 14 0c0-4-4-7-7-11ZM8 14a4 4 0 0 0 4 4',
  clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  flame: 'M12 3c2 4-1 6 2 8 1-1 2-2 2-4 4 4 4 7 4 9a8 8 0 0 1-16 0c0-3 2-6 5-9-1 4 1 5 3 6 2-3 1-5 0-10Z',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 4 12 8-12 8Z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  settings: 'M4 7h16M4 17h16M12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM18 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  desktop: 'M4 4h16v12H4ZM8 21h8M12 16v5',
  check: 'm5 12 4 4L19 6',
  bell: 'M5 16h14l-2-3V9a5 5 0 0 0-10 0v4l-2 3Zm5 4h4',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
} as const;
@Component({
  selector: 'app-ui-icon',
  template: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path [attr.d]="path()" /></svg>',
  styles: ':host{display:inline-flex;width:20px;height:20px;flex-shrink:0}svg{width:100%;height:100%;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiIconComponent {
  readonly name = input<keyof typeof paths>('drop');
  readonly path = computed(() => paths[this.name()]);
}
