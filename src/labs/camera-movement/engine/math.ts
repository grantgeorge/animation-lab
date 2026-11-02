import { Quaternion, Vector3 } from "three";
import { quaternionFromYawPitch, type CameraPose } from "@/engine/projection";
import type { Ease, Vec3 } from "./types";

export const RAD = 180 / Math.PI;

export const v3 = (v: Vec3) => new Vector3(v[0], v[1], v[2]);
export const tup = (v: Vector3): Vec3 => [v.x, v.y, v.z];
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
export const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

export function ease(e: Ease, u: number): number {
  const x = clamp01(u);
  switch (e) {
    case "linear":
      return x;
    case "in":
      return x * x * x;
    case "out":
      return 1 - (1 - x) ** 3;
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  }
}

/** Yaw (> 0 toward +X) and pitch (> 0 up) of the direction from `from` to `to`, degrees. */
export function yawPitch(from: Vec3, to: Vec3): { yawDeg: number; pitchDeg: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return { yawDeg: Math.atan2(dx, -dz) * RAD, pitchDeg: Math.atan2(dy, Math.hypot(dx, dz)) * RAD };
}

/** Zero-roll look-at pose (same convention as the Lens lab's rig). */
export function lookAtPose(position: Vec3, target: Vec3): CameraPose {
  const { yawDeg, pitchDeg } = yawPitch(position, target);
  return { position: v3(position), quaternion: quaternionFromYawPitch(yawDeg, pitchDeg) };
}

export const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Rotate a point around a vertical axis through `pivot` by `deg` (> 0 toward +X from −Z, same as yaw). */
export function rotateAboutY(p: Vec3, pivot: Vec3, deg: number): Vec3 {
  const a = deg / RAD;
  const x = p[0] - pivot[0];
  const z = p[2] - pivot[2];
  // yaw convention: forward (0,0,-1) → (sin a, 0, -cos a)
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [pivot[0] + x * c - z * s, p[1], pivot[2] + x * s + z * c];
}

export const quatClone = (q: Quaternion) => q.clone();
