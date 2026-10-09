import { afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { validateDisplayName } from '../../../../shared/user-profile';
import { DesktopService } from '../../core/services/desktop.service';
import { LocalProfileService } from '../../core/services/local-profile.service';
import { OnboardingService } from '../onboarding/onboarding.service';

@Component({
  selector:'app-profile-chip', templateUrl:'./profile-chip.component.html',
  styleUrl:'./profile-chip.component.scss', changeDetection:ChangeDetectionStrategy.OnPush,
})
export class ProfileChipComponent {
  readonly desktop = inject(DesktopService);
  readonly profile = inject(LocalProfileService);
  readonly flow = inject(OnboardingService);
  readonly opened = signal(false);
  readonly view = signal<'profile'|'edit'|'reset'>('profile');
  readonly draft = signal('');
  readonly error = signal('');
  readonly resetDone = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: ResizeObserver;
  private pending = 0;
  constructor() {
    const outside = (event: PointerEvent) => {
      if (this.opened() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (this.opened() && event.key === 'Escape') this.keydown(event);
    };
    const update = () => {
      if (!this.opened() || this.pending) return;
      this.pending = requestAnimationFrame(() => { this.pending = 0; this.position(); });
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    document.addEventListener('scroll',update,true); window.addEventListener('resize',update);
    afterRenderEffect(() => {
      const open = this.opened(); this.view();
      const root = this.host.nativeElement, dialog = root.querySelector<HTMLDialogElement>('dialog');
      if (!dialog) return;
      if (open) {
        if (!dialog.open) dialog.show();
        this.position();
        this.observer ??= new ResizeObserver(update);
        this.observer.observe(dialog);
        root.querySelector<HTMLElement>(this.view()==='edit' ? '#edit-display-name' : this.view()==='reset' ? '[data-testid="cancel-profile-reset"]' : '[data-testid="edit-profile"]')?.focus({ preventScroll:true });
      } else dialog.close();
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.pending) cancelAnimationFrame(this.pending);
      this.observer?.disconnect();
      document.removeEventListener('pointerdown',outside); document.removeEventListener('scroll',update,true);
      document.removeEventListener('keydown',escape);
      window.removeEventListener('resize',update);
      this.host.nativeElement.querySelector<HTMLDialogElement>('dialog')?.close();
    });
  }
  toggle(): void {
    if (this.opened()) this.close();
    else { this.view.set('profile'); this.error.set(''); this.resetDone.set(false); this.opened.set(true); }
  }
  close(restoreFocus = true): void {
    this.opened.set(false); this.observer?.disconnect();
    if (restoreFocus) this.host.nativeElement.querySelector<HTMLElement>('[data-testid="profile-chip"]')?.focus({ preventScroll:true });
  }
  edit(): void { this.draft.set(this.profile.name()); this.error.set(''); this.view.set('edit'); }
  input(event: Event): void { this.draft.set((event.target as HTMLInputElement).value); this.error.set(''); }
  async save(event: Event): Promise<void> {
    event.preventDefault();
    try { validateDisplayName(this.draft()); } catch (error) { this.error.set((error as Error).message); return; }
    if (await this.desktop.updateDisplayName(this.draft())) this.view.set('profile');
    else this.error.set(this.desktop.error() ?? 'Your name could not be saved. Try again.');
  }
  replay(): void { this.close(); void this.flow.startTour(true); }
  resume(): void { this.close(); this.flow.resumeSetup(); }
  async reset(): Promise<void> {
    if (await this.desktop.resetOnboarding()) { this.resetDone.set(true); this.view.set('profile'); }
    else this.error.set(this.desktop.error() ?? 'Onboarding could not be reset. Try again.');
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
  }
  private position(): void {
    const chip = this.host.nativeElement.querySelector('[data-testid="profile-chip"]')!.getBoundingClientRect();
    const dialog = this.host.nativeElement.querySelector<HTMLDialogElement>('dialog')!;
    const rect = dialog.getBoundingClientRect(), pad=12;
    dialog.style.left = Math.max(pad,Math.min(chip.right-rect.width,innerWidth-rect.width-pad))+'px';
    dialog.style.top = Math.max(pad,Math.min(chip.bottom+10,innerHeight-rect.height-pad))+'px';
  }
}
