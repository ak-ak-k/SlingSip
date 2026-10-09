import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { type AnimationAsset, type CharacterDirection, type SpriteAnimation, type WebmAnimation } from './character.model';
import { SpriteAnimationComponent } from './sprite-animation.component';
import { abortError, prepareWebm, releaseVideo } from './webm-player';

export interface PlaybackInfo { type: 'sprite' | 'webm'; durationMs: number; stride?: number; frameCount?: number; referenceHeight?: number }
export interface CharacterPlayer {
  play(asset: AnimationAsset, direction: CharacterDirection, controlled: boolean, signal: AbortSignal): Promise<PlaybackInfo>;
  setFrame(frame: number): void;
  setWalkingSpeed(speed: number, height: number): void;
  stop(): void;
}

@Component({
  selector: 'app-animation-renderer',
  imports: [SpriteAnimationComponent],
  template: `
    <div class="render-box" [style.transform]="flipped() ? 'scaleX(-1)' : 'none'" [attr.data-renderer]="kind()">
      @if (sprite(); as clip) { <app-sprite-animation [clip]="clip" [frame]="frame()" [height]="height()" [style.visibility]="kind() === 'sprite' ? 'visible' : 'hidden'" /> }
      <video #videoA muted playsinline preload="auto" aria-hidden="true" [style.visibility]="videoIndex() === 0 ? 'visible' : 'hidden'"></video>
      <video #videoB muted playsinline preload="auto" aria-hidden="true" [style.visibility]="videoIndex() === 1 ? 'visible' : 'hidden'"></video>
    </div>`,
  styles: `
    :host, .render-box { display: block; position: absolute; inset: 0; background: transparent; pointer-events: none; }
    .render-box { transform-origin: center; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; background: transparent; object-fit: contain; object-position: bottom; pointer-events: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimationRendererComponent implements CharacterPlayer {
  readonly height = input.required<number>();
  protected readonly sprite = signal<SpriteAnimation | null>(null);
  protected readonly frame = signal<number | null>(null);
  protected readonly flipped = signal(false);
  protected readonly kind = signal<'sprite' | 'webm' | 'hidden'>('hidden');
  protected readonly videoIndex = signal<number | null>(null);
  private readonly videoA = viewChild<ElementRef<HTMLVideoElement>>('videoA');
  private readonly videoB = viewChild<ElementRef<HTMLVideoElement>>('videoB');
  private readonly images = new Map<string, Promise<HTMLImageElement>>();
  private generation = 0;
  private activeWebm: WebmAnimation | undefined;

  constructor() { inject(DestroyRef).onDestroy(() => this.stop()); }

  async play(asset: AnimationAsset, direction: CharacterDirection, controlled: boolean, signal: AbortSignal): Promise<PlaybackInfo> {
    const generation = ++this.generation;
    if (asset.primary.type === 'webm') {
      const index = this.videoIndex() === 0 ? 1 : 0;
      const video = this.videos()[index]!;
      try {
        const durationMs = await prepareWebm(video, asset.primary, signal);
        if (signal.aborted || generation !== this.generation) throw abortError();
        this.flipped.set(asset.primary.facing !== direction);
        this.kind.set('webm');
        this.videoIndex.set(index);
        this.activeWebm = asset.primary;
        this.videos()[1 - index]!.pause();
        return { type: 'webm', durationMs };
      } catch (error) {
        if (signal.aborted || generation !== this.generation) throw abortError();
        releaseVideo(video);
        console.warn('Character video unavailable; using development sprite fallback.', error);
      }
    }
    let clip = asset.primary.type === 'sprite' ? asset.primary : asset.fallback;
    try { await this.loadImage(clip.src); }
    catch (error) {
      if (signal.aborted || generation !== this.generation) throw abortError();
      if (clip.src === asset.fallback.src) throw error;
      clip = asset.fallback;
      await this.loadImage(clip.src);
    }
    if (signal.aborted || generation !== this.generation) throw abortError();
    this.videos().forEach((video) => video.pause());
    this.flipped.set(clip.facing !== direction);
    this.frame.set(controlled ? 0 : null);
    this.sprite.set(clip);
    this.videoIndex.set(null);
    this.kind.set('sprite');
    this.activeWebm = undefined;
    return { type: 'sprite', durationMs: clip.frameCount / (clip.fps * clip.playbackRate) * 1000, stride: clip.stride, frameCount: clip.frameCount, referenceHeight: clip.frameHeight };
  }

  setFrame(frame: number): void { this.frame.set(frame); }

  setWalkingSpeed(speed: number, height: number): void {
    const clip = this.activeWebm;
    const index = this.videoIndex();
    if (!clip?.stride || !clip.referenceHeight || index === null) return;
    const video = this.videos()[index]!;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      const stride = clip.stride * height / clip.referenceHeight;
      video.playbackRate = Math.min(16, Math.max(.0625, speed * video.duration / stride));
    }
  }

  stop(): void {
    this.generation += 1;
    this.kind.set('hidden');
    this.sprite.set(null);
    this.videoIndex.set(null);
    this.activeWebm = undefined;
    for (const ref of [this.videoA(), this.videoB()]) { if (ref) releaseVideo(ref.nativeElement); }
  }

  private videos(): HTMLVideoElement[] {
    return [this.videoA()?.nativeElement, this.videoB()?.nativeElement].filter((video): video is HTMLVideoElement => !!video);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    let image = this.images.get(src);
    if (!image) {
      image = new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => { this.images.delete(src); reject(new Error(`Unable to load character sprites: ${src}`)); };
        element.src = src;
      });
      this.images.set(src, image);
    }
    return image;
  }
}
