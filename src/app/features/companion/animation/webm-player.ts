import { type WebmAnimation } from './character.model';

const owners = new WeakMap<HTMLVideoElement, number>();

export function abortError(): DOMException { return new DOMException('Character playback cancelled.', 'AbortError'); }

export function releaseVideo(video: HTMLVideoElement): void {
  owners.set(video, (owners.get(video) ?? 0) + 1);
  video.pause();
  video.removeAttribute('src');
  video.load();
}

/** Decode and start a buffered video before revealing it. Always bounded and cancellable. */
export function prepareWebm(video: HTMLVideoElement, clip: WebmAnimation, signal: AbortSignal): Promise<number> {
  if (signal.aborted) return Promise.reject(abortError());
  const owner = (owners.get(video) ?? 0) + 1;
  owners.set(video, owner);
  video.muted = true;
  video.playsInline = true;
  video.controls = false;
  video.loop = clip.loop;
  video.playbackRate = clip.playbackRate;
  return new Promise<number>((resolve, reject) => {
    let settled = false;
    const current = () => owners.get(video) === owner;
    const cleanup = () => {
      clearTimeout(deadline);
      video.removeEventListener('loadeddata', decoded);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', cancelled);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      // An old request must never clear a buffer reused by a newer sequence.
      if (current()) releaseVideo(video);
      reject(error);
    };
    const cancelled = () => fail(abortError());
    const failed = () => fail(new Error(`Unable to decode character video: ${clip.src}`));
    const decoded = () => {
      if (!current() || signal.aborted) { cancelled(); return; }
      void video.play().then(() => {
        if (settled) return;
        if (!current() || signal.aborted) { cancelled(); return; }
        settled = true;
        cleanup();
        resolve(Number.isFinite(video.duration) ? video.duration * 1000 / clip.playbackRate : (clip.durationMs ?? 280));
      }).catch((error: Error) => fail(error));
    };
    const deadline = window.setTimeout(() => fail(new Error(`Character video loading timed out: ${clip.src}`)), 8000);
    video.addEventListener('loadeddata', decoded, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', cancelled, { once: true });
    video.src = clip.src;
    video.load();
  });
}
