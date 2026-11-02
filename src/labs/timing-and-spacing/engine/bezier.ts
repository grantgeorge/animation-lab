/**
 * Cubic-bezier timing curves (the same shape a DCC graph editor or CSS `cubic-bezier()` uses).
 * P0 = (0, 0), P1 = (x1, y1), P2 = (x2, y2), P3 = (1, 1). x is normalised time, y is normalised progress.
 * x1, x2 are kept in [0, 1] so the curve is a function of time; y may overshoot a little.
 */
export interface Bezier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const Y_MIN = -0.3;
export const Y_MAX = 1.3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampBezier(b: Bezier): Bezier {
  return { x1: clamp(b.x1, 0, 1), y1: clamp(b.y1, Y_MIN, Y_MAX), x2: clamp(b.x2, 0, 1), y2: clamp(b.y2, Y_MIN, Y_MAX) };
}

const coord = (p1: number, p2: number, t: number) => {
  const m = 1 - t;
  return 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t;
};
const dcoord = (p1: number, p2: number, t: number) => {
  const m = 1 - t;
  return 3 * m * m * p1 + 6 * m * t * (p2 - p1) + 3 * t * t * (1 - p2);
};

/** Curve parameter t whose x equals `x` (Newton with a bisection fallback; exact to ~1e-7). */
export function solveT(b: Bezier, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = coord(b.x1, b.x2, t) - x;
    if (Math.abs(err) < 1e-7) return t;
    const d = dcoord(b.x1, b.x2, t);
    if (Math.abs(d) < 1e-6) break;
    t = clamp(t - err / d, 0, 1);
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 40; i++) {
    const v = coord(b.x1, b.x2, t);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return t;
}

/** Progress (y) at normalised time u (x). */
export function ease(b: Bezier, u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return coord(b.y1, b.y2, solveT(b, u));
}

/** dy/du, by a symmetric difference that stays inside [0, 1]. */
export function easeSlope(b: Bezier, u: number, h = 1e-4): number {
  const a = clamp(u - h, 0, 1);
  const c = clamp(u + h, 0, 1);
  return (ease(b, c) - ease(b, a)) / (c - a);
}

/** Point reflection through (0.5, 0.5): the time-reversed curve, used to mirror a rise into a fall. */
export function mirrorBezier(b: Bezier): Bezier {
  return { x1: 1 - b.x2, y1: 1 - b.y2, x2: 1 - b.x1, y2: 1 - b.y1 };
}

export function bezierEquals(a: Bezier, b: Bezier, eps = 1e-6) {
  return Math.abs(a.x1 - b.x1) < eps && Math.abs(a.y1 - b.y1) < eps && Math.abs(a.x2 - b.x2) < eps && Math.abs(a.y2 - b.y2) < eps;
}

export type CurvePresetId = "linear" | "easeIn" | "easeOut" | "easeInOut" | "gravity";

/**
 * Presets describe the RISE (floor → apex); the fall uses the mirrored curve so the arc is symmetric.
 * `gravity` is an exact parabola: 1 − (1 − u)² is a quadratic bezier with control (½, 1), elevated to cubic.
 */
export const CURVE_PRESETS: Record<CurvePresetId, { label: string; rise: Bezier; hint: string }> = {
  linear: { label: "Linear", rise: { x1: 1 / 3, y1: 1 / 3, x2: 2 / 3, y2: 2 / 3 }, hint: "Constant speed, sharp turnarounds at the top and the floor" },
  easeIn: { label: "Ease in", rise: { x1: 0.42, y1: 0, x2: 1, y2: 1 }, hint: "Starts slow, ends fast: lingers on the floor, spikes at the top" },
  easeOut: { label: "Ease out", rise: { x1: 0, y1: 0, x2: 0.58, y2: 1 }, hint: "Starts fast, ends slow: snaps off the floor, hangs at the top" },
  easeInOut: { label: "Ease in-out", rise: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }, hint: "Slow at the top AND the floor: soft, cushioned landings" },
  gravity: { label: "Gravity", rise: { x1: 1 / 3, y1: 2 / 3, x2: 2 / 3, y2: 1 }, hint: "Exact parabola: hangs at the top, full speed into the floor" },
};

export const CURVE_PRESET_IDS = Object.keys(CURVE_PRESETS) as CurvePresetId[];

export function presetCurves(id: CurvePresetId): { rise: Bezier; fall: Bezier } {
  const rise = { ...CURVE_PRESETS[id].rise };
  return { rise, fall: mirrorBezier(rise) };
}

/** The preset a (rise, fall) pair matches exactly, if any. */
export function matchPreset(rise: Bezier, fall: Bezier): CurvePresetId | null {
  for (const id of CURVE_PRESET_IDS) {
    const p = presetCurves(id);
    if (bezierEquals(p.rise, rise, 1e-4) && bezierEquals(p.fall, fall, 1e-4)) return id;
  }
  return null;
}

/**
 * How eased each end of an arc is, as slopes relative to linear (1 = linear, 0 = fully eased, 2 = gravity's impact).
 * apex: speed arriving at / leaving the top. contact: speed leaving / arriving at the floor. Averaged over rise and fall.
 */
export function arcCharacter(rise: Bezier, fall: Bezier) {
  const apex = (easeSlope(rise, 1, 0.02) + easeSlope(fall, 0, 0.02)) / 2;
  const contact = (easeSlope(rise, 0, 0.02) + easeSlope(fall, 1, 0.02)) / 2;
  return { apex, contact };
}
