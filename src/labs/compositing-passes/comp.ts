/**
 * The comp, renderer-free. Every pass value is linear light (scene-referred), exactly as the passes
 * are rendered. The composite shader in CompStage mirrors these functions line for line, and these
 * are the ones under test.
 *
 *   beauty = albedo × (diffuse light × shadow × AO) + specular + emission
 *
 * The shadow pass is the ratio of the lit diffuse pass with and without shadows, so at the default
 * comp the rebuild reproduces the rendered beauty exactly. AO is a utility pass: the beauty has none,
 * so it starts at strength 0 and adding it is a creative decision.
 */

export type Vec3 = [number, number, number];
export type BreakMode = 'none' | 'add' | 'aoAll' | 'flatFog' | 'depthKey' | 'hardMatte' | 'display';
export type MatteId = 'characters' | 'set' | 'sky';
export const MATTES: readonly MatteId[] = ['characters', 'set', 'sky'];

export interface CompState {
  /** Relight: exposure on the diffuse light pass alone, in stops. */
  relight: number;
  /** Warm (+) or cool (−) tint on the diffuse light pass. */
  lightWarmth: number;
  /** Gains, in stops. */
  specGain: number;
  emisGain: number;
  /** 1 = as rendered, 0 = no shadows. */
  shadowDensity: number;
  /** Colour the shadows lift toward (linear), and how far. 0 = black shadows, as rendered. */
  shadowColor: Vec3;
  shadowLift: number;
  /** AO strength, 0 = off (the beauty has no AO). */
  ao: number;
  /** Depth haze: amount, start distance (m) and colour (linear). */
  haze: number;
  hazeStart: number;
  hazeColor: Vec3;
  /** A grade isolated by an ID matte. */
  matte: MatteId;
  matteExposure: number;
  matteWarmth: number;
  breakMode: BreakMode;
}

export const DEFAULT_COMP: CompState = {
  relight: 0, lightWarmth: 0, specGain: 0, emisGain: 0,
  shadowDensity: 1, shadowColor: [0.05, 0.11, 0.32], shadowLift: 0,
  ao: 0, haze: 0, hazeStart: 6, hazeColor: [0.16, 0.2, 0.3],
  matte: 'characters', matteExposure: 0, matteWarmth: 0,
  breakMode: 'none',
};

/** Haze falls off over this distance (m) once it starts. */
export const HAZE_FALLOFF_M = 4;

/** One pixel of every pass. depth is the view distance in metres (Infinity where nothing was drawn). */
export interface PassPixel {
  albedo: Vec3;
  diffU: Vec3;
  diffS: Vec3;
  spec: Vec3;
  emis: Vec3;
  ao: number;
  depth: number;
  /** ID matte coverage: characters, set, sky. */
  id: Vec3;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const stops = (s: number) => 2 ** s;
/** A warm/cool tint that keeps green fixed. */
export const warmth = (w: number): Vec3 => [1 + 0.22 * w, 1, 1 - 0.22 * w];

/** The shadow pass: lit ÷ unshadowed, per channel; 1 where there is no direct light to shadow. */
export function shadowRatio(diffS: Vec3, diffU: Vec3): Vec3 {
  return diffS.map((s, i) => (diffU[i] > 1e-5 ? Math.min(1, s / diffU[i]) : 1)) as Vec3;
}

/** Haze amount (0..1) at a view distance. */
export function hazeAt(depth: number, amount: number, start: number, falloff = HAZE_FALLOFF_M): number {
  if (amount <= 0) return 0;
  const d = Number.isFinite(depth) ? depth : 1e4;
  return amount * (1 - Math.exp(-Math.max(0, d - start) / falloff));
}

/** IEC 61966-2-1 sRGB transfer, per channel. */
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** three.js ACESFilmicToneMapping (exposure 1), so the comp displays exactly as the other labs render. */
export function acesFilmic(c: Vec3): Vec3 {
  const x = c.map((v) => v / 0.6);
  const i = [
    0.59719 * x[0] + 0.35458 * x[1] + 0.04823 * x[2],
    0.076 * x[0] + 0.90834 * x[1] + 0.01566 * x[2],
    0.0284 * x[0] + 0.13383 * x[1] + 0.83777 * x[2],
  ];
  const f = i.map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081));
  const o = [
    1.60475 * f[0] - 0.53108 * f[1] - 0.07367 * f[2],
    -0.10208 * f[0] + 1.10813 * f[1] - 0.00605 * f[2],
    -0.00327 * f[0] - 0.07276 * f[1] + 1.07602 * f[2],
  ];
  return o.map((v) => Math.min(1, Math.max(0, v))) as Vec3;
}

