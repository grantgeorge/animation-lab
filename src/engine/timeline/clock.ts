import { clamp, wrap } from "../math";

/**
 * Deterministic master clock. Maps wall time to loop time absolutely (no accumulation, so no drift).
 * Ticked exactly once per rendered frame; every pass in that frame reads `frameT`.
 */
export class MasterClock {
  durationS: number;
  loop = true;
  speed = 1;
  frameT = 0;
  private playing = false;
  private baseS = 0;
  private anchorMs = 0;
  private now: () => number;

  constructor(opts: { durationS: number; now?: () => number; startAt?: number; playing?: boolean }) {
    this.durationS = opts.durationS;
    this.now = opts.now ?? (() => performance.now());
    this.baseS = wrap(opts.startAt ?? 0, this.durationS);
    this.frameT = this.baseS;
    if (opts.playing) this.play();
  }

  setNow(now: () => number) {
    const t = this.peek();
    this.now = now;
    this.baseS = t;
    this.anchorMs = this.now();
  }

  get isPlaying() {
    return this.playing;
  }

  play() {
    if (this.playing) return;
    this.anchorMs = this.now();
    this.playing = true;
  }

  pause() {
    if (!this.playing) return;
    this.baseS = this.peek();
    this.playing = false;
  }

  seek(t: number) {
    this.baseS = this.loop ? wrap(t, this.durationS) : clamp(t, 0, this.durationS);
    this.anchorMs = this.now();
    this.frameT = this.baseS;
  }

  setSpeed(s: number) {
    this.baseS = this.peek();
    this.anchorMs = this.now();
    this.speed = s;
  }

  peek(): number {
    const raw = this.playing ? this.baseS + ((this.now() - this.anchorMs) / 1000) * this.speed : this.baseS;
    return this.loop ? wrap(raw, this.durationS) : clamp(raw, 0, this.durationS);
  }

  /** Call exactly once per frame, first thing in the frame. */
  tick(): number {
    this.frameT = this.peek();
    return this.frameT;
  }
}
