import { Euler, Quaternion, Vector3 } from 'three';
import type { BoneMapping } from '@/scene/characters/RiggedCharacter';

/**
 * The math of a puppet rig, renderer-free. Clip and slider values are rotation deltas (degrees) in
 * rest-aligned axes, exactly as in RiggedCharacter: L = P0⁻¹ · (F⁻¹·Δ·F) · O · P0 · L0, where P0 is the
 * parent's rest world rotation, L0 the bone's bind local rotation, O the rest offset (A-pose → arms
 * down) and F the ancestors' accumulated offset (so a forearm's rx stays an elbow hinge).
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export type Delta = { rx?: number; ry?: number; rz?: number };
export type Order = 'XYZ' | 'XZY' | 'YXZ';

/** How much of the A-pose correction to apply: the three states of "why our arm fixes mattered". */
export type Correction = 'none' | 'offset' | 'shipped';

export interface RestFrame {
  p0: Quaternion;
  p0inv: Quaternion;
  l0: Quaternion;
  offset: Quaternion;
  frame: Quaternion | null;
  frameInv: Quaternion | null;
  order: Order;
}

const euler = (d: readonly [number, number, number], order: Order = 'XYZ') => new Euler(d[0] * DEG, d[1] * DEG, d[2] * DEG, order);

export function makeRest(p0: Quaternion, l0: Quaternion, m: BoneMapping): RestFrame {
  const frame = m.frameDeg ? new Quaternion().setFromEuler(euler(m.frameDeg)) : null;
  return {
    p0: p0.clone(),
    p0inv: p0.clone().invert(),
    l0: l0.clone(),
    offset: new Quaternion().setFromEuler(euler(m.offsetDeg ?? [0, 0, 0])),
    frame,
    frameInv: frame ? frame.clone().invert() : null,
    order: m.order ?? 'XYZ',
  };
}

const ID = new Quaternion();
const tE = new Euler();
const tD = new Quaternion();

/** Bone local rotation for a delta, under a correction mode. */
export function deltaToLocal(r: RestFrame, d: Delta | undefined, correction: Correction, out = new Quaternion()): Quaternion {
  tE.set((d?.rx ?? 0) * DEG, (d?.ry ?? 0) * DEG, (d?.rz ?? 0) * DEG, r.order);
  tD.setFromEuler(tE);
  if (correction === 'shipped' && r.frame && r.frameInv) tD.premultiply(r.frameInv).multiply(r.frame);
  tD.multiply(correction === 'none' ? ID : r.offset);
  return out.copy(r.p0inv).multiply(tD).multiply(r.p0).multiply(r.l0);
}

/** The inverse: the delta that produces a local rotation (used to "match FK to IK"). */
export function localToDelta(r: RestFrame, local: Quaternion, correction: Correction): Required<Delta> {
  const q = r.p0.clone().multiply(local).multiply(r.l0.clone().invert()).multiply(r.p0inv);
  if (correction !== 'none') q.multiply(r.offset.clone().invert());
  if (correction === 'shipped' && r.frame && r.frameInv) q.premultiply(r.frame).multiply(r.frameInv);
  const e = new Euler().setFromQuaternion(q, r.order);
  const clean = (v: number) => Math.round(v * RAD * 1000) / 1000 || 0;
  return { rx: clean(e.x), ry: clean(e.y), rz: clean(e.z) };
}

export interface HingeSolve {
  /** Hinge bend in degrees (0 = the bind pose's own bend). */
  deg: number;
  /** Distance to the target as a share of the chain's longest reach. */
  reach: number;
  reached: boolean;
}

/**
 * Bend a hinge (elbow, knee) until the chain spans `want`. `distanceAt(deg)` measures root-to-end
 * distance for a bend and shrinks as the bend grows. Out of reach → straight (0°); too close → fully bent.
 */
export function solveHinge(distanceAt: (deg: number) => number, want: number, maxDeg = 165): HingeSolve {
  const longest = distanceAt(0);
  const reach = want / longest;
  if (want >= longest) return { deg: 0, reach, reached: want <= longest + 1e-4 };
  if (distanceAt(maxDeg) > want) return { deg: maxDeg, reach, reached: false };
  let lo = 0, hi = maxDeg;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (distanceAt(mid) > want) lo = mid; else hi = mid; }
  return { deg: (lo + hi) / 2, reach, reached: true };
}

