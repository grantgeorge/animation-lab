import { Matrix4, Vector3 } from "three";

/**
 * Brush noise. Surface-attached paint is a function of a point's REST (surface) coordinate, so it
 * moves with the surface; a screen-space filter is a function of the pixel, so it doesn't.
 * Pure and deterministic: the same coordinate and seed always give the same value.
 */

/** Integer hash → [0, 1). (xxhash-style avalanche on 32-bit ints.) */
export function hashInt3(x: number, y: number, z: number, seed = 0): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 3D value noise in [0, 1). */
export function valueNoise3(x: number, y: number, z: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const h = (dx: number, dy: number, dz: number) => hashInt3(ix + dx, iy + dy, iz + dz, seed);
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), fx), mix(h(0, 1, 0), h(1, 1, 0), fx), fy),
    mix(mix(h(0, 0, 1), h(1, 0, 1), fx), mix(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz,
  );
}

/** Tileable 2D value noise with integer period (for paper and brush tiles). */
export function periodicNoise2(x: number, y: number, period: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  const w = (v: number) => ((v % period) + period) % period;
  const h = (dx: number, dy: number) => hashInt3(w(ix + dx), w(iy + dy), 0, seed);
  return mix(mix(h(0, 0), h(1, 0), fx), mix(h(0, 1), h(1, 1), fx), fy);
}

/** Fractal sum of periodicNoise2 (octaves double the period, so the result still tiles). */
export function periodicFbm2(x: number, y: number, period: number, octaves = 4, seed = 0): number {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += a * periodicNoise2(x * f, y * f, period * f, seed + o * 17);
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Seeded PRNG (mulberry32) → [0, 1). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Painted patch value at a surface point: terraced noise, i.e. colour blocks rather than a gradient. */
export function patchValue(rest: Vector3, freq: number, seed = 0, levels = 4): number {
  const n = valueNoise3(rest.x * freq, rest.y * freq, rest.z * freq, seed);
  return Math.min(levels - 1, Math.floor(n * levels)) / (levels - 1);
}

/**
 * Surface-attached sample: the world point is taken back into the object's rest frame first,
 * so moving or rotating the object (and the point with it) gives the same value.
 */
export function surfaceSample(world: Vector3, objectMatrix: Matrix4, freq: number, seed = 0): number {
  const rest = world.clone().applyMatrix4(objectMatrix.clone().invert());
  return patchValue(rest, freq, seed);
}

/** Screen-space sample: depends only on where the point lands on screen. */
export function screenSample(world: Vector3, viewProj: Matrix4, freqPx: number, sizePx: [number, number], seed = 0): number {
  const ndc = world.clone().applyMatrix4(viewProj);
  const px = (ndc.x * 0.5 + 0.5) * sizePx[0];
  const py = (ndc.y * 0.5 + 0.5) * sizePx[1];
  return patchValue(new Vector3(px, py, 0), freqPx, seed);
}
