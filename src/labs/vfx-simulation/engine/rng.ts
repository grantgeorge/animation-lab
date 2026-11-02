/** Seeded randomness and cheap deterministic noise. No Math.random anywhere in the lab. */

/** mulberry32: a tiny, fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash of an integer (and a salt) to [0, 1). */
export function hash01(i: number, salt = 0): number {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((salt | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Signed hash in [-1, 1). */
export const hashS = (i: number, salt = 0) => hash01(i, salt) * 2 - 1;

/**
 * Smooth pseudo-noise from a few incommensurate sines: continuous, deterministic, roughly in [-1, 1].
 * Good enough for turbulence and wobble; not a gradient noise.
 */
export function wobble(x: number, y: number, z: number, seed = 0): number {
  const s = seed * 1.618;
  return (
    0.5 * Math.sin(1.7 * x + 2.3 * y + 0.9 * z + s) +
    0.3 * Math.sin(-2.9 * x + 1.3 * y + 3.1 * z + 2.1 * s + 1.1) +
    0.2 * Math.sin(4.3 * x - 3.7 * y + 1.9 * z + 0.7 * s + 2.3)
  );
}

/** A divergence-free-ish 3D turbulence field (curl of three wobble potentials, finite differences). */
export function curl3(x: number, y: number, z: number, t: number, out: [number, number, number]) {
  const e = 0.05;
  const a = (px: number, py: number, pz: number) => wobble(px, py + t, pz, 1);
  const b = (px: number, py: number, pz: number) => wobble(py, pz + t, px, 2);
  const c = (px: number, py: number, pz: number) => wobble(pz, px + t, py, 3);
  // curl = (dc/dy − db/dz, da/dz − dc/dx, db/dx − da/dy)
  out[0] = (c(x, y + e, z) - c(x, y - e, z) - (b(x, y, z + e) - b(x, y, z - e))) / (2 * e);
  out[1] = (a(x, y, z + e) - a(x, y, z - e) - (c(x + e, y, z) - c(x - e, y, z))) / (2 * e);
  out[2] = (b(x + e, y, z) - b(x - e, y, z) - (a(x, y + e, z) - a(x, y - e, z))) / (2 * e);
  return out;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const easeIn = (u: number) => clamp01(u) ** 3;
export const easeInOut = (u: number) => {
  const x = clamp01(u);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
/** Overshoots past 1 then settles (anticipation's mirror: follow-through). */
export const easeOutBack = (u: number, k = 1.7) => {
  const x = clamp01(u) - 1;
  return 1 + (k + 1) * x * x * x + k * x * x;
};
/** A damped spring from 0 to 1: overshoot then one or two smaller bounces. */
export const springSettle = (u: number, bounce = 0.18, freq = 2.2) => {
  if (u <= 0) return 0;
  return 1 - Math.exp(-5 * u) * Math.cos(freq * Math.PI * u) * (1 - bounce) - bounce * Math.exp(-7 * u) * Math.cos(2 * freq * Math.PI * u);
};
