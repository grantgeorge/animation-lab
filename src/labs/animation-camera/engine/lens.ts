import { distanceForFraction, hfovDeg } from "@/engine/optics";
import { tanHalf, intrinsics } from "@/engine/projection";
import { D, GATE, depthOf, ndcPersp, shot, subjects, type Shot, type Vec3 } from "./common";

/** Experiment 2: 24 / 50 / 100 mm with Bram held at the same size (matched framing). */
export const E2 = {
  focals: [24, 50, 100] as const,
  min: 18,
  max: 135,
  /** Head & shoulders box (world Y), held at `fraction` of the frame height. */
  box: { bottom: D.characters.primary.framingBox.bottom, top: D.characters.primary.framingBox.top },
  fraction: 0.78,
  /** Lens height a touch below the eyes; aim at the middle of the box. */
  lensY: 1.5,
} as const;

const c = D.characters.primary;
/** Bram's facing on his mark: the rig turns his root by restYaw (three's +Y rotation). */
const yaw = ((c.restYawDeg ?? 0) * Math.PI) / 180;
export const BRAM_FORWARD: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)];
const BRAM_RIGHT: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];

/** Camera distance (to the subject plane) that holds the box at `fraction` of frame height. */
export const matchedDistance = (focalMm: number) => distanceForFraction(E2.box.top - E2.box.bottom, focalMm, E2.fraction, GATE);

/** The matched camera at time t: straight in front of Bram's live anchor, distance ∝ focal length. */
export function matchedShot(focalMm: number, t: number): Shot {
  const a = subjects()("primary", t).anchor;
  const d = matchedDistance(focalMm);
  const mid = (E2.box.top + E2.box.bottom) / 2;
  const target: Vec3 = [a[0], mid, a[2]];
  return shot([a[0] + BRAM_FORWARD[0] * d, E2.lensY, a[2] + BRAM_FORWARD[2] * d], target, focalMm);
}

/** Dolly-zoom sweep for Watch: 24 → 100 → 24 mm, log-spaced, over the loop. */
export function sweepFocal(t: number, period: number) {
  const u = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);
  return Math.exp(Math.log(24) + (Math.log(100) - Math.log(24)) * u);
}

export interface LensReadout {
  focalMm: number;
  hfovDeg: number;
  /** Camera → Bram's face, metres. */
  distanceM: number;
  /** Projected height of the head & shoulders box (fraction of frame height): the matched metric. */
  metric: number;
  /** How much bigger the nose tip is drawn than the ears (perspective magnification ∝ 1/depth). */
  noseToEar: number;
  /** Doorway opening and back-wall window height, relative to Bram's box. */
  doorwayRatio: number;
  windowRatio: number;
  /** How much of the back wall fits across the frame, metres. */
  wallWidthM: number;
}

export function lensReadout(s: Shot, t: number): LensReadout {
  const a = subjects()("primary", t).anchor;
  const span = (p0: Vec3, p1: Vec3) => Math.abs(ndcPersp(s, p1)[1] - ndcPersp(s, p0)[1]) / 2;
  const metric = span([a[0], E2.box.bottom, a[2]], [a[0], E2.box.top, a[2]]);
  const L = c.landmarks;
  const head: Vec3 = [a[0], L.noseTip.y, a[2]];
  const nose: Vec3 = [head[0] + BRAM_FORWARD[0] * L.noseTip.forward, L.noseTip.y, head[2] + BRAM_FORWARD[2] * L.noseTip.forward];
  const ear: Vec3 = [head[0] + BRAM_FORWARD[0] * L.earMid.forward + BRAM_RIGHT[0] * 0.08, L.earMid.y, head[2] + BRAM_FORWARD[2] * L.earMid.forward + BRAM_RIGHT[2] * 0.08];
  const door = D.set.doorway;
  const dx = (door.openingX[0] + door.openingX[1]) / 2;
  const win = D.set.backWall.window;
  const doorH = span([dx, 0, door.z], [dx, door.heightM, door.z]);
  const winH = span([win.centre[0], win.centre[1] - win.h / 2, win.centre[2]], [win.centre[0], win.centre[1] + win.h / 2, win.centre[2]]);
  const wallDepth = depthOf(s, [win.centre[0], win.centre[1], D.set.backWall.z]);
  return {
    focalMm: s.focalMm,
    hfovDeg: hfovDeg(s.focalMm, GATE),
    distanceM: depthOf(s, head),
    metric,
    noseToEar: depthOf(s, ear) / depthOf(s, nose),
    doorwayRatio: doorH / metric,
    windowRatio: winH / metric,
    wallWidthM: 2 * wallDepth * tanHalf(intrinsics(s.focalMm, GATE)).x,
  };
}
