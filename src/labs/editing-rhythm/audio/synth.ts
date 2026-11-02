import { audibleEvents, humLevel, type Audible, type SfxKind } from "../engine/audio";
import { analyseKnows } from "../engine/explain";
import { SHOTS } from "../engine/shots";
import type { Edit } from "../engine/types";

/**
 * Procedural WebAudio for the lab: every sound is synthesised (oscillators + filtered noise), no
 * assets. The AudioContext is created only after a user gesture (browser autoplay policy). Sound
 * events are scheduled from the AUDIO edit in record time, so J/L cuts move what you hear.
 */
type Ctx = AudioContext;

const evCache = new WeakMap<Edit, { events: Audible[]; revealAt: number | null; main: boolean }>();
function eventsFor(e: Edit) {
  let v = evCache.get(e);
  if (!v) {
    const k = analyseKnows(e);
    v = { events: audibleEvents(e), revealAt: k.revealAt, main: e.some((c) => SHOTS[c.shot].reel === "main") };
    evCache.set(e, v);
  }
  return v;
}

/** The score bed: tension rises toward the reveal, then releases (record time). */
export function droneLevel(e: Edit, t: number): number {
  const v = eventsFor(e);
  if (!v.main) return 0;
  if (v.revealAt === null) return 0.55;
  if (t < v.revealAt) return 0.25 + 0.75 * Math.min(1, t / Math.max(0.5, v.revealAt));
  return Math.max(0, 1 - (t - v.revealAt) / 1.2);
}

export class Sound {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private humGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private lastT = -1;
  /** Count of one-shots fired (read by the test hook). */
  fired = 0;
  lastFired: { kind: SfxKind; rec: number } | null = null;

  get ready() {
    return this.ctx !== null;
  }

