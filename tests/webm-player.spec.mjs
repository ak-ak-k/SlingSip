import { electron } from './helpers/existing-user-electron.mjs';
import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const fixtureModule = path.resolve('dist/renderer/browser/_test/webm-player.mjs');

test.beforeAll(async () => {
  await mkdir(path.dirname(fixtureModule), { recursive: true });
  await build({ entryPoints: ['src/app/features/companion/animation/webm-player.ts'], outfile: fixtureModule, bundle: true, platform: 'browser', format: 'esm' });
});
test.afterAll(() => unlink(fixtureModule));

test('WebM decodes and plays, releases resources, rejects missing clips, and survives stale cancellation', async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args: ['.', '--companion-test'], env, chromiumSandbox: true });
  try {
    await expect.poll(() => app.windows().filter((page) => page.url().endsWith('#/dashboard')).length, { timeout: 60_000 }).toBe(1);
    const dashboard = app.windows().find((page) => page.url().endsWith('#/dashboard'));
    const result = await dashboard.evaluate(async () => {
      const { prepareWebm, releaseVideo } = await import(new URL('_test/webm-player.mjs', document.baseURI).href);
      // A real, local browser-encoded clip; no production asset or IPC test hooks required.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(20);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks = [];
      recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
      const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }));
      recorder.start();
      for (let frame = 0; frame < 8; frame++) {
        context.clearRect(0, 0, 64, 64);
        context.fillStyle = '#ade5c4';
        context.fillRect(frame * 5, 20, 20, 20);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      const src = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
      const video = document.createElement('video');
      document.body.append(video);
      const clip = { type: 'webm', src, facing: 'left', playbackRate: 1, loop: true };
      try {
        const durationMs = await prepareWebm(video, clip, new AbortController().signal);
        const playing = { paused: video.paused, muted: video.muted, loop: video.loop, inline: video.playsInline, controls: video.controls, decoded: video.readyState >= 2, durationMs };
        releaseVideo(video);
        const released = video.paused && !video.hasAttribute('src');
        let missing;
        try { await prepareWebm(video, { ...clip, src: 'assets/character/missing.webm' }, new AbortController().signal); }
        catch (error) { missing = error.message; }
        const old = new AbortController();
        const oldLoad = prepareWebm(video, clip, old.signal).catch((error) => error.name);
        const currentLoad = prepareWebm(video, clip, new AbortController().signal);
        old.abort();
        const oldResult = await oldLoad;
        await currentLoad;
        const restarted = !video.paused && video.src === src;
        const cancelled = new AbortController();
        cancelled.abort();
        let alreadyCancelled;
        try { await prepareWebm(video, clip, cancelled.signal); }
        catch (error) { alreadyCancelled = error.name; }
        return { playing, released, missing, oldResult, restarted, alreadyCancelled };
      } finally {
        releaseVideo(video);
        video.remove();
        URL.revokeObjectURL(src);
      }
    });
    expect(result.playing).toMatchObject({ paused: false, muted: true, loop: true, inline: true, controls: false, decoded: true });
    expect(result.playing.durationMs).toBeGreaterThan(0);
    expect(result.released).toBe(true);
    expect(result.missing).toContain('Unable to decode character video');
    expect(result.oldResult).toBe('AbortError');
    expect(result.restarted).toBe(true);
    expect(result.alreadyCancelled).toBe('AbortError');
  } finally { await app.close(); }
});
