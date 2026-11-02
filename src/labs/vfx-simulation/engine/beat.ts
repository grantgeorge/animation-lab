import { FPS, LOOP_S, type Step } from "./timing";
import { clamp01, easeIn, easeOut, lerp, smoothstep } from "./rng";

/**
 * The beat: Pip kicks a bucket of water over. Every treatment shares the kick; each times the rest
 * its own way. All positions in metres, floor at y = 0, the camera looks down −Z.
 */
export type Treatment = "real" | "cartoon" | "drawn";
export const TREATMENTS: readonly Treatment[] = ["real", "cartoon", "drawn"];

export interface Phys {
  /** × 9.81 m/s². */
  gravity: number;
  /** 0 thin as water … 1 thick as syrup. */
  viscosity: number;
  /** Kick and splash energy (the effect reacts to the character). */
  intensity: number;
  /** Realistic droplets (quality-capped); also sets how many drops the stylized treatments draw. */
  count: number;
  turbulence: number;
  /** Realistic: art-directed retime. Cartoon: exaggeration. Hand-drawn: graphic simplification. */
  stylization: number;
}

export interface Timing {
  step: Step;
  /** Frames the splash peak is held. */
  hold: number;
  /** Frames of anticipation before the bucket goes over. */
  antic: number;
}

export const PHYS_DEFAULT: Phys = { gravity: 1, viscosity: 0.15, intensity: 1, count: 2400, turbulence: 0.25, stylization: 0.6 };
export const TIMING_DEFAULT: Record<Treatment, Timing> = {
  real: { step: 1, hold: 0, antic: 0 },
  cartoon: { step: 1, hold: 7, antic: 4 },
  drawn: { step: 2, hold: 8, antic: 4 },
};
export const LIMITS = {
  gravity: [0.4, 2],
  viscosity: [0, 1],
  intensity: [0.4, 1.6],
  turbulence: [0, 1],
  stylization: [0, 1],
  hold: [0, 16],
  antic: [0, 10],
  offset: [-10, 14],
} as const;
/** Realistic droplet caps by quality tier (the e2e path runs on software WebGL). */
export const COUNT_RANGE = { min: 300, high: 4800, low: 1200, e2e: 600 } as const;

/** Set marks. */
export const PIP_X = -0.8;
export const BUCKET = { x: -0.36, z: 0, rTop: 0.15, rBot: 0.115, h: 0.27, fill: 0.78 } as const;
/** Where the stylized slab lands. The realistic sim finds its own landing spot. */
export const IMPACT = { x: 0.42, z: 0.04 } as const;
export const KICK_T = 0.82;
const f = (n: number) => n / FPS;

export interface BeatTimes {
  kick: number;
  /** Bucket starts going over / is on its side. */
  tipStart: number;
  tipEnd: number;
  /** Water leaves the bucket. */
  release: number;
  /** Main mass meets the floor. */
  impact: number;
  /** Splash at its peak shape. */
  peak: number;
  holdEnd: number;
  /** Crown gone, drops landed. */
  collapse: number;
  settle: number;
  /** Pip's flinch. */
  recoil: number;
}

/** Pip flinches this many frames after the water lands, when in sync. */
export const SYNC_LAG = 2;

/** Key times for one treatment. `lag` (frames) is Pip's flinch after the water lands (negative = before). */
export function beatTimes(tr: Treatment, p: Phys, tm: Timing, lag = SYNC_LAG): BeatTimes {
  const gs = 1 / Math.sqrt(p.gravity);
  const kick = KICK_T;
  if (tr === "real") {
    // physical: no anticipation in the water, a fall that scales with 1/√g
    const tipStart = kick + f(tm.antic);
    const tipEnd = tipStart + 0.36 * gs;
    const release = tipStart + 0.13 * gs;
    const impact = tipStart + 0.6 * gs - 0.19;
    const peak = impact + 0.13 * gs;
    const holdEnd = peak + f(tm.hold);
    return { kick, tipStart, tipEnd, release, impact, peak, holdEnd, collapse: holdEnd + 0.3 * gs, settle: holdEnd + 1.0, recoil: impact + f(lag) };
  }
  // authored: squash on contact, rear back (anticipation), whip over, slab flies, crown pops and holds
  const tipStart = kick + f(2 + tm.antic);
  const tipEnd = tipStart + f(4) * Math.sqrt(gs);
  const release = tipStart + f(1);
  const impact = release + 0.2 * gs;
  const rise = f(4 + 2 * p.viscosity) * (0.85 + 0.15 * p.intensity);
  const peak = impact + f(1) + rise;
  const holdEnd = peak + f(tm.hold);
  const collapse = holdEnd + 0.4 * gs;
  return { kick, tipStart, tipEnd, release, impact, peak, holdEnd, collapse, settle: collapse + 0.35, recoil: impact + f(lag) };
}