  /** Create/resume the context. Call from a user-gesture handler only. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      master.connect(comp).connect(ctx.destination);
      this.master = master;
      const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = n.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < d.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      this.noise = n;
      // the box's hum: two detuned low oscillators through a lowpass
      this.humGain = ctx.createGain();
      this.humGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 520;
      for (const [f, type] of [[55, "sine"], [110.6, "triangle"], [164.4, "sine"]] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.connect(lp);
        o.start();
      }
      lp.connect(this.humGain).connect(master);
      // the tension drone: a low open fifth with a slow beat
      this.droneGain = ctx.createGain();
      this.droneGain.gain.value = 0;
      const dlp = ctx.createBiquadFilter();
      dlp.type = "lowpass";
      dlp.frequency.value = 380;
      for (const f of [36.7, 55.1, 73.6, 110.3]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        o.connect(g).connect(dlp);
        o.start();
      }
      dlp.connect(this.droneGain).connect(master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  suspend() {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  /** Once per frame: continuous layers follow the audio edit; one-shots fire as the playhead crosses them. */
  tick(e: Edit, t: number, playing: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.humGain || !this.droneGain) {
      this.lastT = t;
      return;
    }
    const now = ctx.currentTime;
    const hum = playing ? Math.min(1.3, humLevel(e, t)) : 0;
    this.humGain.gain.setTargetAtTime(hum * 0.16, now, 0.05);
    this.droneGain.gain.setTargetAtTime(playing ? droneLevel(e, t) * 0.05 : 0, now, 0.25);
    const prev = this.lastT;
    this.lastT = t;
    if (!playing || prev < 0 || t <= prev || t - prev > 0.3) return;
    for (const x of eventsFor(e).events) {
      if (x.rec > prev && x.rec <= t) {
        this.fire(x.kind, x.gain, now + 0.01);
        this.fired++;
        this.lastFired = { kind: x.kind, rec: x.rec };
      }
    }
  }

  /** Audition one sound immediately (the audio lane markers). */
  audition(kind: SfxKind, gain = 1) {
    if (!this.ctx) return;
    this.fire(kind, gain, this.ctx.currentTime + 0.01);
  }

  private env(at: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(this.master!);
    return g;
  }

  private noiseSrc(at: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(at, Math.random() * 0.5);
    s.stop(at + dur + 0.05);
    return s;
  }

  private osc(type: OscillatorType, f0: number, f1: number, at: number, dur: number, out: AudioNode) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    o.connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  }

  private filter(type: BiquadFilterType, f: number, q: number, out: AudioNode) {
    const b = this.ctx!.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    b.connect(out);
    return b;
  }

  private fire(kind: SfxKind, gain: number, at: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    switch (kind) {
      case "step": {
        const g = this.env(at, 0.5 * gain, 0.004, 0.09);
        this.noiseSrc(at, 0.12).connect(this.filter("bandpass", 320, 1.3, g));
        this.osc("sine", 110, 60, at, 0.07, this.env(at, 0.35 * gain, 0.003, 0.07));
        break;
      }
      case "creak": {
        const g = this.env(at, 0.22 * gain, 0.04, 0.55);
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        const f = o.frequency;
        f.setValueAtTime(140, at);
        for (let i = 1; i <= 10; i++) f.linearRampToValueAtTime(110 + ((i * 37) % 60) + (i % 2 ? 25 : -10), at + i * 0.055);
        o.connect(this.filter("bandpass", 950, 7, g));
        o.start(at);
        o.stop(at + 0.65);
        break;
      }
      case "gasp": {
        const g = this.env(at, 0.42 * gain, 0.09, 0.32);
        const bp = this.filter("bandpass", 1300, 2.2, g);
        bp.frequency.setValueAtTime(1000, at);
        bp.frequency.linearRampToValueAtTime(1800, at + 0.15);
        this.noiseSrc(at, 0.45).connect(this.filter("highpass", 500, 0.7, bp));
        break;
      }
      case "breath": {
        const g = this.env(at, 0.2 * gain, 0.22, 0.5);
        this.noiseSrc(at, 0.8).connect(this.filter("bandpass", 760, 1.1, g));
        break;
      }
      case "sting": {
        [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => this.osc("sine", f, f * 1.002, at + i * 0.012, 2.2, this.env(at + i * 0.012, (0.16 - i * 0.015) * gain, 0.01, 2.1)));
        this.noiseSrc(at, 0.7).connect(this.filter("highpass", 3200, 0.8, this.env(at, 0.18 * gain, 0.01, 0.6)));
        this.osc("sine", 90, 38, at, 0.5, this.env(at, 0.5 * gain, 0.005, 0.5));
        break;
      }
      case "thud": {
        this.osc("sine", 130, 42, at, 0.18, this.env(at, 0.7 * gain, 0.004, 0.26));
        this.noiseSrc(at, 0.12).connect(this.filter("lowpass", 420, 0.8, this.env(at, 0.4 * gain, 0.003, 0.1)));
        break;
      }
      case "whistleUp":
      case "whistleDown": {
        const up = kind === "whistleUp";
        const dur = up ? 0.38 : 0.5;
        const g = this.env(at, 0.2 * gain, 0.03, dur);
        const o = this.osc("sine", up ? 480 : 1700, up ? 1700 : 330, at, dur, g);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 9;
        const lg = ctx.createGain();
        lg.gain.value = 18;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(at);
        lfo.stop(at + dur + 0.05);
        break;
      }
      case "bonk": {
        this.osc("sine", 560, 240, at, 0.14, this.env(at, 0.4 * gain, 0.003, 0.18));
        this.osc("triangle", 1200, 1100, at, 0.04, this.env(at, 0.15 * gain, 0.002, 0.04));
        break;
      }
      case "shimmer": {
        [2093, 2637, 3136].forEach((f, i) => this.osc("sine", f, f, at + i * 0.06, 0.25, this.env(at + i * 0.06, 0.05 * gain, 0.01, 0.24)));
        break;
      }
      case "ignite": {
        const g = this.env(at, 0.3 * gain, 0.06, 0.5);
        const bp = this.filter("bandpass", 500, 1.4, g);
        bp.frequency.setValueAtTime(400, at);
        bp.frequency.exponentialRampToValueAtTime(1700, at + 0.35);
        this.noiseSrc(at, 0.6).connect(bp);
        this.osc("sine", 95, 70, at, 0.4, this.env(at, 0.25 * gain, 0.02, 0.4));
        break;
      }
    }
  }
}

/** One engine per page. */
export const sound = new Sound();
