import { describe, expect, it } from "vitest";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { measure } from "../measure";
import { captureMatchRef, solveMatchedFraming } from "../matchFraming";
import { intrinsics, projectPoint } from "../projection";
import { poseFromRig, railSForPrimaryDistance } from "../rig";
import type { CameraRig } from "../types";

const at = (focalMm: number, distanceM: number): CameraRig => ({
  railS: railSForPrimaryDistance(d, distanceM),
  yawDeg: 0,
  pitchDeg: 0,
  focalMm,
});
const ndcY = (rig: CameraRig, p: readonly [number, number, number]) => projectPoint(poseFromRig(d, rig), intrinsics(rig.focalMm), p).ndc;
const bram = d.characters.primary;
const pip = d.characters.secondary;
const B = (y: number) => [bram.anchor[0], y, bram.anchor[2]] as const;

describe("teaching configurations read as intended", () => {
  it("A · 24 mm fixed @ 3 m: shins up, whole doorway and Pip in, clock face in", () => {
    const rig = at(24, 3);
    expect(ndcY(rig, B(bram.landmarks.feet))[1]).toBeLessThan(-1); // feet out
    expect(ndcY(rig, B(bram.landmarks.capTop))[1]).toBeLessThan(1);
    for (const x of d.set.doorway.openingX) expect(Math.abs(ndcY(rig, [x, 1, d.set.doorway.z])[0])).toBeLessThan(1);
    expect(Math.abs(ndcY(rig, [pip.anchor[0] + 0.26, 0.5, pip.anchor[2]])[0])).toBeLessThan(1);
    expect(ndcY(rig, d.set.tower.clockFace)[1]).toBeLessThan(1);
  });

  it("18 mm fixed @ 3 m shows Bram head to toe", () => {
    expect(ndcY(at(18, 3), B(0))[1]).toBeGreaterThan(-1);
  });

  it("B · 85 mm fixed @ 3 m: head & shoulders in, doorway complete, Pip cut, same face ratio as A", () => {
    const rig = at(85, 3);
    expect(ndcY(rig, B(bram.landmarks.capTop))[1]).toBeLessThan(0.95);
    expect(ndcY(rig, B(bram.landmarks.chestTop))[1]).toBeGreaterThan(-1);
    const doorR = ndcY(rig, [d.set.doorway.openingX[1], 1, d.set.doorway.z])[0];
    expect(doorR).toBeLessThan(1);
    // ≥ 5 cm margin at the door plane: half-width 5·18/85 = 1.059 → edge x 0.709 vs jamb 0.65
    expect(-0.35 + (5 * 18) / 85 - d.set.doorway.openingX[1]).toBeGreaterThan(0.05);
    const pipL = ndcY(rig, [pip.anchor[0] - 0.26, 0.5, pip.anchor[2]])[0];
    const pipR = ndcY(rig, [pip.anchor[0] + 0.26, 0.5, pip.anchor[2]])[0];
    expect(pipL).toBeLessThan(1);
    expect(pipR).toBeGreaterThan(1);
    expect(measure(d, rig, "primary").faceStretch).toBeCloseTo(measure(d, at(24, 3), "primary").faceStretch, 9);
  });

  it("C/D · Ex2 matched 24 vs 85: same size, very different perspective", () => {
    const start = at(50, 2.093373);
    const ref = captureMatchRef(d, start, "primary");
    const c = solveMatchedFraming(d, start, "primary", ref, 24).rig;
    const dd = solveMatchedFraming(d, start, "primary", ref, 85).rig;
    const mc = measure(d, c, "primary", { mode: "match", matchRef: ref });
    const md = measure(d, dd, "primary", { mode: "match", matchRef: ref });
    expect(mc.subjectFraction).toBeCloseTo(0.92, 3);
    expect(md.subjectFraction).toBeCloseTo(0.92, 3);
    expect(mc.faceStretch).toBeCloseTo(1.36, 1);
    expect(md.faceStretch).toBeCloseTo(1.1, 1);
    expect(mc.fgBgMagnification).toBeNull(); // lantern is behind the camera at 1.0 m
    expect(md.bgRatioVs24!).toBeCloseTo(1.91, 2);
    expect(mc.shotSize).toBe("MCU");
    expect(md.shotSize).toBe("MCU");
    expect(mc.perspective).toBe("deep");
    expect(md.perspective).toBe("natural");
  });

  it("body fractions and classes for the canonical fixed shots", () => {
    const cases: [number, number, string][] = [
      [50, 1.465, "MS"],
      [24, 0.703, "FS"],
      [85, 2.49, "MCU"],
      [135, 3.956, "CU"],
    ];
    for (const [f, p, size] of cases) {
      const m = measure(d, at(f, 3), "primary");
      expect(m.bodyFraction).toBeCloseTo(p, 2);
      expect(m.shotSize).toBe(size);
      expect(m.perspective).toBe("natural"); // a lens change never changes perspective
    }
    expect(measure(d, at(135, 8.1), "primary").perspective).toBe("compressed");
  });
});
