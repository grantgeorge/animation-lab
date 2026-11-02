import { describe, expect, it } from "vitest";
import { sampleClip, validatePerformance } from "@/scene/animation/dsl";
import { MARKS } from "../engine/marks";
import { REELS, SOURCE_END, masterT } from "../engine/source";
import { BRAM_CLIP, PIP_CLIP } from "./index";

describe("source performance", () => {
  it("is a valid, closed performance over the master timeline", () => {
    expect(validatePerformance({ id: "editing-rhythm", durationS: SOURCE_END, clips: [BRAM_CLIP, PIP_CLIP] })).toEqual([]);
  });

  it("puts the cast on their marks in each reel", () => {
    const b = sampleClip(BRAM_CLIP, masterT("main", 1)).get("root")!;
    expect(b.px).toBeCloseTo(MARKS.bram.at[0]);
    expect(b.pz).toBeCloseTo(MARKS.bram.at[2]);
    const p = sampleClip(PIP_CLIP, masterT("main", 5)).get("root")!;
    expect(p.px).toBeCloseTo(MARKS.pip.stepTo[0]);
    // Pip is offstage while Bram slips and lights lamps
    expect(sampleClip(PIP_CLIP, masterT("slip", 4)).get("root")!.pz).toBeCloseTo(MARKS.offstage.pip[2]);
    // Bram walks the lamp line
    const a = sampleClip(BRAM_CLIP, masterT("mont", 1)).get("root")!.px!;
    const z = sampleClip(BRAM_CLIP, masterT("mont", REELS.mont.length - 1)).get("root")!.px!;
    expect(z - a).toBeGreaterThan(6);
  });

  it("holds Bram's Kuleshov face neutral", () => {
    for (const t of [1.2, 2.5, 3.6]) {
      const pose = sampleClip(BRAM_CLIP, masterT("kule", t));
      expect(pose.get("brows")?.py ?? 0).toBe(0);
      expect(pose.get("mouth")?.py ?? 0).toBe(0);
    }
  });
});
