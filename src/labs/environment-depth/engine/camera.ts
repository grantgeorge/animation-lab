import { Matrix4, Quaternion, Vector3 } from "three";
import { GATE, PIP, groundY } from "./world";

/** The film camera, its matched-framing base position for a focal length, and the three moves. */
export interface Shot {
  position: Vector3;
  quaternion: Quaternion;
  focalMm: number;
}

export const CAMERA = {
  eyeM: 1.1,
  defaultFocalMm: 24,
  /** Pip fills this fraction of the frame height at every focal length (matched subject size). */
  pipFrac: 0.12,
  /** Frame centre on Pip's plane, metres above his feet (puts him on the lower third). */
  aimM: 2.4,
  /** At 24 mm the camera stands this far right of the path centre. */
  lateralM: 1.05,
  minFocalMm: 18,
  maxFocalMm: 135,
} as const;

export type MoveId = "push" | "track" | "arc";
export const MOVES: readonly MoveId[] = ["push", "track", "arc"];

/** One loop: hold, move out, hold, move back, hold (seconds). */
export const LOOP_S = 12;
export const FPS = 24;

export const tanHalf = (focalMm: number) => ({ x: GATE.widthMm / (2 * focalMm), y: GATE.heightMm / (2 * focalMm) });
export const hfovDeg = (focalMm: number) => (2 * Math.atan(GATE.widthMm / (2 * focalMm)) * 180) / Math.PI;
export const vfovDeg = (focalMm: number) => (2 * Math.atan(GATE.heightMm / (2 * focalMm)) * 180) / Math.PI;

/** Distance at which Pip (1.05 m) fills `pipFrac` of the frame height: d = f·H / (frac·h). */
export const distanceForFocal = (focalMm: number) => (focalMm * PIP.heightM) / (CAMERA.pipFrac * GATE.heightMm);

export const AIM = new Vector3(PIP.root[0], CAMERA.aimM, PIP.root[2]);

/** Horizontal heading of the film camera (fixed: every lens looks at Pip along the same line). */
export const HEADING = (() => {
  const d = distanceForFocal(CAMERA.defaultFocalMm);
  return new Vector3(PIP.root[0] - CAMERA.lateralM, 0, -d).normalize();
})();
export const RIGHT = new Vector3(-HEADING.z, 0, HEADING.x).normalize();

const UP = new Vector3(0, 1, 0);
const m = new Matrix4();

export function lookAtQuat(from: Vector3, to: Vector3, out = new Quaternion()) {
  m.lookAt(from, to, UP);
  return out.setFromRotationMatrix(m);
}

/** Camera eye height follows the ground a little (a dolly on the forest floor). */
export const eyeY = (x: number, z: number) => CAMERA.eyeM + 0.9 * groundY(x, z);

/** Matched framing: back the camera off along the heading so Pip keeps his size at any focal length. */
export function baseShot(focalMm: number): Shot {
  const d = distanceForFocal(focalMm);
  const x = AIM.x - HEADING.x * d;
  const z = AIM.z - HEADING.z * d;
  const position = new Vector3(x, eyeY(x, z), z);
  return { position, quaternion: lookAtQuat(position, AIM), focalMm };
}

export const MOVE = { pushM: 4.2, trackM: 3.4, trackPushM: 1.6, arcDeg: 28 } as const;

/**
 * The same move for every construction. u = 0 is the base frame (frame 0 of the move).
 * push: straight in, orientation fixed. track: sideways with a little push, orientation fixed.
 * arc: orbit about the vertical through Pip's frame centre, always looking at it.
 */
export function moveShot(focalMm: number, move: MoveId, u: number, size = 1): Shot {
  const b = baseShot(focalMm);
  const k = size * u;
  if (move === "arc") {
    const ang = (MOVE.arcDeg * k * Math.PI) / 180;
    const off = b.position.clone().sub(AIM);
    off.y = 0;
    off.applyAxisAngle(UP, ang);
    const x = AIM.x + off.x;
    const z = AIM.z + off.z;
    const position = new Vector3(x, eyeY(x, z), z);
    return { position, quaternion: lookAtQuat(position, AIM), focalMm };
  }
  const p = b.position.clone();
  if (move === "push") p.addScaledVector(HEADING, MOVE.pushM * k);
  else p.addScaledVector(RIGHT, MOVE.trackM * k).addScaledVector(HEADING, MOVE.trackPushM * k);
  p.y = eyeY(p.x, p.z);
  return { position: p, quaternion: b.quaternion.clone(), focalMm };
}

/** Plan-view bounds (world x / z) that hold the base camera, Pip and the forest behind him. */
export function planBounds(focalMm: number, aspect: number) {
  const c0 = baseShot(focalMm).position;
  const z1 = c0.z + 8;
  const z0 = PIP.root[2] - 34;
  const h = z1 - z0;
  const w = h * aspect;
  const cx = (c0.x + PIP.root[0]) / 2;
  return { x0: cx - w / 2, x1: cx + w / 2, z0, z1 };
}

const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/** Move progress for loop time t: 0.6 s hold, 4.8 s out, 1.2 s hold, 4.8 s back, 0.6 s hold. */
export function moveU(t: number) {
  const x = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  if (x < 0.6) return 0;
  if (x < 5.4) return smoother((x - 0.6) / 4.8);
  if (x < 6.6) return 1;
  if (x < 11.4) return smoother(1 - (x - 6.6) / 4.8);
  return 0;
}

/** The loop time at which the move reaches progress u on the way out. */
export function timeForU(u: number) {
  if (u <= 0) return 0;
  if (u >= 1) return 6;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (smoother(mid) < u) lo = mid;
    else hi = mid;
  }
  return 0.6 + 4.8 * ((lo + hi) / 2);
}

/** World → camera matrix of a shot. */
export function viewMatrix(s: Shot, out = new Matrix4()) {
  return out.compose(s.position, s.quaternion, new Vector3(1, 1, 1)).invert();
}

/** Camera-space position of a world point (camera looks down −Z). */
export function toCamera(s: Shot, p: Vector3) {
  return p.clone().sub(s.position).applyQuaternion(s.quaternion.clone().invert());
}

/** Normalised device coordinates of a world point, and its depth along the view axis. */
export function project(s: Shot, p: Vector3) {
  const c = toCamera(s, p);
  const th = tanHalf(s.focalMm);
  const z = -c.z;
  return { x: c.x / z / th.x, y: c.y / z / th.y, depth: z };
}
