import { describe, expect, it } from "vitest";
import { LOOKS, PRESETS, TAKE_APART_STEPS, cloneRig, getPreset } from "./presets";
import { analyze } from "./ratio";
import { describeAzimuth } from "./spherical";
import { CHANNEL_IDS, LIGHT_IDS, LIMITS } from "./types";

describe("presets", () => {
  it("has the five looks on keys 1–5 plus the neutral rig on 0", () => {
    expect(LOOKS.map((p) => p.id)).toEqual(["flat", "storybook", "dramatic", "noir", "sunset"]);
    expect(LOOKS.map((p) => p.key)).toEqual(["1", "2", "3", "4", "5"]);
    expect(getPreset("three-point")?.key).toBe("0");
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });

  it("keeps every value inside the lab limits and every note written", () => {
    for (const p of PRESETS) {
      expect(p.note.length).toBeGreaterThan(60);
      for (const c of CHANNEL_IDS) expect(p.roles[c].length).toBeGreaterThan(10);
      for (const id of LIGHT_IDS) {
        const l = p.rig.lights[id];
        for (const k of ["azimuthDeg", "elevationDeg", "distanceM", "intensity", "kelvin", "softness", "spreadDeg", "gobo"] as const) {
          expect(l[k], `${p.id}.${id}.${k}`).toBeGreaterThanOrEqual(LIMITS[k].min);
          expect(l[k], `${p.id}.${id}.${k}`).toBeLessThanOrEqual(LIMITS[k].max);
        }
      }
      for (const k of ["ambient", "glowStrength", "saturation", "exposure"] as const) {
        expect(p.rig.env[k], `${p.id}.env.${k}`).toBeGreaterThanOrEqual(LIMITS[k].min);
        expect(p.rig.env[k], `${p.id}.env.${k}`).toBeLessThanOrEqual(LIMITS[k].max);
      }
    }
  });

  it("hits the lighting ratio each look is known for", () => {
    const r = (id: string) => analyze(getPreset(id)!.rig).ratio;
    expect(r("flat")).toBeLessThanOrEqual(2.2);
    expect(r("storybook")).toBeGreaterThan(2.5);
    expect(r("storybook")).toBeLessThan(3.6);
    expect(r("dramatic")).toBeGreaterThan(6.5);
    expect(r("dramatic")).toBeLessThan(10);
    expect(r("noir")).toBeGreaterThan(30);
  });

  it("builds each look from the right geometry", () => {
    const flat = getPreset("flat")!.rig.lights;
    expect(describeAzimuth(flat.key.azimuthDeg).side).toBe("front");
    expect(flat.key.softness).toBeGreaterThan(0.8);

    const dramatic = getPreset("dramatic")!.rig.lights;
    expect(Math.abs(dramatic.key.azimuthDeg)).toBeGreaterThanOrEqual(60);
    expect(dramatic.key.softness).toBeLessThan(0.2);

    const noir = getPreset("noir")!.rig;
    expect(noir.lights.fill.on).toBe(false);
    expect(noir.lights.key.gobo).toBe(1);
    expect(noir.lights.key.elevationDeg).toBeGreaterThan(30);
    expect(noir.env.saturation).toBeLessThan(0.2);

    const sunset = getPreset("sunset")!.rig;
    expect(Math.abs(sunset.lights.key.azimuthDeg)).toBeGreaterThan(150);
    expect(sunset.lights.key.elevationDeg).toBeLessThan(12);
    expect(sunset.lights.key.kelvin).toBeLessThan(2600);
    expect(sunset.lights.fill.kelvin).toBeGreaterThan(9000);
  });

  it("cloneRig is deep enough that editing the copy leaves the preset alone", () => {
    const p = getPreset("storybook")!;
    const c = cloneRig(p.rig);
    c.lights.key.azimuthDeg = 99;
    c.env.ambient = 1;
    expect(p.rig.lights.key.azimuthDeg).not.toBe(99);
    expect(p.rig.env.ambient).not.toBe(1);
  });

  it("take-apart builds up key → fill → rim → everything", () => {
    expect(TAKE_APART_STEPS.map((s) => s.adds)).toEqual(["key", "fill", "rim", "ambient"]);
    expect(TAKE_APART_STEPS.at(-1)!.mask).toEqual({ key: 1, fill: 1, rim: 1, ambient: 1 });
    expect(TAKE_APART_STEPS[0].mask).toEqual({ key: 1, fill: 0, rim: 0, ambient: 0 });
  });
});
