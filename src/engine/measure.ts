import { Vector3 } from "three";
import type { CameraRig, MatchRef, SceneDescriptor, TargetId } from "./types";
import { RAD } from "./math";
import { hfovDeg, vfovDeg } from "./optics";
import { type CameraPose, intrinsics, projectPoint } from "./projection";
import { anchorFor, distanceToPrimaryAlongRail, poseFromRig } from "./rig";
import { solveMatchedFraming, subjectMetric } from "./matchFraming";
import {
  type AngleClass,
  type LensClass,
  type PerspectiveClass,
  type ShotSize,
  classifyAngle,
  classifyLens,
  classifyPerspective,
  classifyShotSize,
} from "./classify";

export interface Measurements {
  focalMm: number;
  hfovDeg: number;
  vfovDeg: number;
  targetId: TargetId;
  targetName: string;
  /** Straight-line distance from the lens to the active target's anchor. */
  distanceM: number;
  /** Distance along the rail to Bram's plane (what the dolly slider shows). */
  distanceToPrimaryM: number;
  railS: number;
  cameraPosition: [number, number, number];
  yawDeg: number;
  pitchDeg: number;
  elevationToTargetDeg: number;
  /** Framing box height as a fraction of frame height (Both: union fit). */
  subjectFraction: number;
  /** Full body height as a fraction of frame height (drives shot size). */
  bodyFraction: number;
  frameWidthAtSubjectM: number;
  frameHeightAtSubjectM: number;
  doorwayWidthFraction: number;
  backWallCoverageWidthM: number;
  /** Doorway size relative to the subject, vs the same framing at 24 mm. Match mode only. */
  bgRatioVs24: number | null;
  /** Lantern vs doorway apparent size ratio; null when the lantern is beside or behind the lens. */
  fgBgMagnification: number | null;
  /** Nose tip vs ears magnification for the subject's face (front-facing rest pose). */
  faceStretch: number;
  /** Pip's projected height relative to Bram's. True ratio is 1.12 / 1.78 ≈ 0.63. */
  apparentHeightRatio: number;
  kRatio: number;
  shotSize: ShotSize;
  lensClass: LensClass;
  angle: AngleClass;
  perspective: PerspectiveClass;
  timeS: number;
}

const depthAlong = (pose: CameraPose, p: Vector3) =>
  p.clone().sub(pose.position).dot(new Vector3(0, 0, -1).applyQuaternion(pose.quaternion));

function bodyFractionFor(d: SceneDescriptor, pose: CameraPose, focalMm: number, target: TargetId): number {
  const i = intrinsics(focalMm, d.gate);
  const heightNdc = (which: "primary" | "secondary") => {
    const c = d.characters[which];
    const [x, , z] = c.anchor;
    const y0 = c.root[1];
    const top = projectPoint(pose, i, [x, y0 + c.heightM, z]).ndc[1];
    const bottom = projectPoint(pose, i, [x, y0, z]).ndc[1];
    return [bottom, top] as const;
  };
  if (target !== "both") {
    const [b, t] = heightNdc(target);
    return (t - b) / 2;
  }
  const [b1, t1] = heightNdc("primary");
  const [b2, t2] = heightNdc("secondary");
  return (Math.max(t1, t2) - Math.min(b1, b2)) / 2;
}

/** Face stretch for a character: how much larger the nose tip images than the ears. */
function faceStretchFor(d: SceneDescriptor, pose: CameraPose, which: "primary" | "secondary"): number {
  const c = d.characters[which];
  const [x, , z] = c.anchor;
  const y0 = c.root[1];
  const nose = depthAlong(pose, new Vector3(x, y0 + c.landmarks.noseTip.y, z + c.landmarks.noseTip.forward));
  const ear = depthAlong(pose, new Vector3(x, y0 + c.landmarks.earMid.y, z + c.landmarks.earMid.forward));
  return nose > 0 ? ear / nose : NaN;
}

