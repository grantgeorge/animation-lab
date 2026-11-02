/**
 * Image-rendering "looks": a characteristic curve (scene stops → display value) plus colour,
 * grain and halation. These are artistic approximations written for this lab. They are not, and
 * do not claim to be, any manufacturer's colour science. Pure: the GLSL in runtime/shaders.ts
 * evaluates exactly `curveValue` with the uniforms from `curveUniforms`.
 */
export type LookId = "neutral" | "naturalistic" | "large-format" | "clean-hires" | "film35" | "film65" | "action" | "doc";

export interface Look {
  id: LookId;
  label: string;
  /** One-word family name used in the blind test reveal. */
  short: string;
  blurb: string;
  /** Prompt words for the colour and texture (the roll-off words come from `describeRollOff`). */
  prompt: string;
  /** Stops above 18 % grey where the sensor (or negative) saturates. */
  clipStops: number;
  /** Shoulder hardness: ~1.2 is a long film-like roll-off, ≥ 6 is a hard video clip. */
  shoulder: number;
  /** Toe hardness (same scale). */
  toe: number;
  /** Mid-grey contrast: display units per stop at 18 % grey (0.145 ≈ a plain sRGB gamma). */
  contrast: number;
  /** Display value of 18 % grey. */
  midGrey: number;
  /** Lifted black (display value). */
  black: number;
  saturation: number;
  /** + warms (amber), − cools (blue). */
  warmth: number;
  /** + green, − magenta. */
  tint: number;
  /** Channel crosstalk (film dye overlap): mutes and blends secondaries. */
  crosstalk: number;
  shadowTint: readonly [number, number, number];
  highlightTint: readonly [number, number, number];
  grain: number;
  /** Grain size in pixels at 1080 lines. */
  grainSize: number;
  /** Colour (digital) noise instead of luminance (film) grain. */
  chromaNoise: boolean;
  halation: number;
  bloom: number;
  /** + sharpens, − softens. */
  sharpen: number;
  vignette: number;
  /** Gate weave in pixels at 1080 lines. */
  weave: number;
}

const base = {
  clipStops: 7,
  shoulder: 2.2,
  toe: 1.8,
  contrast: 0.145,
  midGrey: 0.44,
  black: 0,
  saturation: 1,
  warmth: 0,
  tint: 0,
  crosstalk: 0,
  shadowTint: [0, 0, 0] as const,
  highlightTint: [0, 0, 0] as const,
  grain: 0,
  grainSize: 1,
  chromaNoise: false,
  halation: 0,
  bloom: 0,
  sharpen: 0,
  vignette: 0,
  weave: 0,
};

export const LOOKS: Record<LookId, Look> = {
  neutral: { ...base, id: "neutral", label: "Neutral reference", short: "Neutral", blurb: "A plain display curve with no colour opinion. Use it as the control.", prompt: "neutral color" },
  naturalistic: {
    ...base,
    id: "naturalistic",
    label: "Naturalistic digital cinema (ARRI-style)",
    short: "Naturalistic",
    blurb: "Long, gentle highlight roll-off, soft contrast, slightly warm skin, restrained saturation.",
    prompt: "naturalistic color and skin tones",
    clipStops: 7.6,
    shoulder: 1.45,
    toe: 1.7,
    contrast: 0.138,
    midGrey: 0.435,
    black: 0.006,
    saturation: 0.95,
    warmth: 0.035,
    crosstalk: 0.06,
    highlightTint: [0.012, 0.004, -0.01],
    grain: 0.01,
    bloom: 0.025,
    vignette: 0.1,
  },
  "large-format": {
    ...base,
    id: "large-format",
    label: "Large-format epic",
    short: "Large format",
    blurb: "Clean, rich and open: low contrast, deep blacks, a little bloom around the practicals.",
    prompt: "rich gentle contrast, clean deep blacks",
    clipStops: 7.6,
    shoulder: 1.6,
    toe: 2,
    contrast: 0.134,
    midGrey: 0.44,
    saturation: 1.03,
    warmth: 0.02,
    crosstalk: 0.03,
    shadowTint: [-0.006, 0, 0.01],
    grain: 0.006,
    grainSize: 0.8,
    bloom: 0.06,
    sharpen: 0.08,
    vignette: 0.16,
  },
  "clean-hires": {
    ...base,
    id: "clean-hires",
    label: "Clean high-resolution (RED-style)",
    short: "Clean hi-res",
    blurb: "Crisp detail, neutral-cool balance, a slightly firmer curve and saturated colour.",
    prompt: "crisp clean high-resolution detail, neutral color, firm contrast",
    clipStops: 7,
    shoulder: 2.5,
    toe: 2.3,
    contrast: 0.155,
    midGrey: 0.445,
    saturation: 1.07,
    warmth: -0.012,
    sharpen: 0.38,
    vignette: 0.04,
  },
  film35: {
    ...base,
    id: "film35",
    label: "Vintage 35 mm film",
    short: "35 mm film",
    blurb: "Visible grain, halation around lamps, lifted blacks, muted warm-green colour and a very long shoulder.",
    prompt: "vintage film texture with visible grain, halation around highlights, faded blacks, muted warm color",
    clipStops: 10,
    shoulder: 1.15,
    toe: 1.3,
    contrast: 0.15,
    midGrey: 0.43,
    black: 0.038,
    saturation: 0.84,
    warmth: 0.05,
    tint: 0.018,
    crosstalk: 0.13,
    shadowTint: [-0.012, 0.006, 0.012],
    highlightTint: [0.02, 0.008, -0.016],
    grain: 0.055,
    grainSize: 1.5,
    halation: 0.5,
    bloom: 0.04,
    sharpen: -0.3,
    vignette: 0.3,
    weave: 0.7,
  },
  film65: {
    ...base,
    id: "film65",
    label: "65 mm film",
    short: "65 mm film",
    blurb: "Fine grain, subtle halation and a long shoulder, with the clarity of a big negative.",
    prompt: "fine film grain, subtle halation, rich natural color",
    clipStops: 10,
    shoulder: 1.25,
    toe: 1.5,
    contrast: 0.15,
    midGrey: 0.44,
    black: 0.014,
    saturation: 0.98,
    warmth: 0.035,
    crosstalk: 0.08,
    highlightTint: [0.012, 0.004, -0.01],
    grain: 0.03,
    grainSize: 0.85,
    halation: 0.2,
    bloom: 0.03,
    sharpen: 0.04,
    vignette: 0.14,
    weave: 0.2,
  },
  action: {
    ...base,
    id: "action",
    label: "High-speed action",
    short: "Action",
    blurb: "Punchy contrast, hard shoulder (less highlight headroom), saturated, cool and sharp.",
    prompt: "punchy contrast, saturated color, crisp detail",
    clipStops: 5.2,
    shoulder: 3.6,
    toe: 2.6,
    contrast: 0.172,
    midGrey: 0.45,
    saturation: 1.13,
    warmth: -0.03,
    sharpen: 0.3,
    grain: 0.014,
    chromaNoise: true,
    vignette: 0.05,
  },
  doc: {
    ...base,
    id: "doc",
    label: "Doc / run-and-gun",
    short: "Doc",
    blurb: "A broadcast-style curve: bright mids, highlights that clip rather than roll, a little sensor noise.",
    prompt: "natural documentary video color, light sensor noise",
    clipStops: 5.5,
    shoulder: 6,
    toe: 2,
    contrast: 0.15,
    midGrey: 0.465,
    black: 0.01,
    saturation: 1,
    warmth: -0.02,
    sharpen: 0.15,
    grain: 0.02,
    chromaNoise: true,
  },
};

