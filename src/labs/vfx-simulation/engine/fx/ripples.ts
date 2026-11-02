import { FPS, FRAMES, LOOP_S } from "../timing";
import { clamp01, easeOut, hash01, mulberry32 } from "../rng";

/**
 * Water: a pebble drops into a pond. Simulated: a height-field wave equation (ripples spread, interfere
 * and reflect off the banks) plus ballistic splash drops that fall back and start their own rings.
 * Keyed: evenly timed rings that ease out and fade, and authored drop arcs.
 */
export const POND = { size: 3.2, n: 64 } as const;
export const DROP_T = 0.75;
const PEBBLE_H = 1.25;
const G = 9.81;
export const pebbleImpact = DROP_T + Math.sqrt((2 * PEBBLE_H) / G);

export function pebbleY(t: number) {
  if (t < DROP_T) return PEBBLE_H;
  const a = t - DROP_T;
  return Math.max(-0.4, PEBBLE_H - 0.5 * G * a * a);
}

export interface SplashDrop {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Time it lands back in the pond. */
  land: number;
}

/** Ballistic splash drops (seeded): positions at t, or null once landed. */
export function simDrops(size: number): SplashDrop[] {
  const rnd = mulberry32(42);
  const n = 14;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const sp = (0.5 + 0.7 * rnd()) * (0.6 + 0.6 * size);
    const vy = (1.6 + 1.4 * rnd()) * (0.6 + 0.6 * size);
    return { x: 0, y: 0.02, z: 0, vx: Math.cos(a) * sp, vy, vz: Math.sin(a) * sp, land: pebbleImpact + (2 * vy) / G };
  });
}

export function dropAt(d: SplashDrop, t: number): [number, number, number] | null {
  const a = t - pebbleImpact;
  if (a < 0 || t > d.land) return null;
  return [d.x + d.vx * a, d.y + d.vy * a - 0.5 * G * a * a, d.z + d.vz * a];
}

/** Baked height field: FRAMES frames of n × n heights. */
export class RippleBake {
  readonly n = POND.n;
  readonly frames: Float32Array[] = [];
  constructor(size: number) {
    const n = this.n;
    const dx = POND.size / n;
    let h = new Float32Array(n * n);
    let h0 = new Float32Array(n * n);
    const c = 0.55;
    const sub = 6;
    const dt = 1 / FPS / sub;
    const k = (c * dt) / dx;
    const k2 = k * k;
    const damp = 0.996;
    const drops = simDrops(size);
    const landed = new Set<number>();
    const poke = (x: number, z: number, amp: number, rad: number) => {
      const cx = (x / POND.size + 0.5) * n;
      const cz = (z / POND.size + 0.5) * n;
      const R = rad / dx;
      for (let j = Math.max(1, Math.floor(cz - 3 * R)); j < Math.min(n - 1, Math.ceil(cz + 3 * R)); j++)
        for (let i = Math.max(1, Math.floor(cx - 3 * R)); i < Math.min(n - 1, Math.ceil(cx + 3 * R)); i++) {
          const d2 = ((i - cx) ** 2 + (j - cz) ** 2) / (R * R);
          const dd = amp * Math.exp(-d2);
          h[j * n + i] -= dd;
          h0[j * n + i] -= dd;
        }
    };
    let poked = false;
    for (let f = 0; f < FRAMES; f++) {
      for (let s = 0; s < sub; s++) {
        const t = (f + s / sub) / FPS;
        if (!poked && t >= pebbleImpact) {
          poke(0, 0, 0.07 * (0.5 + size), 0.08 + 0.05 * size);
          poked = true;
        }
        drops.forEach((d, i) => {
          if (!landed.has(i) && t >= d.land) {
            landed.add(i);
            const a = d.land - pebbleImpact;
            poke(d.vx * a, d.vz * a, 0.02 * (0.5 + size), 0.035);
          }
        });
        const next = new Float32Array(n * n);
        for (let j = 1; j < n - 1; j++)
          for (let i = 1; i < n - 1; i++) {
            const id = j * n + i;
            const lap = h[id - 1] + h[id + 1] + h[id - n] + h[id + n] - 4 * h[id];
            next[id] = (2 * h[id] - h0[id] + k2 * lap) * damp;
          }
        h0 = h;
        h = next;
      }
      this.frames.push(h.slice());
    }
  }
  heightAt(frame: number) {
    return this.frames[Math.max(0, Math.min(this.frames.length - 1, frame))];
  }
}

/** Keyed rings: radius and strength of each ring at t. */
export function keyedRings(t: number, size: number) {
  const rings: { r: number; a: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const t0 = pebbleImpact + k * 0.28;
    const u = (t - t0) / (1.7 + 0.2 * k);
    if (u < 0 || u > 1) continue;
    rings.push({ r: (0.12 + (1.1 + 0.25 * size) * easeOut(u)) * (1 - 0.12 * k), a: (1 - u) * (1 - 0.25 * k) });
  }
  return rings;
}

/** Keyed drops: six teardrops on authored arcs (on twos), each with its own little ring when it lands. */
export function keyedDrops(t: number, size: number) {
  const out: { x: number; y: number; z: number; dx: number; dy: number; ring: number | null }[] = [];
  const tt = Math.floor(t * 12) / 12;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const dur = 0.5 + 0.12 * hash01(k, 3);
    const u = (tt - pebbleImpact) / dur;
    const dist = (0.3 + 0.18 * hash01(k, 5)) * (0.7 + 0.5 * size);
    const apex = (0.3 + 0.15 * hash01(k, 7)) * (0.7 + 0.5 * size);
    if (u >= 0 && u < 1) {
      const y = 4 * apex * u * (1 - u);
      out.push({ x: Math.cos(a) * dist * u, y, z: Math.sin(a) * dist * u, dx: Math.cos(a) * dist, dy: 4 * apex * (1 - 2 * u), ring: null });
    } else if (u >= 1 && u < 2.2) {
      out.push({ x: Math.cos(a) * dist, y: -1, z: Math.sin(a) * dist, dx: 0, dy: 0, ring: clamp01((u - 1) / 1.2) });
    }
  }
  return out;
}

/** Height of the keyed surface (sum of Gaussian ring bumps) for the realistic-look + keyed combination. */
export function keyedHeight(x: number, z: number, t: number, size: number) {
  const d = Math.hypot(x, z);
  let h = 0;
  for (const r of keyedRings(t, size)) h += 0.03 * r.a * (0.5 + size) * Math.exp(-(((d - r.r) / 0.07) ** 2));
  return h;
}

export const RIPPLE_LOOP = LOOP_S;
