import type { LookId } from "./looks";

/** The family presets the blind test draws from (the neutral control is left out). */
export const BLIND_POOL: readonly LookId[] = ["naturalistic", "large-format", "clean-hires", "film35", "film65", "action", "doc"];

/** Small deterministic PRNG (mulberry32) so a round number always gives the same line-up. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BlindRound {
  round: number;
  /** The look behind monitors A, B and C. */
  looks: [LookId, LookId, LookId];
}

/**
 * Three different looks for round n. Rounds alternate between a "close" line-up (three digital
 * cinema looks, the realistic case) and an "open" one drawn from the whole pool.
 */
export function blindRound(round: number): BlindRound {
  const r = rng(round * 7919 + 17);
  const pool = round % 2 === 0 ? ["naturalistic", "large-format", "clean-hires"] as LookId[] : [...BLIND_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { round, looks: [pool[0], pool[1], pool[2]] };
}

export type Guesses = [LookId | null, LookId | null, LookId | null];

export function scoreBlind(round: BlindRound, guesses: Guesses): { correct: number; total: 3; complete: boolean } {
  return { correct: round.looks.filter((l, i) => guesses[i] === l).length, total: 3, complete: guesses.every((g) => g !== null) };
}

/** Assign a guess to a monitor; a look can only be used once, so it is removed from any other monitor. */
export function assignGuess(guesses: Guesses, monitor: 0 | 1 | 2, look: LookId): Guesses {
  const next = guesses.map((g) => (g === look ? null : g)) as Guesses;
  next[monitor] = look;
  return next;
}
