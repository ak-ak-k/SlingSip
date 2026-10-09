import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, output, signal } from '@angular/core';
import { positionTour, type TourRect } from './tour-position';
import { DesktopService } from '../../core/services/desktop.service';

export const DASHBOARD_TOUR = [
  { title: "Today's Progress", selector:'app-today-progress', copy:"Your hydration lives here. Every sip moves you closer to today's goal." },
  { title:'Next Water Break', selector:'.next-break', copy:"I'll swing back around this time." },
  { title:'History', selector:'[data-tour-target="history"]', copy:"See how consistent you've been over time." },
  { title:'Settings', selector:'[data-tour-target="settings"]', copy:'Change your goal, glass size and reminder schedule anytime.' },
  { title:'Your Profile', selector:'[data-testid="profile-chip"]', copy:'Update your name, replay the tour or manage onboarding here.' },
  { title:'Quietly in Your Tray', selector:'', copy:'You can close the dashboard. SlingSip keeps running quietly in your system tray.' },
] as const;

@Component({
  selector:'app-dashboard-tour', templateUrl:'./dashboard-tour.component.html',
  styleUrl:'./dashboard-tour.component.scss', changeDetection:ChangeDetectionStrategy.OnPush,
  host:{ '[class.low-power]':'desktop.snapshot()?.companionPreferences?.lowPowerAnimations' },
})
export class DashboardTourComponent {
  readonly desktop = inject(DesktopService);
  readonly finished = output<void>();
  readonly steps = DASHBOARD_TOUR;
  readonly index = signal(0);
  readonly target = signal<TourRect | null>(null);
  readonly position = signal({ x:12, y:12 });
  readonly imageFailed = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private dialog?: HTMLDialogElement;
  private observer?: ResizeObserver;
  private mutation?: MutationObserver;
  private previousFocus: HTMLElement | null = null;
  private pending = 0;
  private lastStep = -1;
  private targetElement?: HTMLElement;
  constructor() {
    const update = () => this.schedule();
    afterNextRender(() => {
      this.dialog = this.host.nativeElement.querySelector('dialog')!;
      this.previousFocus = document.activeElement as HTMLElement;
      this.dialog.showModal();
      this.observer = new ResizeObserver(update);
      this.observer.observe(this.dialog.querySelector('.tour-card')!);
      this.mutation = new MutationObserver(update);
      const dashboard = document.querySelector('[data-testid="dashboard"]');
      if (dashboard) this.mutation.observe(dashboard,{ childList:true,subtree:true });
      window.addEventListener('resize',update);
      document.addEventListener('scroll',update,true);
      this.schedule();
    });
    afterRenderEffect(() => { this.index(); this.schedule(); });
    inject(DestroyRef).onDestroy(() => {
      if (this.pending) cancelAnimationFrame(this.pending);
      this.observer?.disconnect(); this.mutation?.disconnect();
      window.removeEventListener('resize',update); document.removeEventListener('scroll',update,true);
      this.dialog?.close();
      if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll:true });
    });
  }
  next(): void { if (this.index() === this.steps.length-1) this.finished.emit(); else this.index.update(index=>index+1); }
  back(): void { this.index.update(index=>Math.max(0,index-1)); }
  skip(event?: Event): void { event?.preventDefault(); this.finished.emit(); }
  private schedule(): void {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => { this.pending = 0; this.measure(); });
  }
  private measure(): void {
    if (!this.dialog?.open) return;
    const selector = this.steps[this.index()].selector;
    const element = selector ? document.querySelector<HTMLElement>('[data-testid="dashboard"] '+selector) : null;
    const changed = this.lastStep !== this.index();
    if (changed) {
      this.lastStep = this.index();
      element?.scrollIntoView({ block:'center',inline:'nearest',behavior:'instant' });
      this.dialog.querySelector<HTMLElement>('[data-testid="tour-next"]')?.focus({ preventScroll:true });
    }
    if (element !== this.targetElement) {
      if (this.targetElement) this.observer?.unobserve(this.targetElement);
      this.targetElement = element ?? undefined;
      if (element) this.observer?.observe(element);
    }
    const r = element?.getBoundingClientRect();
    const visible = r && r.width>0 && r.height>0 && r.right>0 && r.bottom>0 && r.x<innerWidth && r.y<innerHeight;
    const x = r ? Math.max(8,r.x-6) : 0, y = r ? Math.max(8,r.y-6) : 0;
    const target = visible && r ? { x,y,width:Math.max(0,Math.min(innerWidth-8,r.right+6)-x),height:Math.max(0,Math.min(innerHeight-8,r.bottom+6)-y) } : null;
    this.target.set(target);
    const card = this.dialog.querySelector('.tour-card')!.getBoundingClientRect();
    this.position.set(positionTour(innerWidth,innerHeight,card.width,card.height,target));
  }
}
