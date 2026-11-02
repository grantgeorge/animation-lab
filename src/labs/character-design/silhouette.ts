/**
 * Silhouette metrics on a binary mask (row-major, 1 = figure). Pixel units throughout.
 * - area: filled pixels
 * - hull: area of the convex hull of the filled pixels' corners
 * - solidity: area ÷ hull. A blob is close to 1; limbs that break away from the body lower it.
 * - negative space: 1 − solidity, the share of the outline's hull that is background.
 */
export interface Mask { w: number; h: number; data: Uint8Array }

export function maskFromRGBA(rgba: Uint8Array, w: number, h: number, threshold = 128): Mask {
  // readPixels returns rows bottom-up; flip so row 0 is the top. Dark pixels are the figure.
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((h - 1 - y) * w + x) * 4;
    data[y * w + x] = rgba[i] < threshold ? 1 : 0;
  }
  return { w, h, data };
}

export const area = (m: Mask) => { let n = 0; for (const v of m.data) n += v; return n; };

type P = [number, number];
const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Andrew's monotone chain. */
export function convexHull(points: P[]): P[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lower: P[] = [], upper: P[] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function polygonArea(poly: P[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; s += x0 * y1 - x1 * y0; }
  return Math.abs(s) / 2;
}

/** Hull of every filled pixel's corners. Only the extreme pixels of each row can be on the hull. */
export function hullArea(m: Mask) {
  const pts: P[] = [];
  for (let y = 0; y < m.h; y++) {
    let lo = -1, hi = -1;
    for (let x = 0; x < m.w; x++) if (m.data[y * m.w + x]) { if (lo < 0) lo = x; hi = x; }
    if (lo >= 0) pts.push([lo, y], [lo, y + 1], [hi + 1, y], [hi + 1, y + 1]);
  }
  return pts.length ? polygonArea(convexHull(pts)) : 0;
}

export function iou(a: Mask, b: Mask) {
  let inter = 0, union = 0;
  for (let i = 0; i < a.data.length; i++) { const x = a.data[i], y = b.data[i]; inter += x & y; union += x | y; }
  return union ? inter / union : 1;
}

export interface SilhouetteReading { solidity: number; negative: number; distinct: number }
export function readSilhouette(m: Mask, reference: Mask): SilhouetteReading {
  const a = area(m), hull = hullArea(m);
  const solidity = hull ? Math.min(1, a / hull) : 1;
  return { solidity, negative: 1 - solidity, distinct: 1 - iou(m, reference) };
}
