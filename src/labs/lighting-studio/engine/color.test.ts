import { describe, expect, it } from "vitest";
import { colorName, describeKelvin, hexToRgb, kelvinToRgb, lerpKelvin, luminance, mixHex, rgbToHex } from "./color";

describe("kelvin → rgb", () => {
  it("is near white at 6600 K", () => {
    const c = kelvinToRgb(6600);
    expect(c.r).toBeCloseTo(1, 1);
    expect(c.g).toBeGreaterThan(0.95);
    expect(c.b).toBeGreaterThan(0.95);
  });
  it("is orange when warm and blue when cool", () => {
    const warm = kelvinToRgb(2000);
    expect(warm.r).toBe(1);
    expect(warm.b).toBeLessThan(0.15);
    expect(warm.g).toBeLessThan(0.6);
    const cool = kelvinToRgb(11000);
    expect(cool.b).toBe(1);
    expect(cool.r).toBeLessThan(0.85);
  });
  it("is monotonic in blue across the range", () => {
    let prev = -1;
    for (let k = 1800; k <= 12000; k += 200) {
      const { b } = kelvinToRgb(k);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });
  it("describes warmth", () => {
    expect(describeKelvin(2000)).toBe("deep warm");
    expect(describeKelvin(3000)).toBe("warm");
    expect(describeKelvin(5600)).toBe("neutral");
    expect(describeKelvin(11500)).toBe("deep blue");
  });
});

describe("hex and mixing", () => {
  it("round-trips hex", () => {
    expect(rgbToHex(hexToRgb("#ff8a3d"))).toBe("#FF8A3D");
    expect(hexToRgb("#fff")).toEqual({ r: 1, g: 1, b: 1 });
  });
  it("mixes in linear light", () => {
    expect(mixHex("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    // Halfway in linear light is brighter than sRGB 50 % grey (#808080).
    expect(hexToRgb(mixHex("#000000", "#FFFFFF", 0.5)).r).toBeGreaterThan(0.7);
  });
  it("measures luminance", () => {
    expect(luminance("#FFFFFF")).toBeCloseTo(1);
    expect(luminance("#000000")).toBe(0);
  });
  it("interpolates temperature in mireds", () => {
    expect(lerpKelvin(2000, 10000, 0)).toBeCloseTo(2000);
    expect(lerpKelvin(2000, 10000, 1)).toBeCloseTo(10000);
    // mired midpoint of 2000 K and 10000 K is 3333 K, not 6000 K
    expect(lerpKelvin(2000, 10000, 0.5)).toBeCloseTo(3333.33, 1);
  });
});

describe("colour names", () => {
  it("names common colours", () => {
    expect(colorName("#FF8A3D")).toMatch(/orange/);
    expect(colorName("#4FB4F0")).toMatch(/sky blue|cyan/);
    expect(colorName("#050505")).toBe("near-black");
    expect(colorName("#5E5E5E")).toBe("dark grey");
    expect(colorName("#A0A0A0")).toBe("grey");
    expect(colorName("#4B3570")).toMatch(/violet/);
  });
});
