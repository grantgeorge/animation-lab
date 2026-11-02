import { sampleTrack, type Ease, type Key } from '@/scene/animation/dsl';
import { proceduralConfig as cfg } from '@/labs/lens-and-framing/config';
import { DURATION, REST, type Pose, type PoseFn } from './move';

/**
 * The keyframed hop: an animator's poses at four draggable key times. Everything (the look down, the
 * anticipation, the arc, the "ta-da") is authored, so it is exactly what the animator wanted, for the
 * crate it was keyed on. The heights are keyed numbers: change the crate and they are simply wrong.
 */
export type KeyId = 'crouch' | 'launch' | 'contact' | 'recover';
export type KeyTimes = Record<KeyId, number>;
export const KEY_IDS: readonly KeyId[] = ['crouch', 'launch', 'contact', 'recover'];
export const KEY_LABELS: Record<KeyId, string> = { crouch: 'Anticipation', launch: 'Take-off', contact: 'Contact', recover: 'Recover' };
export const DEFAULT_TIMES: KeyTimes = { crouch: 0.8, launch: 1.0, contact: 1.42, recover: 2.0 };
/** The look down at the landing spot, before anything moves. */
export const LOOK_T = 0.35;
/** How high above the crate the keyed arc peaks (m), and how far forward Pip lands. */
export const APEX_RISE = 0.1;
export const LAND_Z = 0.62;

const MIN = { start: 0.55, crouchToLaunch: 0.06, air: 0.15, recover: 0.25, end: DURATION - 0.6 };

/** Move one key, keeping the order and minimum gaps an animator's graph would. */
export function retime(times: KeyTimes, id: KeyId, t: number): KeyTimes {
  const k = { ...times };
  if (id === 'crouch') k.crouch = Math.min(Math.max(t, MIN.start), k.launch - MIN.crouchToLaunch);
  if (id === 'launch') k.launch = Math.min(Math.max(t, k.crouch + MIN.crouchToLaunch), k.contact - MIN.air);
  if (id === 'contact') k.contact = Math.min(Math.max(t, k.launch + MIN.air), k.recover - MIN.recover);
  if (id === 'recover') k.recover = Math.min(Math.max(t, k.contact + MIN.recover), MIN.end);
  for (const key of KEY_IDS) k[key] = Math.round(k[key] * 1000) / 1000;
  return k;
}

type K = [number, number, Ease?];
type Channel = keyof Pose;

/** Authored keys per channel, for key times `k` and the crate height the animator keyed on. */
export function keyframeKeys(k: KeyTimes, keyedM: number): Record<Channel, K[]> {
  const apex = (k.launch + k.contact) / 2;
  const squash = k.contact + 0.11;
  const settle = Math.min(DURATION - 0.05, k.recover + 0.45);
  const end = (c: Channel): K => [DURATION, REST[c], 'inOut'];
  return {
    z: [[0, 0], [k.launch, 0, 'hold'], [k.contact, LAND_Z, 'linear'], [squash, LAND_Z + 0.03, 'out'], [DURATION, LAND_Z + 0.03, 'linear']],
    y: [[0, keyedM], [k.launch, keyedM, 'hold'], [apex, keyedM + APEX_RISE, 'out'], [k.contact, 0, 'in'], [DURATION, 0, 'linear']],
    crouch: [[0, 0], [LOOK_T, 0, 'inOut'], [k.crouch, 0.55, 'inOut'], [k.launch, 0.04, 'in'], [apex, 0.28, 'out'], [k.contact, 0.12, 'inOut'], [squash, 0.66, 'out'], [k.recover, 0.04, 'inOut'], [settle, 0.08, 'inOut'], end('crouch')],
    lean: [[0, 0], [LOOK_T, 4, 'inOut'], [k.crouch, 22, 'inOut'], [k.launch, -2, 'in'], [apex, 4, 'inOut'], [k.contact, 6, 'inOut'], [squash, 24, 'out'], [k.recover, -4, 'inOut'], [settle, 0, 'inOut'], end('lean')],
    head: [[0, 0], [LOOK_T, 24, 'inOut'], [k.crouch, 20, 'inOut'], [k.launch, 4, 'in'], [apex, 10, 'inOut'], [k.contact, 6, 'inOut'], [squash, 14, 'out'], [k.recover, -10, 'inOut'], [settle, -2, 'inOut'], end('head')],
    armUp: [[0, 0], [LOOK_T, 0, 'inOut'], [k.crouch, 8, 'inOut'], [k.launch, 52, 'in'], [apex, 70, 'out'], [k.contact, 58, 'inOut'], [squash, 30, 'out'], [k.recover, 72, 'inOut'], [settle, 18, 'inOut'], end('armUp')],
    armFwd: [[0, 0], [LOOK_T, 0, 'inOut'], [k.crouch, -42, 'inOut'], [k.launch, 38, 'in'], [apex, 24, 'out'], [k.contact, 18, 'inOut'], [squash, 30, 'out'], [k.recover, 4, 'inOut'], [settle, 0, 'inOut'], end('armFwd')],
    elbow: [[0, REST.elbow], [LOOK_T, REST.elbow, 'inOut'], [k.crouch, 28, 'inOut'], [k.launch, 10, 'in'], [apex, 18, 'inOut'], [k.contact, 12, 'inOut'], [squash, 34, 'out'], [k.recover, 10, 'inOut'], [settle, REST.elbow, 'inOut'], end('elbow')],
  };
}

export function keyframePose(k: KeyTimes, keyedM: number): PoseFn {
  const keys = keyframeKeys(k, keyedM);
  const chans = Object.keys(keys) as Channel[];
  return (t) => {
    const out = { ...REST };
    for (const c of chans) out[c] = sampleTrack(keys[c] as Key[], t);
    return out;
  };
}

/**
 * The gravity the keyed airtime implies: rising APEX_RISE and falling (crate + APEX_RISE) in
 * (contact − launch) seconds. Animators cheat this on purpose; it tells you which way.
 */
export function impliedGravity(k: KeyTimes, keyedM: number, rise = APEX_RISE) {
  const air = k.contact - k.launch;
  return (2 * (Math.sqrt(rise) + Math.sqrt(keyedM + rise)) ** 2) / (air * air);
}

export function gravityFeel(g: number): 'floaty' | 'natural' | 'snappy' {
  return g < 6.5 ? 'floaty' : g > 14 ? 'snappy' : 'natural';
}

export const DEFAULT_KEYED_M = cfg.crate.heightM;
