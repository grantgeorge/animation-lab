import { BODY_HALF_W, BODY_HEIGHT } from "./params";

/**
 * Volume-preserving squash & stretch along an arbitrary axis in the picture plane.
 * `stretch` scales along the axis; both perpendicular axes scale by 1/√stretch so sx·sy·sz = 1.
 * axis: radians from vertical (+y) toward +x. The 2×2 picture-plane matrix is g·I + (s − g)·a·aᵀ.
 */
export interface Deform {
  stretch: number;
  girth: number;
  axis: number;
  /** Row-major 2×2 [m00, m01, m10, m11] acting on (x, y). Depth (z) scales by `girth`. */
  m: [number, number, number, number];
}

export const MAX_STRETCH = 1.75;
export const MIN_SQUASH = 0.45;

export function deform(stretch: number, axis = 0): Deform {
  const s = Math.min(MAX_STRETCH, Math.max(MIN_SQUASH, stretch));
  const g = 1 / Math.sqrt(s);
  const ax = Math.sin(axis);
  const ay = Math.cos(axis);
  const k = s - g;
  return { stretch: s, girth: g, axis, m: [g + k * ax * ax, k * ax * ay, k * ax * ay, g + k * ay * ay] };
}

/** Determinant of the full 3D deformation (picture-plane det × depth scale). 1 means volume preserved. */
export function volume(d: Deform) {
  const [a, b, c, e] = d.m;
  return (a * e - b * c) * d.girth;
}

/** Half the vertical extent of the deformed body ellipse (semi-axes BODY_HALF_W × BODY_HEIGHT/2). */
export function halfHeight(d: Deform) {
  const rx = BODY_HALF_W;
  const ry = BODY_HEIGHT / 2;
  const [, , c, e] = d.m;
  return Math.hypot(c * rx, e * ry);
}

/** Half the horizontal extent, for the contact shadow. */
export function halfWidth(d: Deform) {
  const rx = BODY_HALF_W;
  const ry = BODY_HEIGHT / 2;
  const [a, b] = d.m;
  return Math.hypot(a * rx, b * ry);
}

/** Stretch from speed (units per frame): nothing below a crawl, saturating when the body jumps half its size per frame. */
export function speedStretch(amount: number, speedPerFrame: number) {
  const k = Math.min(1, Math.max(0, (speedPerFrame - 0.05) / 0.45));
  return 1 + amount * 0.75 * Math.pow(k, 1.1);
}

/** Peak squash on an impact of the given speed (units per frame). */
export function impactSquash(amount: number, impactPerFrame: number) {
  const k = Math.min(1, Math.max(0.25, impactPerFrame / 0.4));
  return 1 - amount * 0.5 * k;
}
