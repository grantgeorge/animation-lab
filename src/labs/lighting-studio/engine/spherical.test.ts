import { describe, expect, it } from "vitest";
import { anglesFromPosition, clampPlacement, describeAzimuth, describeElevation, lerpAngleDeg, lightPosition, raySphereNearest, sourceRadiusM, wrapDeg, type Vec3 } from "./spherical";

const T: Vec3 = [0, 1.45, 0];
const close = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9 - Math.round(Math.log10(1 / eps) - 9)));

describe("angles", () => {
  it("wraps to (-180, 180]", () => {
    expect(wrapDeg(190)).toBe(-170);
    expect(wrapDeg(-180)).toBe(180);
    expect(wrapDeg(540)).toBe(180);
    expect(wrapDeg(-30)).toBe(-30);
  });
  it("interpolates the short way round", () => {
    expect(lerpAngleDeg(170, -170, 0.5)).toBeCloseTo(180);
    expect(lerpAngleDeg(-170, 170, 0.25)).toBeCloseTo(-175);
    expect(lerpAngleDeg(-40, 40, 0.5)).toBeCloseTo(0);
  });
});

describe("light placement", () => {
  it("puts azimuth 0 on the camera side and +90 on screen right", () => {
    close(lightPosition(0, 0, 3, T), [0, 1.45, 3]);
    close(lightPosition(90, 0, 3, T), [3, 1.45, 0]);
    close(lightPosition(-90, 0, 2, T), [-2, 1.45, 0]);
    close(lightPosition(180, 0, 2, T), [0, 1.45, -2]);
    close(lightPosition(0, 90, 2, T), [0, 3.45, 0]);
  });
  it("round-trips position ↔ angles", () => {
    for (const [az, el, d] of [[-40, 30, 3], [162, 8, 3.8], [-148, -12, 2], [90, 60, 4.5]]) {
      const a = anglesFromPosition(lightPosition(az, el, d, T), T);
      expect(a.azimuthDeg).toBeCloseTo(az, 9);
      expect(a.elevationDeg).toBeCloseTo(el, 9);
      expect(a.distanceM).toBeCloseTo(d, 9);
    }
  });
  it("clamps placement to the lab limits", () => {
    expect(clampPlacement({ azimuthDeg: 200, elevationDeg: 120, distanceM: 0.2 })).toEqual({ azimuthDeg: -160, elevationDeg: 85, distanceM: 1.4 });
  });
});

describe("ray drag on the light sphere", () => {
  it("keeps the hit on the side the light is already on", () => {
    const origin: Vec3 = [0, 1.45, 10];
    const dir: Vec3 = [0, 0, -1];
    close(raySphereNearest(origin, dir, T, 3, [0, 1.45, 2.5]), [0, 1.45, 3]);
    close(raySphereNearest(origin, dir, T, 3, [0, 1.45, -2.5]), [0, 1.45, -3]);
  });
  it("falls back to the closest point on the sphere when the ray misses", () => {
    const p = raySphereNearest([5, 1.45, 10], [0, 0, -1], T, 3, [0, 0, 0]);
    close(p, [3, 1.45, 0]);
  });
});

describe("plain-language placement", () => {
  it("names sides and heights", () => {
    expect(describeAzimuth(-45)).toEqual({ side: "three-quarter", screen: "left", abs: 45 });
    expect(describeAzimuth(90).side).toBe("side");
    expect(describeAzimuth(150)).toEqual({ side: "three-quarter back", screen: "right", abs: 150 });
    expect(describeAzimuth(178).screen).toBe("centre");
    expect(describeAzimuth(5).side).toBe("front");
    expect(describeElevation(-20)).toBe("underlight");
    expect(describeElevation(0)).toBe("eye level");
    expect(describeElevation(35)).toBe("high");
    expect(describeElevation(75)).toBe("overhead");
  });
  it("soft means a bigger source", () => {
    expect(sourceRadiusM(1)).toBeGreaterThan(sourceRadiusM(0) * 10);
  });
});
