import type { ReelId } from "./types";

/**
 * The master source timeline (seconds). Reels are separated by 2 s of dead time, where the cast and
 * props move between set-ups; no clip ever reads from a gap.
 */
export const REELS: Record<ReelId, { start: number; length: number; name: string; tape: string }> = {
  main: { start: 1, length: 22, name: "The glowing box", tape: "MAIN" },
  kule: { start: 25, length: 8, name: "Kuleshov plates", tape: "KULE" },
  slip: { start: 35, length: 16, name: "Banana peel", tape: "SLIP" },
  mont: { start: 53, length: 60, name: "Lamplighter (60 s)", tape: "MONT" },
};
export const SOURCE_END = 114;
export const FPS = 24;

/** Master source time of a reel-local time. */
export const masterT = (reel: ReelId, local: number) => REELS[reel].start + local;
/** Which reel (if any) a master time falls in, with its local time. */
export function reelAt(master: number): { reel: ReelId; local: number } | null {
  for (const id of Object.keys(REELS) as ReelId[]) {
    const r = REELS[id];
    if (master >= r.start - 0.25 && master <= r.start + r.length + 0.25) return { reel: id, local: master - r.start };
  }
  return null;
}

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/**
 * Story beats of the box scene (main-reel local seconds). These are the facts the explanation layer
 * reasons about, and the names the prompt writer uses.
 */
export const BEATS = {
  pipStep: [2.0, 3.1],
  reachStart: 4.5,
  reachFull: 7.0,
  bramNotices: 6.0,
  bramWorried: 6.5,
  waitHand: [7.2, 10.0],
  lidCrack: 9.3,
  hesitate: [10.0, 13.0],
  exchangeLook: [10.6, 12.2],
  lunge: [13.0, 14.2],
  touch: 14.2,
  reveal: 14.6,
  startle: [14.6, 15.4],
  moths: 14.8,
  relief: [16.5, 22],
} as const;

/** How strongly the box glows at main-local time t (0 dormant … 1 full, > 1 the burst). */
export function boxGlow(t: number): number {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const base = 0.12 + 0.05 * pulse;
  const wake = 0.42 * smooth(4.6, 7.0, t);
  const rise = 0.36 * smooth(7.6, 9.2, t) * (0.85 + 0.15 * Math.sin(t * 6.1));
  const breathe = -0.12 * smooth(12.2, 12.8, t) * (1 - smooth(13.2, 14.0, t));
  const touch = 0.18 * smooth(13.6, 14.3, t);
  const burst = 1.6 * smooth(14.5, 14.7, t) * (1 - smooth(14.8, 16.8, t));
  const settle = 0.25 * smooth(15.5, 17, t);
  return Math.max(0, base + wake + rise + breathe + touch + burst + settle);
}

/** Lid opening angle in degrees (0 shut, ~105 thrown open) at main-local time t. */
export function lidAngle(t: number): number {
  const crack = 9 * smooth(9.25, 9.45, t) * (1 - smooth(9.9, 10.5, t)) + 3 * smooth(10.2, 10.5, t) * (1 - smooth(14.25, 14.4, t));
  const rattle = t > 12.8 && t < 14.2 ? 2.5 * Math.abs(Math.sin(t * 31)) * smooth(12.8, 13.3, t) : 0;
  const open = 108 * smooth(14.3, 14.75, t);
  return Math.min(110, crack + rattle + open + (t > 14.75 ? -6 * Math.sin((t - 14.75) * 9) * Math.exp(-(t - 14.75) * 4) : 0));
}

/** 0..1 how far the moths have emerged (main-local). */
export const mothsOut = (t: number) => smooth(BEATS.moths, BEATS.moths + 1.2, t);

/** Main-local windows where something visibly moves: cutting inside one is "cutting on movement". */
export const MOVEMENT: readonly { from: number; to: number; what: string }[] = [
  { from: 2.0, to: 3.1, what: "Pip steps toward the box" },
  { from: 4.5, to: 5.6, what: "Pip's hand starts to reach" },
  { from: 6.0, to: 6.5, what: "Bram's head snaps round" },
  { from: 7.2, to: 7.8, what: "Bram's hand goes up" },
  { from: 10.0, to: 10.8, what: "Pip pulls his hand back" },
  { from: 10.6, to: 11.3, what: "Pip turns to Bram" },
  { from: 13.0, to: 14.3, what: "Pip lunges for the lid" },
  { from: 14.3, to: 15.4, what: "the lid flies open, Bram jumps" },
];

export function movementAt(t: number): string | null {
  for (const m of MOVEMENT) if (t >= m.from - 0.05 && t <= m.to + 0.05) return m.what;
  return null;
}

/** Montage reel: when each street lamp is lit (mont-local seconds). */
export const LAMPS_LIT = [6.5, 21.5, 36.5, 51.5] as const;
export const lampLevel = (k: number, t: number) => smooth(LAMPS_LIT[k], LAMPS_LIT[k] + 0.7, t);
/** Dusk light (1 = late golden dusk, 0 = full night) over the 60 s montage reel. */
export const duskLevel = (t: number) => 1 - smooth(0, 58, t);

/** Comedy reel beats (slip-local seconds). */
export const SLIP = {
  strutFrom: 0.2,
  step: 6.0,
  skid: [6.0, 6.4],
  stare: [6.4, 9.4],
  fall: [9.4, 9.85],
  land: 9.75,
  sitFrom: 10.1,
  embarrassed: 13.0,
  end: 15.5,
} as const;
