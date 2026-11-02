import { describe, expect, it } from "vitest";
import { sampleClip, validatePerformance } from "@/scene/animation/dsl";
import { lookAround } from "./lookAround";

describe("look-around performance", () => {
  it("validates: sorted keys, finite values, loop closes", () => {
    expect(validatePerformance(lookAround)).toEqual([]);
  });
  it("sweeps the head across the key light and back", () => {
    const clip = lookAround.clips[0];
    const at = (t: number) => sampleClip(clip, t).get("head")!.ry!;
    expect(at(0)).toBeLessThan(-20);
    expect(at(3.4)).toBeGreaterThan(20);
    expect(at(7)).toBeCloseTo(at(0));
  });
});
