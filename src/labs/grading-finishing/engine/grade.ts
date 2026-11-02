import { LUMA, clamp01, lerp, luma, polarToWheel, smoothstep, toEncoded, toLinear, wheelOffset, type RGB } from "./color";
import { STOCKS, type StockId } from "./stocks";

/** A colour wheel: a push toward a hue (x, y inside the unit disc) plus a master level. */
export interface Wheel {
  x: number;
  y: number;
  m: number;
}

export interface SplitTone {
  shadowHue: number;
  shadowAmt: number;
  highlightHue: number;
  highlightAmt: number;
  /** −1 favours highlights, +1 favours shadows. */
  balance: number;
}

/** One grade layer, in the units the controls show. */
export interface GradeParams {
  /** Stops of exposure in linear light. */
  exposure: number;
  /** −1 cool … +1 warm. */
  temperature: number;
  /** −1 green … +1 magenta. */
  tint: number;
  /** Slope at the pivot; 1 is neutral. */
  contrast: number;
  /** The code value that contrast leaves fixed (0.46 ≈ 18 % grey). */
  pivot: number;
  saturation: number;
  lift: Wheel;
  gamma: Wheel;
  gain: Wheel;
  split: SplitTone;
  stock: StockId;
  /** 0 = stock off, 1 = full emulation. */
  stockMix: number;
}

export const ZERO_WHEEL: Wheel = { x: 0, y: 0, m: 0 };
export const NEUTRAL_SPLIT: SplitTone = { shadowHue: 195, shadowAmt: 0, highlightHue: 35, highlightAmt: 0, balance: 0 };
export const MID_GREY = toEncoded(0.18);

export const NEUTRAL_GRADE: GradeParams = {
  exposure: 0,
  temperature: 0,
  tint: 0,
  contrast: 1,
  pivot: 0.46,
  saturation: 1,
  lift: ZERO_WHEEL,
  gamma: ZERO_WHEEL,
  gain: ZERO_WHEEL,
  split: NEUTRAL_SPLIT,
  stock: "none",
  stockMix: 1,
};

/** Wheel scales: how far a full push moves each range. */
export const WHEEL_SCALE = { lift: 0.12, gamma: 0.4, gain: 0.35 } as const;
/** How far a full split-tone push offsets the code value. */
export const SPLIT_SCALE = 0.2;

/** Everything a grade layer resolves to: the numbers the shader reads. */
export interface ResolvedGrade {
  expGain: RGB;
  cross: number[];
  knee: number;
  chanGamma: RGB;
  contrast: number;
  pivot: number;
  lift: RGB;
  gamma: RGB;
  gain: RGB;
  splitS: RGB;
  splitH: RGB;
  splitCenter: number;
  saturation: number;
}

/**
 * White-balance gains in linear light. Temperature trades red against blue, tint trades green
 * against magenta; the gains are then normalised to unit luminance, so a grey keeps its brightness
 * and temperature = tint = 0 is exactly [1, 1, 1].
 */
export function whiteBalanceGains(temperature: number, tint: number): RGB {
  const g: RGB = [Math.exp(0.32 * temperature + 0.1 * tint), Math.exp(-0.2 * tint), Math.exp(-0.32 * temperature + 0.1 * tint)];
  const y = luma(g);
  return [g[0] / y, g[1] / y, g[2] / y];
}

const add = (a: RGB, b: RGB, s = 1): RGB => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

export function resolveGrade(p: GradeParams): ResolvedGrade {
  const st = STOCKS[p.stock] ?? STOCKS.none;
  const k = p.stock === "none" ? 0 : clamp01(p.stockMix);
  const wb = whiteBalanceGains(p.temperature, p.tint);
  const e = Math.pow(2, p.exposure);
  const cross = [1, 0, 0, 0, 1, 0, 0, 0, 1].map((v, i) => lerp(v, st.cross[i], k));
  const wheel = (w: Wheel, scale: number) => add([w.m, w.m, w.m], wheelOffset(w.x, w.y)).map((v) => v * scale) as RGB;
  const liftW = wheel(p.lift, WHEEL_SCALE.lift);
  const gammaW = wheel(p.gamma, WHEEL_SCALE.gamma);
  const gainW = wheel(p.gain, WHEEL_SCALE.gain);
  const toe = lerp(0, st.toe, k);
  const sS = wheelOffset(...polarToWheel(p.split.shadowHue, p.split.shadowAmt));
  const sH = wheelOffset(...polarToWheel(p.split.highlightHue, p.split.highlightAmt));
  const tS = wheelOffset(...polarToWheel(st.shadowTint[0], st.shadowTint[1] * k));
  const tH = wheelOffset(...polarToWheel(st.highlightTint[0], st.highlightTint[1] * k));
  return {
    expGain: [wb[0] * e, wb[1] * e, wb[2] * e],
    cross,
    knee: lerp(1, st.knee, k),
    chanGamma: [lerp(1, st.chanGamma[0], k), lerp(1, st.chanGamma[1], k), lerp(1, st.chanGamma[2], k)],
    contrast: Math.max(0.05, p.contrast * lerp(1, st.contrast, k)),
    pivot: Math.min(0.9, Math.max(0.1, p.pivot)),
    lift: [liftW[0] + toe, liftW[1] + toe, liftW[2] + toe],
    gamma: gammaW.map((v) => Math.max(0.2, 1 + v)) as RGB,
    gain: gainW.map((v) => Math.max(0, 1 + v)) as RGB,
    splitS: add(sS, tS).map((v) => v * SPLIT_SCALE) as RGB,
    splitH: add(sH, tH).map((v) => v * SPLIT_SCALE) as RGB,
    splitCenter: 0.5 + 0.3 * p.split.balance,
    saturation: Math.max(0, p.saturation * lerp(1, st.saturation, k)),
  };
}

