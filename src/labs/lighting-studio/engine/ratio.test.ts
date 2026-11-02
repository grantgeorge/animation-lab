import { describe, expect, it } from "vitest";
import { analyze, effectiveRig, formatRatio, formatStops, illuminance } from "./ratio";
import { cloneRig, getPreset, soloMask } from "./presets";

const base = () => cloneRig(getPreset("three-point")!.rig);

describe("illuminance", () => {
  it("follows the inverse-square law", () => {
    const l = base().lights.key;
    const near = illuminance({ ...l, distanceM: 2 });
    const far = illuminance({ ...l, distanceM: 4 });
    expect(near / far).toBeCloseTo(4);
  });
  it("is zero for a light that is off", () => {
    expect(illuminance({ ...base().lights.key, on: false })).toBe(0);
  });
});

describe("lighting ratio", () => {
  it("is 2:1 = one stop when key equals fill and there is no ambient", () => {
    const r = base();
    r.env.ambient = 0;
    r.lights.fill = { ...r.lights.key, azimuthDeg: 40 };
    const a = analyze(r);
    expect(a.ratio).toBeCloseTo(2);
    expect(a.stops).toBeCloseTo(1);
    expect(formatRatio(a.ratio)).toBe("2:1");
  });
  it("goes to infinity with no fill and no ambient", () => {
    const r = base();
    r.env.ambient = 0;
    r.lights.fill.on = false;
    const a = analyze(r);
    expect(a.ratio).toBe(Infinity);
    expect(formatRatio(a.ratio)).toBe("64:1+");
    expect(formatStops(a.stops)).toBe("6+ stops");
  });
  it("shares add up to one", () => {
    const a = analyze(base());
    expect(a.share.key + a.share.fill + a.share.rim + a.share.ambient).toBeCloseTo(1);
  });
  it("formats ratios and stops", () => {
    expect(formatRatio(1.4)).toBe("1.5:1");
    expect(formatRatio(7.6)).toBe("8:1");
    expect(formatStops(3)).toBe("3.0 stops");
    expect(formatStops(1)).toBe("1.0 stop");
  });
});

describe("solo / take-apart masks", () => {
  it("solo key removes every other channel", () => {
    const eff = effectiveRig(base(), soloMask("key"));
    const a = analyze(eff);
    expect(a.e.fill).toBe(0);
    expect(a.e.rim).toBe(0);
    expect(a.e.ambient).toBe(0);
    expect(a.e.key).toBeGreaterThan(0);
    expect(eff.env.glowStrength).toBe(0);
  });
  it("does not mutate the input rig", () => {
    const r = base();
    effectiveRig(r, soloMask("fill"));
    expect(r.lights.key.intensity).toBe(getPreset("three-point")!.rig.lights.key.intensity);
  });
});
