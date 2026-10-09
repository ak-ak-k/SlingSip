import { afterNextRender, ChangeDetectionStrategy, Component, effect, ElementRef, DestroyRef, inject, untracked, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DesktopService } from '../../core/services/desktop.service';
import { CompanionCharacterComponent } from './companion-character.component';
import { CompanionInputService } from './companion-input.service';
import { SpeechBubbleComponent } from './speech-bubble.component';
import { SwingAnimationService } from './animation/swing-animation.service';
import { CharacterStateService } from './animation/character-state.service';
import { AudioService } from './animation/audio.service';
import { ReminderInteractionService } from './reminder-interaction.service';
import { CompanionVisualHitTestService } from './three/companion-visual-hit-test.service';

@Component({
  selector: 'app-companion',
  imports: [CompanionCharacterComponent, SpeechBubbleComponent, DecimalPipe],
  providers: [AudioService, CompanionInputService, SwingAnimationService, CharacterStateService, ReminderInteractionService, CompanionVisualHitTestService],
  templateUrl: './companion.component.html',
  styleUrl: './companion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanionComponent {
  readonly desktop = inject(DesktopService);
  readonly animation = inject(SwingAnimationService);
  readonly reminder = inject(ReminderInteractionService);
  private readonly input = inject(CompanionInputService);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');

  constructor() {
    effect(() => {
      const visible = this.desktop.overlayVisible();
      const ready = this.animation.ready();
      untracked(() => {
        const snapshot = this.desktop.snapshot();
        const area = snapshot?.overlay.bounds ?? snapshot?.display.workArea;
        const dashboard = snapshot?.dashboardBounds;
        const viewport = this.animation.viewport();
        const sx = area?.width && viewport.width ? viewport.width / area.width : 1;
        const sy = area?.height && viewport.height ? viewport.height / area.height : 1;
        this.animation.setDashboardBounds(area && dashboard ? { x: (dashboard.x - area.x) * sx, y: (dashboard.y - area.y) * sy,
          width: dashboard.width * sx, height: dashboard.height * sy } : null);
        if (!visible) this.reminder.cancel();
        else if (ready) {
          const visibilityRevision = this.desktop.snapshot()!.overlay.visibilityRevision;
          void this.reminder.start(visibilityRevision);
        }
      });
    });
    effect(() => {
      const snapshot = this.desktop.snapshot();
      if (snapshot) untracked(() => { this.animation.configure(snapshot.companionPreferences); this.animation.setActive(snapshot.displayActive && snapshot.overlay.visible && !document.hidden); });
    });
    const visibility = () => { this.animation.setActive((this.desktop.snapshot()?.displayActive ?? true) && this.desktop.overlayVisible() && !document.hidden); this.input.refreshTargets(); };
    document.addEventListener('visibilitychange', visibility);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', visibility));
    afterNextRender(() => this.input.connect(this.stage().nativeElement));
    effect(() => {
      this.reminder.bubbleVisible();
      untracked(() => this.input.refreshTargets());
    });
  }
}
