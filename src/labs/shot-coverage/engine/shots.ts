import { Vector3 } from "three";
import type { SceneDescriptor } from "@/engine/types";
import { classifyAngle, classifyLens, classifyShotSize, type AngleClass, type LensClass, type ShotSize } from "@/engine/classify";
import { intrinsics, projectPoint, toCameraSpace, type CameraPose } from "@/engine/projection";
import { bodyFraction } from "@/labs/camera-movement/engine/analyze";
import { lookAtPose, yawPitch } from "@/labs/camera-movement/engine/math";
import { axisAt, sideOf } from "./axis";
import { WHO_ID, type CamSpec, type SubjectFn, type SubjectId, type Vec3 } from "./types";

export interface ShotPose extends CameraPose {
  focalMm: number;
  target: Vec3;
}

/** Framing point of a character: a little below the eyes, so the face sits in the upper half. */
export function facePoint(d: SceneDescriptor, subjects: SubjectFn, id: SubjectId, t: number): Vec3 {
  const s = subjects(id, t);
  const c = d.characters[id];
  return [s.feet[0], s.feet[1] + c.landmarks.eyes - 0.08 * c.landmarks.capTop, s.feet[2]];
}

/** Eye point of a character (for eyelines and screen position). */
export function eyePoint(d: SceneDescriptor, subjects: SubjectFn, id: SubjectId, t: number): Vec3 {
  const s = subjects(id, t);
  return [s.feet[0], s.feet[1] + d.characters[id].landmarks.eyes, s.feet[2]];
}

export function aimPoint(cam: CamSpec, d: SceneDescriptor, subjects: SubjectFn, t: number): Vec3 {
  switch (cam.aim) {
    case "bram":
    case "pip":
      return facePoint(d, subjects, WHO_ID[cam.aim], t);
    case "both": {
      const a = facePoint(d, subjects, "primary", t);
      const b = facePoint(d, subjects, "secondary", t);
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    }
    default:
      return cam.target;
  }
}

/** The camera's pose at time t: fixed position, zero roll, aimed at its (moving) target. */
export function poseOf(cam: CamSpec, d: SceneDescriptor, subjects: SubjectFn, t: number): ShotPose {
  const target = aimPoint(cam, d, subjects, t);
  const p = lookAtPose(cam.position, target);
  return { ...p, focalMm: cam.focalMm, target };
}

/** Where a character's look (toward the other character) points in the frame. */
export type Look = "left" | "right" | "toward" | "away";

export interface CharOnScreen {
  /** Horizontal NDC of the eyes: −1 left edge, +1 right edge (can be beyond). */
  x: number;
  y: number;
  depth: number;
  inFront: boolean;
  inFrame: boolean;
  /** Screen half the character is on, judged against the other character (who is left of whom). */
  side: "L" | "R";
  /** Eyeline: the direction this character looks to see the other one. */
  look: Look;
}

export interface ScreenInfo {
  primary: CharOnScreen;
  secondary: CharOnScreen;
  /** Which side of the axis of action the camera is on at this time. */
  axisSide: -1 | 0 | 1;
}

/** Camera-space look classification of a world direction. */
function lookOf(pose: CameraPose, from: Vec3, to: Vec3): Look {
  const a = toCameraSpace(pose, from);
  const b = toCameraSpace(pose, to);
  const v = b.sub(a);
  if (Math.abs(v.x) < 0.04 * Math.abs(v.z)) return v.z > 0 ? "toward" : "away";
  return v.x > 0 ? "right" : "left";
}

/**
 * Where each character lands in the shot and which way their eyeline runs. The eyeline is the
 * line of looking from one character to the other (the relationship the 180° rule protects).
 */
export function screenInfo(pose: ShotPose, d: SceneDescriptor, subjects: SubjectFn, t: number): ScreenInfo {
  const i = intrinsics(pose.focalMm, d.gate);
  const eb = eyePoint(d, subjects, "primary", t);
  const ep = eyePoint(d, subjects, "secondary", t);
  const pb = projectPoint(pose, i, eb);
  const pp = projectPoint(pose, i, ep);
  // Screen order from camera-space x/depth so it stays meaningful when someone is off-screen.
  const cb = toCameraSpace(pose, eb);
  const cp = toCameraSpace(pose, ep);
  const order = cb.x * Math.max(-cp.z, 0.05) < cp.x * Math.max(-cb.z, 0.05);
  const one = (p: typeof pb, side: "L" | "R", look: Look): CharOnScreen => ({
    x: p.inFront ? p.ndc[0] : p.ndc[0] > 0 ? -9 : 9,
    y: p.ndc[1],
    depth: p.depth,
    inFront: p.inFront,
    inFrame: p.inFront && Math.abs(p.ndc[0]) <= 1 && Math.abs(p.ndc[1]) <= 1.05,
    side,
    look,
  });
  return {
    primary: one(pb, order ? "L" : "R", lookOf(pose, eb, ep)),
    secondary: one(pp, order ? "R" : "L", lookOf(pose, ep, eb)),
    axisSide: sideOf(axisAt(subjects, t), [pose.position.x, pose.position.y, pose.position.z]),
  };
}

