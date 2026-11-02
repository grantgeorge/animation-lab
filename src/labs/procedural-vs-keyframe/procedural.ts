import { sampleTrack, type Ease, type Key } from '@/scene/animation/dsl';
import { DURATION, REST, clamp, smooth, type Pose, type PoseFn } from './move';

/**
 * The procedural hop: no keys and no simulation, just rules that read the situation (how high the
 * crate is) and write a pose. Change the crate and every number re-derives instantly; give it a new
 * seed and you get a different, equally valid take, which is what crowds and games need.
 */
export interface ProcParams {
  /** 0 timid … 1 bold: jump distance, height and arm swing. */
  energy: number;
  /** Variation seed: small changes to timing and amplitudes. */
  seed: number;
}
export const PROC_DEFAULT: ProcParams = { energy: 0.5, seed: 1 };
export const G = 9.81;

export type RuleId = 'look' | 'crouch' | 'jump' | 'plant' | 'balance' | 'breathe';
export interface Rule { id: RuleId; label: string; how: string; start: number; end: number }

/** Deterministic small PRNG (mulberry32). */
export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ProcResult {
  pose: PoseFn;
  rules: Rule[];
  launchT: number;
  contactT: number;
  airtime: number;
  landZ: number;
  rise: number;
  crouch: number;
  landCrouch: number;
}

type K = [number, number, Ease?];

export function generate(p: ProcParams, crateM: number): ProcResult {
  const r = rng(p.seed);
  const jitter = (amount: number) => 1 + (r() - 0.5) * 2 * amount;
  const e = clamp(p.energy, 0, 1);
  // Rule: crouch in proportion to the drop.
  const crouch = clamp(0.25 + 0.9 * crateM, 0.25, 0.85) * jitter(0.06);
  // Rule: jump to clear the edge and land a body-length out; bolder jumps go higher and farther.
  const landZ = (0.32 + 0.3 * e + 0.45 * crateM) * jitter(0.06);
  const rise = (0.04 + 0.1 * e) * jitter(0.1);
  const up = Math.sqrt((2 * rise) / G), down = Math.sqrt((2 * (crateM + rise)) / G);
  const airtime = up + down;
  const impact = G * down;
  // Rule: look at the landing spot first; the bigger the drop, the longer the look.
  const lookEnd = (0.5 + 0.25 * crateM) * jitter(0.05);
  const crouchT = lookEnd + (0.18 + 0.2 * crouch) * jitter(0.05);
  const launchT = crouchT + 0.08 + 0.08 * crouch;
  const contactT = launchT + airtime;
  // Rule: plant the feet and absorb in proportion to the impact speed.
  const landCrouch = clamp(impact / 3.6, 0.15, 1);
  const squashT = contactT + 0.06 + 0.06 * landCrouch;
  const recoverT = squashT + 0.25 + 0.3 * landCrouch;
  const lookDeg = clamp((Math.atan2(0.9 + crateM, landZ + 0.25) * 180) / Math.PI - 40, 10, 34);
  const arms = 40 + 50 * e;
  const end = (c: keyof Pose): K => [DURATION, REST[c], 'inOut'];
  const keys: Partial<Record<keyof Pose, K[]>> = {
    crouch: [[0, 0], [lookEnd, 0.04, 'inOut'], [crouchT, crouch, 'inOut'], [launchT, 0.03, 'in'], [launchT + up, 0.22 + 0.1 * e, 'out'], [contactT, 0.1, 'inOut'], [squashT, landCrouch, 'out'], [recoverT, 0.05, 'inOut'], end('crouch')],
    lean: [[0, 0], [lookEnd, 5, 'inOut'], [crouchT, 10 + 25 * crateM, 'inOut'], [launchT, -2, 'in'], [contactT, 5, 'inOut'], [squashT, 10 + 14 * landCrouch, 'out'], [recoverT, -2, 'inOut'], end('lean')],
    head: [[0, 0], [lookEnd, lookDeg, 'inOut'], [crouchT, lookDeg * 0.85, 'inOut'], [launchT, lookDeg * 0.4, 'in'], [contactT, lookDeg * 0.5, 'inOut'], [squashT, lookDeg * 0.6, 'out'], [recoverT, -3, 'inOut'], end('head')],
    armUp: [[0, 0], [lookEnd, 0, 'inOut'], [crouchT, 6, 'inOut'], [launchT, arms * 0.7, 'in'], [launchT + up, arms, 'out'], [contactT, arms * 0.8, 'inOut'], [squashT, arms * 0.45, 'out'], [recoverT, 10, 'inOut'], end('armUp')],
    armFwd: [[0, 0], [lookEnd, 0, 'inOut'], [crouchT, -30 - 15 * e, 'inOut'], [launchT, 25 + 15 * e, 'in'], [contactT, 14, 'inOut'], [squashT, 26, 'out'], [recoverT, 2, 'inOut'], end('armFwd')],
    elbow: [[0, REST.elbow], [crouchT, 24, 'inOut'], [launchT, 10, 'in'], [squashT, 30, 'out'], [recoverT, 10, 'inOut'], end('elbow')],
  };
  const breathPhase = r() * Math.PI * 2;
  const pose: PoseFn = (t) => {
    const out = { ...REST };
    for (const [c, k] of Object.entries(keys) as [keyof Pose, K[]][]) out[c] = sampleTrack(k as Key[], t);
    // Rule: the root follows the exact ballistic arc and plants the feet on whatever is below.
    if (t < launchT) { out.y = crateM; out.z = 0; }
    else if (t < contactT) { const s = t - launchT; out.y = Math.max(0, crateM + G * up * s - (G / 2) * s * s); out.z = (landZ * s) / airtime; }
    else { out.y = 0; out.z = landZ + 0.03 * smooth((t - contactT) / 0.15); }
    // Rule: breathe once settled (small, seeded).
    const settled = smooth((t - recoverT) / 0.3);
    out.lean += Math.sin((t - recoverT) * 2.6 + breathPhase) * 1.8 * settled;
    out.head += Math.sin((t - recoverT) * 2.6 + breathPhase - 0.6) * 1.2 * settled;
    return out;
  };
  const rules: Rule[] = [
    { id: 'look', label: 'Look at the landing spot', how: `head down ${Math.round(lookDeg)}°, longer for a bigger drop`, start: 0, end: lookEnd },
    { id: 'crouch', label: 'Crouch in proportion to the drop', how: `knees ${Math.round(crouch * 100)}% for ${Math.round(crateM * 100)} cm`, start: lookEnd, end: launchT },
    { id: 'jump', label: 'Jump to clear the edge', how: `ballistic arc, ${Math.round(rise * 100)} cm up, lands ${Math.round(landZ * 100)} cm out`, start: launchT, end: contactT },
    { id: 'balance', label: 'Balance with the arms', how: `arms up ${Math.round(arms)}° in the air`, start: launchT, end: squashT },
    { id: 'plant', label: 'Plant the feet, absorb the impact', how: `${impact.toFixed(1)} m/s → knees ${Math.round(landCrouch * 100)}%`, start: contactT, end: recoverT },
    { id: 'breathe', label: 'Breathe', how: 'a small seeded rise and fall', start: recoverT, end: DURATION },
  ];
  return { pose, rules, launchT, contactT, airtime, landZ, rise, crouch, landCrouch };
}
