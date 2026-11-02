import { describe, expect, it } from "vitest";
import { CURVE_PRESET_IDS, arcCharacter, bezierEquals, clampBezier, ease, easeSlope, matchPreset, mirrorBezier, presetCurves, solveT } from "./bezier";

describe("bezier timing curves", () => {
  it("passes through the end points for every preset", () => {
    for (const id of CURVE_PRESET_IDS) {
      const { rise, fall } = presetCurves(id);
      for (const b of [rise, fall]) {
        expect(ease(b, 0)).toBe(0);
        expect(ease(b, 1)).toBe(1);
      }
    }
  });

  it("inverts x(t) accurately, including flat-start curves", () => {
    const b = { x1: 0, y1: 0, x2: 0.58, y2: 1 };
    for (let i = 1; i < 20; i++) {
      const x = i / 20;
      const t = solveT(b, x);
      const m = 1 - t;
      expect(3 * m * m * t * b.x1 + 3 * m * t * t * b.x2 + t ** 3).toBeCloseTo(x, 6);
    }
  });

  it("linear preset is the identity", () => {
    const { rise } = presetCurves("linear");
    for (const u of [0.1, 0.25, 0.5, 0.8]) expect(ease(rise, u)).toBeCloseTo(u, 6);
  });

  it("gravity preset is an exact parabola: rise 1 − (1 − u)², fall u²", () => {
    const { rise, fall } = presetCurves("gravity");
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.95]) {
      expect(ease(rise, u)).toBeCloseTo(1 - (1 - u) ** 2, 5);
      expect(ease(fall, u)).toBeCloseTo(u * u, 5);
    }
  });

  it("mirroring is an involution and time-reverses the curve", () => {
    const b = { x1: 0.2, y1: 0.9, x2: 0.7, y2: 1.1 };
    expect(bezierEquals(mirrorBezier(mirrorBezier(b)), b, 1e-12)).toBe(true);
    const m = mirrorBezier(b);
    for (const u of [0.2, 0.5, 0.9]) expect(ease(m, u)).toBeCloseTo(1 - ease(b, 1 - u), 5);
  });

  it("clamps handles so the curve stays a function of time", () => {
    expect(clampBezier({ x1: -1, y1: 5, x2: 2, y2: -5 })).toEqual({ x1: 0, y1: 1.3, x2: 1, y2: -0.3 });
  });

  it("recognises presets and characterises arcs", () => {
    const g = presetCurves("gravity");
    expect(matchPreset(g.rise, g.fall)).toBe("gravity");
    expect(matchPreset(g.rise, presetCurves("linear").fall)).toBeNull();
    const ga = arcCharacter(g.rise, g.fall);
    expect(ga.apex).toBeLessThan(0.1);
    expect(ga.contact).toBeGreaterThan(1.9);
    const l = presetCurves("linear");
    const la = arcCharacter(l.rise, l.fall);
    expect(la.apex).toBeCloseTo(1, 2);
    expect(la.contact).toBeCloseTo(1, 2);
    expect(easeSlope(l.rise, 0.5)).toBeCloseTo(1, 4);
  });
});
