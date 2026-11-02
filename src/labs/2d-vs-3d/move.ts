import type { Clip, Ease, Key, Track } from '@/scene/animation/dsl';
import { sampleTrack } from '@/scene/animation/dsl';
import { twoDThreeDConfig as cfg } from '@/labs/lens-and-framing/config';

/**
 * "The hooray hop", defined ONCE and technique-neutral: Pip crouches, throws both arms up, hops,
 * lands in a squash and settles. Every technique on the page samples this same timeline: the
 * hand-drawn and cut-out panes draw it, and the 3D pane converts it to an ordinary rig clip.
 */
export const FPS = 24;
export const DURATION = 2.5;
export const FRAMES = Math.round(DURATION * FPS); // 60
export type Cadence = 1 | 2;

export interface MovePose {
  /** Feet above the floor (m). */
  y: number;
  /** Knee bend, 0 (straight) to 1 (deepest crouch). */
  crouch: number;
  /** Torso pitch forward (deg). */
  lean: number;
  /** Head pitch, + nods down (deg). */
  head: number;
  /** Both arms raised sideways from hanging (deg). Rest is the rig's 12°. */
  armUp: number;
  /** Both arms swung forward (+) or back (−) (deg). */
  armFwd: number;
  /** Elbow bend (deg). */
  elbow: number;
  /** Whole-body scale along the body (1 rest, < 1 squash, > 1 stretch), volume preserved. */
  squash: number;
  /** Mouth open, 0..1. */
  mouth: number;
  /** Eyes widened, 0..1. */
  wide: number;
}
export type PoseChannel = keyof MovePose;

type K = [number, number, Ease?];
const REST: MovePose = { y: 0, crouch: 0, lean: 0, head: 0, armUp: cfg.restArmUp, armFwd: 0, elbow: 8, squash: 1, mouth: 0, wide: 0 };
// Beats (s): 0.40 start of the crouch · 0.62 low · 0.70 take-off · 0.96 apex · 1.24 contact · 1.34 squash · 1.56 rebound · 1.8 settle.
const end = (c: PoseChannel): K => [DURATION, REST[c], 'inOut'];
const hold = (t: number, c: PoseChannel): K => [t, REST[c], 'inOut'];

export const KEYS: Record<PoseChannel, K[]> = {
  y: [[0, 0], [0.7, 0, 'hold'], [0.8, 0.2, 'out'], [0.96, 0.32, 'out'], [1.24, 0, 'in'], end('y')],
  crouch: [[0, 0], hold(0.4, 'crouch'), [0.62, 0.85, 'out'], [0.7, 0.04, 'in'], [0.96, 0.45, 'out'], [1.16, 0.12, 'inOut'], [1.24, 0.1, 'linear'], [1.34, 0.8, 'out'], [1.56, 0.05, 'inOut'], [1.8, 0.16, 'inOut'], [2.1, 0, 'inOut'], end('crouch')],
  lean: [[0, 0], hold(0.4, 'lean'), [0.62, 24, 'out'], [0.7, -4, 'in'], [0.96, 2, 'inOut'], [1.24, 4, 'inOut'], [1.34, 18, 'out'], [1.56, -3, 'inOut'], [1.8, 3, 'inOut'], [2.1, 0, 'inOut'], end('lean')],
  head: [[0, 0], hold(0.4, 'head'), [0.62, 10, 'out'], [0.72, -16, 'in'], [0.96, -10, 'inOut'], [1.24, 0, 'inOut'], [1.36, 8, 'out'], [1.6, -4, 'inOut'], [1.9, 0, 'inOut'], end('head')],
  armUp: [[0, REST.armUp], hold(0.4, 'armUp'), [0.62, 22, 'out'], [0.7, 92, 'in'], [0.8, 122, 'out'], [0.96, 128, 'inOut'], [1.24, 108, 'inOut'], [1.34, 70, 'out'], [1.56, 34, 'inOut'], [1.8, 16, 'inOut'], [2.1, REST.armUp, 'inOut'], end('armUp')],
  armFwd: [[0, 0], hold(0.4, 'armFwd'), [0.62, -38, 'out'], [0.7, 18, 'in'], [0.86, 12, 'out'], [1.24, 6, 'inOut'], [1.34, 18, 'out'], [1.56, 4, 'inOut'], [1.9, 0, 'inOut'], end('armFwd')],
  elbow: [[0, REST.elbow], hold(0.4, 'elbow'), [0.62, 30, 'out'], [0.7, 6, 'in'], [0.96, 4, 'inOut'], [1.24, 10, 'inOut'], [1.34, 34, 'out'], [1.56, 14, 'inOut'], [1.9, REST.elbow, 'inOut'], end('elbow')],
  squash: [[0, 1], hold(0.4, 'squash'), [0.62, 0.86, 'out'], [0.7, 1.16, 'in'], [0.8, 1.08, 'out'], [0.96, 1, 'inOut'], [1.2, 1.06, 'in'], [1.24, 1.04, 'linear'], [1.34, 0.84, 'out'], [1.56, 1.05, 'inOut'], [1.8, 0.98, 'inOut'], [2.1, 1, 'inOut'], end('squash')],
  mouth: [[0, 0], hold(0.6, 'mouth'), [0.72, 0.7, 'out'], [0.96, 0.95, 'inOut'], [1.24, 0.6, 'inOut'], [1.36, 0.3, 'out'], [1.9, 0, 'inOut'], end('mouth')],
  wide: [[0, 0], hold(0.6, 'wide'), [0.72, 1, 'out'], [1.3, 0.8, 'inOut'], [1.9, 0, 'inOut'], end('wide')],
};

