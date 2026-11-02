import { type Bezier, type CurvePresetId, clampBezier, matchPreset, presetCurves } from "./bezier";

/** Frames per second of the animation (film rate). The display holds each frame; nothing is interpolated. */
export const FPS = 24;

/**
 * World scale: the character's body is 1 unit tall, which we call 0.5 m. Real gravity in units/s² follows.
 * Used only for the "implied gravity" readout and the prompt phrase.
 */
export const BODY_HEIGHT = 1;
export const BODY_HALF_W = 0.43;
export const METERS_PER_UNIT = 0.5;
export const G_REAL = 9.81 / METERS_PER_UNIT;

/** Most horizontal travel of a whole performance (the lane), in units. */
export const TRAVEL = 5.2;
/** Horizontal speed in flight before any friction, units per frame. Long, floaty performances are capped at TRAVEL. */
export const FLIGHT_VX = 0.072;

export type WeightPresetId = "bowling" | "rubber" | "beach" | "balloon";

export interface MotionParams {
  /** Last weight preset applied; null once a weight-defining value has been edited. */
  weight: WeightPresetId | null;
  /** Height of the first apex (bottom of the body above the floor), units. */
  height: number;
  /** Frames from takeoff to the first landing. */
  airFrames: number;
  /** Coefficient of restitution: rebound speed / impact speed. Heights shrink by e², airtime by e. */
  restitution: number;
  /** Frames the body stays on the floor at each impact (≥ 1: the contact frame itself). */
  contactFrames: number;
  /** Horizontal speed kept through each impact (friction). */
  drift: number;
  /** Squash & stretch amount, 0 = rigid, 1 = exaggerated. */
  squash: number;
  /** Anticipation depth, 0 = none. */
  anticipation: number;
  /** Frames of windup before takeoff. */
  anticipationFrames: number;
  /** Overlapping action on the antenna, 0 = rigid. */
  followThrough: number;
  /** Height curve of every rise (floor → apex) and fall (apex → floor). */
  rise: Bezier;
  fall: Bezier;
  /** Keep the fall the time-mirror of the rise while editing. */
  linkCurves: boolean;
  /** true: rebound airtime shrinks with √height (physics). false: every rebound takes as long as the first (wrong on purpose). */
  physicalTiming: boolean;
  /** Animate on twos: hold every drawing for two frames (12 drawings per second). */
  onTwos: boolean;
  /** Most rebounds after the first landing. */
  maxBounces: number;
}

export const LIMITS = {
  height: [0.6, 3.2],
  airFrames: [8, 60],
  restitution: [0.1, 0.9],
  contactFrames: [1, 4],
  drift: [0, 1],
  squash: [0, 1],
  anticipation: [0, 1],
  anticipationFrames: [0, 24],
  followThrough: [0, 1],
  maxBounces: [0, 8],
} as const satisfies Partial<Record<keyof MotionParams, readonly [number, number]>>;

type WeightValues = Pick<MotionParams, "height" | "airFrames" | "restitution" | "contactFrames" | "drift" | "squash">;

export const WEIGHT_PRESETS: Record<WeightPresetId, { label: string; blurb: string; values: WeightValues }> = {
  bowling: {
    label: "Bowling ball",
    blurb: "Drops fast, barely rebounds, hardly deforms, stops dead.",
    values: { height: 1.5, airFrames: 14, restitution: 0.32, contactFrames: 2, drift: 0.45, squash: 0.12 },
  },
  rubber: {
    label: "Rubber ball",
    blurb: "Real-world gravity, lively shrinking rebounds, springy squash.",
    values: { height: 2.4, airFrames: 24, restitution: 0.72, contactFrames: 1, drift: 0.85, squash: 0.55 },
  },
  beach: {
    label: "Beach ball",
    blurb: "Air drag makes it hang; slow arcs, soft landings, drifts on.",
    values: { height: 2.6, airFrames: 34, restitution: 0.68, contactFrames: 2, drift: 0.92, squash: 0.45 },
  },
  balloon: {
    label: "Balloon",
    blurb: "Barely any weight: very long hang time, lazy drifting bounces.",
    values: { height: 2.2, airFrames: 52, restitution: 0.45, contactFrames: 3, drift: 0.97, squash: 0.45 },
  },
};

export const WEIGHT_IDS = Object.keys(WEIGHT_PRESETS) as WeightPresetId[];
export const WEIGHT_KEYS = ["height", "airFrames", "restitution", "contactFrames", "drift", "squash"] as const satisfies readonly (keyof MotionParams)[];

export const DEFAULT_PARAMS: MotionParams = {
  weight: "rubber",
  ...WEIGHT_PRESETS.rubber.values,
  anticipation: 0.6,
  anticipationFrames: 8,
  followThrough: 0.7,
  ...presetCurves("gravity"),
  linkCurves: true,
  physicalTiming: true,
  onTwos: false,
  maxBounces: 6,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const INT_KEYS = new Set<keyof MotionParams>(["airFrames", "contactFrames", "anticipationFrames", "maxBounces"]);

/** Clamp every value into range and round integer fields. Never throws; unknown keys are dropped. */
export function sanitize(p: MotionParams): MotionParams {
  const out: MotionParams = { ...p, rise: clampBezier(p.rise), fall: clampBezier(p.fall) };
  for (const [k, [lo, hi]] of Object.entries(LIMITS) as [keyof typeof LIMITS, readonly [number, number]][]) {
    const v = Number.isFinite(out[k]) ? out[k] : DEFAULT_PARAMS[k];
    out[k] = INT_KEYS.has(k) ? Math.round(clamp(v, lo, hi)) : clamp(v, lo, hi);
  }
  return out;
}

export function applyWeight(p: MotionParams, id: WeightPresetId): MotionParams {
  return { ...p, ...WEIGHT_PRESETS[id].values, weight: id };
}

export function applyCurvePreset(p: MotionParams, id: CurvePresetId): MotionParams {
  return { ...p, ...presetCurves(id) };
}

export function curvePresetOf(p: MotionParams): CurvePresetId | null {
  return matchPreset(p.rise, p.fall);
}

/** Merge a partial update. Editing a weight-defining value detaches the weight preset unless it still matches. */
export function updateParams(p: MotionParams, patch: Partial<MotionParams>): MotionParams {
  let next = sanitize({ ...p, ...patch });
  if (patch.weight) next = sanitize(applyWeight(next, patch.weight));
  else if (WEIGHT_KEYS.some((k) => k in patch)) next.weight = weightPresetOf(next);
  return next;
}

export function weightPresetOf(p: MotionParams): WeightPresetId | null {
  for (const id of WEIGHT_IDS) {
    const v = WEIGHT_PRESETS[id].values;
    if (WEIGHT_KEYS.every((k) => Math.abs(v[k] - p[k]) < 1e-6)) return id;
  }
  return null;
}

/** Gravity implied by an arc of height h (units) lasting n frames, as a multiple of real gravity at our scale. */
export function impliedGravity(height: number, airFrames: number, fps = FPS) {
  const t = airFrames / fps;
  return (8 * height) / (t * t) / G_REAL;
}

/** Airtime (frames) a real object needs for an arc of this height. */
export function physicalAirFrames(height: number, fps = FPS) {
  return 2 * Math.sqrt((2 * height) / G_REAL) * fps;
}
