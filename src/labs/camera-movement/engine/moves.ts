import type { SceneDescriptor } from "@/engine/types";
import { lerp3, rotateAboutY } from "./math";
import type { CameraKey, Interp, Move, MoveKind, MoveParams, SubjectFn, SubjectId, Vec3 } from "./types";

/** What each preset's single "amount" means, its range and default, plus the default lens. */
export interface MoveInfo {
  kind: MoveKind;
  label: string;
  amount: { label: string; unit: string; min: number; max: number; step: number; default: number };
  focalMm: number;
  subject: SubjectId;
  interp: Interp;
}

export const MOVE_INFO: Record<MoveKind, MoveInfo> = {
  static: { kind: "static", label: "Locked off", amount: { label: "Distance", unit: "m", min: 1.2, max: 7, step: 0.1, default: 3 }, focalMm: 50, subject: "primary", interp: "linear" },
  dollyIn: { kind: "dollyIn", label: "Dolly in", amount: { label: "Push", unit: "m", min: 0.4, max: 4, step: 0.1, default: 2.2 }, focalMm: 35, subject: "primary", interp: "linear" },
  dollyOut: { kind: "dollyOut", label: "Dolly out", amount: { label: "Pull", unit: "m", min: 0.4, max: 4, step: 0.1, default: 2.2 }, focalMm: 35, subject: "primary", interp: "linear" },
  zoomIn: { kind: "zoomIn", label: "Zoom in", amount: { label: "Zoom ratio", unit: "×", min: 1.2, max: 5, step: 0.1, default: 2.5 }, focalMm: 28, subject: "primary", interp: "linear" },
  pan: { kind: "pan", label: "Pan", amount: { label: "Sweep", unit: "°", min: -80, max: 80, step: 1, default: 40 }, focalMm: 35, subject: "primary", interp: "linear" },
  tilt: { kind: "tilt", label: "Tilt", amount: { label: "Sweep", unit: "°", min: -45, max: 45, step: 1, default: 28 }, focalMm: 35, subject: "primary", interp: "linear" },
  truck: { kind: "truck", label: "Truck", amount: { label: "Slide", unit: "m", min: -4, max: 4, step: 0.1, default: 2.4 }, focalMm: 35, subject: "primary", interp: "linear" },
  crane: { kind: "crane", label: "Crane", amount: { label: "Rise", unit: "m", min: -1.2, max: 3.5, step: 0.1, default: 2.6 }, focalMm: 28, subject: "primary", interp: "linear" },
  orbit: { kind: "orbit", label: "Orbit", amount: { label: "Arc", unit: "°", min: -150, max: 150, step: 1, default: 70 }, focalMm: 35, subject: "primary", interp: "orbit" },
  tracking: { kind: "tracking", label: "Tracking", amount: { label: "Lead distance", unit: "m", min: 1.2, max: 5, step: 0.1, default: 2.4 }, focalMm: 35, subject: "secondary", interp: "track" },
  dollyZoom: { kind: "dollyZoom", label: "Dolly zoom", amount: { label: "Pull back", unit: "m", min: -2.4, max: 5, step: 0.1, default: 3.4 }, focalMm: 24, subject: "primary", interp: "dollyZoom" },
};

export const MOVE_ORDER: readonly MoveKind[] = ["static", "dollyIn", "dollyOut", "zoomIn", "pan", "tilt", "truck", "crane", "orbit", "tracking", "dollyZoom"];

/** Default params for a move in a scene: a centred move window spanning ~70 % of the loop. */
export function defaultParams(kind: MoveKind, d: SceneDescriptor): MoveParams {
  const info = MOVE_INFO[kind];
  const T = d.timeline.durationS;
  const whole = kind === "tracking";
  return {
    amount: info.amount.default,
    focalMm: info.focalMm,
    subject: info.subject,
    ease: kind === "tracking" ? "linear" : "inOut",
    t0: whole ? 0 : Math.round(T * 0.15 * 10) / 10,
    t1: whole ? T : Math.round(T * 0.85 * 10) / 10,
  };
}

const LENS_Y = 1.47;

/** A camera `dist` in front of the subject on the +Z side (towards the audience), at lens height. */
function frontOf(anchor: Vec3, dist: number, y = LENS_Y): Vec3 {
  return [anchor[0], y, anchor[2] + dist];
}

/**
 * Build a move from a preset. Every preset starts from a sensible framing of the subject at time t0,
 * so the same scene can be filmed with any move.
 */
