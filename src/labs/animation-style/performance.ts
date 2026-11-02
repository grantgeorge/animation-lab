import type { Channel, Clip, Ease, Key, Track } from '@/scene/animation/dsl';
import { sampleTrack } from '@/scene/animation/dsl';
import { runCycle } from '@/scene/animation/performances/cycles';

/**
 * "The startle": one beat for Pip on the doorway set. The door bangs open beside him, he jumps,
 * freezes in fright, then bolts off screen right. It is authored in LAYERS, so a movement style can
 * reweight them without touching the choreography:
 * - pose: the main body and face poses (scaled by exaggeration);
 * - antic: preparatory moves before each action (scaled by anticipation);
 * - follow: overshoot and settle after each action (scaled by follow-through);
 * - travel: where he goes (never scaled, so every style exits the same way).
 */
export const DURATION = 5.5;
export const DOOR_BANG = 1.0;
/** Beat boundaries (s). Pose-hold styles snap between these instead of moving through them. */
export const BEATS = [0, 1.0, 1.14, 1.24, 1.42, 1.6, 2.4, 2.66] as const;
/** From here Pip runs: cycles are never pose-snapped. */
export const RUN_START = 2.66;
const RUN_END = 4.6;

type Layer = 'pose' | 'antic' | 'follow' | 'travel';
type K = [number, number, Ease?];
const tr = (part: string, ch: Channel, keys: K[]): Track => ({ part, ch, keys: keys as Key[] });
const blink = (t: number): K[] => [[t, 0, 'hold'], [t + 0.05, -0.92, 'in'], [t + 0.08, -0.92, 'hold'], [t + 0.14, 0, 'out']];
// The last key must arrive exactly at DURATION (a 'hold' key would only land after it) so loops close.
const end = (v = 0): K => [DURATION, v, 'inOut'];

