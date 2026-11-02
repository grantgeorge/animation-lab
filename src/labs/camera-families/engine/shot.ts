import { Matrix4, Quaternion, Vector3 } from "three";
import type { Gate } from "./formats";
import { panYawDeg } from "./shutter";

/**
 * The lab's one locked-off shot of the doorway: a fixed camera position, so perspective never
 * changes; only the sensor, lens, aperture, shutter and response do. Metres, doorway scene.
 */
export const SHOT = {
  position: [-0.45, 1.32, 1.5] as const,
  target: [0.2, 1.42, -4.0] as const,
  near: 0.08,
  far: 60,
} as const;

/** Points of interest for focus presets and the depth-of-field diagram (world space). */
export const MARKS = {
  lantern: { label: "Lantern", point: [0.62, 2.05, -1.6] as const },
  bram: { label: "Bram", point: [-0.35, 1.47, -3.0] as const },
  pip: { label: "Pip", point: [0.72, 0.8, -4.7] as const },
  doorway: { label: "Doorway", point: [0.34, 1.0, -5.0] as const },
  wall: { label: "Back wall", point: [-0.6, 2.1, -9.0] as const },
} as const;
export type MarkId = keyof typeof MARKS;
export const FOCUS_TARGETS: readonly MarkId[] = ["lantern", "bram", "pip", "wall"];

const UP = new Vector3(0, 1, 0);

/** Zero-roll orientation looking from SHOT.position at SHOT.target, then panned by `yawDeg`. */
export function shotQuaternion(yawDeg = 0, out = new Quaternion()): Quaternion {
  const m = new Matrix4().lookAt(new Vector3(...SHOT.position), new Vector3(...SHOT.target), UP);
  out.setFromRotationMatrix(m);
  if (yawDeg) out.premultiply(new Quaternion().setFromAxisAngle(UP, (yawDeg * Math.PI) / 180));
  return out;
}

/** Camera yaw at scene time t for the selected move. */
export const moveYawDeg = (move: "locked" | "pan", t: number) => (move === "pan" ? panYawDeg(t) : 0);

/** Distance of a world point along the (unpanned) optical axis: what a focus puller measures. */
export function depthAlongAxis(p: readonly [number, number, number]): number {
  const fwd = new Vector3(0, 0, -1).applyQuaternion(shotQuaternion(0));
  return new Vector3(...p).sub(new Vector3(...SHOT.position)).dot(fwd);
}

export const markDepth = (id: MarkId) => depthAlongAxis(MARKS[id].point);

/**
 * How big Bram reads: the projected height of a 1 m vertical segment at his mark, as a fraction of
 * the frame WIDTH (comparable across 16:9 and open-gate aspects). For a pinhole camera a camera-space
 * point (x, y, z) lands at y·f / −z on the sensor, so the fraction is Δ(y / −z) · f / w.
 * Same framing (focal scaled with the gate width) keeps it constant.
 */
export function subjectWidthFraction(gate: Gate, focalMm: number, yawDeg = 0): number {
  const inv = shotQuaternion(yawDeg).invert();
  const cam = new Vector3(...SHOT.position);
  const [x, y, z] = MARKS.bram.point;
  const toCam = (py: number) => new Vector3(x, py, z).sub(cam).applyQuaternion(inv);
  const a = toCam(y - 0.5);
  const b = toCam(y + 0.5);
  return (Math.abs(b.y / -b.z - a.y / -a.z) * focalMm) / gate.widthMm;
}
