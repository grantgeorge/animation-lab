import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { RAD } from "../math";

/** three (x, y, z) Y-up meters → Blender (x, −z, y) Z-up meters. */
export const toBlenderLocation = (p: readonly number[]): [number, number, number] => [p[0], -p[2], p[1]];

/**
 * Blender camera rotation (rotation_mode 'XYZ', degrees).
 * Both cameras look down local −Z with +Y up, so M_blender = Rx(+90°)·M_three.
 * Blender's XYZ mode is extrinsic X→Y→Z, i.e. M = Rz·Ry·Rx — three's 'ZYX' Euler order.
 */
export function toBlenderRotation(q: Quaternion): [number, number, number] {
  const m = new Matrix4().makeRotationX(Math.PI / 2).multiply(new Matrix4().makeRotationFromQuaternion(q));
  const e = new Euler().setFromRotationMatrix(m, "ZYX");
  return [e.x * RAD, e.y * RAD, e.z * RAD];
}

/** three meters → Unreal centimeters, Z-up left-handed, X forward: 100·(−z, x, y). */
export const toUnrealLocation = (p: readonly number[]): [number, number, number] => [-p[2] * 100, p[0] * 100, p[1] * 100];

/** Unreal FRotator (degrees) from a three camera orientation. Roll is 0 for the lab's zero-roll rig. */
export function toUnrealRotator(q: Quaternion): { pitch: number; yaw: number; roll: number } {
  const f = new Vector3(0, 0, -1).applyQuaternion(q);
  const u = new Vector3(0, 1, 0).applyQuaternion(q);
  const r = new Vector3(1, 0, 0).applyQuaternion(q);
  const F = [-f.z, f.x, f.y];
  const U = [-u.z, u.x, u.y];
  const R = [-r.z, r.x, r.y];
  const yaw = Math.atan2(F[1], F[0]) * RAD;
  const pitch = Math.atan2(F[2], Math.hypot(F[0], F[1])) * RAD;
  const roll = Math.atan2(-R[2], U[2]) * RAD;
  const clean = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);
  return { pitch: clean(pitch), yaw: clean(yaw), roll: clean(roll) };
}
