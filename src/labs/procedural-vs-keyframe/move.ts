import type { Clip, Key, Track } from '@/scene/animation/dsl';
import { proceduralConfig as cfg } from '@/labs/lens-and-framing/config';

/**
 * One move, shared by every authoring method: Pip on a crate looks down, hops off and lands.
 * Each method is a function of time that returns this technique-neutral pose; the stage bakes it
 * into an ordinary rig clip, so the four panes differ only in how the numbers were made.
 */
export const FPS = 24;
export const DURATION = 3.2;
export const FRAMES = Math.round(DURATION * FPS);

export interface Pose {
  /** Travel forward from the start mark (m). */
  z: number;
  /** Feet above the floor (m): the crate top while standing on it, 0 once landed. */
  y: number;
  /** Knee bend, 0 straight to 1 deepest. The hips drop to keep the feet where `y` says. */
  crouch: number;
  /** Torso pitch, + forward (deg). */
  lean: number;
  /** Head pitch, + nods down (deg). */
  head: number;
  /** Arms raised sideways from the rig's rest (deg). */
  armUp: number;
  /** Arms swung forward (+) or back (−) (deg). */
  armFwd: number;
  /** Elbow bend (deg). */
  elbow: number;
}
export type PoseFn = (t: number) => Pose;
export const REST: Pose = { z: 0, y: 0, crouch: 0, lean: 0, head: 0, armUp: 0, armFwd: 0, elbow: 8 };

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const kneeAngle = (crouch: number) => clamp(crouch, 0, 1) * cfg.crouchMaxDeg;
export const hipDrop = (crouch: number) => cfg.legM * (1 - Math.cos((kneeAngle(crouch) * Math.PI) / 180));
/** The crouch that drops the hips by `m` metres (inverse of hipDrop), clamped to the deepest bend. */
export const crouchForDrop = (m: number) => {
  const c = 1 - clamp(m, 0, cfg.legM) / cfg.legM;
  return clamp((Math.acos(clamp(c, -1, 1)) * 180) / Math.PI / cfg.crouchMaxDeg, 0, 1);
};
export const MAX_DROP = hipDrop(1);

/** Rig deltas (degrees, metres) for a pose. Feet counter-rotate so the soles stay flat in a crouch. */
export function rigDeltas(p: Pose): Record<string, Partial<Record<'px' | 'py' | 'pz' | 'rx' | 'rz', number>>> {
  const a = kneeAngle(p.crouch);
  return {
    root: { py: p.y - hipDrop(p.crouch), pz: p.z },
    torso: { rx: p.lean },
    head: { rx: p.head },
    thighL: { rx: -a }, thighR: { rx: -a },
    shinL: { rx: 2 * a }, shinR: { rx: 2 * a },
    footL: { rx: -a }, footR: { rx: -a },
    upperArmL: { rz: p.armUp, rx: -p.armFwd }, upperArmR: { rz: -p.armUp, rx: -p.armFwd },
    forearmL: { rx: -p.elbow }, forearmR: { rx: -p.elbow },
  };
}

/** Bake a pose function into a rig clip: every channel keyed every 1/48 s, linear in between. */
export function bakeClip(pose: PoseFn): Clip {
  const steps = FRAMES * 2;
  const tracks = new Map<string, Key[]>();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * DURATION;
    for (const [part, chans] of Object.entries(rigDeltas(pose(t)))) for (const [ch, v] of Object.entries(chans)) {
      const id = `${part}.${ch}`;
      let keys = tracks.get(id);
      if (!keys) tracks.set(id, (keys = []));
      keys.push([t, v as number, i === 0 ? undefined : 'linear']);
    }
  }
  return { character: 'pip', tracks: [...tracks].map(([id, keys]): Track => { const [part, ch] = id.split('.'); return { part, ch: ch as Track['ch'], keys }; }) };
}

/**
 * Where the feet are against what is under them, in metres: at the start (standing on the crate) and at
 * the end (on the floor). Positive floats above, negative sinks in.
 */
export function contact(pose: PoseFn, crateM: number) {
  const start = pose(0).y - crateM;
  const end = pose(DURATION).y;
  return { start, end, error: Math.max(Math.abs(start), Math.abs(end)) };
}

export const wrap = (t: number) => ((t % DURATION) + DURATION) % DURATION;
export const frameAt = (t: number) => Math.min(FRAMES - 1, Math.floor(wrap(t) * FPS + 1e-6));

/** Smoothstep-style blend used by the procedural and physics layers. */
export const smooth = (u: number) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
