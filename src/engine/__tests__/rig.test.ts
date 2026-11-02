import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { forwardOf, intrinsics, projectPoint } from "../projection";
import { aimForNdc, poseFromRig, railPosition } from "../rig";

describe("rig and projection", () => {
  it("default camera sits 3 m in front of Bram's anchor, level", () => {
    const pose = poseFromRig(d, d.defaultRig);
    expect(pose.position.toArray()).toEqual([-0.35, 1.47, -0]);
    const p = projectPoint(pose, intrinsics(50), d.characters.primary.anchor);
    expect(p.ndc[0]).toBeCloseTo(0, 12);
    expect(p.ndc[1]).toBeCloseTo(0, 12);
    expect(p.depth).toBeCloseTo(3, 12);
  });

  it("yaw > 0 turns the camera toward +X; pitch > 0 looks up", () => {
    const f = forwardOf(poseFromRig(d, { railS: 0, yawDeg: 90, pitchDeg: 0, focalMm: 50 }));
    expect(f.x).toBeCloseTo(1, 9);
    const u = forwardOf(poseFromRig(d, { railS: 0, yawDeg: 0, pitchDeg: 30, focalMm: 50 }));
    expect(u.y).toBeCloseTo(0.5, 9);
  });

  it("projectPoint matches three's Vector3.project for random points", () => {
    for (let k = 0; k < 50; k++) {
      const rig = { railS: -1 + k * 0.05, yawDeg: -20 + k * 0.7, pitchDeg: -10 + k * 0.4, focalMm: 18 + k * 2 };
      const pose = poseFromRig(d, rig);
      const cam = new PerspectiveCamera();
      cam.aspect = 16 / 9;
      cam.filmGauge = 36;
      cam.near = 0.05;
      cam.far = 60;
      cam.setFocalLength(rig.focalMm);
      cam.position.copy(pose.position);
      cam.quaternion.copy(pose.quaternion);
      cam.updateMatrixWorld(true);
      const pt = new Vector3(Math.sin(k) * 2, 1 + Math.cos(k), -4 - (k % 5));
      const ours = projectPoint(pose, intrinsics(rig.focalMm), pt);
      const theirs = pt.clone().project(cam);
      expect(ours.ndc[0]).toBeCloseTo(theirs.x, 9);
      expect(ours.ndc[1]).toBeCloseTo(theirs.y, 9);
    }
  });

  it("aimForNdc places an off-centre anchor exactly at the requested NDC", () => {
    const anchor = d.characters.secondary.anchor;
    for (const f of [18, 24, 50, 135]) {
      for (const ndc of [
        [0.63, -0.96],
        [-0.63, 0.96],
        [0.3, 0.2],
        [0, 0],
      ] as const) {
        for (const s of [-5.4, 0, 2.4]) {
          const pos = railPosition(d, s);
          const aim = aimForNdc(pos, anchor, ndc, intrinsics(f));
          const pose = poseFromRig(d, { railS: s, focalMm: f, ...aim });
          const p = projectPoint(pose, intrinsics(f), anchor);
          expect(p.ndc[0]).toBeCloseTo(ndc[0], 9);
          expect(p.ndc[1]).toBeCloseTo(ndc[1], 9);
          expect(p.inFront).toBe(true);
        }
      }
    }
  });
});

describe("fixed mode keeps perspective", () => {
  it("NDC of any point scales by f2/f1 about the centre", () => {
    const rig = { railS: 0.4, yawDeg: 12, pitchDeg: -9, focalMm: 24 };
    const pose = poseFromRig(d, rig);
    for (const pt of [
      [0.72, 0.5, -4.7],
      [-2.2, 5.2, -11.5],
      [0.62, 2.05, -1.6],
    ] as const) {
      const a = projectPoint(pose, intrinsics(24), pt).ndc;
      const b = projectPoint(pose, intrinsics(85), pt).ndc;
      expect(b[0] / a[0]).toBeCloseTo(85 / 24, 9);
      expect(b[1] / a[1]).toBeCloseTo(85 / 24, 9);
    }
  });

  it("two equal objects at 2 m and 4 m image 2:1 for every focal length", () => {
    const pose = poseFromRig(d, d.defaultRig);
    for (const f of d.focal.presets) {
      const i = intrinsics(f);
      const h = (z: number) => projectPoint(pose, i, [-0.35, 2.47, z]).ndc[1] - projectPoint(pose, i, [-0.35, 1.47, z]).ndc[1];
      expect(h(-2) / h(-4)).toBeCloseTo(2, 9);
    }
  });
});
