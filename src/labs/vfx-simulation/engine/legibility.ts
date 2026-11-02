import { fromCard, IMPACT } from "./beat";

/**
 * Legibility: can the audience read the splash as a shape on this frame? Measured, not asserted.
 * Each frame the airborne splash (not the puddle) is rasterised into a side-on occupancy grid
 * (2.5 cm cells over the splash area). A frame counts as legible when the silhouette is
 *   - big enough to see (AREA_MIN cells),
 *   - mostly one shape (the largest piece holds SOLID_MIN of it; pieces under 5 cm apart group), and
 *   - stable (intersection-over-union with the previous frame ≥ STABLE_MIN), because a shape that is
 *     different on every frame is noise to the eye however correct it is.
 * The headline number is the longest run of consecutive legible frames: how long the shape is held.
 */
export const GRID = { x0: -0.5, x1: 1.3, y0: 0.035, y1: 1.035, cell: 0.025 } as const;
export const GW = Math.round((GRID.x1 - GRID.x0) / GRID.cell);
export const GH = Math.round((GRID.y1 - GRID.y0) / GRID.cell);
export const AREA_MIN = 24;
export const SOLID_MIN = 0.6;
export const STABLE_MIN = 0.5;

export type Prim = { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; rot: number } | { kind: "poly"; pts: number[] };

export const newGrid = () => new Uint8Array(GW * GH);

const cellX = (x: number) => Math.floor((x - GRID.x0) / GRID.cell);
const cellY = (y: number) => Math.floor((y - GRID.y0) / GRID.cell);

/** Mark the cell of every particle (x, y, z triples; NaN = not released). */
export function rasterParticles(pos: Float32Array, n: number, grid: Uint8Array) {
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1];
    if (!(y >= GRID.y0)) continue;
    const cx = cellX(pos[i * 3]);
    const cy = cellY(y);
    if (cx >= 0 && cx < GW && cy >= 0 && cy < GH) grid[cy * GW + cx] = 1;
  }
}

function inPoly(x: number, y: number, pts: number[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Fill cells whose centres fall inside the primitives. */
export function rasterPrims(prims: Prim[], grid: Uint8Array) {
  for (const p of prims) {
    let x0: number, x1: number, y0: number, y1: number;
    if (p.kind === "ellipse") {
      const m = Math.max(p.rx, p.ry);
      x0 = p.cx - m;
      x1 = p.cx + m;
      y0 = p.cy - m;
      y1 = p.cy + m;
    } else {
      x0 = y0 = Infinity;
      x1 = y1 = -Infinity;
      for (let i = 0; i < p.pts.length; i += 2) {
        x0 = Math.min(x0, p.pts[i]);
        x1 = Math.max(x1, p.pts[i]);
        y0 = Math.min(y0, p.pts[i + 1]);
        y1 = Math.max(y1, p.pts[i + 1]);
      }
    }
    const c = Math.cos(p.kind === "ellipse" ? -p.rot : 0);
    const s = Math.sin(p.kind === "ellipse" ? -p.rot : 0);
    for (let cy = Math.max(0, cellY(y0)); cy <= Math.min(GH - 1, cellY(y1)); cy++) {
      const y = GRID.y0 + (cy + 0.5) * GRID.cell;
      for (let cx = Math.max(0, cellX(x0)); cx <= Math.min(GW - 1, cellX(x1)); cx++) {
        const x = GRID.x0 + (cx + 0.5) * GRID.cell;
        let hit: boolean;
        if (p.kind === "ellipse") {
          const dx = x - p.cx;
          const dy = y - p.cy;
          const u = dx * c - dy * s;
          const v = dx * s + dy * c;
          hit = (u * u) / (p.rx * p.rx) + (v * v) / (p.ry * p.ry) <= 1;
        } else hit = inPoly(x, y, p.pts);
        if (hit) grid[cy * GW + cx] = 1;
      }
    }
  }
}

/** Card-space polygons (hand-drawn) → world-plane polygons at the splash depth. */
export function cardToWorld(polys: number[][]): Prim[] {
  return polys.map((pts) => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = fromCard(pts[i], pts[i + 1], IMPACT.z);
      out.push(x, y);
    }
    return { kind: "poly" as const, pts: out };
  });
}

export interface FrameMetric {
  area: number;
  pieces: number;
  solid: number;
  iou: number;
  legible: boolean;
}

/**
 * Connected pieces of a grid. Shapes with at most two empty cells (5 cm) between them are grouped first
 * (a one-cell dilation), because the eye reads a crown and the drops just off its tips as one splash.
 * Returns the number of pieces and the share of filled cells in the largest.
 */
export function pieces(grid: Uint8Array): { count: number; largest: number } {
  const dil = new Uint8Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) continue;
    const cx = i % GW;
    const cy = (i - cx) / GW;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < GW && y < GH) dil[y * GW + x] = 1;
      }
  }
  const label = new Int32Array(grid.length).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < dil.length; i++) {
    if (!dil[i] || label[i] >= 0) continue;
    const id = sizes.length;
    sizes.push(0);
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const c = stack.pop()!;
      if (grid[c]) sizes[id]++;
      const cx = c % GW;
      const cy = (c - cx) / GW;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          const j = y * GW + x;
          if (dil[j] && label[j] < 0) {
            label[j] = id;
            stack.push(j);
          }
        }
    }
  }
  return { count: sizes.filter((n) => n > 0).length, largest: sizes.length ? Math.max(...sizes) : 0 };
}

export function frameMetric(cur: Uint8Array, prev: Uint8Array | null): FrameMetric {
  let area = 0;
  let inter = 0;
  let uni = 0;
  for (let i = 0; i < cur.length; i++) {
    area += cur[i];
    if (prev) {
      inter += cur[i] & prev[i];
      uni += cur[i] | prev[i];
    }
  }
  const pc = pieces(cur);
  const solid = area ? pc.largest / area : 0;
  const iou = prev ? (uni ? inter / uni : 0) : 0;
  return { area, pieces: pc.count, solid, iou, legible: area >= AREA_MIN && solid >= SOLID_MIN && iou >= STABLE_MIN };
}

export interface Legibility {
  frames: FrameMetric[];
  legibleFrames: number;
  /** Longest run of consecutive legible frames. */
  longestRun: number;
  runStart: number;
  /** First legible frame at or after the impact frame (−1 = never). */
  firstAfterImpact: number;
  /** Silhouette pieces on the frame with the most splash area (a noise measure). */
  piecesAtPeak: number;
}

/** Run the metric over every frame of the loop. `gridAt(frame, grid)` fills a cleared grid. */
export function measure(frames: number, gridAt: (frame: number, grid: Uint8Array) => void, impactFrame: number): Legibility {
  const out: FrameMetric[] = [];
  let prev: Uint8Array | null = null;
  let run = 0;
  let best = 0;
  let bestStart = -1;
  let first = -1;
  let peakArea = -1;
  let piecesAtPeak = 0;
  for (let f = 0; f < frames; f++) {
    const g = newGrid();
    gridAt(f, g);
    const m = frameMetric(g, prev);
    out.push(m);
    if (m.legible) {
      run++;
      if (run > best) {
        best = run;
        bestStart = f - run + 1;
      }
      if (first < 0 && f >= impactFrame) first = f;
    } else run = 0;
    if (m.area > peakArea && f >= impactFrame) {
      peakArea = m.area;
      piecesAtPeak = m.pieces;
    }
    prev = g;
  }
  return { frames: out, legibleFrames: out.filter((m) => m.legible).length, longestRun: best, runStart: bestStart, firstAfterImpact: first, piecesAtPeak };
}
