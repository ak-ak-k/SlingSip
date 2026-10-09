import { DestroyRef, inject, Injectable } from '@angular/core';
import { SWING_CONFIG as config } from './swing-config';
import type { CompanionPreferences } from '../../../../../shared/companion-preferences';
export type AudioCue = 'attach' | 'swing' | 'bubble' | 'success' | 'bottle';
/** Original, synthesized quiet cues. No files, network requests or copyrighted samples. */
@Injectable()
export class AudioService {
  private context?: AudioContext;
  private enabled = false;
  private volume = 0;
  private nodes = new Map<AudioScheduledSourceNode, () => void>();
  private generation = 0;
  constructor() { inject(DestroyRef).onDestroy(() => { this.stop(); void this.context?.close(); }); }
  configure(preferences: CompanionPreferences, active: boolean): void {
    this.enabled = active && preferences.soundEffects;
    this.volume = preferences.soundVolume;
    if (!this.enabled || this.volume === 0) { this.stop(); void this.context?.suspend(); }
  }
  play(cue: AudioCue): void {
    if (!this.enabled || this.volume === 0) return;
    try {
      this.context ??= new AudioContext();
      const context = this.context, generation = this.generation;
      // A failed autoplay/device resume drops this cue; it is never queued for later.
      void context.resume().then(() => { if (this.enabled && generation === this.generation && context.state === 'running') this.synthesize(context, cue); }).catch(() => {});
    } catch { /* Audio is optional; a missing output device never interrupts a reminder. */ }
  }
  stop(): void { this.generation++; for (const [node, cleanup] of this.nodes) { try { node.stop(); } catch {} cleanup(); } this.nodes.clear(); }
  private synthesize(context: AudioContext, cue: AudioCue): void {
    const now = context.currentTime, duration = cue === 'swing' ? config.audioSwingSeconds : cue === 'success' ? config.audioSuccessSeconds : config.audioShortSeconds;
    const gain = context.createGain(); gain.connect(context.destination);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(this.volume * config.audioGain, now + config.audioAttackSeconds);
    gain.gain.exponentialRampToValueAtTime(.00001, now + duration);
    let source: AudioScheduledSourceNode, cleanup: () => void;
    if (cue === 'attach' || cue === 'swing') {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0); for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
      const noise = context.createBufferSource(); noise.buffer = buffer;
      const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = cue === 'attach' ? 1400 : 600; filter.Q.value = .6;
      noise.connect(filter); filter.connect(gain); source = noise;
      cleanup = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.nodes.delete(source); };
    } else {
      const oscillator = context.createOscillator(); oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(cue === 'bottle' ? 1800 : cue === 'bubble' ? 450 : 660, now);
      oscillator.frequency.exponentialRampToValueAtTime(cue === 'success' ? 880 : cue === 'bottle' ? 1200 : 650, now + duration);
      oscillator.connect(gain); source = oscillator;
      cleanup = () => { source.disconnect(); gain.disconnect(); this.nodes.delete(source); };
    }
    source.onended = cleanup; this.nodes.set(source, cleanup); source.start(now); source.stop(now + duration);
  }
}
