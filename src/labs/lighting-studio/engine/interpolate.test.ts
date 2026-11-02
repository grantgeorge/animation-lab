import { describe, expect, it } from "vitest";
import { easeInOut, lerpLight, lerpRig } from "./interpolate";
import { getPreset } from "./presets";

const a = getPreset("dramatic")!.rig;
const b = getPreset("sunset")!.rig;

describe("rig interpolation", () => {
  it("returns the endpoints exactly", () => {
    expect(lerpRig(a, b, 0)).toEqual(a);
    expect(lerpRig(a, b, 1)).toEqual(b);
  });
  it("swings azimuth the short way round", () => {
    const l = lerpLight({ ...a.lights.key, azimuthDeg: 170 }, { ...a.lights.key, azimuthDeg: -170 }, 0.5);
    expect(Math.abs(l.azimuthDeg)).toBeCloseTo(180);
  });
  it("fades a light that switches off instead of popping", () => {
    const on = { ...a.lights.fill, on: true, intensity: 10 };
    const off = { ...a.lights.fill, on: false, intensity: 10 };
    const mid = lerpLight(on, off, 0.5);
    expect(mid.on).toBe(true);
    expect(mid.intensity).toBeCloseTo(5);
    expect(lerpLight(on, off, 1).on).toBe(false);
  });
  it("eases smoothly from 0 to 1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
  });
  it("blends environment colours", () => {
    const mid = lerpRig(a, b, 0.5).env;
    expect(mid.glowColor).not.toBe(a.env.glowColor);
    expect(mid.glowColor).not.toBe(b.env.glowColor);
    expect(mid.glowStrength).toBeCloseTo((a.env.glowStrength + b.env.glowStrength) / 2);
  });
});
