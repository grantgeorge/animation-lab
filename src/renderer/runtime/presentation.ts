import { Vector3 } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import type { CameraMode, CameraRig, MatchRef, TargetId } from "@/engine/types";
import { aimForNdc, anchorFor, poseFromRig, railPosition } from "@/engine/rig";
import { intrinsics, type CameraPose } from "@/engine/projection";

/**
 * Eased camera state, outside React. Focal length and depth-to-target are eased in log space with
 * the same time constant, so during a Match travel d/f stays constant on every frame: the subject
 * holds its size while the background visibly stretches or compresses. Aim is never eased; it is
 * recomputed from the eased focal so the subject never sways.
 */
export interface Presentation {
  railS: number;
  focalMm: number;
  yawDeg: number;
  pitchDeg: number;
  pose: CameraPose;
  settled: boolean;
  travelling: boolean;
}

export const presentation: Presentation = {
  railS: d.defaultRig.railS,
  focalMm: d.defaultRig.focalMm,
  yawDeg: 0,
  pitchDeg: 0,
  pose: poseFromRig(d, d.defaultRig),
  settled: true,
  travelling: false,
};

export interface PresentationTarget {
  rig: CameraRig;
  mode: CameraMode;
  targetId: TargetId;
  matchRef: MatchRef | null;
}

const follow = (x: number, target: number, dt: number, tau: number) =>
  tau <= 0 ? target : x + (target - x) * (1 - Math.exp(-dt / tau));

export function advancePresentation(
  t: PresentationTarget,
  dt: number,
  opts: { dragging: boolean; reducedMotion: boolean; travel: boolean },
) {
  const p = presentation;
  const tau = opts.reducedMotion ? 0 : opts.dragging ? 0.05 : opts.travel ? 0.3 : 0.12;
  const anchor = anchorFor(d, t.targetId);
  const anchorZ = anchor[2];
  const depth = (s: number) => Math.max(1e-3, -s - anchorZ);

  const u = Math.log(depth(p.railS));
  const uT = Math.log(depth(t.rig.railS));
  const lf = Math.log(p.focalMm);
  const lfT = Math.log(t.rig.focalMm);
  const uN = follow(u, uT, dt, tau);
  const lfN = follow(lf, lfT, dt, tau);
  const done = Math.abs(uN - uT) < 2e-5 && Math.abs(lfN - lfT) < 2e-5;
  p.railS = done ? t.rig.railS : -anchorZ - Math.exp(uN);
  p.focalMm = done ? t.rig.focalMm : Math.exp(lfN);

  if (t.mode === "match" && t.matchRef) {
    const aim = aimForNdc(railPosition(d, p.railS), anchor, t.matchRef.anchorNdc, intrinsics(p.focalMm, d.gate));
    p.yawDeg = aim.yawDeg;
    p.pitchDeg = aim.pitchDeg;
  } else {
    p.yawDeg = follow(p.yawDeg, t.rig.yawDeg, dt, tau);
    p.pitchDeg = follow(p.pitchDeg, t.rig.pitchDeg, dt, tau);
    if (Math.abs(p.yawDeg - t.rig.yawDeg) < 1e-4) p.yawDeg = t.rig.yawDeg;
    if (Math.abs(p.pitchDeg - t.rig.pitchDeg) < 1e-4) p.pitchDeg = t.rig.pitchDeg;
  }
  p.pose = poseFromRig(d, { railS: p.railS, focalMm: p.focalMm, yawDeg: p.yawDeg, pitchDeg: p.pitchDeg });
  p.settled = done && p.yawDeg === (t.mode === "match" ? p.yawDeg : t.rig.yawDeg) && p.pitchDeg === (t.mode === "match" ? p.pitchDeg : t.rig.pitchDeg);
  p.travelling = !done;
}

export const presentationRig = (): CameraRig => ({
  railS: presentation.railS,
  focalMm: presentation.focalMm,
  yawDeg: presentation.yawDeg,
  pitchDeg: presentation.pitchDeg,
});

export const tmpV = new Vector3();
