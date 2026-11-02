import { Vector3 } from "three";
import type { CameraRig, SceneDescriptor, TargetId, Vec3 } from "./types";
import { RAD, clamp } from "./math";
import { type CameraPose, type Intrinsics, intrinsics, ndcToCameraDirection, quaternionFromYawPitch } from "./projection";

/** Camera position on the rail. The rail runs along −Z: z = −railS. */
export const railPosition = (d: SceneDescriptor, railS: number) => new Vector3(d.rail.x, d.rail.y, -railS);

export function poseFromRig(d: SceneDescriptor, rig: CameraRig): CameraPose {
  return { position: railPosition(d, rig.railS), quaternion: quaternionFromYawPitch(rig.yawDeg, rig.pitchDeg) };
}

/** Distance along the rail from the camera to the primary's plane. */
export const distanceToPrimaryAlongRail = (d: SceneDescriptor, railS: number) => -railS - d.characters.primary.anchor[2];

export const railSForPrimaryDistance = (d: SceneDescriptor, distanceM: number) => -(d.characters.primary.anchor[2] + distanceM);

export function anchorFor(d: SceneDescriptor, target: TargetId): Vec3 {
  if (target === "primary") return d.characters.primary.anchor;
  if (target === "secondary") return d.characters.secondary.anchor;
  return d.anchors.both;
}

/**
 * Exact zero-roll aim: the yaw/pitch that makes `anchor` appear at `ndc`.
 * Solves R_y(ψ)·R_x(θ)·c = w, with c the camera-space direction of the NDC point and w the world direction to the anchor.
 * Yaw and pitch do not add across frames, so a simple subtraction would drift by ~2 % of the frame.
 */
export function aimForNdc(
  cameraPos: Vector3,
  anchor: Vec3,
  ndc: readonly [number, number],
  i: Intrinsics,
): { yawDeg: number; pitchDeg: number } {
  const w = new Vector3(anchor[0], anchor[1], anchor[2]).sub(cameraPos).normalize();
  const c = ndcToCameraDirection(i, ndc);
  const r = Math.hypot(c.y, c.z);
  const phi = Math.atan2(c.z, c.y);
  const a = Math.acos(clamp(w.y / r, -1, 1));
  const t1 = a - phi;
  const t2 = -a - phi;
  const norm = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
  const theta = Math.abs(norm(t1)) <= Math.abs(norm(t2)) ? norm(t1) : norm(t2);
  // v = R_x(θ)·c
  const vx = c.x;
  const vz = c.y * Math.sin(theta) + c.z * Math.cos(theta);
  const psi = norm(Math.atan2(w.x, w.z) - Math.atan2(vx, vz));
  return { yawDeg: -psi * RAD, pitchDeg: theta * RAD };
}

/** Clamp a rail position to travel limits and the no-go sphere around every anchor. */
export function clampRailS(d: SceneDescriptor, railS: number): { railS: number; hint: null | "min" | "max" } {
  let s = railS;
  let hint: null | "min" | "max" = null;
  if (s > d.rail.sMax) {
    s = d.rail.sMax;
    hint = "min";
  } else if (s < d.rail.sMin) {
    s = d.rail.sMin;
    hint = "max";
  }
  for (const anchor of [d.characters.primary.anchor, d.characters.secondary.anchor]) {
    const p = railPosition(d, s);
    const dist = p.distanceTo(new Vector3(...anchor));
    if (dist < d.noGoRadiusM) {
      s = -(anchor[2] + d.noGoRadiusM);
      hint = "min";
    }
  }
  return { railS: s, hint };
}

export const rigIntrinsics = (d: SceneDescriptor, rig: CameraRig) => intrinsics(rig.focalMm, d.gate);
