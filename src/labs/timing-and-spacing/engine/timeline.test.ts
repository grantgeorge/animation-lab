import { describe, expect, it } from "vitest";
import { presetCurves } from "./bezier";
import { DEFAULT_PARAMS, FLIGHT_VX, FPS, TRAVEL, type MotionParams, applyWeight, impliedGravity, physicalAirFrames, updateParams, weightPresetOf } from "./params";
import { buildTimeline, contactAt, motionAt, spacing, splitArc } from "./timeline";

const base: MotionParams = { ...DEFAULT_PARAMS };

describe("bounce timeline", () => {
  it("is contiguous and on integer frames", () => {
    const tl = buildTimeline(base);
    let f = 0;
    for (const s of tl.segments) {
      expect(s.f0).toBe(f);
      expect(Number.isInteger(s.f1)).toBe(true);
      f = s.f1;
    }
    expect(tl.totalFrames).toBe(f);
  });

  it("every apex and contact is on a drawn frame, at the right height", () => {
    const tl = buildTimeline(base);
    for (const a of tl.arcs) {
      expect(Number.isInteger(a.apexFrame)).toBe(true);
      expect(motionAt(tl, a.apexFrame - 1e-9).y).toBeCloseTo(a.height, 5);
      expect(motionAt(tl, a.land).y).toBe(0);
    }
  });

  it("restitution shrinks height by e² and airtime by e", () => {
    const tl = buildTimeline({ ...base, restitution: 0.7, maxBounces: 3, height: 3, airFrames: 40 });
    const [a0, a1, a2] = tl.arcs;
    expect(a1.height / a0.height).toBeCloseTo(0.49, 6);
    expect(a2.height / a1.height).toBeCloseTo(0.49, 6);
    expect(a1.land - a1.takeoff).toBe(Math.round(40 * 0.7));
    expect(a2.land - a2.takeoff).toBe(Math.round(40 * 0.49));
  });

  it("constant rebound timing keeps every arc as long as the first (physics broken on purpose)", () => {
    const tl = buildTimeline({ ...base, physicalTiming: false, maxBounces: 3 });
    const lens = tl.arcs.map((a) => a.land - a.takeoff);
    expect(new Set(lens).size).toBe(1);
  });

  it("stops bouncing below the minimum arc height and respects maxBounces", () => {
    expect(buildTimeline({ ...base, restitution: 0.1 }).arcs.length).toBe(1);
    expect(buildTimeline({ ...base, restitution: 0.9, maxBounces: 2 }).arcs.length).toBe(3);
  });

  it("gravity curve gives a parabolic height: peak ∝ (time to peak)²", () => {
    const tl = buildTimeline({ ...base, ...presetCurves("gravity"), airFrames: 24, height: 2.4 });
    const a = tl.arcs[0];
    const T = a.apexFrame - a.takeoff;
    for (const k of [2, 4, 6, 9]) {
      // Time k frames before the apex the body is H·(k/T)² below it.
      const h = motionAt(tl, a.apexFrame - k).y;
      expect(a.height - h).toBeCloseTo(a.height * (k / T) ** 2, 4);
    }
  });

  it("travels at constant flight speed, centred in the lane and capped to it", () => {
    const tl = buildTimeline(base);
    expect(motionAt(tl, 0).x).toBeCloseTo(-tl.travel / 2, 6);
    expect(motionAt(tl, tl.totalFrames - 1).x).toBeCloseTo(tl.travel / 2, 6);
    const a = tl.arcs[0];
    expect(motionAt(tl, a.apexFrame).x - motionAt(tl, a.takeoff).x).toBeCloseTo(FLIGHT_VX * (a.apexFrame - a.takeoff), 6);
    const heavy = buildTimeline(applyWeight(base, "bowling"));
    const balloon = buildTimeline(applyWeight(base, "balloon"));
    expect(heavy.travel).toBeLessThan(tl.travel);
    expect(balloon.travel).toBeCloseTo(TRAVEL, 6);
  });

  it("anticipation delays takeoff by its frames", () => {
    const a = buildTimeline({ ...base, anticipation: 0 });
    const b = buildTimeline({ ...base, anticipation: 0.8, anticipationFrames: 10 });
    expect(b.takeoffFrame - a.takeoffFrame).toBe(10);
  });

  it("contact windows cover the impact frame and contactFrames − 1 more", () => {
    const tl = buildTimeline({ ...base, contactFrames: 3, maxBounces: 2, restitution: 0.8 });
    const c = tl.contacts[0];
    expect(contactAt(tl, c.frame)).toBe(c);
    expect(contactAt(tl, c.frame + 2)).toBe(c);
    expect(contactAt(tl, c.frame + 3)).toBeNull();
    expect(motionAt(tl, c.frame + 1).y).toBe(0);
    expect(motionAt(tl, c.frame + 3).y).toBeGreaterThan(0);
  });

  it("gravity impacts twice as fast as linear for the same arc", () => {
    const g = buildTimeline({ ...base, ...presetCurves("gravity") });
    const l = buildTimeline({ ...base, ...presetCurves("linear") });
    expect(g.contacts[0].impact / l.contacts[0].impact).toBeCloseTo(2, 2);
  });

  it("linear spacing is even within an arc; gravity spacing bunches at the apex", () => {
    const sp = (p: MotionParams) => {
      const tl = buildTimeline({ ...p, airFrames: 24, height: 2.4 });
      const a = tl.arcs[0];
      const pts = [];
      for (let f = a.takeoff; f <= a.apexFrame; f++) {
        const m = motionAt(tl, f);
        pts.push({ cx: 0, cy: m.y });
      }
      return spacing(pts);
    };
    const lin = sp({ ...base, ...presetCurves("linear") });
    expect(Math.max(...lin) - Math.min(...lin)).toBeLessThan(1e-4);
    const grav = sp({ ...base, ...presetCurves("gravity") });
    expect(grav[0] / grav[grav.length - 1]).toBeGreaterThan(10);
  });
});

describe("params", () => {
  it("weight presets read heavy → light as implied gravity", () => {
    const g = (id: "bowling" | "rubber" | "beach" | "balloon") => {
      const p = applyWeight(base, id);
      return impliedGravity(p.height, p.airFrames);
    };
    expect(g("bowling")).toBeGreaterThan(1.4);
    expect(g("rubber")).toBeGreaterThan(0.9);
    expect(g("rubber")).toBeLessThan(1.1);
    expect(g("beach")).toBeLessThan(0.7);
    expect(g("balloon")).toBeLessThan(g("beach"));
    expect(physicalAirFrames(2.4)).toBeCloseTo(24, 0);
    expect(FPS).toBe(24);
  });

  it("editing a weight value detaches the preset; re-applying restores it", () => {
    const p = updateParams(base, { restitution: 0.5 });
    expect(p.weight).toBeNull();
    expect(weightPresetOf(updateParams(p, { weight: "rubber" }))).toBe("rubber");
  });

  it("sanitises out-of-range input", () => {
    const p = updateParams(base, { airFrames: 999.4, squash: -3, anticipationFrames: 7.6 });
    expect(p.airFrames).toBe(60);
    expect(p.squash).toBe(0);
    expect(p.anticipationFrames).toBe(8);
    expect(splitArc(7)).toEqual([3, 4]);
  });
});
