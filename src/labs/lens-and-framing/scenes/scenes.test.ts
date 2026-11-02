import { describe, expect, it } from "vitest";
import { SCENES, getScene, doorwayScene } from "../config";
import { captureMatchRef, feasiblePresets, solveMatchedFraming } from "@/engine/matchFraming";
import { measure } from "@/engine/measure";
import { poseFromRig } from "@/engine/rig";
import { intrinsics, projectPoint, toCameraSpace } from "@/engine/projection";
import { performanceFor } from "@/scene/animation/performances";
import { sampleClip, sampleTrack, validatePerformance } from "@/scene/animation/dsl";
import type { SceneDescriptor } from "@/engine/types";

const ndc = (d: SceneDescriptor, f: number, p: readonly [number, number, number]) =>
  projectPoint(poseFromRig(d, { ...d.defaultRig, focalMm: f }), intrinsics(f, d.gate), p).ndc;

describe.each(SCENES.map((s) => [s.scene.id, s] as const))("scene %s", (id, d) => {
  it("shares the stage: rail, gate, lens kit and Bram's plane are identical to the doorway", () => {
    expect(d.rail).toEqual(doorwayScene.rail);
    expect(d.gate).toEqual(doorwayScene.gate);
    expect(d.focal).toEqual(doorwayScene.focal);
    expect(d.characters.primary.anchor[2]).toBe(doorwayScene.characters.primary.anchor[2]);
  });

  it("reads natural perspective from the default camera, and Fixed lens changes never change it", () => {
    for (const f of d.focal.presets) expect(measure(d, { ...d.defaultRig, focalMm: f }, "primary").perspective).toBe("natural");
  });

  it("frames both characters at 24 mm from the default position", () => {
    const [bx, by] = ndc(d, 24, d.characters.primary.anchor);
    const [px, py] = ndc(d, 24, d.characters.secondary.anchor);
    for (const v of [bx, by, px, py]) expect(Math.abs(v)).toBeLessThan(0.95);
  });

  it("Match on Bram is feasible at every preset", () => {
    const ref = captureMatchRef(d, d.defaultRig, "primary");
    expect(Object.values(feasiblePresets(d, "primary", ref)).every(Boolean)).toBe(true);
  });

  it("Pip's framing box and anchor sit on his feet (root height included)", () => {
    const c = d.characters.secondary;
    expect(c.framingBox.bottom).toBeCloseTo(c.root[1], 6);
    expect(c.anchor[1]).toBeCloseTo(c.root[1] + 0.56, 6);
  });

  it("the Both anchor sits between the two marks", () => {
    const [a, b] = [d.characters.primary.anchor, d.characters.secondary.anchor];
    expect(d.anchors.both[2]).toBeCloseTo((a[2] + b[2]) / 2, 3);
  });

  it("its performance is valid, loops at the scene length and has zero seam velocity", () => {
    const p = performanceFor(id);
    expect(p.durationS).toBe(d.timeline.durationS);
    expect(validatePerformance(p)).toEqual([]);
    const T = p.durationS;
    for (const clip of p.clips)
      for (const tr of clip.tracks) {
        const v0 = (sampleTrack(tr.keys, 0.001) - sampleTrack(tr.keys, 0)) / 0.001;
        const v1 = (sampleTrack(tr.keys, T) - sampleTrack(tr.keys, T - 0.001)) / 0.001;
        expect(Math.abs(v0), `${clip.character}.${tr.part}.${tr.ch} start`).toBeLessThan(1e-3);
        expect(Math.abs(v1), `${clip.character}.${tr.part}.${tr.ch} end`).toBeLessThan(1e-3);
      }
  });

  it("timeline markers fall inside the loop", () => {
    for (const [t] of d.timeline.markers) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(d.timeline.durationS);
    }
  });
});

describe("the alley lesson: telephoto compression of a run", () => {
  const d = getScene("alley");
  const pip = performanceFor("alley").clips.find((c) => c.character === "pip")!;
  const startZ = d.characters.secondary.root[2] + (sampleClip(pip, 0).get("root")?.pz ?? 0);

  it("Pip starts deep in the alley, past the archway, and reaches his mark at the skid", () => {
    expect(startZ).toBeLessThan(d.set.doorway.z - 5);
    const at = sampleClip(pip, 3.3).get("root")!;
    expect(at.pz).toBeCloseTo(0, 6);
    expect(at.px).toBeCloseTo(0, 6);
  });

  it("matched on Pip, his sprint grows him far more at 24 mm than at 85 mm", () => {
    const ref = captureMatchRef(d, d.defaultRig, "secondary");
    const growth = (f: number) => {
      const rig = solveMatchedFraming(d, d.defaultRig, "secondary", ref, f).rig;
      const pose = poseFromRig(d, rig);
      const depth = (z: number) => -toCameraSpace(pose, [d.characters.secondary.anchor[0], 0.56, z]).z;
      return depth(startZ) / depth(d.characters.secondary.anchor[2]);
    };
    expect(growth(24)).toBeGreaterThan(4.5);
    expect(growth(85)).toBeLessThan(2.6);
    expect(growth(24) / growth(85)).toBeGreaterThan(2);
  });

  it("the run never passes through the archway piers", () => {
    const [x0, x1] = d.set.doorway.openingX;
    for (let t = 0; t <= 8; t += 0.05) {
      const r = sampleClip(pip, t).get("root")!;
      const x = d.characters.secondary.root[0] + (r.px ?? 0);
      expect(x - 0.3).toBeGreaterThan(x0);
      expect(x + 0.3).toBeLessThan(x1);
    }
  });
});

describe("the workshop lesson: a long lens stacks Pip onto Bram's shoulder", () => {
  const d = getScene("workshop");
  it("Pip appears much bigger next to Bram at 85 mm matched than at 24 mm matched", () => {
    const ref = captureMatchRef(d, d.defaultRig, "primary");
    const ratio = (f: number) => {
      const rig = solveMatchedFraming(d, d.defaultRig, "primary", ref, f).rig;
      return measure(d, rig, "primary").apparentHeightRatio;
    };
    expect(ratio(85)).toBeGreaterThan(ratio(24) * 1.15);
  });

  it("Pip is hidden under the floor at the loop seam and standing on his mark for the BOO", () => {
    const pip = performanceFor("workshop").clips.find((c) => c.character === "pip")!;
    // hidden inside the riser: his hat stays below its top
    expect(sampleClip(pip, 0).get("root")!.py! + d.characters.secondary.landmarks.capTop).toBeLessThan(0);
    expect(Math.abs(sampleClip(pip, 3.2).get("root")!.py ?? 1)).toBeLessThan(0.05);
  });
});
