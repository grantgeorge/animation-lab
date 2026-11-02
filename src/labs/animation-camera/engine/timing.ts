import { Vector3 } from "three";
import { ease } from "@/labs/camera-movement/engine/math";
import { FPS, shot, subjects, type Shot, type Vec3 } from "./common";

/** Experiment 4: a photoreal camera (depth of field, motion blur) vs a stylized anime camera. */
export type LookStyle = "photoreal" | "anime" | "split";
export type Stepping = 1 | 2 | 3;

/** Loop time quantized to drawings: on ones every frame is new, on twos each drawing holds 2 frames. */
export function stepTime(t: number, onN: number): number {
  if (onN <= 1) return t;
  const f = Math.floor(t * FPS + 1e-6);
  return (Math.floor(f / onN) * onN) / FPS;
}

export function drawingInfo(t: number, onN: number) {
  const frame = Math.floor(t * FPS + 1e-6);
  return { frame, drawing: Math.floor(frame / onN), held: frame % onN !== 0, drawingsPerSecond: FPS / onN };
}

/** Sub-frame sample times (offsets from t, seconds) spread over a shutter of `shutterDeg`, centred on the frame. */
export function shutterOffsets(samples: number, shutterDeg: number): number[] {
  const open = shutterDeg / 360 / FPS;
  if (samples <= 1) return [0];
  return Array.from({ length: samples }, (_, k) => ((k + 0.5) / samples - 0.5) * open);
}

/**
 * Circle of confusion diameter in pixels for a thin lens: c = A·f·|z − s| / (z·(s − f)), A = f / N,
 * converted from the sensor (mm) to the image height in pixels.
 */
export function cocPx(zM: number, focusM: number, focalMm: number, fStop: number, sensorHmm: number, imageHpx: number) {
  const f = focalMm / 1000;
  const A = f / fStop;
  const c = (A * f * Math.abs(zM - focusM)) / (zM * Math.max(1e-6, focusM - f));
  return ((c * 1000) / sensorHmm) * imageHpx;
}

/** The shot: hold on Bram, whip-pan to Pip for his wave and hop, pan back. 75 mm from the right. */
export const E4 = {
  position: [1.3, 1.4, 0.9] as Vec3,
  focalMm: 75,
  pans: [
    [2.5, 2.9, 1],
    [5.2, 5.6, 0],
  ] as const,
  bramAimY: 1.5,
  pipAimLift: 0.3,
} as const;

/** 0 = aimed at Bram, 1 = aimed at Pip. */
export function aimBlend(t: number): number {
  const [[a0, a1], [b0, b1]] = E4.pans;
  if (t < a0) return 0;
  if (t < a1) return ease("inOut", (t - a0) / (a1 - a0));
  if (t < b0) return 1;
  if (t < b1) return 1 - ease("inOut", (t - b0) / (b1 - b0));
  return 0;
}

export function e4Target(t: number): Vec3 {
  const s = subjects();
  const b = s("primary", t).anchor;
  const p = s("secondary", t).anchor;
  const w = aimBlend(t);
  const bt: Vec3 = [b[0], E4.bramAimY, b[2]];
  const pt: Vec3 = [p[0], p[1] + E4.pipAimLift, p[2]];
  return [bt[0] + (pt[0] - bt[0]) * w, bt[1] + (pt[1] - bt[1]) * w, bt[2] + (pt[2] - bt[2]) * w];
}

export function e4Shot(t: number): Shot {
  return shot(E4.position, e4Target(t), E4.focalMm);
}

/** Focus follows whoever the camera is aimed at (a rack focus during each pan). */
export function e4Focus(t: number): number {
  const p = e4Target(t);
  return Math.hypot(p[0] - E4.position[0], p[1] - E4.position[1], p[2] - E4.position[2]);
}

/** Angular speed of a camera path (deg/s) and the on-screen direction the world slides. */
export function angularVelocity(poseAt: (t: number) => Shot, t: number, h = 1 / 240) {
  const a = poseAt(t - h);
  const b = poseAt(t + h);
  const fa = new Vector3(0, 0, -1).applyQuaternion(a.quaternion);
  const fb = new Vector3(0, 0, -1).applyQuaternion(b.quaternion);
  const ang = fa.angleTo(fb);
  // Direction of the change in camera space of the earlier pose: the world slides the other way.
  const local = fb.clone().applyQuaternion(a.quaternion.clone().invert());
  const dir: [number, number] = [-local.x, -local.y];
  const n = Math.hypot(dir[0], dir[1]) || 1;
  return { degPerS: ((ang * 180) / Math.PI) / (2 * h), dir: [dir[0] / n, dir[1] / n] as [number, number] };
}
