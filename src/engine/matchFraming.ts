import { Vector3 } from "three";
import type { CameraRig, ClampHint, MatchRef, SceneDescriptor, TargetId } from "./types";
import { type CameraPose, intrinsics, projectPoint } from "./projection";
import { aimForNdc, anchorFor, poseFromRig, railPosition } from "./rig";

/** Projected corner points of a character's framing box (front-facing quad at the character's depth). */
function boxCorners(d: SceneDescriptor, which: "primary" | "secondary"): Vector3[] {
  const c = d.characters[which];
  const { bottom, top, halfWidthM } = c.framingBox;
  const [x, , z] = c.anchor;
  return [
    new Vector3(x - halfWidthM, bottom, z),
    new Vector3(x + halfWidthM, bottom, z),
    new Vector3(x - halfWidthM, top, z),
    new Vector3(x + halfWidthM, top, z),
  ];
}

/**
 * Framing metric = how much of the frame height the target's framing box fills (1 = edge to edge).
 * Single targets: projected height of the box. Both: max(width, height)/2 of the NDC bounding box
 * of both boxes, so it reads "fits in the frame" when ≤ 1.
 */
export function subjectMetric(d: SceneDescriptor, pose: CameraPose, focalMm: number, target: TargetId): number {
  const i = intrinsics(focalMm, d.gate);
  if (target !== "both") {
    const c = d.characters[target];
    const [x, , z] = c.anchor;
    const top = projectPoint(pose, i, [x, c.framingBox.top, z]);
    const bottom = projectPoint(pose, i, [x, c.framingBox.bottom, z]);
    return (top.ndc[1] - bottom.ndc[1]) / 2;
  }
  const pts = [...boxCorners(d, "primary"), ...boxCorners(d, "secondary")].map((p) => projectPoint(pose, i, p).ndc);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const w = (Math.max(...xs) - Math.min(...xs)) / 2;
  const h = (Math.max(...ys) - Math.min(...ys)) / 2;
  return Math.max(w, h);
}

/** Capture the current framing of a target: metric + where its anchor sits on screen. */
export function captureMatchRef(d: SceneDescriptor, rig: CameraRig, target: TargetId): MatchRef {
  const pose = poseFromRig(d, rig);
  const p = projectPoint(pose, intrinsics(rig.focalMm, d.gate), anchorFor(d, target));
  return { metric: subjectMetric(d, pose, rig.focalMm, target), anchorNdc: [p.ndc[0], p.ndc[1]] };
}

/** Rig at rail position s, re-aimed so the anchor keeps its captured screen position. */
export function rigAt(d: SceneDescriptor, s: number, focalMm: number, target: TargetId, ref: MatchRef): CameraRig {
  const aim = aimForNdc(railPosition(d, s), anchorFor(d, target), ref.anchorNdc, intrinsics(focalMm, d.gate));
  return { railS: s, focalMm, ...aim };
}

export const metricAt = (d: SceneDescriptor, s: number, focalMm: number, target: TargetId, ref: MatchRef) =>
  subjectMetric(d, poseFromRig(d, rigAt(d, s, focalMm, target, ref)), focalMm, target);

export interface MatchSolution {
  rig: CameraRig;
  achievedMetric: number;
  clamped: ClampHint;
}

/**
 * Move the camera along the rail so the target keeps `ref.metric` at the new focal length.
 * The metric is strictly increasing in railS (closer = bigger), so bracketed root finding is safe.
 * Seed: d ∝ f (exact for a level, centred subject).
 */
export function solveMatchedFraming(
  d: SceneDescriptor,
  currentRig: CameraRig,
  target: TargetId,
  ref: MatchRef,
  focalMm: number,
): MatchSolution {
  const { sMin, sMax } = d.rail;
  const f = (s: number) => metricAt(d, s, focalMm, target, ref) - ref.metric;
  const fNear = f(sMax);
  const fFar = f(sMin);
  const clampKind = (kind: "min" | "max"): ClampHint => (target === "both" ? "both" : kind);
  if (fNear < 0) {
    const rig = rigAt(d, sMax, focalMm, target, ref);
    return { rig, achievedMetric: fNear + ref.metric, clamped: clampKind("min") };
  }
  if (fFar > 0) {
    const rig = rigAt(d, sMin, focalMm, target, ref);
    return { rig, achievedMetric: fFar + ref.metric, clamped: clampKind("max") };
  }
  // Seed bracket around the closed-form guess, then Illinois regula falsi.
  const anchorZ = anchorFor(d, target)[2];
  const depth0 = -currentRig.railS - anchorZ;
  const guessS = -(anchorZ + (depth0 * focalMm) / currentRig.focalMm);
  let lo = sMin;
  let hi = sMax;
  let flo = fFar;
  let fhi = fNear;
  if (guessS > sMin && guessS < sMax) {
    const fg = f(guessS);
    if (fg > 0) {
      hi = guessS;
      fhi = fg;
    } else {
      lo = guessS;
      flo = fg;
    }
  }
  let side = 0;
  let s = (lo + hi) / 2;
  for (let k = 0; k < 60; k++) {
    s = (lo * fhi - hi * flo) / (fhi - flo);
    if (!Number.isFinite(s) || s <= lo || s >= hi) s = (lo + hi) / 2;
    const fs = f(s);
    if (Math.abs(fs) < 1e-7 || hi - lo < 1e-7) break;
    if (fs > 0) {
      hi = s;
      fhi = fs;
      if (side === 1) flo /= 2;
      side = 1;
    } else {
      lo = s;
      flo = fs;
      if (side === -1) fhi /= 2;
      side = -1;
    }
  }
  const rig = rigAt(d, s, focalMm, target, ref);
  return { rig, achievedMetric: f(s) + ref.metric, clamped: null };
}

/** Focal range over which Match framing can hold `ref` from the rail (presets only, for UI hatching). */
export function feasiblePresets(d: SceneDescriptor, target: TargetId, ref: MatchRef): Record<number, boolean> {
  const out: Record<number, boolean> = {};
  for (const f of d.focal.presets) {
    const near = metricAt(d, d.rail.sMax, f, target, ref);
    const far = metricAt(d, d.rail.sMin, f, target, ref);
    out[f] = near >= ref.metric - 1e-6 && far <= ref.metric + 1e-6;
  }
  return out;
}