const LAYERS: Record<Layer, Track[]> = {
  pose: [
    // idle: a little weight shift while he waits
    tr('torso', 'rz', [[0, 0], [0.5, 1.5], [1.0, 0], [1.24, 0, 'hold'], end()]),
    tr('head', 'ry', [[0, 8], [1.0, 8, 'hold'], [1.24, -26, 'out'], [2.4, -22, 'inOut'], [2.6, 25, 'inOut'], [2.9, 0, 'inOut'], [5.2, 0, 'hold'], end(8)]),
    tr('head', 'rx', [[0, 0], [1.24, 0, 'hold'], [1.42, -5, 'out'], [2.4, -3, 'inOut'], [2.7, 0, 'inOut'], end()]),
    // the take: arms fly up, torso recoils
    tr('torso', 'rx', [[0, 0], [1.24, 0, 'hold'], [1.42, -14, 'out'], [2.4, -12, 'inOut'], [2.66, 0, 'inOut'], end()]),
    tr('torso', 'ry', [[0, 0], [1.24, 0, 'hold'], [1.42, -18, 'out'], [2.4, -14, 'inOut'], [2.66, 0, 'inOut'], end()]),
    tr('upperArmL', 'rx', [[0, 0], [1.24, 0, 'hold'], [1.42, -55, 'out'], [2.4, -50, 'inOut'], [2.62, 0, 'inOut'], end()]),
    tr('upperArmR', 'rx', [[0, 0], [1.24, 0, 'hold'], [1.42, -55, 'out'], [2.4, -50, 'inOut'], [2.62, 0, 'inOut'], end()]),
    tr('upperArmL', 'rz', [[0, 0], [1.24, 0, 'hold'], [1.42, 62, 'out'], [2.4, 56, 'inOut'], [2.62, 0, 'inOut'], end()]),
    tr('upperArmR', 'rz', [[0, 0], [1.24, 0, 'hold'], [1.42, -62, 'out'], [2.4, -56, 'inOut'], [2.62, 0, 'inOut'], end()]),
    tr('forearmL', 'rx', [[0, -10], [1.24, -10, 'hold'], [1.42, -38, 'out'], [2.4, -34, 'inOut'], [2.62, -10, 'inOut'], end(-10)]),
    tr('forearmR', 'rx', [[0, -10], [1.24, -10, 'hold'], [1.42, -38, 'out'], [2.4, -34, 'inOut'], [2.62, -10, 'inOut'], end(-10)]),
    // the jump itself
    tr('root', 'py', [[0, 0], [1.24, 0, 'hold'], [1.36, 0.13, 'out'], [1.5, 0, 'in'], end()]),
    tr('thighL', 'rx', [[0, 0], [1.24, 0, 'hold'], [1.36, -22, 'out'], [1.5, 0, 'in'], end()]),
    tr('shinL', 'rx', [[0, 0], [1.24, 0, 'hold'], [1.36, 30, 'out'], [1.5, 0, 'in'], end()]),
    // face: wide eyes, brows up, mouth open
    tr('eyes', 'py', [[0, 0], [1.2, 0, 'hold'], [1.3, 1, 'out'], [2.4, 0.8, 'inOut'], [2.9, 0.2, 'inOut'], end()]),
    tr('brows', 'py', [[0, 0.1], [1.2, 0.1, 'hold'], [1.3, 1, 'out'], [2.4, 0.85, 'inOut'], [2.9, 0.4, 'inOut'], end(0.1)]),
    tr('mouth', 'sy', [[0, 0], [1.22, 0, 'hold'], [1.34, 0.85, 'out'], [2.4, 0.6, 'inOut'], [2.8, 0.35, 'inOut'], end()]),
    tr('mouth', 'py', [[0, 0.35], [1.0, 0.35, 'hold'], [1.2, 0, 'out'], end(0.35)]),
    tr('eyes', 'sy', [[0, 0], ...blink(0.55), ...blink(2.2), end()]),
  ],
  antic: [
    // flinch down before the jump
    tr('root', 'py', [[0, 0], [1.14, 0, 'hold'], [1.24, -0.06, 'out'], [1.36, 0, 'out'], end()]),
    tr('torso', 'rx', [[0, 0], [1.14, 0, 'hold'], [1.24, 12, 'out'], [1.4, 0, 'inOut'], end()]),
    tr('head', 'rx', [[0, 0], [1.14, 0, 'hold'], [1.24, 12, 'out'], [1.4, 0, 'inOut'], end()]),
    tr('upperArmL', 'rx', [[0, 0], [1.14, 0, 'hold'], [1.24, 14, 'out'], [1.4, 0, 'inOut'], end()]),
    tr('upperArmR', 'rx', [[0, 0], [1.14, 0, 'hold'], [1.24, 14, 'out'], [1.4, 0, 'inOut'], end()]),
    // wind back before the run: lean away from the exit, then go
    tr('torso', 'rx', [[0, 0], [2.4, 0, 'hold'], [2.58, -14, 'inOut'], [2.74, 0, 'out'], end()]),
    tr('root', 'py', [[0, 0], [2.4, 0, 'hold'], [2.58, -0.05, 'inOut'], [2.72, 0, 'out'], end()]),
    tr('root', 'px', [[0, 0], [2.4, 0, 'hold'], [2.6, -0.12, 'inOut'], [2.78, 0, 'out'], end()]),
  ],
  follow: [
    // the landing settles: knees give, arms overshoot then relax
    tr('root', 'py', [[0, 0], [1.5, 0, 'hold'], [1.6, -0.05, 'out'], [1.78, 0, 'inOut'], end()]),
    tr('upperArmL', 'rx', [[0, 0], [1.42, 0, 'hold'], [1.56, -18, 'out'], [1.8, 4, 'inOut'], [2.0, 0, 'inOut'], end()]),
    tr('upperArmR', 'rx', [[0, 0], [1.42, 0, 'hold'], [1.58, -18, 'out'], [1.84, 4, 'inOut'], [2.04, 0, 'inOut'], end()]),
    tr('forearmL', 'rx', [[0, 0], [1.46, 0, 'hold'], [1.62, -20, 'out'], [1.9, 6, 'inOut'], [2.1, 0, 'inOut'], end()]),
    tr('forearmR', 'rx', [[0, 0], [1.48, 0, 'hold'], [1.64, -20, 'out'], [1.92, 6, 'inOut'], [2.12, 0, 'inOut'], end()]),
    tr('head', 'rx', [[0, 0], [1.42, 0, 'hold'], [1.56, -8, 'out'], [1.8, 3, 'inOut'], [2.0, 0, 'inOut'], end()]),
    tr('thighL', 'rx', [[0, 0], [1.5, 0, 'hold'], [1.6, -16, 'out'], [1.78, 0, 'inOut'], end()]),
    tr('thighR', 'rx', [[0, 0], [1.5, 0, 'hold'], [1.6, -16, 'out'], [1.78, 0, 'inOut'], end()]),
    tr('shinL', 'rx', [[0, 0], [1.5, 0, 'hold'], [1.6, 28, 'out'], [1.78, 0, 'inOut'], end()]),
    tr('shinR', 'rx', [[0, 0], [1.5, 0, 'hold'], [1.6, 28, 'out'], [1.78, 0, 'inOut'], end()]),
    // the run's first strides drag the body, then it catches up
    tr('head', 'rx', [[0, 0], [2.66, 0, 'hold'], [2.8, -10, 'out'], [3.05, 0, 'inOut'], end()]),
  ],
  travel: [
    // turn to the exit, accelerate away, then (off screen) cut back to the mark so the loop closes
    tr('root', 'ry', [[0, 0], [2.42, 0, 'hold'], [2.7, 78, 'inOut'], [5.45, 78, 'hold'], [DURATION, 0, 'linear']]),
    tr('root', 'px', [[0, 0], [2.66, 0, 'hold'], [3.05, 0.42, 'in'], [RUN_END, 3.6, 'linear'], [5.45, 3.6, 'hold'], [DURATION, 0, 'linear']]),
    ...runCycle({ t0: RUN_START, t1: RUN_END, stepS: 0.15, stride: 44, armSwing: 50, lean: 18, bob: 0.05 }),
  ],
};

