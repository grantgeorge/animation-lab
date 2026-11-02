import type { Gate } from "./types";
import { RAD } from "./math";

/** Full-frame width, 16:9 active area. */
export const GATE_16x9: Gate = { widthMm: 36, heightMm: 20.25 };

/** Horizontal field of view in degrees: 2·atan(w / 2f). */
export const hfovDeg = (focalMm: number, gate: Gate = GATE_16x9) =>
  2 * Math.atan(gate.widthMm / (2 * focalMm)) * RAD;

/** Vertical field of view in degrees: 2·atan(h / 2f). three.js PerspectiveCamera.fov is this value. */
export const vfovDeg = (focalMm: number, gate: Gate = GATE_16x9) =>
  2 * Math.atan(gate.heightMm / (2 * focalMm)) * RAD;

/** Size of the frame (meters) on a plane at `distanceM` in front of the lens. */
export const frameSizeAtDistance = (focalMm: number, distanceM: number, gate: Gate = GATE_16x9) => ({
  widthM: (distanceM * gate.widthMm) / focalMm,
  heightM: (distanceM * gate.heightMm) / focalMm,
});

/** Fraction of frame height an object of height H at depth Z occupies: f·H / (Z·h). */
export const heightFraction = (heightM: number, distanceM: number, focalMm: number, gate: Gate = GATE_16x9) =>
  (focalMm * heightM) / (distanceM * gate.heightMm);

/** Depth at which an object of height H fills `fraction` of the frame height. */
export const distanceForFraction = (heightM: number, focalMm: number, fraction: number, gate: Gate = GATE_16x9) =>
  (focalMm * heightM) / (fraction * gate.heightMm);

/** Focal length that makes an object of height H at depth Z fill `fraction` of the frame height. */
export const focalForFraction = (heightM: number, distanceM: number, fraction: number, gate: Gate = GATE_16x9) =>
  (fraction * distanceM * gate.heightMm) / heightM;