export type ShotKind = "master" | "two-shot" | "ots" | "single";

export interface ShotDescription {
  subject: SubjectId | "both";
  kind: ShotKind;
  size: ShotSize;
  /** Body-height fraction of the subject (the taller of the two for two-shots). */
  fraction: number;
  angle: AngleClass;
  lens: LensClass;
  focalMm: number;
  /** For OTS shots: whose shoulder, and on which frame edge. */
  foreground?: { id: SubjectId; edge: "left" | "right" };
  info: ScreenInfo;
}

const OTHER: Record<SubjectId, SubjectId> = { primary: "secondary", secondary: "primary" };

/** What the shot is, in an editor's vocabulary: master, two-shot, over-the-shoulder or single. */
export function describeShot(cam: CamSpec, d: SceneDescriptor, subjects: SubjectFn, t: number): ShotDescription {
  const pose = poseOf(cam, d, subjects, t);
  const info = screenInfo(pose, d, subjects, t);
  let subject: SubjectId | "both";
  if (cam.aim === "bram" || cam.aim === "pip") subject = WHO_ID[cam.aim];
  else if (cam.aim === "both") subject = "both";
  else {
    const b = info.primary;
    const p = info.secondary;
    if (b.inFrame && p.inFrame && Math.abs(b.x - p.x) < 1.2 && Math.abs(b.depth / p.depth - 1) < 0.5) subject = "both";
    else if (!p.inFront || (b.inFront && Math.abs(b.x) <= Math.abs(p.x))) subject = "primary";
    else subject = "secondary";
  }
  const fb = bodyFraction(pose, d, subjects, "primary", t);
  const fp = bodyFraction(pose, d, subjects, "secondary", t);
  const { pitchDeg } = yawPitch([pose.position.x, pose.position.y, pose.position.z], pose.target);
  const base = { angle: classifyAngle(pitchDeg), lens: classifyLens(cam.focalMm), focalMm: cam.focalMm, info };
  if (subject === "both") {
    const fraction = Math.max(fb, fp);
    return { subject, kind: fraction < 0.65 ? "master" : "two-shot", size: classifyShotSize(fraction), fraction, ...base };
  }
  const fraction = subject === "primary" ? fb : fp;
  const o = info[OTHER[subject]];
  const s = info[subject];
  const size = classifyShotSize(fraction);
  // Over-the-shoulder: the other character's shoulder line is in frame, nearer the lens than the subject.
  const fg = OTHER[subject];
  const fs = subjects(fg, t);
  const lm = d.characters[fg].landmarks;
  const ii = intrinsics(pose.focalMm, d.gate);
  const fgIn = [lm.chestTop + 0.08, lm.eyes, lm.capTop - 0.04].some((hY) => {
    const q = projectPoint(pose, ii, [fs.feet[0], fs.feet[1] + hY, fs.feet[2]]);
    return q.inFront && q.depth < s.depth * 0.8 && Math.abs(q.ndc[0]) < 1.3 && Math.abs(q.ndc[1]) < 1.02;
  });
  if (fgIn) {
    return { subject, kind: "ots", size, fraction, foreground: { id: fg, edge: o.x < s.x ? "left" : "right" }, ...base };
  }
  if (o.inFrame && fraction < 1.15) return { subject, kind: "two-shot", size, fraction, ...base };
  return { subject, kind: "single", size, fraction, ...base };
}

/** Unit view direction of a camera toward its target at time t. */
export function viewDir(cam: CamSpec, d: SceneDescriptor, subjects: SubjectFn, t: number): Vector3 {
  const a = aimPoint(cam, d, subjects, t);
  return new Vector3(a[0] - cam.position[0], a[1] - cam.position[1], a[2] - cam.position[2]).normalize();
}
