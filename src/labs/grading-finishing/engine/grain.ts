/**
 * Film grain, deterministic per frame. A 32-bit integer hash (pcg3d, Jarzynski & Olano 2020) seeds
 * two octaves of smooth value noise, so grain clumps instead of fizzing per pixel; its strength
 * follows the image (strongest in the mids) and is mostly monochrome. The seed is the timeline
 * frame number: a paused frame keeps its grain, the next frame gets new grain.
 * Mirrored by `grainAt` in runtime/shaders.ts.
 */

export interface GrainOpts {
  /** Grain cell size in output pixels (fine ≈ 1.2, coarse 16 mm ≈ 3). */
  size: number;
  /** 0 = monochrome grain, 1 = independent grain per dye layer. */
  chroma: number;
}

/** pcg3d hash on uint32 triples (Math.imul keeps it bit-exact with the GLSL uint version). */
export function pcg3d(x: number, y: number, z: number): [number, number, number] {
  x = (Math.imul(x >>> 0, 1664525) + 1013904223) >>> 0;
  y = (Math.imul(y >>> 0, 1664525) + 1013904223) >>> 0;
  z = (Math.imul(z >>> 0, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  y = (y ^ (y >>> 16)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  return [x, y, z];
}

/** Hash of an integer lattice point → [−1, 1]. Channel 0 is the shared (mono) layer, 1–3 are R, G, B. */
export function latticeValue(ix: number, iy: number, frame: number, channel: number): number {
  return (pcg3d(ix + 8192, iy + 8192, frame * 4 + channel)[0] / 4294967295) * 2 - 1;
}

function valueNoise(px: number, py: number, frame: number, channel: number): number {
  const ix = Math.floor(px), iy = Math.floor(py);
  let fx = px - ix, fy = py - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = latticeValue(ix, iy, frame, channel), b = latticeValue(ix + 1, iy, frame, channel);
  const c = latticeValue(ix, iy + 1, frame, channel), d = latticeValue(ix + 1, iy + 1, frame, channel);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Two octaves, rescaled so the result has roughly unit standard deviation. */
export function grainNoise(px: number, py: number, frame: number, channel: number, size: number): number {
  const s = Math.max(0.5, size);
  const n1 = valueNoise(px / s, py / s, frame, channel);
  const n2 = valueNoise(px / (s * 2.0) + 37.1, py / (s * 2.0) + 11.7, frame, channel + 8);
  return (0.86 * n1 + 0.28 * n2) * 2.0;
}

/** Grain visibility by code-value luma: strongest in the mids, almost none in clipped white or deep black. */
export function grainWeight(l: number): number {
  const m = Math.max(0, 4 * l * (1 - l));
  return 0.06 + 0.94 * Math.pow(m, 0.75);
}

/** Peak grain offset in code values at amount = 1. */
export const GRAIN_STRENGTH = 0.1;

/** The grain offset for one pixel: add it to the encoded colour. */
export function grainAt(px: number, py: number, frame: number, l: number, amount: number, o: GrainOpts): [number, number, number] {
  const k = amount * GRAIN_STRENGTH * grainWeight(l);
  const mono = grainNoise(px, py, frame, 0, o.size);
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const own = o.chroma > 0 ? grainNoise(px, py, frame, c + 1, o.size) : 0;
    out[c] = k * (mono + (own - mono) * o.chroma);
  }
  return out;
}

/** The timeline frame that seeds the grain (24 fps). */
export const grainFrame = (t: number) => Math.max(0, Math.round(t * 24));
