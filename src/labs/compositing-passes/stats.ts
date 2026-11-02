import type { CompState } from './comp';

/**
 * Measurements on small display-space readbacks of the rebuild, the beauty and the ID matte
 * (RGBA bytes, same size). Pure, so the challenges and the difference meter are testable.
 */
export interface FrameStats {
  /** Mean absolute difference rebuild vs beauty, 0..1 of full scale. */
  diff: number;
  /** Matte-weighted mean display luma, rebuild and beauty. */
  charLuma: number;
  charLuma0: number;
  /** Matte-weighted blue ÷ red over the set, rebuild and beauty (above 1 reads cooler). */
  setCool: number;
  setCool0: number;
  /** Mean absolute change inside each matte. */
  charChange: number;
  setChange: number;
  skyChange: number;
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function frameStats(rebuild: ArrayLike<number>, beauty: ArrayLike<number>, id: ArrayLike<number>): FrameStats {
  let diff = 0, n = 0;
  const w = [0, 0, 0], change = [0, 0, 0];
  let cl = 0, cl0 = 0, sb = 0, sr = 0, sb0 = 0, sr0 = 0;
  for (let i = 0; i < rebuild.length; i += 4) {
    const r = rebuild[i] / 255, g = rebuild[i + 1] / 255, b = rebuild[i + 2] / 255;
    const r0 = beauty[i] / 255, g0 = beauty[i + 1] / 255, b0 = beauty[i + 2] / 255;
    const d = (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)) / 3;
    diff += d; n++;
    const m = [id[i] / 255, id[i + 1] / 255, id[i + 2] / 255];
    for (let k = 0; k < 3; k++) { w[k] += m[k]; change[k] += m[k] * d; }
    cl += m[0] * luma(r, g, b); cl0 += m[0] * luma(r0, g0, b0);
    sb += m[1] * b; sr += m[1] * r; sb0 += m[1] * b0; sr0 += m[1] * r0;
  }
  const safe = (a: number, b: number) => (b > 1e-6 ? a / b : 0);
  return {
    diff: safe(diff, n),
    charLuma: safe(cl, w[0]), charLuma0: safe(cl0, w[0]),
    setCool: safe(sb, sr), setCool0: safe(sb0, sr0),
    charChange: safe(change[0], w[0]), setChange: safe(change[1], w[1]), skyChange: safe(change[2], w[2]),
  };
}

export interface Check { label: string; ok: boolean }
export interface Challenge {
  id: string;
  title: string;
  brief: string;
  /** Comp to start from (the broken comp for "fix it"). */
  start: Partial<CompState>;
  checks: (s: FrameStats, c: CompState, ctx: { resetUsed: boolean }) => Check[];
  insight: string;
}

/** A broken comp the student has to put back together by soloing passes. */
export const BROKEN: Partial<CompState> = { relight: -0.6, specGain: 1.6, emisGain: -2, shadowDensity: 0.35 };

const cool = (c: CompState) => c.shadowColor[2] > c.shadowColor[0] + 0.1;

export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'colder',
    title: 'Make the night colder without re-rendering',
    brief: 'The director wants a colder night, and there’s no time to re-render. Lift the shadows toward blue and cool the set, but keep the characters’ faces as bright as the render.',
    start: {},
    checks: (s, c) => [
      { label: 'Shadows lifted toward blue', ok: cool(c) && c.shadowLift >= 0.25 && c.shadowDensity >= 0.6 && c.breakMode === 'none' },
      { label: 'The set reads ≥ 12% cooler', ok: s.setCool >= s.setCool0 * 1.12 },
      { label: 'Characters within ±8% of the render', ok: s.charLuma0 > 0 && Math.abs(s.charLuma / s.charLuma0 - 1) <= 0.08 },
    ],
    insight: 'The shadow pass is a mask of where the key light is blocked, so you can colour exactly those pixels. The ID matte protects the faces. A re-render would have changed the lights and waited hours; the comp changed two numbers.',
  },
  {
    id: 'haze',
    title: 'Add haze that only touches the background',
    brief: 'Push the back wall and clock tower into the night with haze, without fogging Bram and Pip in the foreground.',
    start: {},
    checks: (s, c) => [
      { label: 'Haze from depth, not flat', ok: c.haze > 0.1 && c.breakMode === 'none' },
      { label: 'The set changes by ≥ 5%', ok: s.setChange >= 0.05 },
      { label: 'Characters change < 2%', ok: s.charChange < 0.02 },
    ],
    insight: 'The depth pass stores how far every pixel is from the lens, so haze can start at a distance: behind the characters, in front of the wall. A flat fog with no depth would grey everything equally.',
  },
  {
    id: 'fix',
    title: 'Fix the broken comp',
    brief: 'Someone left four passes at the wrong levels. Solo passes, compare against the render with the wipe, and put the comp back until the rebuild matches. Don’t use Reset.',
    start: BROKEN,
    checks: (s, _c, { resetUsed }) => [
      { label: 'Rebuild matches the render (Δ < 0.4%)', ok: s.diff < 0.004 },
      { label: 'Solved without Reset comp', ok: !resetUsed },
    ],
    insight: 'When the passes add back up to the beauty, you know every pass is present and at unit gain. That check is the first thing a compositor does with a new render, before any creative change.',
  },
];
