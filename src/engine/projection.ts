import { Euler, Quaternion, Vector3 } from "three";
import type { Gate, Vec3 } from "./types";
import { DEG } from "./math";
import { GATE_16x9 } from "./optics";

export interface CameraPose {
  position: Vector3;
  quaternion: Quaternion;
}

export interface Intrinsics {
  focalMm: number;
  gate: Gate;
}

export const intrinsics = (focalMm: number, gate: Gate = GATE_16x9): Intrinsics => ({ focalMm, gate });

/** tan of half the horizontal / vertical field of view. */
export const tanHalf = (i: Intrinsics) => ({
  x: i.gate.widthMm / (2 * i.focalMm),
  y: i.gate.heightMm / (2 * i.focalMm),
});

/** Orientation from yaw (> 0 toward +X) and pitch (> 0 up), zero roll. */
export function quaternionFromYawPitch(yawDeg: number, pitchDeg: number): Quaternion {
  return new Quaternion().setFromEuler(new Euler(pitchDeg * DEG, -yawDeg * DEG, 0, "YXZ"));
}

/** World → camera space (camera looks down −Z). */
export function toCameraSpace(pose: CameraPose, p: Vec3 | Vector3): Vector3 {
  const v = Array.isArray(p) ? new Vector3(p[0], p[1], p[2]) : (p as Vector3).clone();
  const inv = pose.quaternion.clone().invert();
  return v.sub(pose.position).applyQuaternion(inv);
}

export interface Projected {
  /** Normalized device coordinates; (±1, ±1) are the frame edges. */
  ndc: [number, number];
  /** Depth in front of the lens, meters (positive = in front). */
  depth: number;
  inFront: boolean;
}

/** Pinhole projection, identical to three's PerspectiveCamera for x/y. */
export function projectPoint(pose: CameraPose, i: Intrinsics, p: Vec3 | Vector3): Projected {
  const c = toCameraSpace(pose, p);
  const depth = -c.z;
  const t = tanHalf(i);
  const safe = Math.abs(depth) < 1e-9 ? 1e-9 : depth;
  return { ndc: [c.x / safe / t.x, c.y / safe / t.y], depth, inFront: depth > 0 };
}

/** Camera-space unit direction to a point that appears at `ndc`. */
export function ndcToCameraDirection(i: Intrinsics, ndc: readonly [number, number]): Vector3 {
  const t = tanHalf(i);
  return new Vector3(ndc[0] * t.x, ndc[1] * t.y, -1).normalize();
}

/** Four world-space corners of the frame on a plane `distance` in front of the lens: TL, TR, BR, BL. */
export function frustumCornersAtDistance(pose: CameraPose, i: Intrinsics, distance: number): Vector3[] {
  const t = tanHalf(i);
  const hw = distance * t.x;
  const hh = distance * t.y;
  return (
    [
      [-hw, hh],
      [hw, hh],
      [hw, -hh],
      [-hw, -hh],
    ] as const
  ).map(([x, y]) => new Vector3(x, y, -distance).applyQuaternion(pose.quaternion).add(pose.position));
}

/** Forward unit vector of a pose. */
export const forwardOf = (pose: CameraPose) => new Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
