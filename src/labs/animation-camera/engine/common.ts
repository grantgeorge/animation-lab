import { Quaternion, Vector3 } from "three";
import type { Vec3 } from "@/engine/types";
import { doorwayScene } from "@/labs/lens-and-framing/config";
import { GATE_16x9 } from "@/engine/optics";
import { intrinsics, projectPoint, toCameraSpace, type CameraPose } from "@/engine/projection";
import { clipFor } from "@/scene/animation/performances";
import { makeSubjectFn } from "@/labs/camera-movement/engine/subject";
import { lookAtPose } from "@/labs/camera-movement/engine/math";
import type { SubjectFn } from "@/labs/camera-movement/engine/types";

export type { Vec3, CameraPose, SubjectFn };

/** The lab always films the doorway scene (Bram, Pip, the lantern, the doorway, the back wall, the tower). */
export const D = doorwayScene;
export const GATE = GATE_16x9;
export const ASPECT = 16 / 9;
export const FPS = 24;
export const LOOP_S = D.timeline.durationS;

let subjectFn: SubjectFn | null = null;
/** Where Bram (primary) and Pip (secondary) are at loop time t, from the doorway performance. */
export function subjects(): SubjectFn {
  subjectFn ??= makeSubjectFn(D, { primary: clipFor("doorway", "bram"), secondary: clipFor("doorway", "pip") });
  return subjectFn;
}

/** A pose plus the lens that goes with it. */
export interface Shot extends CameraPose {
  focalMm: number;
}

export const shot = (position: Vec3, target: Vec3, focalMm: number): Shot => ({ ...lookAtPose(position, target), focalMm });

export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const tuple = (v: Vector3): Vec3 => [v.x, v.y, v.z];
export const smooth = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};
/** Smooth ping-pong 0 → 1 → 0 over the loop (seamless at the wrap). */
export const pingPong = (t: number, period = LOOP_S) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);

/** Camera basis vectors (world space) for a pose. */
export function basis(q: Quaternion) {
  return {
    right: new Vector3(1, 0, 0).applyQuaternion(q),
    up: new Vector3(0, 1, 0).applyQuaternion(q),
    forward: new Vector3(0, 0, -1).applyQuaternion(q),
  };
}

/** Depth of a point along the camera's view axis. */
export const depthOf = (pose: CameraPose, p: Vec3) => -toCameraSpace(pose, p).z;

/** Perspective NDC of a world point for a shot. */
export const ndcPersp = (s: Shot, p: Vec3) => projectPoint(s, intrinsics(s.focalMm, GATE), p).ndc;

/**
 * An orthographic frustum in camera space: half height plus an off-centre shift (cx, cy), so a
 * subject can sit at the same place in frame as it does through the perspective lens.
 */
export interface OrthoFrame {
  halfH: number;
  cx: number;
  cy: number;
}

/** Orthographic NDC of a world point: no divide by depth, so size never depends on distance. */
export function ndcOrtho(pose: CameraPose, f: OrthoFrame, p: Vec3, aspect = ASPECT): [number, number] {
  const v = toCameraSpace(pose, p);
  return [(v.x - f.cx) / (f.halfH * aspect), (v.y - f.cy) / f.halfH];
}

/**
 * The orthographic frustum (same pose) in which the segment bottom→top has the same on-screen height
 * as through the perspective lens, and `anchor` lands on the same NDC point.
 */
export function matchOrtho(s: Shot, bottom: Vec3, top: Vec3, anchor: Vec3, aspect = ASPECT): OrthoFrame {
  const spanNdc = ndcPersp(s, top)[1] - ndcPersp(s, bottom)[1];
  const vt = toCameraSpace(s, top);
  const vb = toCameraSpace(s, bottom);
  const halfH = Math.abs((vt.y - vb.y) / spanNdc);
  const a = ndcPersp(s, anchor);
  const va = toCameraSpace(s, anchor);
  return { halfH, cx: va.x - a[0] * halfH * aspect, cy: va.y - a[1] * halfH };
}

/** Fraction of frame height a vertical segment fills (perspective or orthographic). */
export function heightFrac(project: (p: Vec3) => [number, number], base: Vec3, heightM: number): number {
  const b = project(base);
  const t = project([base[0], base[1] + heightM, base[2]]);
  return Math.abs(t[1] - b[1]) / 2;
}