export interface LayerWeights { exaggeration: number; anticipation: number; followThrough: number }

/** Bake a clip for the given layer weights. Face channels are clamped by the rig, so they saturate. */
export function startleClip(w: LayerWeights): Clip {
  const scale = (tracks: Track[], k: number) => tracks.map(t => (k === 1 ? t : { ...t, keys: t.keys.map(([time, v, e]) => [time, v * k, e] as const) }));
  return {
    character: 'pip',
    tracks: [...scale(LAYERS.pose, w.exaggeration), ...scale(LAYERS.antic, w.anticipation), ...scale(LAYERS.follow, w.followThrough), ...LAYERS.travel],
  };
}

export const allTracks = () => Object.values(LAYERS).flat();

/** Door leaf yaw (degrees, inward): bangs open, rebounds off its stop, settles. */
const DOOR: K[] = [[0, 0], [DOOR_BANG, 0, 'hold'], [DOOR_BANG + 0.1, 100, 'in'], [DOOR_BANG + 0.22, 84, 'out'], [DOOR_BANG + 0.36, 92, 'inOut'], [5.2, 92, 'hold'], [DURATION, 0, 'inOut']];
export const doorAngle = (t: number) => sampleTrack(DOOR as Key[], t);

/** Squash (<1) and stretch (>1) of the whole body over the beat, before the style's amount is applied. */
const SQUASH: K[] = [[0, 1], [1.14, 1, 'hold'], [1.24, 0.9, 'out'], [1.32, 1.12, 'out'], [1.46, 1, 'inOut'], [1.52, 0.88, 'out'], [1.7, 1, 'inOut'], [2.48, 1, 'hold'], [2.58, 0.93, 'inOut'], [2.7, 1.08, 'out'], [2.86, 1, 'inOut'], end(1)];
export const squashAt = (t: number) => sampleTrack(SQUASH as Key[], t);
