/**
 * The crawl metric: do the strokes stay on the surface?
 *
 * Inputs are two consecutive 24 fps frames of one version of the test, each rendered with a
 * matching SURFACE-COORDINATE pass (every pixel of the character stores which small cell of its
 * rest-pose surface it shows, RGB = cell index, A = coverage). For every surface cell seen in both
 * frames we compare its mean brightness. Paint that is attached to the surface keeps its value as
 * the head turns; paint that lives on the screen, or is re-invented each frame, does not.
 *
 * Lighting legitimately changes as the head turns, so by default each cell's value is the RESIDUAL
 * (stylized − clean, i.e. what the paint adds) and crawl = mean over moving cells of |Δ residual|,
 * as % of full scale. ("excess" mode instead subtracts the clean render's own per-cell change.)
 */

export interface CoordFrame {
  /** RGBA8 surface-coordinate pass (A > 0 = character pixel). */
  coords: Uint8Array | Uint8ClampedArray;
  /** RGBA8 image of the version under test, same size. */
  image: Uint8Array | Uint8ClampedArray;
}

export interface CellStats {
  sum: Float64Array;
  count: Uint32Array;
  keys: Map<number, number>;
}

const luma = (d: ArrayLike<number>, i: number) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

export interface CellMean {
  mean: number;
  n: number;
  /** Centroid of the cell's pixels (pixel units), to tell moving cells from still ones. */
  x: number;
  y: number;
}

/**
 * Mean brightness (and pixel centroid) per surface cell. `width` is the image width in pixels.
 * With `base`, the value per pixel is the residual image − base (what the stylisation added).
 */
export function cellMeans(coords: ArrayLike<number>, image: ArrayLike<number>, width = 1, base?: ArrayLike<number>): Map<number, CellMean> {
  const acc = new Map<number, { s: number; n: number; x: number; y: number }>();
  for (let i = 0, p = 0; i + 3 < coords.length; i += 4, p++) {
    if (coords[i + 3] < 128) continue;
    const key = coords[i] | (coords[i + 1] << 8) | (coords[i + 2] << 16);
    const a = acc.get(key);
    const l = base ? luma(image, i) - luma(base, i) : luma(image, i);
    const x = p % width, y = Math.floor(p / width);
    if (a) {
      a.s += l;
      a.n++;
      a.x += x;
      a.y += y;
    } else acc.set(key, { s: l, n: 1, x, y });
  }
  const out = new Map<number, CellMean>();
  for (const [k, a] of acc) out.set(k, { mean: a.s / a.n, n: a.n, x: a.x / a.n, y: a.y / a.n });
  return out;
}

/** |Δ mean| per cell seen in both frames, plus how far the cell moved on screen. */
function cellDeltas(a: Map<number, CellMean>, b: Map<number, CellMean>, minCount: number) {
  const out = new Map<number, { d: number; move: number }>();
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb || va.n < minCount || vb.n < minCount) continue;
    out.set(k, { d: Math.abs(vb.mean - va.mean), move: Math.hypot(vb.x - va.x, vb.y - va.y) });
  }
  return out;
}

export interface CrawlResult {
  /** Excess change attached cells show beyond the clean render, % of full scale (0 = perfectly stuck). */
  crawl: number;
  /** Raw mean change per cell, % (before subtracting the clean render). */
  raw: number;
  /** Surface cells compared. */
  cells: number;
  /** Of which moved on screen (the ones that can crawl). */
  moving: number;
}

/**
 * Crawl between frames a → b. `cleanA`/`cleanB` are the clean renders' images for the same two
 * moments (same coordinate passes); without them the raw change is reported as crawl.
 */
export interface CrawlOptions {
  /** Image width in pixels (for cell centroids). */
  width?: number;
  minCount?: number;
  /** Only cells that moved at least this far (px) are scored; still cells can't crawl. */
  minMove?: number;
  /**
   * "residual" (default with a clean render): compare what the stylisation ADDS (image − clean)
   * per cell, so lighting that moves across the surface cancels out. "excess": compare
   * brightness and subtract the clean render's own change per cell.
   */
  mode?: "residual" | "excess";
}

export function crawlBetween(a: CoordFrame, b: CoordFrame, clean?: { a: ArrayLike<number>; b: ArrayLike<number> }, opts: CrawlOptions = {}): CrawlResult {
  const { width = 1, minCount = 3, minMove = 0, mode = "residual" } = opts;
  const residual = !!clean && mode === "residual";
  const da = cellDeltas(cellMeans(a.coords, a.image, width, residual ? clean.a : undefined), cellMeans(b.coords, b.image, width, residual ? clean.b : undefined), minCount);
  const dc = clean && !residual ? cellDeltas(cellMeans(a.coords, clean.a, width), cellMeans(b.coords, clean.b, width), minCount) : null;
  let raw = 0;
  let excess = 0;
  let n = 0;
  for (const [k, d] of da) {
    if (d.move < minMove) continue;
    raw += d.d;
    excess += Math.max(0, d.d - (dc?.get(k)?.d ?? 0));
    n++;
  }
  return { crawl: n ? (100 * excess) / n : 0, raw: n ? (100 * raw) / n : 0, cells: da.size, moving: n };
}

/** Exponential moving average, for the live readout. */
export const ema = (prev: number | null, next: number, k = 0.25) => (prev === null || !Number.isFinite(prev) ? next : prev + (next - prev) * k);

/**
 * Per-pixel frame difference as a heat value (0–1) for the Inspect diff strip. With the clean
 * frames it maps the change of the residual (what the paint adds), like the metric does.
 */
export function diffMap(a: ArrayLike<number>, b: ArrayLike<number>, gain = 4, clean?: { a: ArrayLike<number>; b: ArrayLike<number> }): Float32Array {
  const out = new Float32Array(Math.floor(a.length / 4));
  for (let i = 0, j = 0; i + 3 < a.length; i += 4, j++) {
    const d = clean ? luma(a, i) - luma(clean.a, i) - (luma(b, i) - luma(clean.b, i)) : luma(a, i) - luma(b, i);
    out[j] = Math.min(1, Math.abs(d) * gain);
  }
  return out;
}
