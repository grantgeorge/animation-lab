import { Vector3 } from "three";
import { project, tanHalf, type Shot } from "./camera";
import { BANDS } from "./world";

/**
 * 2.5D construction: slice the frame-0 picture into depth layers and hang each on a flat card.
 * A card at depth d slides across the screen at a speed ∝ 1/d when the camera moves sideways,
 * which is the whole trick of the multiplane camera.
 */
export interface LayerRange {
  index: number;
  /** Near and far edge of the slice along the frame-0 view axis (m). b = Infinity for the backdrop. */
  a: number;
  b: number;
}

export const SLICE = { nearM: 4.5, farM: 220, minLayers: 2, maxLayers: 6, defaultLayers: 5 } as const;

/** Slice boundaries: n layers need n − 1 cuts, spaced geometrically (equal steps in 1/depth feel). */
export function sliceBounds(n: number, near: number = SLICE.nearM, far: number = SLICE.farM): number[] {
  const cuts = Math.max(0, Math.round(n) - 1);
  if (cuts === 0) return [];
  if (cuts === 1) return [Math.sqrt(near * far)];
  return Array.from({ length: cuts }, (_, i) => near * (far / near) ** (i / (cuts - 1)));
}

export function layerRanges(n: number): LayerRange[] {
  const b = sliceBounds(n);
  const edges = [0, ...b, Infinity];
  return edges.slice(0, -1).map((a, i) => ({ index: i, a, b: edges[i + 1] }));
}

/** Median of the depths that fall inside [a, b): where the layer's content actually sits. */
export function medianDepth(depths: ArrayLike<number>, a: number, b: number): number | null {
  const inside: number[] = [];
  for (let i = 0; i < depths.length; i++) {
    const d = depths[i];
    if (d >= a && d < b && Number.isFinite(d)) inside.push(d);
  }
  if (!inside.length) return null;
  inside.sort((x, y) => x - y);
  const mid = inside.length >> 1;
  return inside.length % 2 ? inside[mid] : 0.5 * (inside[mid - 1] + inside[mid]);
}

/** Fallback card depth when a slice holds no pixels. */
export function nominalDepth(r: LayerRange) {
  if (r.a <= 0) return 0.6 * r.b;
  if (!Number.isFinite(r.b)) return 1.8 * r.a;
  return Math.sqrt(r.a * r.b);
}

/** Card depth for each range: the median of its pixels, clamped into the slice. */
export function cardDepths(ranges: readonly LayerRange[], depths: ArrayLike<number> | null) {
  return ranges.map((r) => {
    const m = depths ? medianDepth(depths, r.a, r.b) : null;
    const d = m ?? nominalDepth(r);
    return Math.max(r.a > 0 ? r.a : 0.5, Math.min(Number.isFinite(r.b) ? r.b : d, d));
  });
}

/**
 * Parallax strength. k = 1 keeps true depth; k = 0 pulls everything onto one plane at depth D
 * (a flat painting). The image from the frame-0 camera never changes; only the motion does.
 */
export const squashDepth = (d: number, D: number, k: number) => D + (d - D) * k;

/** World size of a card hung at depth d that fills the frame-0 view, with overscan. */
export function cardSize(depth: number, focalMm: number, overscan = 1) {
  const th = tanHalf(focalMm);
  return { width: 2 * depth * th.x * overscan, height: 2 * depth * th.y * overscan };
}

/** Screen slide (NDC, half-widths) of something at depth d for a sideways camera move of x metres. */
export const parallaxNdc = (depth: number, lateralM: number, focalMm: number) => -lateralM / (depth * tanHalf(focalMm).x);

/** Multiplane speed of a layer relative to a reference layer: ∝ 1 / depth. */
export const relativeSpeed = (depth: number, refDepth: number) => refDepth / depth;

/**
 * Where a layer's anchor (the frame-0 frame centre at its depth) is on screen now: its slide since
 * frame 0. For flat 2D all anchors share one depth, so they slide together (no parallax).
 */
export function anchorShift(c0: Shot, now: Shot, depth: number) {
  const fwd = new Vector3(0, 0, -1).applyQuaternion(c0.quaternion);
  const p = c0.position.clone().addScaledVector(fwd, depth);
  const q = project(now, p);
  return { x: q.x, y: q.y, depthNow: q.depth };
}

export type Band = "fg" | "mg" | "bg";
export const bandOf = (distanceM: number): Band => (distanceM < BANDS.fgM ? "fg" : distanceM < BANDS.mgM ? "mg" : "bg");
