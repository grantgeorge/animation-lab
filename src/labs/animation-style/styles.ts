import { BEATS, DURATION, RUN_START, squashAt, type LayerWeights } from './performance';

export const FPS = 24;
export type Cadence = 1 | 2 | 3 | 4;

/** A movement style is a recipe of principle settings applied to the same choreography. */
export interface Recipe extends LayerWeights {
  /** Frames each pose is held for on a 24 fps timeline. */
  cadence: Cadence;
  squash: number;
  /** 0 = move evenly between key poses; 1 = hold each pose and snap to the next. */
  holds: number;
  /** Per-pose handling wobble (stop motion), in metres. */
  jitter: number;
}
export type MotionId = 'naturalistic' | 'cartoony' | 'limited' | 'snappy' | 'stopmotion';
export interface MotionStyle { id: MotionId; label: string; short: string; recipe: Recipe; watch: string; prompt: string }

export const MOTIONS: MotionStyle[] = [
  { id: 'naturalistic', label: 'Naturalistic', short: 'Grounded', recipe: { cadence: 1, exaggeration: 0.8, anticipation: 0.35, followThrough: 0.7, squash: 0, holds: 0, jitter: 0 },
    watch: 'A small, quick flinch, then real weight on the landing. Nothing is bigger than a person would do.',
    prompt: 'grounded, naturalistic acting: believable weight and balance, restrained reaction, smooth motion on ones' },
  { id: 'cartoony', label: 'Cartoony', short: 'Exaggerated', recipe: { cadence: 1, exaggeration: 1.45, anticipation: 1.5, followThrough: 1.4, squash: 1, holds: 0.15, jitter: 0 },
    watch: 'A big crouch before the jump, a stretched take, a squashed landing and arms that overshoot and settle.',
    prompt: 'cartoony, exaggerated acting: strong anticipation, big squash and stretch, overshoot and settle, smooth motion on ones' },
  { id: 'limited', label: 'Limited', short: 'Anime TV', recipe: { cadence: 3, exaggeration: 1.1, anticipation: 0.2, followThrough: 0.15, squash: 0, holds: 0.85, jitter: 0 },
    watch: 'Few drawings. Long held poses, a sudden jump to the next one, then a dramatic hold on the reaction.',
    prompt: 'limited animation: long held key poses, sudden transitions, minimal in-betweens, animated on threes' },
  { id: 'snappy', label: 'Snappy stepped', short: 'Pose to pose', recipe: { cadence: 2, exaggeration: 1.25, anticipation: 0.9, followThrough: 0.45, squash: 0.35, holds: 0.6, jitter: 0 },
    watch: 'Strong silhouettes that hit and hold, fast transitions between them, the whole body on twos.',
    prompt: 'snappy pose-to-pose animation: strong silhouettes, fast transitions into crisp holds, stepped on twos' },
  { id: 'stopmotion', label: 'Stop motion', short: 'Handcrafted', recipe: { cadence: 2, exaggeration: 1, anticipation: 0.6, followThrough: 0.35, squash: 0, holds: 0.2, jitter: 0.004 },
    watch: 'On twos, with a tiny wobble each time the puppet is touched. It reads as handled, physical and real.',
    prompt: 'stop-motion feel: physical weight, animated on twos with a slight handled wobble between poses' },
];
/** The four styles the comparison grid shows. */
export const GRID: MotionId[] = ['naturalistic', 'cartoony', 'limited', 'snappy'];
export const motion = (id: MotionId) => MOTIONS.find(m => m.id === id)!;

export type LookId = 'modelled' | 'toon' | 'flat';
export const LOOKS: { id: LookId; label: string }[] = [
  { id: 'modelled', label: 'As modelled' },
  { id: 'toon', label: 'Toon-shaded' },
  { id: 'flat', label: 'Flat colour' },
];

/** Whole-frame index on the 24 fps timeline, and the first frame of the pose being held there. */
export const frameAt = (t: number) => Math.floor(t * FPS + 1e-6);
export const heldFrame = (t: number, cadence: Cadence) => Math.floor(frameAt(t) / cadence) * cadence;

/**
 * Pose-to-pose timing: within each beat, hold the previous pose and arrive late and fast. `holds` is the
 * share of each beat spent holding. The run (a cycle) is never snapped.
 */
export function remap(t: number, holds: number) {
  if (holds <= 0 || t >= RUN_START) return t;
  for (let i = 0; i < BEATS.length - 1; i++) {
    const a = BEATS[i], b = i + 1 < BEATS.length ? BEATS[i + 1] : RUN_START;
    if (t < b) {
      const u = (t - a) / (b - a), wait = holds * 0.75;
      return u <= wait ? a : a + ((u - wait) / (1 - wait)) * (b - a);
    }
  }
  return t;
}

/** The clip time a style shows at real time t: held on its cadence, then pose-snapped. */
export const styleTime = (t: number, r: Recipe) => remap(heldFrame(t, r.cadence) / FPS, r.holds);

/** Body scale (y, xz) for squash and stretch at real time t; volume is preserved. */
export function squashScale(t: number, r: Recipe) {
  const y = 1 + (squashAt(styleTime(t, r)) - 1) * r.squash;
  return { y, xz: 1 / Math.sqrt(y) };
}

/** Deterministic per-pose wobble for stop motion: changes only when a new pose is shot. */
export function wobble(t: number, r: Recipe) {
  if (!r.jitter) return { x: 0, z: 0, yaw: 0 };
  const n = heldFrame(t, r.cadence);
  const h = (k: number) => { const s = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  return { x: h(1) * r.jitter, z: h(2) * r.jitter, yaw: h(3) * r.jitter * 120 };
}

export const posesPerSecond = (c: Cadence) => FPS / c;
export const cadenceName = (c: Cadence) => ['ones', 'twos', 'threes', 'fours'][c - 1];
export const loopTime = (t: number) => ((t % DURATION) + DURATION) % DURATION;
