import { Quaternion, Vector3 } from "three";
import { DEG } from "@/engine/math";
import { tanHalf, intrinsics, toCameraSpace } from "@/engine/projection";
import { D, GATE, heightFrac, matchOrtho, ndcOrtho, ndcPersp, shot, subjects, type OrthoFrame, type Shot, type Vec3 } from "./common";

/** Experiment 1: the same set through a perspective lens and an orthographic camera. */
export type Projection = "perspective" | "orthographic";
export type ViewPreset = "street" | "iso";

/** True isometric: 45° around, arctan(1/√2) = 35.264° down. */
export const ISO_YAW_DEG = 45;
export const ISO_PITCH_DEG = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI;

export const E1 = {
  /** A three-quarter street view a little above eye level, so the floor lines show their convergence. */
  street: { position: [-2.7, 2.1, 1.5] as Vec3, target: [0.25, 0.95, -4.4] as Vec3, focalMm: 30 },
  /** The perspective twin of the isometric view sits far back along the iso direction. */
  iso: { target: [0.1, 0.9, -4.6] as Vec3, distance: 13.5, focalMm: 35 },
  /** Floor rulers: lines running into depth (x, from z0 to z1) and cross ticks every metre. */
  rulers: { xs: [-1.6, -0.8, 0, 0.8, 1.6], z0: 1.2, z1: -8.6 },
  /** Identical 1.78 m poles (Bram's height) at Bram's, Pip's and the back wall's depth. */
  poles: [
    { id: "bram", label: "at Bram", base: [-1.05, 0, -3.0] as Vec3 },
    { id: "pip", label: "at Pip", base: [1.35, 0, -4.7] as Vec3 },
    { id: "wall", label: "at the back wall", base: [-2.2, 0, -8.6] as Vec3 },
  ],
  poleHeightM: D.characters.primary.landmarks.capTop,
} as const;

export function perspShot(view: ViewPreset): Shot {
  if (view === "street") return shot(E1.street.position, E1.street.target, E1.street.focalMm);
  const y = ISO_PITCH_DEG * DEG;
  const a = ISO_YAW_DEG * DEG;
  const dir: Vec3 = [Math.sin(a) * Math.cos(y), Math.sin(y), Math.cos(a) * Math.cos(y)];
  const t = E1.iso.target;
  const p: Vec3 = [t[0] + dir[0] * E1.iso.distance, t[1] + dir[1] * E1.iso.distance, t[2] + dir[2] * E1.iso.distance];
  return shot(p, t, E1.iso.focalMm);
}

/** Bram's full height at time t (feet → cap) and his framing anchor. */
function bramSpan(t: number) {
  const s = subjects()("primary", t);
  return { bottom: s.feet, top: [s.feet[0], s.feet[1] + s.heightM, s.feet[2]] as Vec3, anchor: s.anchor };
}

/** Ortho frame matched to the perspective shot on Bram's rest mark (stable: the camera never breathes). */
export function orthoFor(view: ViewPreset): OrthoFrame {
  const s = perspShot(view);
  const b = bramSpan(0);
  const c = D.characters.primary;
  return matchOrtho(s, c.root, [c.root[0], c.landmarks.capTop, c.root[2]], b.anchor);
}

/** Camera yaw / pitch of a shot (degrees, yaw > 0 toward +X, pitch > 0 up). */
export function yawPitchOf(s: Shot) {
  const f = new Vector3(0, 0, -1).applyQuaternion(s.quaternion);
  return { yawDeg: (Math.atan2(f.x, -f.z) * 180) / Math.PI, pitchDeg: (Math.atan2(f.y, Math.hypot(f.x, f.z)) * 180) / Math.PI };
}

/**
 * Vanishing point of world lines with direction `dir`, in perspective NDC. Null when the lines are
 * parallel to the image plane (they never converge) or recede behind the camera.
 */
export function vanishingPoint(s: Shot, dir: Vec3): [number, number] | null {
  const c = new Vector3(...dir).applyQuaternion(s.quaternion.clone().invert());
  if (c.z > -1e-6) return null;
  const th = tanHalf(intrinsics(s.focalMm, GATE));
  return [c.x / -c.z / th.x, c.y / -c.z / th.y];
}

export interface Segment2 {
  a: [number, number];
  b: [number, number];
}

/** The floor rulers (lines into depth) projected through either camera. */
export function rulerSegments(s: Shot, proj: Projection, frame: OrthoFrame): Segment2[] {
  const P = (p: Vec3) => (proj === "perspective" ? ndcPersp(s, p) : ndcOrtho(s, frame, p));
  return E1.rulers.xs.map((x) => ({ a: P([x, 0, E1.rulers.z0]), b: P([x, 0, E1.rulers.z1]) }));
}

/** Intersection of two 2D lines (infinite), or null when they are parallel. */
export function intersect(l1: Segment2, l2: Segment2): [number, number] | null {
  const d1 = [l1.b[0] - l1.a[0], l1.b[1] - l1.a[1]];
  const d2 = [l2.b[0] - l2.a[0], l2.b[1] - l2.a[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const n1 = Math.hypot(d1[0], d1[1]);
  const n2 = Math.hypot(d2[0], d2[1]);
  if (Math.abs(den) < 1e-6 * n1 * n2) return null;
  const u = ((l2.a[0] - l1.a[0]) * d2[1] - (l2.a[1] - l1.a[1]) * d2[0]) / den;
  return [l1.a[0] + d1[0] * u, l1.a[1] + d1[1] * u];
}

/** Angle (degrees) between the outermost rulers on screen: > 0 converging, 0 parallel. */
export function convergenceDeg(segs: Segment2[]): number {
  const a = segs[0];
  const b = segs[segs.length - 1];
  const ang = (s: Segment2) => Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
  let d = Math.abs(ang(a) - ang(b));
  if (d > Math.PI) d = 2 * Math.PI - d;
  if (d > Math.PI / 2) d = Math.PI - d;
  return (d * 180) / Math.PI;
}

export interface E1Readout {
  bramFrac: number;
  pipFrac: number;
  /** Pip's on-screen height / Bram's. Real heights give 1.12 / 1.78 = 0.63. */
  pipToBram: number;
  trueRatio: number;
  /** On-screen height of the three identical poles (fraction of frame). */
  poles: number[];
  convergenceDeg: number;
  vp: [number, number] | null;
  /** Depth of each pole along the view axis, metres. */
  poleDepths: number[];
}

export function e1Readout(view: ViewPreset, proj: Projection, t: number): E1Readout {
  const s = perspShot(view);
  const f = orthoFor(view);
  const P = (p: Vec3) => (proj === "perspective" ? ndcPersp(s, p) : ndcOrtho(s, f, p));
  const subj = subjects();
  const b = subj("primary", t);
  const p = subj("secondary", t);
  const bramFrac = heightFrac(P, b.feet, b.heightM);
  const pipFrac = heightFrac(P, p.feet, p.heightM);
  const segs = rulerSegments(s, proj, f);
  return {
    bramFrac,
    pipFrac,
    pipToBram: pipFrac / bramFrac,
    trueRatio: p.heightM / b.heightM,
    poles: E1.poles.map((q) => heightFrac(P, q.base, E1.poleHeightM)),
    convergenceDeg: convergenceDeg(segs),
    vp: proj === "perspective" ? vanishingPoint(s, [0, 0, -1]) : null,
    poleDepths: E1.poles.map((q) => -toCameraSpace(s, q.base).z),
  };
}

/** Quaternion for the iso camera, exposed for tests. */
export const isoQuaternion = (): Quaternion => perspShot("iso").quaternion;
