import { describe, expect, it } from "vitest";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { captureMatchRef, metricAt, solveMatchedFraming, feasiblePresets } from "../matchFraming";
import { distanceToPrimaryAlongRail, poseFromRig } from "../rig";
import { intrinsics, projectPoint } from "../projection";
import type { CameraRig, TargetId } from "../types";

const ex2Rig = (): CameraRig => ({ ...d.defaultRig, railS: -(d.characters.primary.anchor[2] + 2.093373) });

describe("matched framing", () => {
  it("default 50 mm @ 3 m frames Bram's head & shoulders at 64 %", () => {
    expect(captureMatchRef(d, d.defaultRig, "primary").metric).toBeCloseTo(0.642, 3);
  });

  it("primary: distance ∝ focal length and the metric is held", () => {
    const start = ex2Rig();
    const ref = captureMatchRef(d, start, "primary");
    expect(ref.metric).toBeCloseTo(0.92, 4);
    const expected: Record<number, number> = { 18: 0.7536, 24: 1.0048, 35: 1.4654, 85: 3.5587, 135: 5.6521 };
    for (const [fStr, dist] of Object.entries(expected)) {
      const f = Number(fStr);
      const sol = solveMatchedFraming(d, start, "primary", ref, f);
      expect(sol.clamped).toBeNull();
      expect(distanceToPrimaryAlongRail(d, sol.rig.railS)).toBeCloseTo(dist, 3);
      expect(Math.abs(sol.achievedMetric - ref.metric)).toBeLessThan(1e-4);
      expect(sol.rig.yawDeg).toBeCloseTo(0, 9);
      expect(sol.rig.pitchDeg).toBeCloseTo(0, 9);
    }
  });

  it("every preset is reachable for Bram from the default capture (135 mm → 8.1 m)", () => {
    const ref = captureMatchRef(d, d.defaultRig, "primary");
    const sol = solveMatchedFraming(d, d.defaultRig, "primary", ref, 135);
    expect(sol.clamped).toBeNull();
    expect(distanceToPrimaryAlongRail(d, sol.rig.railS)).toBeCloseTo(8.1, 3);
  });

  it.each(["primary", "secondary", "both"] as TargetId[])("metric is strictly increasing along the rail for %s", (target) => {
    const ref = captureMatchRef(d, d.defaultRig, target);
    for (const f of d.focal.presets) {
      let prev = -Infinity;
      for (let s = d.rail.sMin; s <= d.rail.sMax; s += 0.2) {
        const m = metricAt(d, s, f, target, ref);
        expect(m).toBeGreaterThan(prev);
        prev = m;
      }
    }
  });

  it("secondary keeps its anchor on screen and clamps outside the reachable band", () => {
    const ref = captureMatchRef(d, d.defaultRig, "secondary");
    expect(ref.metric).toBeCloseTo(0.588, 2);
    const ok = solveMatchedFraming(d, d.defaultRig, "secondary", ref, 85);
    expect(ok.clamped).toBeNull();
    const p = projectPoint(poseFromRig(d, ok.rig), intrinsics(85), d.characters.secondary.anchor);
    expect(p.ndc[0]).toBeCloseTo(ref.anchorNdc[0], 6);
    expect(p.ndc[1]).toBeCloseTo(ref.anchorNdc[1], 6);
    expect(solveMatchedFraming(d, d.defaultRig, "secondary", ref, 18).clamped).toBe("min");
    expect(solveMatchedFraming(d, d.defaultRig, "secondary", ref, 135).clamped).toBe("max");
    const feas = feasiblePresets(d, "secondary", ref);
    expect(feas).toMatchObject({ 18: false, 24: false, 35: true, 50: true, 85: true, 135: false });
  });

  it("solving at the current focal is idempotent", () => {
    const start = ex2Rig();
    const ref = captureMatchRef(d, start, "primary");
    const sol = solveMatchedFraming(d, start, "primary", ref, 50);
    expect(sol.rig.railS).toBeCloseTo(start.railS, 5);
  });
});
