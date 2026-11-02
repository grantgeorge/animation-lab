/**
 * Sensor and film gates, in millimetres (the full recording area: open gate for digital, camera
 * aperture for film). Pure data; sources are listed per camera in cameras.ts and in
 * docs/labs/camera-families.md.
 */
export type FormatId =
  | "action"
  | "one-inch"
  | "s35-3perf"
  | "s35-4perf"
  | "alexa35"
  | "ff"
  | "vv"
  | "lf"
  | "65-5perf"
  | "alexa265"
  | "imax"
  | "venice"
  | "ursa-lf"
  | "phantom"
  | "small-360";

export interface Format {
  id: FormatId;
  /** Short label for chips and the gate diagram. */
  label: string;
  /** Family name used in prompts and copy. */
  family: "small" | "s35" | "ff" | "lf" | "65";
  widthMm: number;
  heightMm: number;
  /** True when the size is a nominal "type" designation rather than a measured active area. */
  nominal?: boolean;
  note?: string;
}

/** Full-frame reference width: every crop factor in the lab is a width ratio against 36 mm. */
export const FF_WIDTH_MM = 36;

export const FORMATS: Record<FormatId, Format> = {
  action: { id: "action", label: "Action cam 1/1.9″", family: "small", widthMm: 6.7, heightMm: 5.0, nominal: true, note: "1/1.9-inch type, nominal (retailer figure; GoPro doesn't publish the active area)" },
  "one-inch": { id: "one-inch", label: "1-inch type", family: "small", widthMm: 13.2, heightMm: 8.8, nominal: true, note: "1-inch type (nominal 13.2 × 8.8 mm)" },
  "s35-3perf": { id: "s35-3perf", label: "Super 35 3-perf", family: "s35", widthMm: 24.89, heightMm: 13.87 },
  "s35-4perf": { id: "s35-4perf", label: "Super 35 4-perf", family: "s35", widthMm: 24.89, heightMm: 18.66 },
  alexa35: { id: "alexa35", label: "Super 35 4.6K", family: "s35", widthMm: 27.99, heightMm: 19.22 },
  ff: { id: "ff", label: "Full frame", family: "ff", widthMm: 36, heightMm: 24, note: "nominal 36 × 24 mm" },
  vv: { id: "vv", label: "VistaVision (VV)", family: "lf", widthMm: 40.96, heightMm: 21.6 },
  lf: { id: "lf", label: "ARRI LF", family: "lf", widthMm: 36.7, heightMm: 25.54 },
  "65-5perf": { id: "65-5perf", label: "65 mm 5-perf", family: "65", widthMm: 52.48, heightMm: 23.01 },
  alexa265: { id: "alexa265", label: "65 mm digital", family: "65", widthMm: 54.12, heightMm: 25.58 },
  imax: { id: "imax", label: "IMAX 15/70", family: "65", widthMm: 70.41, heightMm: 51.61, note: "SMPTE ST 417 camera aperture; other references give 52.6 mm high" },
  venice: { id: "venice", label: "Full frame 8.6K", family: "ff", widthMm: 35.9, heightMm: 24 },
  "ursa-lf": { id: "ursa-lf", label: "Blackmagic LF", family: "ff", widthMm: 35.64, heightMm: 23.32 },
  phantom: { id: "phantom", label: "Phantom 4K (S35)", family: "s35", widthMm: 27.6, heightMm: 15.5 },
  "small-360": { id: "small-360", label: "1/2.3″ (per lens)", family: "small", widthMm: 6.17, heightMm: 4.55, nominal: true, note: "1/2.3-inch type, nominal; one of six lenses" },
};

/** The outlines drawn in the nested gate diagram, largest first. */
export const DIAGRAM_FORMATS: readonly FormatId[] = ["imax", "alexa265", "65-5perf", "vv", "lf", "ff", "alexa35", "s35-3perf", "one-inch", "action"];

/** The delivery frame: every format is shown as a 16:9 extraction across its full width. */
export const DELIVERY_ASPECT = 16 / 9;

export interface Gate {
  widthMm: number;
  heightMm: number;
}

/** The 16:9 area extracted across the full gate width (what the shot monitor shows by default). */
export const extraction = (f: Gate, aspect = DELIVERY_ASPECT): Gate => ({ widthMm: f.widthMm, heightMm: f.widthMm / aspect });

/** The gate the shot is rendered through: the 16:9 extraction, or the whole open gate. */
export const shotGate = (f: Gate, openGate: boolean): Gate => (openGate ? { widthMm: f.widthMm, heightMm: f.heightMm } : extraction(f));

/** Horizontal crop factor against full frame (36 mm wide). Matching widths keeps the horizontal FOV. */
export const cropFactor = (f: Gate) => FF_WIDTH_MM / f.widthMm;

export const diagonalMm = (f: Gate) => Math.hypot(f.widthMm, f.heightMm);

/**
 * Format-scaled circle of confusion: frame width ÷ 1200 (0.030 mm on full frame, 0.021 mm on
 * Super 35). Scaling with the width keeps the "acceptably sharp" limit the same fraction of the
 * delivered picture on every format, which is what makes the equivalence exact.
 */
export const COC_DIVISOR = 1200;
export const cocMm = (f: Gate) => f.widthMm / COC_DIVISOR;
