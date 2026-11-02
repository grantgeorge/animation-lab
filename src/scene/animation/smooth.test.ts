import { describe, expect, it } from "vitest";
import { sampleClipSmoothed } from "./smooth";
import { sampleClip, type Clip } from "./dsl";

const clip: Clip = {
  character: "pip",
  tracks: [
    { part: "upperArmL", ch: "rz", keys: [[0, 0], [1, 0, "hold"], [1.2, 90, "out"], [3, 90, "hold"], [4, 0, "inOut"]] },
    { part: "handL", ch: "rz", keys: [[0, 0], [1, 0, "hold"], [1.2, 40, "out"], [4, 0, "inOut"]] },
    { part: "eyes", ch: "sy", keys: [[0, 0], [2, 0, "hold"], [2.05, -0.9, "in"], [2.1, 0, "out"], [4, 0, "hold"]] },
  ],
};

describe("motion smoothing", () => {
  it("matches the raw pose on holds", () => {
    expect(sampleClipSmoothed(clip, 2.5, 4).get("upperArmL")!.rz).toBeCloseTo(90, 6);
    expect(sampleClipSmoothed(clip, 0.5, 4).get("upperArmL")!.rz).toBeCloseTo(0, 6);
  });
  it("rounds off a snap: the first frame of a move is softer than raw", () => {
    const raw = sampleClip(clip, 1.04).get("upperArmL")!.rz!;
    const smooth = sampleClipSmoothed(clip, 1.04, 4).get("upperArmL")!.rz!;
    expect(smooth).toBeLessThan(raw);
    expect(smooth).toBeGreaterThan(0);
  });
  it("hands trail the arm (overlap)", () => {
    const t = 1.1;
    const armFrac = sampleClipSmoothed(clip, t, 4).get("upperArmL")!.rz! / 90;
    const handFrac = sampleClipSmoothed(clip, t, 4).get("handL")!.rz! / 40;
    expect(handFrac).toBeLessThan(armFrac);
  });
  it("keeps blinks raw", () => {
    expect(sampleClipSmoothed(clip, 2.05, 4).get("eyes")!.sy).toBeCloseTo(-0.9, 6);
  });
  it("is deterministic and wraps across the loop seam", () => {
    const a = sampleClipSmoothed(clip, 0.01, 4).get("upperArmL")!.rz;
    const b = sampleClipSmoothed(clip, 4.01, 4).get("upperArmL")!.rz;
    expect(a).toBeCloseTo(b!, 9);
  });
});