/** Linear light → what the screen shows (0..1). */
export const display = (c: Vec3): Vec3 => acesFilmic(c).map(linearToSrgb) as Vec3;

/** The matte a grade uses: the ID pass, or one of the deliberate mistakes. */
export function matteWeight(p: Pick<PassPixel, 'id' | 'depth'>, c: Pick<CompState, 'matte' | 'breakMode'>, depthKeyM = 4.4): number {
  if (c.breakMode === 'depthKey') return p.depth < depthKeyM ? 1 : 0;
  const m = p.id[MATTES.indexOf(c.matte)];
  return c.breakMode === 'hardMatte' ? (m >= 0.5 ? 1 : 0) : m;
}

/** Rebuild one pixel from its passes. Returns linear light. */
export function compose(p: PassPixel, c: CompState): Vec3 {
  const tint = warmth(c.lightWarmth);
  const s = shadowRatio(p.diffS, p.diffU);
  const ao = mix(1, p.ao, c.ao);
  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const light = p.diffU[i] * stops(c.relight) * tint[i];
    const sh = mix(1, s[i], c.shadowDensity);
    const shadow = mix(c.shadowColor[i] * c.shadowLift, 1, sh);
    const lit = light * shadow * (c.breakMode === 'aoAll' ? 1 : ao);
    let diffuse: number;
    if (c.breakMode === 'add') diffuse = p.albedo[i] + lit;
    else if (c.breakMode === 'display') diffuse = srgbToLinear(Math.min(1, linearToSrgb(Math.min(1, p.albedo[i])) * linearToSrgb(Math.min(1, lit))));
    else diffuse = p.albedo[i] * lit;
    let v = diffuse + p.spec[i] * stops(c.specGain) + p.emis[i] * stops(c.emisGain);
    if (c.breakMode === 'aoAll') v *= ao;
    out[i] = v;
  }
  // Grade inside a matte, then haze by depth.
  const m = matteWeight(p, c);
  if (m > 0 && (c.matteExposure !== 0 || c.matteWarmth !== 0)) {
    const g = warmth(c.matteWarmth), e = stops(c.matteExposure);
    for (let i = 0; i < 3; i++) out[i] = mix(out[i], out[i] * e * g[i], m);
  }
  const f = c.breakMode === 'flatFog' ? c.haze * 0.6 : hazeAt(p.depth, c.haze, c.hazeStart);
  if (f > 0) for (let i = 0; i < 3; i++) out[i] = mix(out[i], c.hazeColor[i], f);
  return out;
}

/** What the renderer produced for the same pixel (the reference the rebuild should match). */
export function beauty(p: PassPixel): Vec3 {
  return [0, 1, 2].map((i) => p.albedo[i] * p.diffS[i] + p.spec[i] + p.emis[i]) as Vec3;
}

/** Each deliberate mistake needs a non-default control to show; picking it from the panel applies these. */
export const BREAK_SETUP: Record<Exclude<BreakMode, 'none'>, Partial<CompState>> = {
  add: {},
  aoAll: { ao: 0.9 },
  flatFog: { haze: 0.55 },
  depthKey: { matte: 'characters', matteExposure: 0.7, matteWarmth: 0.8 },
  hardMatte: { matte: 'characters', matteExposure: 0.9, matteWarmth: 1 },
  display: {},
};

export function isDefault(c: CompState): boolean {
  return JSON.stringify(c) === JSON.stringify(DEFAULT_COMP);
}
