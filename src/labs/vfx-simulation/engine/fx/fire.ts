import { LOOP_S, FPS } from "../timing";
import { hash01, hashS, wobble } from "../rng";

/**
 * Fire & smoke. Simulated: a particle system with buoyancy, turbulence, cooling and smoke, each particle
 * a closed-form function of (seed, age) so the loop is exact. Keyed: an eight-drawing flame cycle on
 * twos with authored smoke puffs, the way a 2D effects animator loops fire.
 */
export const FIRE_STRIDE = 7; // x, y, z, size, heat (1 hot … 0 cold), alpha, kind (0 flame, 1 smoke)

/** Particle i's life divides the loop so the cycle repeats exactly every LOOP_S. */
const lifeOf = (i: number, base: number, spread: number) => LOOP_S / Math.max(1, Math.round(LOOP_S / (base + spread * hash01(i, 3))));

export function fireCounts(budget: number) {
  return { flame: Math.round(budget * 0.8), smoke: Math.round(budget * 0.2) };
}

export function fireParticles(t: number, budget: number, wind: number, out: Float32Array): number {
  const { flame, smoke } = fireCounts(budget);
  let o = 0;
  for (let i = 0; i < flame; i++) {
    const L = lifeOf(i, 0.5, 0.35);
    const shifted = t + hash01(i, 5) * L;
    const cyc = Math.floor(shifted / L);
    const age = shifted - cyc * L;
    const u = age / L;
    const seed = i * 13 + (cyc % Math.round(LOOP_S / L));
    const a = hash01(seed, 7) * Math.PI * 2;
    const r = 0.2 * Math.sqrt(hash01(seed, 11));
    const x0 = Math.cos(a) * r;
    const z0 = Math.sin(a) * r * 0.7;
    const pull = 1 - 0.75 * u;
    const lean = wind * (0.55 * age * age + 0.12 * age);
    const tw = 0.06 * u * wobble(age * 7 + i, seed * 0.1, 0, 1);
    out[o++] = x0 * pull + lean + tw;
    out[o++] = 0.03 + 0.24 * age + 0.6 * age * age * (1 - 0.35 * wind);
    out[o++] = z0 * pull + 0.04 * u * wobble(age * 6, i, 1, 2);
    out[o++] = 0.16 * (1 - u) ** 0.55 * (0.7 + 0.6 * hash01(seed, 13));
    out[o++] = 1 - u;
    out[o++] = Math.min(1, u * 8) * (1 - u) ** 0.4;
    out[o++] = 0;
  }
  for (let j = 0; j < smoke; j++) {
    const L = lifeOf(j + 999, 2.0, 0.6);
    const shifted = t + hash01(j, 17) * L;
    const cyc = Math.floor(shifted / L);
    const age = shifted - cyc * L;
    const u = age / L;
    const seed = j * 31 + (cyc % Math.round(LOOP_S / L));
    out[o++] = hashS(seed, 19) * 0.08 + wind * (0.5 * age + 0.18 * age * age) + 0.08 * wobble(age * 2, j, 0, 4) * u;
    out[o++] = 0.45 + 0.26 * age + 0.05 * age * age;
    out[o++] = hashS(seed, 23) * 0.08;
    out[o++] = 0.1 + 0.42 * u;
    out[o++] = 0;
    out[o++] = 0.4 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.6 + 0.4 * hash01(seed, 29));
    out[o++] = 1;
  }
  return flame + smoke;
}

/** The keyed flame cycle: drawing number on screen (on twos, 8 drawings). */
export const flameDrawingAt = (t: number) => Math.floor((t * FPS) / 2) % 8;

/** Authored tip sway and height per drawing (the animator's key table). */
const SWAY = [0, 0.05, 0.09, 0.04, -0.03, -0.08, -0.06, -0.02];
const TALL = [1, 1.08, 0.94, 1.12, 1.0, 0.9, 1.1, 0.96];
/** A detached lick: drawing it appears on, rising one step per drawing. */
const LICKS = [
  { at: 1, x: -0.04, s: 1 },
  { at: 5, x: 0.05, s: 0.8 },
];

export interface FlameLayer {
  pts: number[];
  color: "outer" | "mid" | "core";
}

/** Flame polygon in the camera plane (x, y): a tongue with a wavy outline and a swaying tip. */
function tongue(w: number, h: number, sway: number, wav: number, phase: number) {
  const pts: number[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    const half = w * Math.sin(Math.PI * Math.min(1, v * 1.15)) ** 0.8 * (1 - v) ** 0.35;
    const bend = sway * v * v;
    const wv = wav * Math.sin(v * 9 + phase) * v;
    pts.push(-half + bend + wv, v * h);
  }
  for (let i = n; i >= 0; i--) {
    const v = i / n;
    const half = w * Math.sin(Math.PI * Math.min(1, v * 1.15)) ** 0.8 * (1 - v) ** 0.35;
    const bend = sway * v * v;
    const wv = wav * Math.sin(v * 9 + phase + 1.7) * v;
    pts.push(half + bend + wv, v * h);
  }
  return pts;
}

export function flameDrawing(d: number, wind: number): { layers: FlameLayer[]; licks: number[][] } {
  const sway = SWAY[d] + wind * 0.28;
  const tall = TALL[d] * (1 - 0.15 * wind);
  const layers: FlameLayer[] = [
    { pts: tongue(0.26, 0.82 * tall, sway, 0.025, d), color: "outer" },
    { pts: tongue(0.18, 0.6 * tall, sway * 0.8, 0.018, d + 2), color: "mid" },
    { pts: tongue(0.1, 0.36 * tall, sway * 0.5, 0.01, d + 4), color: "core" },
  ];
  const licks: number[][] = [];
  for (const l of LICKS) {
    const k = (d - l.at + 8) % 8;
    if (k > 2) continue;
    const y = 0.72 * tall + k * 0.12;
    const s = 0.05 * l.s * (1 - k * 0.3);
    const x = l.x + sway * 1.1 + wind * k * 0.06;
    const lp: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = s * (1 + 0.8 * Math.max(0, Math.sin(a)) ** 3);
      lp.push(x + Math.cos(a) * rr * 0.7, y + Math.sin(a) * rr * 1.5);
    }
    licks.push(lp);
  }
  return { layers, licks };
}

/** Authored smoke puffs: three on a 2 s cycle, rising on a drawn path, swelling, popping. */
export function smokePuffs(t: number, wind: number) {
  const out: { x: number; y: number; r: number; alpha: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const u = (((t / 2 + k / 3) % 1) + 1) % 1;
    const stepped = Math.floor(u * 24) / 24;
    out.push({ x: 0.05 * Math.sin(stepped * 6 + k) + wind * stepped * 0.8, y: 0.74 + stepped * 0.55, r: 0.05 + 0.07 * stepped, alpha: stepped > 0.85 ? 0 : 1 });
  }
  return out;
}
