import { linearToOklab, toLinear, type RGB } from "./color";
import { NEUTRAL_GRADE, applyChain, resolveGrade, type GradeParams, type ResolvedGrade } from "./grade";

/**
 * Shot matching. A shot's "signature" is a handful of perceptual numbers (OKLab): brightness, colour
 * cast, contrast and saturation. What matters for cohesion is not that a night exterior and a lit
 * interior measure the same, but that every shot has been *treated* the same way, so the lab measures
 * each shot's change from its clean render and reports how much those changes disagree across shots.
 */

/** [mean L, mean a, mean b, std L, mean chroma]. */
export type Signature = [number, number, number, number, number];

/** Feature weights: a cast of 0.02 in a/b is as visible as 0.04 of lightness. */
export const SIG_WEIGHTS: Signature = [1, 2, 2, 1.5, 2];

/** Pixels as a flat Float32Array of encoded RGB triples. */
export type Pixels = Float32Array;

export function signature(px: Pixels): Signature {
  const n = px.length / 3;
  let L = 0, a = 0, b = 0, L2 = 0, C = 0;
  for (let i = 0; i < px.length; i += 3) {
    const lab = linearToOklab([toLinear(px[i]), toLinear(px[i + 1]), toLinear(px[i + 2])]);
    L += lab[0]; a += lab[1]; b += lab[2]; L2 += lab[0] * lab[0];
    C += Math.hypot(lab[1], lab[2]);
  }
  const mL = L / n;
  return [mL, a / n, b / n, Math.sqrt(Math.max(0, L2 / n - mL * mL)), C / n];
}

export function processPixels(px: Pixels, chain: readonly ResolvedGrade[]): Pixels {
  const out = new Float32Array(px.length);
  const c: RGB = [0, 0, 0];
  for (let i = 0; i < px.length; i += 3) {
    c[0] = px[i]; c[1] = px[i + 1]; c[2] = px[i + 2];
    const v = applyChain(c, chain);
    out[i] = v[0]; out[i + 1] = v[1]; out[i + 2] = v[2];
  }
  return out;
}

export const sigDelta = (a: Signature, b: Signature): Signature => a.map((v, i) => v - b[i]) as Signature;
export const sigDistance = (a: Signature, b: Signature) => Math.sqrt(a.reduce((s, v, i) => s + (SIG_WEIGHTS[i] * (v - b[i])) ** 2, 0));

/**
 * Cross-shot mismatch: the mean pairwise distance between the shots' treatments (each shot's
 * signature change from its clean render). 0 means every shot was treated identically.
 */
export function mismatch(deltas: readonly Signature[]): number {
  let s = 0, n = 0;
  for (let i = 0; i < deltas.length; i++)
    for (let j = i + 1; j < deltas.length; j++) {
      s += sigDistance(deltas[i], deltas[j]);
      n++;
    }
  return n ? s / n : 0;
}

/** The balancing controls auto-match is allowed to move. */
export type MatchParams = Pick<GradeParams, "exposure" | "temperature" | "tint" | "contrast" | "saturation">;
export const NEUTRAL_MATCH: MatchParams = { exposure: 0, temperature: 0, tint: 0, contrast: 1, saturation: 1 };
export const matchToGrade = (m: MatchParams): GradeParams => ({ ...NEUTRAL_GRADE, ...m });

const RANGES: Record<keyof MatchParams, [number, number, number]> = {
  // [min, max, initial step]
  exposure: [-3, 3, 0.5],
  temperature: [-1, 1, 0.3],
  tint: [-1, 1, 0.3],
  contrast: [0.4, 2.5, 0.25],
  saturation: [0, 2.5, 0.25],
};

function subsample(px: Pixels, max = 1600): Pixels {
  const n = px.length / 3;
  if (n <= max) return px;
  const step = n / max;
  const out = new Float32Array(max * 3);
  for (let k = 0; k < max; k++) {
    const i = Math.floor(k * step) * 3;
    out[k * 3] = px[i]; out[k * 3 + 1] = px[i + 1]; out[k * 3 + 2] = px[i + 2];
  }
  return out;
}

/**
 * Auto-balance: find the balancing grade that brings a drifted clip's signature back to a reference
 * signature (here, the clean render: a best case a real colorist approximates with a grey card, skin
 * tone or hero shot). Coordinate descent with step halving: a few hundred evaluations on ~1600 pixels.
 */
export function autoMatch(source: Pixels, reference: Signature, iterations = 7): MatchParams {
  const px = subsample(source);
  const m: MatchParams = { ...NEUTRAL_MATCH };
  const cost = (p: MatchParams) => sigDistance(signature(processPixels(px, [resolveGrade(matchToGrade(p))])), reference);
  let best = cost(m);
  const keys = Object.keys(RANGES) as (keyof MatchParams)[];
  const step = Object.fromEntries(keys.map((k) => [k, RANGES[k][2]])) as Record<keyof MatchParams, number>;
  for (let it = 0; it < iterations; it++) {
    for (const k of keys) {
      for (let tries = 0; tries < 4; tries++) {
        let moved = false;
        for (const dir of [1, -1]) {
          const [lo, hi] = RANGES[k];
          const trial = { ...m, [k]: Math.min(hi, Math.max(lo, m[k] + dir * step[k])) };
          const c = cost(trial);
          if (c < best - 1e-6) {
            best = c;
            Object.assign(m, trial);
            moved = true;
            break;
          }
        }
        if (!moved) break;
      }
      step[k] *= 0.55;
    }
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { exposure: round(m.exposure), temperature: round(m.temperature), tint: round(m.tint), contrast: round(m.contrast), saturation: round(m.saturation) };
}
