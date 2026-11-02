import { twoDThreeDConfig as cfg } from '@/labs/lens-and-framing/config';
import { drawingsPerLoop, kneeAngle, type Cadence, type MovePose } from './move';

/**
 * Pip's body for the 2D panes, in metres in his own space (x = his left, y = up, z = forward),
 * proportioned after the rigged model (1.12 m to the hat crown). Both 2D techniques project the
 * same skeleton; they differ in what they're allowed to do with it.
 */
export const BODY = {
  ankle: 0.057, thigh: 0.19, shin: 0.17, hipX: 0.065, pelvisUp: 0.015,
  torso: 0.3, shoulderX: 0.12, neck: 0.055, headUp: 0.14, headR: 0.142,
  upper: 0.13, fore: 0.115, handR: 0.04,
  /** Raincoat profile from the pelvis: [height, radius]. It is round, so it reads the same from any side. */
  coat: [[-0.15, 0.205], [-0.05, 0.19], [0.1, 0.165], [0.22, 0.135], [0.29, 0.09], [0.33, 0.062]] as const,
} as const;

export type V3 = readonly [number, number, number];
export interface Skeleton {
  pelvis: V3; neck: V3; head: V3;
  /** Pitch (deg, + forward) of the torso and of the head. */
  torsoPitch: number; headPitch: number;
  hip: [V3, V3]; knee: [V3, V3]; ankle: [V3, V3];
  shoulder: [V3, V3]; elbow: [V3, V3]; hand: [V3, V3];
}

const RAD = Math.PI / 180;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** Pitch about the x axis; + tips the top of the body forward (+z). */
export const pitch = (v: V3, deg: number): V3 => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
/** Rotate unit vector d toward unit vector t by deg (in their common plane). */
function toward(d: V3, t: V3, deg: number): V3 {
  const k = d[0] * t[0] + d[1] * t[1] + d[2] * t[2];
  const p = norm([t[0] - k * d[0], t[1] - k * d[1], t[2] - k * d[2]]);
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  return norm([d[0] * c + p[0] * s, d[1] * c + p[1] * s, d[2] * c + p[2] * s]);
}

/** Forward kinematics of the neutral pose (no squash: each technique decides what to do with it). */
export function skeleton(p: MovePose): Skeleton {
  const a = kneeAngle(p.crouch) * RAD;
  const leg = BODY.thigh * Math.cos(a) + BODY.shin * Math.cos(a);
  const pelvisY = p.y + BODY.ankle + leg + BODY.pelvisUp;
  const pelvis: V3 = [0, pelvisY, 0];
  const up = (v: V3) => add(pelvis, pitch(v, p.lean));
  const neck = up([0, BODY.torso + BODY.neck, 0]);
  const headPitch = p.lean + p.head;
  const head = add(neck, pitch([0, BODY.headUp, 0], headPitch));
  const side = (s: 1 | -1) => {
    const hip: V3 = [s * BODY.hipX, pelvisY - BODY.pelvisUp, 0];
    const knee = add(hip, [0, -BODY.thigh * Math.cos(a), BODY.thigh * Math.sin(a)]);
    const ankle = add(knee, [0, -BODY.shin * Math.cos(a), -BODY.shin * Math.sin(a)]);
    const sh: V3 = [s * BODY.shoulderX, BODY.torso, 0];
    let d: V3 = [s * Math.sin(p.armUp * RAD), -Math.cos(p.armUp * RAD), 0];
    d = pitch(d, -p.armFwd);
    const f = toward(d, [0, 0, 1], p.elbow);
    const el = add(sh, mul(d, BODY.upper));
    const hd = add(el, mul(f, BODY.fore));
    return { hip, knee, ankle, shoulder: up(sh), elbow: up(el), hand: up(hd) };
  };
  const L = side(1), R = side(-1);
  return {
    pelvis, neck, head, torsoPitch: p.lean, headPitch,
    hip: [L.hip, R.hip], knee: [L.knee, R.knee], ankle: [L.ankle, R.ankle],
    shoulder: [L.shoulder, R.shoulder], elbow: [L.elbow, R.elbow], hand: [L.hand, R.hand],
  };
}