export function measure(
  d: SceneDescriptor,
  rig: CameraRig,
  target: TargetId,
  opts: { timeS?: number; matchRef?: MatchRef | null; mode?: "fixed" | "match" } = {},
): Measurements {
  const pose = poseFromRig(d, rig);
  const i = intrinsics(rig.focalMm, d.gate);
  const anchor = new Vector3(...anchorFor(d, target));
  const distanceM = pose.position.distanceTo(anchor);
  const depthSubject = depthAlong(pose, anchor);
  const subjectFraction = subjectMetric(d, pose, rig.focalMm, target);
  const bodyFraction = bodyFractionFor(d, pose, rig.focalMm, target);

  const door = d.set.doorway;
  const doorL = projectPoint(pose, i, [door.openingX[0], 1, door.z]).ndc[0];
  const doorR = projectPoint(pose, i, [door.openingX[1], 1, door.z]).ndc[0];
  const doorwayWidthFraction = (doorR - doorL) / 2;

  const wallDepth = depthAlong(pose, new Vector3(d.rail.x, d.rail.y, d.set.backWall.z));
  const doorDepth = depthAlong(pose, new Vector3((door.openingX[0] + door.openingX[1]) / 2, 1, door.z));

  const lanternHead = new Vector3(...d.set.lantern.head);
  const lanternDepth = depthAlong(pose, lanternHead);
  const lanternNdc = projectPoint(pose, i, lanternHead).ndc;
  const lanternVisible = lanternDepth > 0.6 && Math.abs(lanternNdc[0]) <= 1.05;
  const fgBgMagnification = lanternVisible ? doorDepth / lanternDepth : null;

  const pri = d.characters.primary;
  const sec = d.characters.secondary;
  // Heights are measured from each character's feet (root y: Pip may stand on a riser).
  const hPri = (projectPoint(pose, i, [pri.anchor[0], pri.root[1] + pri.heightM, pri.anchor[2]]).ndc[1] -
    projectPoint(pose, i, [pri.anchor[0], pri.root[1], pri.anchor[2]]).ndc[1]);
  const hSec = (projectPoint(pose, i, [sec.anchor[0], sec.root[1] + sec.landmarks.capTop, sec.anchor[2]]).ndc[1] -
    projectPoint(pose, i, [sec.anchor[0], sec.root[1], sec.anchor[2]]).ndc[1]);

  const kRatio = depthSubject / wallDepth;

  let bgRatioVs24: number | null = null;
  if (opts.mode === "match" && opts.matchRef) {
    const at24 = solveMatchedFraming(d, rig, target, opts.matchRef, 24).rig;
    const p24 = poseFromRig(d, at24);
    const ratio = (pose_: CameraPose) =>
      depthAlong(pose_, anchor) / depthAlong(pose_, new Vector3((door.openingX[0] + door.openingX[1]) / 2, 1, door.z));
    bgRatioVs24 = ratio(pose) / ratio(p24);
  }

  const elevationToTargetDeg = Math.asin((anchor.y - pose.position.y) / distanceM) * RAD;

  return {
    focalMm: rig.focalMm,
    hfovDeg: hfovDeg(rig.focalMm, d.gate),
    vfovDeg: vfovDeg(rig.focalMm, d.gate),
    targetId: target,
    targetName: target === "both" ? `${pri.name} & ${sec.name}` : d.characters[target].name,
    distanceM,
    distanceToPrimaryM: distanceToPrimaryAlongRail(d, rig.railS),
    railS: rig.railS,
    cameraPosition: [pose.position.x, pose.position.y, pose.position.z],
    yawDeg: rig.yawDeg,
    pitchDeg: rig.pitchDeg,
    elevationToTargetDeg,
    subjectFraction,
    bodyFraction,
    frameWidthAtSubjectM: (depthSubject * d.gate.widthMm) / rig.focalMm,
    frameHeightAtSubjectM: (depthSubject * d.gate.heightMm) / rig.focalMm,
    doorwayWidthFraction,
    backWallCoverageWidthM: (wallDepth * d.gate.widthMm) / rig.focalMm,
    bgRatioVs24,
    fgBgMagnification,
    faceStretch: faceStretchFor(d, pose, target === "secondary" ? "secondary" : "primary"),
    apparentHeightRatio: hSec / hPri,
    kRatio,
    shotSize: classifyShotSize(bodyFraction),
    lensClass: classifyLens(rig.focalMm),
    angle: classifyAngle(elevationToTargetDeg),
    perspective: classifyPerspective(kRatio, d.perspective),
    timeS: opts.timeS ?? 0,
  };
}