/** Component of `p` perpendicular to unit `u`, normalised (falls back to any perpendicular). */
export function perpendicular(p: Vector3, u: Vector3): Vector3 {
  const v = p.clone().addScaledVector(u, -p.dot(u));
  if (v.lengthSq() < 1e-10) v.set(1, 0, 0).addScaledVector(u, -u.x);
  if (v.lengthSq() < 1e-10) v.set(0, 0, 1).addScaledVector(u, -u.z);
  return v.normalize();
}

/**
 * Pole direction for an arm: 0° points the elbow down, 90° out to the side (away from the body),
 * negative values tuck it in. `outward` is the side the arm is on (+X for the left arm).
 */
export function poleDirection(root: Vector3, target: Vector3, deg: number, outward: Vector3): Vector3 {
  const u = target.clone().sub(root).normalize();
  const down = perpendicular(new Vector3(0, -1, 0), u);
  const side = new Vector3().crossVectors(u, down).normalize();
  if (side.dot(outward) < 0) side.negate();
  return down.multiplyScalar(Math.cos(deg * DEG)).addScaledVector(side, Math.sin(deg * DEG)).normalize();
}

/** The pole angle a middle joint currently has (the inverse of poleDirection). */
export function poleAngle(root: Vector3, mid: Vector3, end: Vector3, outward: Vector3): number {
  const u = end.clone().sub(root).normalize();
  const down = perpendicular(new Vector3(0, -1, 0), u);
  const side = new Vector3().crossVectors(u, down).normalize();
  if (side.dot(outward) < 0) side.negate();
  const m = mid.clone().sub(root);
  m.addScaledVector(u, -m.dot(u));
  if (m.lengthSq() < 1e-10) return 0;
  return Math.atan2(m.dot(side), m.dot(down)) * RAD;
}

/** How far a joint is bent: 0° for a straight chain. */
export function bendAngle(a: Vector3, mid: Vector3, b: Vector3): number {
  const u = a.clone().sub(mid).normalize();
  const v = b.clone().sub(mid).normalize();
  return 180 - Math.acos(Math.min(1, Math.max(-1, u.dot(v)))) * RAD;
}

/** Rotation that swings a bone from pointing along `from` to pointing along `to`, applied in world space. */
export function swing(worldQ: Quaternion, from: Vector3, to: Vector3): Quaternion {
  const s = new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  return s.multiply(worldQ);
}

/** Rigid binding: every vertex follows only its strongest bone (four influences per vertex). */
export function rigidify(weights: ArrayLike<number>): Float32Array {
  const out = new Float32Array(weights.length);
  for (let v = 0; v < weights.length; v += 4) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (weights[v + k] > weights[v + best]) best = k;
    out[v + best] = 1;
  }
  return out;
}

/** Per-vertex influence of a set of bones (indices into the skeleton). */
export function influence(indices: ArrayLike<number>, weights: ArrayLike<number>, bones: ReadonlySet<number>): Float32Array {
  const out = new Float32Array(indices.length / 4);
  for (let v = 0; v < out.length; v++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (bones.has(indices[v * 4 + k])) w += weights[v * 4 + k];
    out[v] = Math.min(1, w);
  }
  return out;
}

/** Weight-paint ramp, as in most DCCs: deep blue (0) → cyan → green → yellow → red (1). Linear RGB. */
const RAMP: readonly [number, number, number, number][] = [
  [0, 0.02, 0.03, 0.16],
  [0.2, 0.0, 0.18, 0.55],
  [0.45, 0.05, 0.6, 0.35],
  [0.7, 0.95, 0.75, 0.05],
  [1, 0.9, 0.08, 0.04],
];
export function heat(w: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const x = Math.min(1, Math.max(0, w));
  for (let i = 1; i < RAMP.length; i++) {
    const [t1, r1, g1, b1] = RAMP[i];
    if (x <= t1) {
      const [t0, r0, g0, b0] = RAMP[i - 1];
      const u = (x - t0) / (t1 - t0);
      out[0] = r0 + (r1 - r0) * u; out[1] = g0 + (g1 - g0) * u; out[2] = b0 + (b1 - b0) * u;
      return out;
    }
  }
  return out;
}
