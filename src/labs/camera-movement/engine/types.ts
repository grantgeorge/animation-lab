import type { Vec3 } from "@/engine/types";

export type { Vec3 };

/** One camera keyframe: where the lens is, what it looks at (zero roll), and the focal length. */
export interface CameraKey {
  position: Vec3;
  target: Vec3;
  focalMm: number;
}

/**
 * How the camera travels between its two keys.
 * linear: position and aim point glide in straight lines; focal changes in log space.
 * orbit: the camera arcs around the subject at a (lerped) radius and height.
 * track: the camera keeps a (lerped) offset from a moving subject and aims at it.
 * dollyZoom: position glides; the focal length is solved every frame so the subject keeps its size.
 */
export type Interp = "linear" | "orbit" | "track" | "dollyZoom";
export type Ease = "linear" | "inOut" | "in" | "out";
export type SubjectId = "primary" | "secondary";

export type MoveKind = "static" | "dollyIn" | "dollyOut" | "zoomIn" | "pan" | "tilt" | "truck" | "crane" | "orbit" | "tracking" | "dollyZoom";

export interface Move {
  kind: MoveKind;
  start: CameraKey;
  end: CameraKey;
  interp: Interp;
  ease: Ease;
  /** Move window inside the loop, seconds. Before t0 the camera holds its start, after t1 its end. */
  t0: number;
  t1: number;
  subject: SubjectId;
}

/** The one or two numbers a preset exposes. Units depend on the move (see MOVE_INFO). */
export interface MoveParams {
  amount: number;
  focalMm: number;
  subject: SubjectId;
  ease: Ease;
  t0: number;
  t1: number;
}

/** Where a subject is at time t: feet position and the aim point (its framing anchor). */
export interface SubjectState {
  feet: Vec3;
  anchor: Vec3;
  heightM: number;
}

export type SubjectFn = (id: SubjectId, t: number) => SubjectState;
