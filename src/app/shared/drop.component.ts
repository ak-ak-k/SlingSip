import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-drop',
  template: `
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 8C27 17 13 29 13 40a19 19 0 0 0 38 0C51 29 37 17 32 8Z" fill="currentColor" />
      <path d="M22 40a10 10 0 0 0 10 10" stroke="var(--drop-detail, var(--slingsip-ink))" stroke-width="3.5" stroke-linecap="round" />
      <circle cx="41" cy="35" r="2" fill="var(--drop-detail, var(--slingsip-ink))" opacity=".3" />
    </svg>
  `,
  styles: [':host { display: block; } svg { display: block; width: 100%; height: 100%; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropComponent {}
