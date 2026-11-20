import { readStore, writeStore } from './storage';

export type SoundName = 'place' | 'slide' | 'dhadi' | 'capture' | 'win' | 'lose' | 'draw';

const MUTE_KEY = 'peddadhadi.muted';

/** Synthesised sound effects (Web Audio). No audio files. */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted: boolean;

  constructor() {
    this.muted = readStore(MUTE_KEY) === '1';
  }

  setMuted(m: boolean): void {
    this.muted = m;
    writeStore(MUTE_KEY, m ? '1' : '0');
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  private tone(
    ctx: AudioContext,
    t0: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    freqEnd?: number,
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(ctx: AudioContext, t0: number, dur: number, freq: number, gain: number, q = 1): void {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t0);
  }

  play(name: SoundName): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case 'place': // wooden tock
        this.tone(ctx, t, 260, 0.12, 'sine', 0.7, 110);
        this.noise(ctx, t, 0.04, 1800, 0.25, 2);
        break;
      case 'slide': // soft scrape
        this.noise(ctx, t, 0.18, 900, 0.18, 0.8);
        this.tone(ctx, t, 180, 0.1, 'sine', 0.2, 140);
        break;
      case 'dhadi': // bright rising triad
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(ctx, t + i * 0.09, f, 0.28, 'triangle', 0.35));
        break;
      case 'capture': // thud + descending blip
        this.tone(ctx, t, 150, 0.22, 'sine', 0.8, 55);
        this.tone(ctx, t, 420, 0.16, 'square', 0.12, 160);
        this.noise(ctx, t, 0.08, 600, 0.3);
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(ctx, t + i * 0.13, f, 0.4, 'triangle', 0.38));
        break;
      case 'lose':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone(ctx, t + i * 0.16, f, 0.45, 'sine', 0.4));
        break;
      case 'draw':
        [440, 440].forEach((f, i) => this.tone(ctx, t + i * 0.18, f, 0.3, 'sine', 0.3));
        break;
    }
  }
}