export const LOOK_ORDER: readonly LookId[] = ["neutral", "naturalistic", "large-format", "clean-hires", "film35", "film65", "action", "doc"];
export const isLookId = (v: unknown): v is LookId => typeof v === "string" && v in LOOKS;

/** Soft clip: g(a) = a / (1 + aᵖ)^(1/p). p → ∞ is a hard clip at 1; small p is a long roll-off. */
export const softClip = (a: number, p: number) => a / Math.pow(1 + Math.pow(a, p), 1 / p);

/**
 * The raw slope that, after the shoulder is normalised so sensor clip lands exactly on display
 * white, gives the look's mid-grey contrast. Solved by fixed-point iteration (monotone, converges fast).
 */
export function rawSlope(look: Pick<Look, "contrast" | "clipStops" | "shoulder" | "midGrey">) {
  const head = 1 - look.midGrey;
  let r = look.contrast;
  for (let i = 0; i < 40; i++) r = look.contrast * softClip((r * look.clipStops) / head, look.shoulder);
  return r;
}

export interface CurveUniforms {
  rawSlope: number;
  /** softClip(rawSlope · clip / head) — the shoulder normaliser. */
  shoulderNorm: number;
  clipStops: number;
  shoulder: number;
  toe: number;
  midGrey: number;
  black: number;
}

export function curveUniforms(look: Look): CurveUniforms {
  const r = rawSlope(look);
  return { rawSlope: r, shoulderNorm: softClip((r * look.clipStops) / (1 - look.midGrey), look.shoulder), clipStops: look.clipStops, shoulder: look.shoulder, toe: look.toe, midGrey: look.midGrey, black: look.black };
}

/**
 * The characteristic curve: exposure in stops relative to 18 % grey → display value [0, 1].
 * Above grey the soft clip is normalised so the sensor's saturation point maps to white; beyond it
 * everything is clipped (that is the camera's highlight limit). Below grey a toe runs into black.
 */
export function curveValue(u: CurveUniforms, stops: number): number {
  const s = Math.min(stops, u.clipStops);
  if (s >= 0) {
    const head = 1 - u.midGrey;
    return u.midGrey + (head * softClip((u.rawSlope * s) / head, u.shoulder)) / u.shoulderNorm;
  }
  const foot = u.midGrey - u.black;
  return u.midGrey - foot * softClip((u.rawSlope * -s) / u.shoulderNorm / foot, u.toe);
}

/** Display slope (per stop) at grey, for tests and the readout. */
export const midSlope = (u: CurveUniforms) => (curveValue(u, 0.01) - curveValue(u, -0.01)) / 0.02;

/** Where the curve reaches 98 % of white: the practical "usable highlight headroom" in stops. */
export function headroomStops(u: CurveUniforms): number {
  let lo = 0;
  let hi = u.clipStops;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (curveValue(u, m) < 0.98) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Roll-off words from the shoulder hardness. */
export function describeRollOff(look: Look): string {
  if (look.shoulder <= 1.3) return "very soft, film-like highlight roll-off";
  if (look.shoulder <= 2) return "soft highlight roll-off";
  if (look.shoulder <= 3) return "moderate highlight roll-off";
  return "hard highlight clipping";
}
