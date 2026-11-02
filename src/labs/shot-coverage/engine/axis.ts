import type { SubjectFn, Vec3 } from "./types";

/** 2D point/vector on the floor plane: [x, z]. */
export type V2 = [number, number];

/**
 * The axis of action (the "180° line") at one instant: the line through Bram's and Pip's feet.
 * `u` points from Bram to Pip; `n` is the floor normal of the "+" side (cross(u, n) > 0).
 * Cameras on the + side see Bram screen-left of Pip; cameras on the − side see the mirror image.
 */
export interface Axis {
  a: V2;
  b: V2;
  u: V2;
  n: V2;
  length: number;
}

/** Cameras closer to the line than this (metres) are "on the line": a neutral shot. */
export const ON_LINE_M = 0.15;

export function axisFrom(a: V2, b: V2): Axis {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const u: V2 = length > 1e-6 ? [dx / length, dz / length] : [1, 0];
  return { a, b, u, n: [-u[1], u[0]], length };
}

export function axisAt(subjects: SubjectFn, t: number): Axis {
  const a = subjects("primary", t).feet;
  const b = subjects("secondary", t).feet;
  return axisFrom([a[0], a[2]], [b[0], b[2]]);
}

/** Signed distance (metres) of a point from the axis; > 0 on the + side. */
export function signedDistance(ax: Axis, p: Vec3 | V2): number {
  const x = p[0];
  const z = p.length === 3 ? p[2] : p[1];
  return ax.u[0] * (z - ax.a[1]) - ax.u[1] * (x - ax.a[0]);
}

/** +1, −1, or 0 when the point is within ON_LINE_M of the line. */
export function sideOf(ax: Axis, p: Vec3 | V2, eps = ON_LINE_M): -1 | 0 | 1 {
  const s = signedDistance(ax, p);
  return Math.abs(s) < eps ? 0 : s > 0 ? 1 : -1;
}

/** Mirror a point across the axis (same height, same distance from the line, other side). */
export function reflectAcross(ax: Axis, p: Vec3): Vec3 {
  const vx = p[0] - ax.a[0];
  const vz = p[2] - ax.a[1];
  const along = vx * ax.u[0] + vz * ax.u[1];
  const px = vx - along * ax.u[0];
  const pz = vz - along * ax.u[1];
  return [ax.a[0] + along * ax.u[0] - px, p[1], ax.a[1] + along * ax.u[1] - pz];
}

/** True when a cut from camera p to camera q (both off the line) jumps across it. */
export function crossesAxis(ax: Axis, p: Vec3, q: Vec3): boolean {
  return sideOf(ax, p) * sideOf(ax, q) < 0;
}
