import { cocMm, cropFactor, type Gate } from "./formats";

const RAD = 180 / Math.PI;

/** Horizontal field of view in degrees for a gate width: 2·atan(w / 2f). */
export const hfovDeg = (focalMm: number, g: Gate) => 2 * Math.atan(g.widthMm / (2 * focalMm)) * RAD;
/** Vertical field of view in degrees: 2·atan(h / 2f). */
export const vfovDeg = (focalMm: number, g: Gate) => 2 * Math.atan(g.heightMm / (2 * focalMm)) * RAD;

/** The focal length on `to` that gives the same horizontal field of view as `focalMm` on `from`. */
export const equivalentFocal = (focalMm: number, from: Gate, to: Gate) => (focalMm * to.widthMm) / from.widthMm;

/** Full-frame-equivalent focal length (same horizontal FOV on a 36 mm-wide gate). */
export const ffEquivalentFocal = (focalMm: number, g: Gate) => focalMm * cropFactor(g);

/**
 * The T-stop on `to` that gives the same depth of field at the same framing (same FOV, same camera
 * position): the aperture diameter f/N must stay the same, so N scales with the focal length.
 */
export const equivalentStop = (stop: number, from: Gate, to: Gate) => (stop * to.widthMm) / from.widthMm;

export const ffEquivalentStop = (stop: number, g: Gate) => stop * cropFactor(g);

/** Hyperfocal distance (mm): H = f² / (N·c) + f. */
export const hyperfocalMm = (focalMm: number, stop: number, c: number) => (focalMm * focalMm) / (stop * c) + focalMm;

export interface DofBand {
  /** Circle of confusion used (mm on the sensor). */
  cocMm: number;
  hyperfocalM: number;
  nearM: number;
  /** Infinity when focused at or beyond the hyperfocal distance. */
  farM: number;
  /** far − near (Infinity when far is infinite). */
  totalM: number;
}

/**
 * Thin-lens depth of field. Distances in metres from the lens; T-stop is used as the f-number
 * (real cine lenses' f-number is a fraction of a stop lower than the T-stop).
 *   near = s(H − f) / (H + s − 2f)      far = s(H − f) / (H − s)   (∞ when s ≥ H)
 */
export function depthOfField(focalMm: number, stop: number, focusM: number, g: Gate, c = cocMm(g)): DofBand {
  const f = focalMm;
  const s = Math.max(focusM * 1000, f * 1.001);
  const H = hyperfocalMm(f, stop, c);
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
  return { cocMm: c, hyperfocalM: H / 1000, nearM: near / 1000, farM: far / 1000, totalM: far === Infinity ? Infinity : (far - near) / 1000 };
}

/**
 * Diameter (mm, on the sensor) of the blur disc for a point at `objectM` when the lens is focused at
 * `focusM`: b = f²·|z − s| / (N·z·(s − f)). This is exactly what the depth-of-field shader evaluates
 * per pixel, so a point is inside the band above iff blurDisc ≤ c.
 */
export function blurDiscMm(focalMm: number, stop: number, focusM: number, objectM: number) {
  const f = focalMm;
  const s = Math.max(focusM * 1000, f * 1.001);
  const z = Math.max(objectM * 1000, f * 1.001);
  return (f * f * Math.abs(z - s)) / (stop * z * (s - f));
}

/** Blur disc as a fraction of the frame width (resolution independent). */
export const blurFraction = (focalMm: number, stop: number, focusM: number, objectM: number, g: Gate) => blurDiscMm(focalMm, stop, focusM, objectM) / g.widthMm;

/** Blur disc in multiples of the circle of confusion (≤ 1 reads as sharp). */
export const blurInCoc = (focalMm: number, stop: number, focusM: number, objectM: number, g: Gate) => blurDiscMm(focalMm, stop, focusM, objectM) / cocMm(g);

/** Background-blur description for copy and prompts, from the blur of the back of the set. */
export type DofClass = "deep" | "moderate" | "shallow" | "very-shallow";
export function classifyDof(backgroundBlurCoc: number): DofClass {
  if (backgroundBlurCoc <= 1.5) return "deep";
  if (backgroundBlurCoc <= 4) return "moderate";
  if (backgroundBlurCoc <= 16) return "shallow";
  return "very-shallow";
}

/** Third-stop T-stop scale from T1 to T22 (rounded the way lens barrels mark them). */
export const T_STOPS = [1, 1.1, 1.3, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22] as const;
export const FULL_STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22] as const;

export const formatStop = (t: number) => (t >= 10 ? t.toFixed(0) : Math.abs(t - Math.round(t)) < 0.05 ? t.toFixed(0) : t.toFixed(1));
export const formatFocal = (f: number) => (f >= 10 ? f.toFixed(0) : f.toFixed(1));
