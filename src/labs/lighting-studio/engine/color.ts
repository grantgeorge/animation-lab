/** Colour helpers: Kelvin → RGB, sRGB ↔ linear, hex parsing, linear mixing and plain-language names. */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Black-body colour temperature to display sRGB (0…1), after Tanner Helland's fit of the CIE data.
 * Valid 1000–40000 K; 6600 K is close to white.
 */
export function kelvinToRgb(kelvin: number): RGB {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  return { r: clamp01(r / 255), g: clamp01(g / 255), b: clamp01(b / 255) };
}

export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/(.)/g, "$1$1") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const to = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export const kelvinToHex = (k: number) => rgbToHex(kelvinToRgb(k));

/** Mix two sRGB hex colours in linear light (how light actually adds). */
export function mixHex(a: string, b: string, u: number): string {
  if (u <= 0) return a;
  if (u >= 1) return b;
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const m = (x: number, y: number) => linearToSrgb(srgbToLinear(x) + (srgbToLinear(y) - srgbToLinear(x)) * u);
  return rgbToHex({ r: m(A.r, B.r), g: m(A.g, B.g), b: m(A.b, B.b) });
}

/** Relative luminance (linear, 0…1) of an sRGB hex colour. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Interpolate colour temperature in mireds (1e6 / K), which is perceptually even. */
export function lerpKelvin(a: number, b: number, u: number): number {
  const ma = 1e6 / a;
  const mb = 1e6 / b;
  return 1e6 / (ma + (mb - ma) * u);
}

export type Warmth = "deep warm" | "warm" | "slightly warm" | "neutral" | "slightly cool" | "cool" | "deep blue";

export function describeKelvin(k: number): Warmth {
  if (k < 2400) return "deep warm";
  if (k < 3600) return "warm";
  if (k < 4800) return "slightly warm";
  if (k <= 6200) return "neutral";
  if (k <= 7600) return "slightly cool";
  if (k <= 10000) return "cool";
  return "deep blue";
}

/** Short colour word for a light of this temperature, for prompts ("orange", "blue"…). */
export function kelvinWord(k: number): string {
  if (k < 2400) return "orange";
  if (k < 3600) return "warm amber";
  if (k < 4800) return "warm";
  if (k <= 6200) return "white";
  if (k <= 7600) return "cool";
  if (k <= 10000) return "cool blue";
  return "blue";
}

function hsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** Plain colour name for a hex value ("deep teal", "pale cream", "near-black"). */
export function colorName(hex: string): string {
  const { h, s, l } = hsl(hexToRgb(hex));
  if (l < 0.08) return "near-black";
  if (s < 0.14 || (l > 0.92 && s < 0.4)) {
    if (l < 0.22) return "charcoal";
    if (l < 0.45) return "dark grey";
    if (l < 0.7) return "grey";
    return l > 0.9 ? "white" : "pale grey";
  }
  const hues: [number, string][] = [
    [12, "red"],
    [32, "orange"],
    [46, "amber"],
    [64, "yellow"],
    [90, "lime"],
    [150, "green"],
    [178, "teal"],
    [196, "cyan"],
    [218, "sky blue"],
    [248, "blue"],
    [282, "violet"],
    [320, "magenta"],
    [345, "pink"],
    [361, "red"],
  ];
  let name = hues.find(([lim]) => h < lim)![1];
  if (name === "orange" && l < 0.3) name = "brown";
  if ((name === "amber" || name === "yellow") && l > 0.75 && s < 0.7) name = "cream";
  const tone = l < 0.25 ? "deep " : l > 0.78 ? "pale " : s > 0.7 && l > 0.42 ? "bright " : "";
  return tone + name;
}
