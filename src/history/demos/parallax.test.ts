import { describe, expect, it } from "vitest";
import { planeOffsets, TRAVEL_PX } from "./parallax";

describe("multiplane parallax", () => {
  it("flat mode moves every plane by the same amount", () => {
    const o = planeOffsets(0.8, "flat");
    expect(new Set(Object.values(o).map((v) => v.toFixed(6))).size).toBe(1);
  });
  it("layered mode moves near planes faster than far planes", () => {
    const o = planeOffsets(1, "layered");
    expect(Math.abs(o.foreground)).toBeCloseTo(TRAVEL_PX);
    expect(Math.abs(o.foreground)).toBeGreaterThan(Math.abs(o.characters));
    expect(Math.abs(o.characters)).toBeGreaterThan(Math.abs(o.background));
  });
  it("the two modes differ for the same camera travel (and agree at rest)", () => {
    expect(planeOffsets(1, "layered").background).not.toBeCloseTo(planeOffsets(1, "flat").background);
    expect(Object.values(planeOffsets(0, "layered")).every((v) => v === 0 || Object.is(v, -0))).toBe(true);
  });
});
