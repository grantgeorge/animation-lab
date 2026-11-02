import { describe, expect, it } from "vitest";
import { doorwayWave } from "./performances/doorwayWave";
import { sampleClip, sampleTrack, validatePerformance } from "./dsl";

describe("doorway-wave performance", () => {
  it("is valid: sorted, finite, loop closes on every channel", () => {
    expect(validatePerformance(doorwayWave)).toEqual([]);
  });

  it("has zero velocity at the loop seam", () => {
    for (const clip of doorwayWave.clips)
      for (const tr of clip.tracks) {
        const v0 = (sampleTrack(tr.keys, 0.001) - sampleTrack(tr.keys, 0)) / 0.001;
        const v1 = (sampleTrack(tr.keys, 6) - sampleTrack(tr.keys, 5.999)) / 0.001;
        expect(Math.abs(v0), `${clip.character}.${tr.part}.${tr.ch} start`).toBeLessThan(1e-3);
        expect(Math.abs(v1), `${clip.character}.${tr.part}.${tr.ch} end`).toBeLessThan(1e-3);
      }
  });

  it("Pip is on his mark during the wave and hidden at the seam", () => {
    const pip = doorwayWave.clips.find((c) => c.character === "pip")!;
    const at = (t: number) => sampleClip(pip, t).get("root")!;
    expect(at(3.35).px).toBeCloseTo(0, 6);
    expect(at(3.35).pz).toBeCloseTo(0, 6);
    expect(at(0).pz).toBeCloseTo(-0.8, 6);
  });
});
