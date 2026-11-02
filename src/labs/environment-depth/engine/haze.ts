/**
 * Atmospheric (aerial) perspective. Light from a surface is attenuated by the air in front of it
 * (transmittance T) and replaced by scattered sky light: seen = local · T + haze · (1 − T).
 * Two layers of air: a thin uniform one (carries the distant ridges) and a dense ground mist whose
 * density falls off exponentially with height. The shader evaluates the same formula per pixel.
 */
export interface HazeParams {
  /** The cue strength, 0..1 (the "Atmospheric depth" slider). */
  amount: number;
  /** Uniform aerial density (1/m). */
  rhoA: number;
  /** Ground-mist density at y = 0 (1/m). */
  rhoH: number;
  /** Ground-mist scale height (m). */
  scaleH: number;
  /** The most the air can replace (keeps far ridges as faint silhouettes). */
  max: number;
}

export const HAZE: Omit<HazeParams, "amount"> = { rhoA: 0.0005, rhoH: 0.0085, scaleH: 28, max: 0.95 };

export const hazeParams = (amount: number): HazeParams => ({ ...HAZE, amount });

/**
 * Optical depth along a straight ray of length L from height y0 to height y1:
 * τ = amount · (ρa·L + ρh · ∫ e^(−y(s)/H) ds), with y linear along the ray.
 */
export function opticalDepth(y0: number, y1: number, L: number, p: HazeParams) {
  if (L <= 0 || p.amount <= 0) return 0;
  const dy = y1 - y0;
  const H = p.scaleH;
  let mist: number;
  if (Math.abs(dy) < 1e-3) mist = L * Math.exp(-y0 / H);
  else mist = ((L * H) / dy) * (Math.exp(-y0 / H) - Math.exp(-y1 / H));
  return p.amount * (p.rhoA * L + p.rhoH * mist);
}

/** How much of the scene's own light survives the air (1 = clear). */
export const transmittance = (y0: number, y1: number, L: number, p: HazeParams) => Math.exp(-opticalDepth(y0, y1, L, p));

/** How much haze colour replaces the surface (0 = none). */
export const hazeFactor = (y0: number, y1: number, L: number, p: HazeParams) => (1 - transmittance(y0, y1, L, p)) * p.max;

/**
 * Apparent contrast relative to local contrast. Two surfaces at the same distance keep only the
 * surviving fraction of their difference: (a − b)·(1 − f). The haze term adds to both and cancels.
 */
export const contrastAt = (y0: number, y1: number, L: number, p: HazeParams) => 1 - hazeFactor(y0, y1, L, p);

export type RGB = readonly [number, number, number];

export function applyHaze(local: RGB, haze: RGB, f: number): [number, number, number] {
  return [local[0] + (haze[0] - local[0]) * f, local[1] + (haze[1] - local[1]) * f, local[2] + (haze[2] - local[2]) * f];
}

/** Michelson contrast of two luminances. */
export const michelson = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-6, a + b);

/** Relative luminance of a linear RGB triple. */
export const luminance = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Samples for the haze-curve diagram: distances (log spaced) along a level ray at eye height. */
export function hazeCurve(p: HazeParams, eyeY: number, n = 64, d0 = 1, d1 = 3000) {
  const out: { d: number; t: number; f: number; contrast: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = d0 * (d1 / d0) ** (i / (n - 1));
    const f = hazeFactor(eyeY, eyeY, d, p);
    out.push({ d, t: transmittance(eyeY, eyeY, d, p), f, contrast: 1 - f });
  }
  return out;
}

export const HAZE_COLORS = {
  blue: { label: "Blue air", short: "Blue", hex: "#9db7d3" },
  gold: { label: "Morning gold", short: "Gold", hex: "#e3c796" },
  green: { label: "Green gloom", short: "Green", hex: "#86a28c" },
  violet: { label: "Dusk violet", short: "Violet", hex: "#a79ac6" },
} as const;
export type HazeColorId = keyof typeof HAZE_COLORS;

/** sRGB hex → linear RGB. */
export function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

/** Linear RGB → sRGB hex (for diagrams). */
export function linearToHex(c: RGB) {
  const ch = (v: number) => {
    const x = Math.max(0, Math.min(1, v));
    const s = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, "0");
  };
  return `#${ch(c[0])}${ch(c[1])}${ch(c[2])}`;
}
