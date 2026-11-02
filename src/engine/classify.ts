export type ShotSize = "EWS" | "WS" | "FS" | "MS" | "MCU" | "CU" | "ECU";
export type LensClass = "ultra-wide" | "wide" | "moderate-wide" | "normal" | "portrait-tele" | "tele";
export type AngleClass = "eye-level" | "high" | "low" | "steep-high" | "steep-low";
export type PerspectiveClass = "deep" | "natural" | "compressed";

export const SHOT_SIZE_LABEL: Record<ShotSize, string> = {
  EWS: "Extreme wide shot",
  WS: "Wide shot",
  FS: "Full shot",
  MS: "Medium shot",
  MCU: "Medium close-up",
  CU: "Close-up",
  ECU: "Extreme close-up",
};

/** Upper bounds on p = full body height / frame height. One table for chip, slider bands, prompt and export. */
export const SHOT_SIZE_BOUNDS: readonly (readonly [ShotSize, number])[] = [
  ["EWS", 0.3],
  ["WS", 0.65],
  ["FS", 1.15],
  ["MS", 2.0],
  ["MCU", 3.5],
  ["CU", 7],
  ["ECU", Infinity],
];

export function classifyShotSize(bodyFraction: number): ShotSize {
  for (const [size, upper] of SHOT_SIZE_BOUNDS) if (bodyFraction < upper) return size;
  return "ECU";
}

export function classifyLens(focalMm: number): LensClass {
  const f = Math.round(focalMm);
  if (f <= 20) return "ultra-wide";
  if (f <= 28) return "wide";
  if (f <= 42) return "moderate-wide";
  if (f <= 62) return "normal";
  if (f <= 105) return "portrait-tele";
  return "tele";
}

export const LENS_LABEL: Record<LensClass, string> = {
  "ultra-wide": "ultra-wide lens",
  wide: "wide-angle lens",
  "moderate-wide": "moderate wide lens",
  normal: "normal lens",
  "portrait-tele": "portrait telephoto",
  tele: "telephoto",
};

export const LENS_TITLE: Record<LensClass, string> = {
  "ultra-wide": "Ultra-wide",
  wide: "Wide angle",
  "moderate-wide": "Moderate wide",
  normal: "Normal",
  "portrait-tele": "Portrait telephoto",
  tele: "Telephoto",
};

/** Angle from the elevation of the line camera → target (position-based, like perspective). */
export function classifyAngle(elevationToTargetDeg: number): AngleClass {
  const e = elevationToTargetDeg;
  if (Math.abs(e) <= 5) return "eye-level";
  if (e < -25) return "steep-high";
  if (e < -5) return "high";
  if (e > 25) return "steep-low";
  return "low";
}

export const ANGLE_LABEL: Record<AngleClass, string> = {
  "eye-level": "eye level",
  high: "high angle",
  low: "low angle",
  "steep-high": "steep high angle",
  "steep-low": "steep low angle",
};

/** Perspective depends on camera position only: k = depth to subject / depth to the back wall. */
export function classifyPerspective(k: number, thresholds: { deep: number; compressed: number }): PerspectiveClass {
  if (k < thresholds.deep) return "deep";
  if (k > thresholds.compressed) return "compressed";
  return "natural";
}

export const PERSPECTIVE_LABEL: Record<PerspectiveClass, string> = {
  deep: "deep, exaggerated perspective",
  natural: "natural perspective",
  compressed: "compressed perspective",
};
