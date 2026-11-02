import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { frameSizeAtDistance, hfovDeg, vfovDeg, distanceForFraction, heightFraction } from "../optics";

describe("optics", () => {
  const table: [number, number, number][] = [
    [18, 90.0, 58.72],
    [24, 73.74, 45.75],
    [35, 54.43, 32.27],
    [50, 39.6, 22.9],
    [85, 23.91, 13.59],
    [135, 15.19, 8.58],
  ];
  it.each(table)("%i mm → %f° h / %f° v on a 36 × 20.25 gate", (f, h, v) => {
    expect(hfovDeg(f)).toBeCloseTo(h, 1);
    expect(Math.abs(hfovDeg(f) - h)).toBeLessThan(0.01);
    expect(Math.abs(vfovDeg(f) - v)).toBeLessThan(0.01);
  });

  it("matches three's PerspectiveCamera.setFocalLength with filmGauge 36 at 16:9", () => {
    for (const [f] of table) {
      const cam = new PerspectiveCamera();
      cam.aspect = 16 / 9;
      cam.filmGauge = 36;
      cam.setFocalLength(f);
      expect(cam.getFilmHeight()).toBeCloseTo(20.25, 9);
      expect(Math.abs(cam.fov - vfovDeg(f))).toBeLessThan(1e-9);
    }
  });

  it("frame size at 3 m with 50 mm is 2.160 × 1.215 m", () => {
    const s = frameSizeAtDistance(50, 3);
    expect(s.widthM).toBeCloseTo(2.16, 9);
    expect(s.heightM).toBeCloseTo(1.215, 9);
  });

  it("distanceForFraction inverts heightFraction", () => {
    const d = distanceForFraction(0.78, 50, 0.92);
    expect(heightFraction(0.78, d, 50)).toBeCloseTo(0.92, 12);
    expect(d).toBeCloseTo(2.0934, 4);
  });
});
