import { FPS, LOOP_S } from "../timing";
import { clamp01, easeInOut, hash01, hashS, wobble } from "../rng";

/**
 * Particles & magic: a wand sweeps a loop-the-loop. Simulated: sparks leave the tip with its velocity,
 * drag to a stop, sink a little and drift on air currents (closed-form per particle so the loop is
 * exact), plus wandering fireflies. Keyed: sparkles placed by hand along the arc, popping on and
 * twinkling on twos.
 */
export const SWEEP = { t0: 0.6, t1: 2.3 } as const;

/** Wand tip path (keyed in both versions): a looping swoosh in the camera plane. */
export function wandTip(t: number): [number, number, number] {
  const u = easeInOut(clamp01((t - SWEEP.t0) / (SWEEP.t1 - SWEEP.t0)));
  const a = u * Math.PI * 2.4;
  const x = -1.1 + 2.2 * u + 0.28 * Math.sin(a * 1.25);
  const y = 0.85 + 0.32 * Math.sin(a) + 0.12 * Math.sin(u * Math.PI);
  return [x, y, 0.12 * Math.cos(a)];
}

function wandVel(t: number): [number, number, number] {
  const e = 1 / 240;
  const a = wandTip(t - e);
  const b = wandTip(t + e);
  return [(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e), (b[2] - a[2]) / (2 * e)];
}

export const MAGIC_STRIDE = 5; // x, y, z, size, glow

/** Sparks at t. `n` is the spark budget. Returns the number written. */
export function sparks(t: number, n: number, out: Float32Array): number {
  let o = 0;
  const life = 1.3;
  const drag = 3.2;
  for (let i = 0; i < n; i++) {
    const tb = SWEEP.t0 + (SWEEP.t1 - SWEEP.t0) * (i / n);
    const age = t - tb;
    if (age < 0 || age > life) continue;
    const p = wandTip(tb);
    const v = wandVel(tb);
    const kick = 0.35 + 0.5 * hash01(i, 3);
    const vx = v[0] * 0.18 + hashS(i, 5) * kick;
    const vy = v[1] * 0.18 + hashS(i, 7) * kick + 0.15;
    const vz = v[2] * 0.18 + hashS(i, 9) * kick * 0.6;
    const k = (1 - Math.exp(-drag * age)) / drag;
    const u = age / life;
    out[o++] = p[0] + vx * k + 0.06 * wobble(age * 2, i, 0, 1) * u;
    out[o++] = p[1] + vy * k - 0.18 * age * age + 0.05 * wobble(age * 2, i, 1, 2) * u;
    out[o++] = p[2] + vz * k;
    out[o++] = (0.028 + 0.03 * hash01(i, 11)) * (1 - u) ** 0.5;
    out[o++] = (1 - u) * (0.65 + 0.35 * Math.sin(age * 40 + i));
  }
  return o / MAGIC_STRIDE;
}

/** Ambient fireflies: wandering on smooth noise, blinking slowly. Exact loop (frequencies × loop). */
export function fireflies(t: number, n: number, out: Float32Array): number {
  let o = 0;
  const w = (2 * Math.PI) / LOOP_S;
  for (let i = 0; i < n; i++) {
    const a = hash01(i, 13) * Math.PI * 2;
    const x = -1.6 + 3.2 * hash01(i, 17) + 0.22 * Math.sin(w * t * (1 + (i % 3)) + a);
    const y = 0.25 + 1.3 * hash01(i, 19) + 0.12 * Math.sin(w * t * (2 + (i % 2)) + a * 1.3);
    const z = -0.8 + 0.6 * hash01(i, 23) + 0.1 * Math.cos(w * t + a);
    const blink = Math.max(0, Math.sin(w * t * (2 + (i % 4)) + a * 2)) ** 3;
    out[o++] = x;
    out[o++] = y;
    out[o++] = z;
    out[o++] = 0.035;
    out[o++] = 0.15 + 0.85 * blink;
  }
  return o / MAGIC_STRIDE;
}

export interface Sparkle {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
}

/** Keyed sparkles: authored positions along the arc, popping on as the tip passes, on twos. */
export function keyedSparkles(t: number, n: number): Sparkle[] {
  const tt = Math.floor(t * FPS / 2) * 2 / FPS;
  const out: Sparkle[] = [];
  for (let k = 0; k < n; k++) {
    const s = (k + 0.5) / n;
    const tb = SWEEP.t0 + (SWEEP.t1 - SWEEP.t0) * s;
    const age = tt - tb;
    if (age < 0 || age > 1.0) continue;
    const p = wandTip(tb);
    const v = wandVel(tb);
    const l = Math.hypot(v[0], v[1]) || 1;
    const side = k % 2 === 0 ? 1 : -1;
    const off = (0.06 + 0.07 * hash01(k, 3)) * side;
    // pop: 0 → 1.35 → 1 over three drawings, hold with a twinkle, shrink out
    let scale = age < 2 / FPS ? 1.35 : age < 4 / FPS ? 1 : age < 0.75 ? 1 : 1 - (age - 0.75) / 0.25;
    if (age < 0.5 / FPS) scale = 0.5;
    const twinkle = Math.floor(age * FPS / 2) % 2;
    out.push({ x: p[0] - (v[1] / l) * off, y: p[1] + (v[0] / l) * off, z: p[2], scale: Math.max(0, scale) * (0.8 + 0.4 * hash01(k, 5)), rot: twinkle ? Math.PI / 4 : 0 });
  }
  return out;
}
