/**
 * The maths behind the five looks, renderer-free. The GLSL in passes.ts mirrors these functions, and
 * the side panel's "light in → colour out" graph plots them.
 */

export type LookId = 'clay' | 'standard' | 'cel' | 'painterly' | 'halftone';
export type OutlineMode = 'hull' | 'edges' | 'both' | 'none';
export type Blend = 'dissolve' | 'wipe';
export type Mismatch = 'none' | 'characters' | 'set';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Cel ramp. `u` is three.js's toon coordinate, N·L remapped to 0..1. `edge` is where the shadow ends,
 * in N·L (−1..1). The lit side splits into equal steps between that edge and full light, and every
 * band is flat: brightness jumps at the edges instead of rolling off.
 */
export function rampLevel(u: number, bands: number, edge: number, floor: number): number {
  const b = Math.max(2, Math.round(bands));
  const e = clamp01((edge + 1) / 2);
  if (u < e) return floor;
  const step = (1 - e) / (b - 1);
  const k = Math.min(b - 1, 1 + Math.floor((u - e) / Math.max(step, 1e-6)));
  return floor + ((1 - floor) * k) / (b - 1);
}

/** The ramp as an 8-bit strip for a three.js gradientMap. */
export function rampData(bands: number, edge: number, floor: number, width = 256): Uint8Array {
  const out = new Uint8Array(width);
  for (let i = 0; i < width; i++) out[i] = Math.round(rampLevel((i + 0.5) / width, bands, edge, floor) * 255);
  return out;
}

/** Number of distinct brightness levels a ramp produces (for the readout). */
export const rampLevels = (bands: number) => Math.max(2, Math.round(bands));

/** Wrapped diffuse: light reaches past the terminator, so the shadow edge softens (the clay look). */
export const wrapDiffuse = (ndl: number, wrap: number) => clamp01((ndl + wrap) / (1 + wrap));

/** Brightness against N·L for the graph. Painterly and halftone filter the standard shading afterwards. */
export function lightResponse(look: LookId, ndl: number, p: { bands: number; edge: number; floor: number; wrap: number }): number {
  if (look === 'cel') return rampLevel((ndl + 1) / 2, p.bands, p.edge, p.floor);
  if (look === 'clay') return wrapDiffuse(ndl, p.wrap);
  return clamp01(ndl);
}

/**
 * Halftone screen: rotate the pixel into the screen's grid, find its cell, and return the offset from
 * that cell's centre. Ink dots sit at cell centres.
 */
export function halftoneCell(x: number, y: number, cell: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const rx = c * x + s * y, ry = -s * x + c * y;
  const gx = Math.floor(rx / cell), gy = Math.floor(ry / cell);
  return { gx, gy, dx: rx - (gx + 0.5) * cell, dy: ry - (gy + 0.5) * cell };
}

/**
 * Dot radius for a brightness: ink covers (1 − brightness) of the cell, so r = cell·√((1 − L)/π).
 * Past half coverage neighbouring dots touch; the radius stops at the cell's half-diagonal.
 */
export function dotRadius(brightness: number, cell: number): number {
  return Math.min(cell * Math.SQRT1_2, cell * Math.sqrt(clamp01(1 - brightness) / Math.PI));
}

/** Share of a cell the dot covers (clipped to the cell), for the graph. */
export function inkCoverage(brightness: number): number {
  const r = dotRadius(brightness, 1);
  return Math.min(1, Math.PI * r * r);
}

/** Classic screen angles per ink (degrees, added to the chosen screen angle). */
export const CMYK_ANGLES = { c: 15, m: 75, y: 0, k: 45 } as const;

/** Dissolve: a straight crossfade. Halfway is a double exposure, not a halfway style. */
export const dissolve = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

/**
 * Wipe: B enters from the right edge as t goes 0 → 1. Returns B's weight at screen x (0..1), with a
 * soft edge `soft` wide (in the same units as x).
 */
export function wipeWeight(x: number, t: number, soft = 0.002): number {
  if (soft <= 0) return x >= 1 - clamp01(t) ? 1 : 0;
  // The edge travels from just past the right edge to just past the left, so t = 0 and 1 are clean.
  const div = 1 + soft - clamp01(t) * (1 + 2 * soft);
  const u = clamp01((x - (div - soft)) / (2 * soft));
  return u * u * (3 - 2 * u);
}

/**
 * Inverted-hull width. Pushing each vertex out along its view-space normal by k·depth keeps the line
 * the same number of pixels wide at any distance: k = px · 2·tan(fov/2) / viewport height.
 */
export function hullOffsetPerDepth(widthPx: number, fovDeg: number, viewportPx: number): number {
  return (widthPx * 2 * Math.tan((fovDeg * Math.PI) / 360)) / Math.max(1, viewportPx);
}

/** Screen-space size of a hull line at a given depth, the inverse of hullOffsetPerDepth (for tests). */
export function hullPixels(offsetPerDepth: number, fovDeg: number, viewportPx: number): number {
  return (offsetPerDepth * viewportPx) / (2 * Math.tan((fovDeg * Math.PI) / 360));
}