export const CHANNELS = Object.keys(KEYS) as PoseChannel[];

/** The pose at time t (seconds, wrapped onto the loop). */
export function samplePose(t: number): MovePose {
  const u = wrap(t);
  const out = { ...REST };
  for (const c of CHANNELS) out[c] = sampleTrack(KEYS[c] as Key[], u);
  return out;
}

export const wrap = (t: number) => ((t % DURATION) + DURATION) % DURATION;
/** 24 fps frame index of time t. */
export const frameAt = (t: number) => Math.min(FRAMES - 1, Math.floor(wrap(t) * FPS + 1e-6));
/** First frame of the drawing on screen at frame f (a drawing is held for `cadence` frames). */
export const heldFrame = (t: number, cadence: Cadence) => Math.floor(frameAt(t) / cadence) * cadence;
/** Time actually shown by a pane animated on `cadence`. */
export const shownTime = (t: number, cadence: Cadence) => heldFrame(t, cadence) / FPS;
/** Which drawing (0-based) a pane on `cadence` is showing. */
export const drawingIndex = (t: number, cadence: Cadence) => Math.floor(frameAt(t) / cadence);
/** Drawings in one loop of the move. */
export const drawingsPerLoop = (cadence: Cadence) => Math.ceil(FRAMES / cadence);
export const drawingsPerSecond = (cadence: Cadence) => FPS / cadence;

/** Leg geometry shared by every technique: knee angle and how far the hips drop for a crouch. */
export const kneeAngle = (crouch: number) => crouch * cfg.crouchMaxDeg;
export const hipDrop = (crouch: number) => cfg.legM * (1 - Math.cos((kneeAngle(crouch) * Math.PI) / 180));

/** Map the neutral pose onto Pip's rig parts (DSL deltas: degrees, metres). */
export function rigDeltas(p: MovePose): Record<string, Partial<Record<'px' | 'py' | 'rx' | 'rz' | 'sy', number>>> {
  const a = kneeAngle(p.crouch);
  const up = p.armUp - cfg.restArmUp;
  return {
    root: { py: p.y - hipDrop(p.crouch) },
    torso: { rx: p.lean },
    head: { rx: p.head },
    thighL: { rx: -a }, thighR: { rx: -a },
    shinL: { rx: 2 * a }, shinR: { rx: 2 * a },
    upperArmL: { rz: up, rx: -p.armFwd }, upperArmR: { rz: -up, rx: -p.armFwd },
    forearmL: { rx: -p.elbow }, forearmR: { rx: -p.elbow },
    mouth: { sy: p.mouth, py: 0.35 }, eyes: { py: p.wide }, brows: { py: p.wide * 0.8 },
  };
}

/**
 * The same move as an ordinary 3D clip: every rig channel keyed at every 1/48 s with linear
 * interpolation, so the rig shows exactly the neutral pose at every frame the panes can show.
 */
export function hopClip(): Clip {
  const steps = FRAMES * 2;
  const tracks = new Map<string, Key[]>();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * DURATION;
    const d = rigDeltas(samplePose(i === steps ? 0 : t));
    for (const [part, chans] of Object.entries(d)) for (const [ch, v] of Object.entries(chans)) {
      const id = `${part}.${ch}`;
      if (!tracks.has(id)) tracks.set(id, []);
      tracks.get(id)!.push([t, v as number, i === 0 ? undefined : 'linear']);
    }
  }
  return {
    character: 'pip',
    tracks: [...tracks].map(([id, keys]): Track => { const [part, ch] = id.split('.'); return { part, ch: ch as Track['ch'], keys }; }),
  };
}

/** Volume-preserving squash: scale along the body and across it. */
export const squashScale = (s: number) => ({ y: s, xz: 1 / Math.sqrt(s) });