/** Highlight shoulder in linear light: identity below the knee, an exponential approach to 1 above. */
export function rolloff(x: number, knee: number): number {
  if (knee >= 0.999 || x <= knee) return x;
  const w = 1 - knee;
  return knee + w * (1 - Math.exp(-(x - knee) / w));
}

/** Contrast as a power S-curve around the pivot: fixed point at the pivot, 0 → 0 and 1 → 1. */
export function contrastCurve(x: number, c: number, p: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x < p ? p * Math.pow(x / p, c) : 1 - (1 - p) * Math.pow((1 - x) / (1 - p), c);
}

/** Apply one resolved grade layer to an encoded colour. Mirrored exactly by `applyGrade` in GLSL. */
export function applyResolved(c: Readonly<RGB>, r: ResolvedGrade): RGB {
  // 1. Linear light: exposure and white balance are gains on light.
  const l0 = toLinear(c[0]) * r.expGain[0];
  const l1 = toLinear(c[1]) * r.expGain[1];
  const l2 = toLinear(c[2]) * r.expGain[2];
  // 2. Stock crosstalk (dye layers bleeding into each other).
  const m = r.cross;
  const x = [m[0] * l0 + m[1] * l1 + m[2] * l2, m[3] * l0 + m[4] * l1 + m[5] * l2, m[6] * l0 + m[7] * l1 + m[8] * l2];
  const out: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    // 3. Highlight shoulder, then back to code values (display-referred: anything over 1 clips).
    let v = toEncoded(clamp01(rolloff(Math.max(0, x[i]), r.knee)));
    // 4. Stock crossover, contrast around the pivot, lift / gamma / gain.
    v = Math.pow(v, r.chanGamma[i]);
    v = contrastCurve(v, r.contrast, r.pivot);
    v = Math.max(0, r.gain[i] * (v + r.lift[i] * (1 - v)));
    out[i] = Math.pow(v, 1 / r.gamma[i]);
  }
  // 5. Split-tone by code-value luma, then saturation around luma.
  const L = out[0] * LUMA[0] + out[1] * LUMA[1] + out[2] * LUMA[2];
  const t = smoothstep(r.splitCenter - 0.4, r.splitCenter + 0.4, L);
  for (let i = 0; i < 3; i++) out[i] += (1 - t) * r.splitS[i] + t * r.splitH[i];
  const L2 = out[0] * LUMA[0] + out[1] * LUMA[1] + out[2] * LUMA[2];
  return [clamp01(L2 + (out[0] - L2) * r.saturation), clamp01(L2 + (out[1] - L2) * r.saturation), clamp01(L2 + (out[2] - L2) * r.saturation)];
}

export const gradePixel = (c: Readonly<RGB>, p: GradeParams): RGB => applyResolved(c, resolveGrade(p));

/** Apply a chain of resolved layers in order (source drift → match → show look → override). */
export function applyChain(c: Readonly<RGB>, chain: readonly ResolvedGrade[]): RGB {
  let v: RGB = [c[0], c[1], c[2]];
  for (const r of chain) v = applyResolved(v, r);
  return v;
}

/** vec4s per grade layer in the shader's uniform array. */
export const GRADE_VEC4S = 10;

/** Pack a resolved layer into GRADE_VEC4S × 4 floats; the layout is read by `runtime/shaders.ts`. */
export function packGrade(r: ResolvedGrade, out: Float32Array, offset = 0): Float32Array {
  const v = [
    ...r.expGain, r.knee,
    r.cross[0], r.cross[1], r.cross[2], r.contrast,
    r.cross[3], r.cross[4], r.cross[5], r.pivot,
    r.cross[6], r.cross[7], r.cross[8], r.saturation,
    ...r.lift, r.splitCenter,
    ...r.gamma, 0,
    ...r.gain, 0,
    ...r.splitS, 0,
    ...r.splitH, 0,
    ...r.chanGamma, 0,
  ];
  out.set(v, offset);
  return out;
}

export const IDENTITY_RESOLVED = resolveGrade(NEUTRAL_GRADE);

/** Deep-ish merge for partial grade patches (wheels and split merge field by field). */
export function mergeGrade(base: GradeParams, patch: Partial<GradeParams> | undefined): GradeParams {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    lift: { ...base.lift, ...patch.lift },
    gamma: { ...base.gamma, ...patch.gamma },
    gain: { ...base.gain, ...patch.gain },
    split: { ...base.split, ...patch.split },
  };
}