/** The panes' shared framing: a square drawing of `frameM` metres with the floor near the bottom. */
export const VIEW = 480;
export const PX = VIEW / cfg.frameM;
export const FLOOR_Y = VIEW - cfg.floorM * PX;
export const CX = VIEW / 2;

export interface P2 { x: number; y: number; d: number }
/** Orthographic projection for a camera turned `turn` degrees around Pip (0 front, 90 his left side). */
export function project(v: V3, turn: number): P2 {
  const c = Math.cos(turn * RAD), s = Math.sin(turn * RAD);
  return { x: CX + (v[0] * c - v[2] * s) * PX, y: FLOOR_Y - v[1] * PX, d: v[0] * s + v[2] * c };
}
/** Unit vector toward the camera, in Pip's space. */
export const toCamera = (turn: number): V3 => [Math.sin(turn * RAD), 0, Math.cos(turn * RAD)];

/** A point on the head sphere at longitude/latitude (deg; 0,0 = straight ahead), pitched with the head. */
export function headPoint(sk: Skeleton, lon: number, lat: number, r: number = BODY.headR): { p: V3; n: V3 } {
  const n = pitch([Math.sin(lon * RAD) * Math.cos(lat * RAD), Math.sin(lat * RAD), Math.cos(lon * RAD) * Math.cos(lat * RAD)], sk.headPitch);
  return { p: add(sk.head, mul(n, r)), n };
}
export const facing = (n: V3, turn: number) => { const v = toCamera(turn); return n[0] * v[0] + n[1] * v[1] + n[2] * v[2]; };

/** Two-bone IK in the picture plane: where a rigid cut-out knee (or elbow) must go. */
export function ik2d(a: { x: number; y: number }, c: { x: number; y: number }, l1: number, l2: number, bendX: number): { x: number; y: number } {
  const dx = c.x - a.x, dy = c.y - a.y;
  const dist = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-6);
  const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
  const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  // Two solutions either side of the line; pick the one on the side bendX points to.
  const px = -uy, py = ux;
  const sgn = Math.sign(px * bendX) || 1;
  return { x: a.x + ux * along + px * h * sgn, y: a.y + uy * along + py * h * sgn };
}

/** Deterministic line boil: a small offset per drawing and per point, so every new drawing wobbles. */
export function boil(seed: number, id: number, amp = 1.1): { x: number; y: number } {
  const h = (n: number) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  return { x: (h(id * 1.7 + 0.3) - 0.5) * 2 * amp, y: (h(id * 2.9 + 7.1) - 0.5) * 2 * amp };
}

/** The cut-out's view library and how a requested camera turn maps onto it. */
export const VIEWS = cfg.views;
export const VIEW_NAMES: Record<number, string> = { 0: 'Front', 45: 'Three-quarter', 90: 'Side' };
export const snapView = (turn: number) => VIEWS.reduce((best, v) => (Math.abs(v - turn) < Math.abs(best - turn) ? v : best), VIEWS[0] as number);
/** True when no drawn view is close enough to pass for the requested angle. */
export const offView = (turn: number) => Math.abs(snapView(turn) - turn) > 4;

/** One drawing per part per view: the cut-out's parts library. */
export const PARTS = ['Head', 'Hat', 'Hair', 'Coat', 'Upper arm ×2', 'Forearm ×2', 'Hand ×2', 'Thigh ×2', 'Shin ×2', 'Boot ×2', 'Eyes (open, wide)', 'Mouths ×3'] as const;
export const PART_DRAWINGS = 4 + 2 * 6 + 2 + 3; // 21 drawings per view

export interface Cost { drawings: number; detail: string }
/** Hand-drawn: every drawing of the loop is drawn again at every angle used. */
export const drawnCost = (cadence: Cadence, angles: number): Cost => ({ drawings: drawingsPerLoop(cadence) * angles, detail: `${drawingsPerLoop(cadence)} drawings × ${angles} angle${angles === 1 ? '' : 's'}` });
/** Cut-out: a parts library per drawn view, reused for any length of animation. */
export const cutoutCost = (views: number): Cost => ({ drawings: PART_DRAWINGS * views, detail: `${PART_DRAWINGS} parts × ${views} views` });
/** 3D: no drawings; one model, rigged and skinned once. */
export const rigCost = (): Cost => ({ drawings: 0, detail: '1 model · 24 joints · skin weights' });
