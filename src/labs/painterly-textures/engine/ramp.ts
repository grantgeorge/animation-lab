/**
 * Painterly shading: a smooth light amount becomes 2–4 painted value bands.
 * The same maths runs in the material shader (render/glsl.ts → ptRamp); this file is the
 * reference the tests and the Inspect ramp curve use.
 */

export interface RampParams {
  /** Number of painted value bands (2–4). */
  bands: number;
  /** Half-width of each band edge, in light-amount units (0 = a hard cut). */
  soft: number;
  /** Light-amount range the edges are spread over. */
  lo: number;
  hi: number;
  /** Output value of the darkest and lightest band. */
  qMin: number;
  qMax: number;
}

export const DEFAULT_RAMP: RampParams = { bands: 3, soft: 0.015, lo: 0.12, hi: 0.88, qMin: 0.16, qMax: 0.86 };

/** Light amount x ∈ [0, 1) from scene irradiance L (a Reinhard-style squash around `mid`). */
export const lightToAmount = (L: number, mid: number) => Math.max(0, L) / (Math.max(0, L) + mid);

/** Inverse of lightToAmount, capped so the brightest band stays finite. */
export const amountToLight = (q: number, mid: number) => (mid * q) / Math.max(1 - q, 0.06);

/** Positions of the N − 1 band edges. */
export function bandEdges(p: Pick<RampParams, "bands" | "lo" | "hi">): number[] {
  const n = Math.max(2, Math.round(p.bands));
  const out: number[] = [];
  for (let i = 1; i < n; i++) out.push(p.lo + ((p.hi - p.lo) * i) / n);
  return out;
}

const smoothstep = (a: number, b: number, x: number) => {
  if (a === b) return x < a ? 0 : 1;
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Banded value for light amount x: a staircase of N plateaus between qMin and qMax. */
export function rampValue(x: number, p: RampParams = DEFAULT_RAMP): number {
  const edges = bandEdges(p);
  let acc = 0;
  for (const e of edges) acc += smoothstep(e - p.soft, e + p.soft, x);
  return p.qMin + ((p.qMax - p.qMin) * acc) / edges.length;
}

/** Which band (0 = deepest shadow) light amount x falls in. */
export function bandIndex(x: number, p: Pick<RampParams, "bands" | "lo" | "hi">): number {
  return bandEdges(p).filter((e) => x >= e).length;
}

/** Sampled curve for the Inspect plot: [x, smooth input, banded output]. */
export function rampCurve(p: RampParams, samples = 121): { x: number; smooth: number; banded: number }[] {
  const out: { x: number; smooth: number; banded: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const x = i / (samples - 1);
    out.push({ x, smooth: p.qMin + (p.qMax - p.qMin) * x, banded: rampValue(x, p) });
  }
  return out;
}

/** Distinct plateaus in a sampled curve (used by tests and the Inspect readout). */
export function countPlateaus(values: number[], eps = 1e-3): number {
  const levels: number[] = [];
  for (const v of values) if (!levels.some((l) => Math.abs(l - v) < eps)) levels.push(v);
  return levels.length;
}