export function buildMove(kind: MoveKind, p: MoveParams, subjects: SubjectFn): Move {
  const info = MOVE_INFO[kind];
  const s0 = subjects(p.subject, p.t0);
  const s1 = subjects(p.subject, p.t1);
  const a = s0.anchor;
  const f = p.focalMm;
  const key = (position: Vec3, target: Vec3, focalMm = f): CameraKey => ({ position, target, focalMm });
  const base = { kind, interp: info.interp, ease: p.ease, t0: p.t0, t1: p.t1, subject: p.subject } as const;
  switch (kind) {
    case "static": {
      const k = key(frontOf(a, p.amount), a);
      return { ...base, start: k, end: k };
    }
    case "dollyIn":
    case "dollyOut": {
      const far = frontOf(a, 1.2 + p.amount);
      const near = frontOf(a, 1.2);
      return kind === "dollyIn" ? { ...base, start: key(far, a), end: key(near, s1.anchor) } : { ...base, start: key(near, a), end: key(far, s1.anchor) };
    }
    case "zoomIn": {
      const pos = frontOf(a, 4.2);
      return { ...base, start: key(pos, a, f), end: key(pos, s1.anchor, Math.min(135, f * p.amount)) };
    }
    case "pan": {
      // A reveal: start looking `amount`° away from the subject, land on it.
      const pos = frontOf(a, 3.4);
      return { ...base, start: key(pos, rotateAboutY(a, pos, -p.amount)), end: key(pos, s1.anchor) };
    }
    case "tilt": {
      // Positive: tilt up from the floor/feet to the face. Negative: from above down to the face.
      const pos = frontOf(a, 3.0);
      const dist = Math.hypot(a[0] - pos[0], a[2] - pos[2]);
      const startTarget: Vec3 = [a[0], pos[1] + Math.tan(((Math.atan2(a[1] - pos[1], dist) * 180) / Math.PI - p.amount) * (Math.PI / 180)) * dist, a[2]];
      return { ...base, start: key(pos, startTarget), end: key(pos, s1.anchor) };
    }
    case "truck": {
      // Slide sideways, keeping the camera's orientation: parallax sorts the planes by depth.
      const mid = frontOf(a, 3.2);
      const h = p.amount / 2;
      const off = (dx: number): Vec3 => [mid[0] + dx, mid[1], mid[2]];
      const tgt = (dx: number, anchor: Vec3): Vec3 => [anchor[0] + dx, anchor[1], anchor[2]];
      return { ...base, start: key(off(-h), tgt(-h, a)), end: key(off(h), tgt(h, s1.anchor)) };
    }
    case "crane": {
      // Boom up (or down) while keeping the subject in frame: the high angle diminishes them.
      const y0 = p.amount >= 0 ? 0.55 : LENS_Y + 1.2;
      const y1 = Math.max(0.3, y0 + p.amount);
      return { ...base, start: key(frontOf(a, 3.2, y0), a), end: key(frontOf(a, 3.6, y1), s1.anchor) };
    }
    case "orbit": {
      const r = 3.0;
      const start = rotateAboutY(frontOf(a, r), a, -p.amount / 2);
      const end = rotateAboutY(frontOf(a, r), a, p.amount / 2);
      return { ...base, start: key(start, a), end: key(end, s1.anchor) };
    }
    case "tracking": {
      // Ahead of the subject and 30° off their front axis, a little below their eye line; the offset
      // follows them, so the camera runs with them.
      const off: Vec3 = [Math.sin(Math.PI / 6) * p.amount, 1.15, Math.cos(Math.PI / 6) * p.amount];
      const pos0: Vec3 = [s0.feet[0] + off[0], s0.feet[1] + off[1], s0.feet[2] + off[2]];
      const pos1: Vec3 = [s1.feet[0] + off[0], s1.feet[1] + off[1], s1.feet[2] + off[2]];
      return { ...base, start: key(pos0, s0.anchor), end: key(pos1, s1.anchor) };
    }
    case "dollyZoom": {
      // Positive amount: pull back while zooming in (background looms). Negative: push in, zoom out.
      const d0 = p.amount >= 0 ? 2.0 : 4.6;
      const d1 = Math.max(0.9, d0 + p.amount);
      const f1 = Math.min(180, Math.max(10, (f * d1) / d0));
      return { ...base, start: key(frontOf(a, d0), a, f), end: key(frontOf(a, d1), s1.anchor, f1) };
    }
  }
}

/** Replace a key's position (from a drag), keeping its aim and lens. */
export function withPosition(m: Move, which: "start" | "end", position: Vec3): Move {
  return { ...m, [which]: { ...m[which], position } };
}

/**
 * The signature experiment: reach the same end framing two ways.
 * Dolly: keep the lens, move the camera from d0 to d1. Zoom: keep the camera, change the lens by d0/d1.
 * The subject ends the same size in both; the background does not.
 */
export function dollyVsZoom(p: MoveParams, subjects: SubjectFn, d0 = 4.2, d1 = 1.7): { dolly: Move; zoom: Move } {
  const a = subjects(p.subject, p.t0).anchor;
  const a1 = subjects(p.subject, p.t1).anchor;
  const f = p.focalMm;
  const base = { ease: p.ease, t0: p.t0, t1: p.t1, subject: p.subject, interp: "linear" as const };
  const far = frontOf(a, d0);
  return {
    dolly: { ...base, kind: "dollyIn", start: { position: far, target: a, focalMm: f }, end: { position: frontOf(a, d1), target: a1, focalMm: f } },
    zoom: { ...base, kind: "zoomIn", start: { position: far, target: a, focalMm: f }, end: { position: far, target: a1, focalMm: (f * d0) / d1 } },
  };
}

export const midKey = (m: Move): CameraKey => ({ position: lerp3(m.start.position, m.end.position, 0.5), target: lerp3(m.start.target, m.end.target, 0.5), focalMm: Math.sqrt(m.start.focalMm * m.end.focalMm) });