export interface BucketPose {
  /** Degrees about Z; negative tips toward +X (away from Pip), positive rears back toward him. */
  angle: number;
  /** Squash along the bucket's own axis (1 = rest). */
  squash: number;
  /** Slide along X (m). */
  slide: number;
  /** Fraction of the water still in the bucket (for the surface disc). */
  water: number;
}

/** The bucket: a rigid prop, keyed (it is the same prop in every treatment; only its timing changes). */
export function bucketPose(tr: Treatment, t: number, b: BeatTimes): BucketPose {
  if (t < b.kick) return { angle: 0, squash: 1, slide: 0, water: 1 };
  if (tr === "real") {
    const u = clamp01((t - b.tipStart) / (b.tipEnd - b.tipStart));
    let angle = -96 * u * u;
    if (t > b.tipEnd) {
      const v = t - b.tipEnd;
      angle = -96 + 7 * Math.exp(-9 * v) * Math.sin(Math.min(v, 0.6) * 22);
    }
    const slide = 0.05 * easeOut(clamp01((t - b.kick) / 0.25));
    return { angle, squash: 1, slide, water: 1 - smoothstep(18, 92, -angle) };
  }
  let angle = 0;
  let squash = 1;
  if (t < b.kick + f(2)) squash = lerp(1, 0.8, easeOut((t - b.kick) / f(2)));
  else if (t < b.tipStart) {
    const u = (t - b.kick - f(2)) / Math.max(1e-6, b.tipStart - b.kick - f(2));
    angle = 13 * easeOut(u);
    squash = lerp(0.8, 1.07, easeOut(u * 1.6));
  } else if (t < b.tipEnd) {
    const u = (t - b.tipStart) / (b.tipEnd - b.tipStart);
    angle = lerp(b.tipStart > b.kick + f(2.5) ? 13 : 0, -104, easeIn(u * 0.7 + 0.3 * u * u));
    squash = lerp(1.07, 1.12, u);
  } else {
    const v = t - b.tipEnd;
    angle = -95 - 9 * Math.exp(-10 * v) * Math.cos(v * 26);
    squash = 1 - 0.16 * Math.exp(-14 * v) * Math.cos(v * 30);
  }
  const slide = 0.07 * easeOut(clamp01((t - b.kick) / 0.3));
  return { angle, squash, slide, water: t < b.release ? 1 : 0 };
}

/** Rotate (x, y) about pivot (px, py) by deg. */
function rot(x: number, y: number, px: number, py: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - px;
  const dy = y - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c];
}

export interface BucketFrame {
  pivot: [number, number];
  /** Bucket-local (x right of its axis, y up from its base) → world XY. */
  toWorld: (lx: number, ly: number) => [number, number];
  mouth: [number, number];
  /** Unit vector out of the mouth. */
  dir: [number, number];
}

export function bucketFrame(pose: BucketPose): BucketFrame {
  const cx = BUCKET.x + pose.slide;
  const pivot: [number, number] = pose.angle <= 0 ? [cx + BUCKET.rBot, 0] : [cx - BUCKET.rBot, 0];
  const toWorld = (lx: number, ly: number) => rot(cx + lx, ly * pose.squash, pivot[0], pivot[1], pose.angle);
  const mouth = toWorld(0, BUCKET.h);
  const base = toWorld(0, 0);
  const len = Math.hypot(mouth[0] - base[0], mouth[1] - base[1]) || 1;
  return { pivot, toWorld, mouth, dir: [(mouth[0] - base[0]) / len, (mouth[1] - base[1]) / len] };
}

/** The bucket camera (fixed). Looks down −Z at the kick. */
export const CAM = { pos: [-0.1, 0.92, 3.45] as const, target: [-0.13, 0.43, 0] as const, fovDeg: 27 };
/** The hand-drawn treatment's paper: a vertical card at z = CARD.z, in world metres. */
export const CARD = { z: 0.24, x0: -0.95, x1: 1.45, y0: -0.02, y1: 1.18 } as const;
/** Floor decal for the hand-drawn puddle (x, z extents). */
export const DECAL = { x0: -0.55, x1: 1.55, z0: -0.7, z1: 0.9 } as const;

/** World point → the point on the card plane the camera sees it through (card coords = world x, y). */
export function toCard(x: number, y: number, z: number): [number, number] {
  const [cx, cy, cz] = CAM.pos;
  const s = (cz - CARD.z) / (cz - z);
  return [cx + (x - cx) * s, cy + (y - cy) * s];
}
/** Card point → world (x, y) on the plane z. */
export function fromCard(u: number, v: number, z: number): [number, number] {
  const [cx, cy, cz] = CAM.pos;
  const s = (cz - CARD.z) / (cz - z);
  return [cx + (u - cx) / s, cy + (v - cy) / s];
}

/** Loop time helpers. */
export const wrapT = (t: number) => ((t % LOOP_S) + LOOP_S) % LOOP_S;
