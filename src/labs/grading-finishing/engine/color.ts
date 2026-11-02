/**
 * Colour primitives shared by the grade, the scopes and the shot-match. Everything here is pure
 * and mirrored line for line by the GLSL in `runtime/shaders.ts`.
 *
 * Convention: an "encoded" value is a display-referred sRGB code value in [0, 1], which is what a
 * rendered frame or an AI video clip delivers. "Linear" is the same light with the transfer curve
 * removed, where exposure and white balance are physically meaningful.
 */

export type RGB = [number, number, number];

/** Rec.709 / sRGB luminance weights (linear light). */
export const LUMA: Readonly<RGB> = [0.2126, 0.7152, 0.0722];

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** sRGB EOTF (code value → linear light). */
export function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB inverse EOTF (linear light → code value). Negative input clamps to 0. */
export function toEncoded(l: number): number {
  if (l <= 0) return 0;
  return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
}

export const luma = (c: Readonly<RGB>) => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];

/**
 * A zero-sum RGB offset pointing at a hue: the basis behind every colour wheel and split-tone in
 * the lab. Red sits at 0°, green at 120°, blue at 240°, so the three components always sum to zero
 * and a push changes colour without shifting overall level.
 */
export function wheelOffset(x: number, y: number): RGB {
  const out: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const phi = (i * 2 * Math.PI) / 3;
    out[i] = x * Math.cos(phi) + y * Math.sin(phi);
  }
  return out;
}

/** Hue in degrees and amount → wheel (x, y). */
export const polarToWheel = (hueDeg: number, amount: number): [number, number] => [
  amount * Math.cos((hueDeg * Math.PI) / 180),
  amount * Math.sin((hueDeg * Math.PI) / 180),
];

/**
 * Three.js's ACES filmic fit (Narkowicz / Hill), identical to `ACESFilmicToneMapping` at exposure 1.
 * The lab's "develop" pass uses it so the clean plate looks exactly like every other lab.
 */
export function acesFilmic(c: Readonly<RGB>): RGB {
  const e = 1 / 0.6;
  const r = c[0] * e, g = c[1] * e, b = c[2] * e;
  // sRGB → AP1-ish (input matrix, rows of the transposed GLSL matrix)
  const i0 = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const i1 = 0.076 * r + 0.90834 * g + 0.01566 * b;
  const i2 = 0.0284 * r + 0.13383 * g + 0.83777 * b;
  const fit = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const f0 = fit(i0), f1 = fit(i1), f2 = fit(i2);
  return [
    clamp01(1.60475 * f0 - 0.53108 * f1 - 0.07367 * f2),
    clamp01(-0.10208 * f0 + 1.10813 * f1 - 0.00605 * f2),
    clamp01(-0.00327 * f0 - 0.07276 * f1 + 1.07602 * f2),
  ];
}

/** Linear sRGB → OKLab (Björn Ottosson, 2020). Used only for measurement, never for grading. */
export function linearToOklab(c: Readonly<RGB>): RGB {
  const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
  const m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
  const s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
