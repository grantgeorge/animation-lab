/**
 * Character Acting lab: an authored performance model.
 * Acting is keyed to WORDS (anchors), not to seconds, so one body performance can be retimed to any
 * voice take, which is how animators animate to a dialogue track.
 */

export const EMOTIONS = ["neutral", "excited", "sarcastic", "nervous", "frustrated", "disappointed"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export type EyeTarget = "partner" | "audience" | "down" | "away";

export interface Arm {
  up: number; // degrees from hanging; + raises outward
  fore: number; // degrees at the elbow; + bends outward/up, − across the body
  open: number; // 0 relaxed hand → 1 spread palm
  fist: number; // 0..1
}
export interface Pose {
  browInner: number; // −1 knit/angry … +1 worried/sad
  browRaise: number; // −1 low … +1 high
  browAsym: number; // + raises the left (screen-right) brow only
  lid: number; // − wide … 0 … + heavy/closing
  squint: number; // 0..1 lower lid up
  smile: number; // −1 frown … +1 smile
  smirk: number; // + left corner up, right corner down
  jaw: number; // extra open (gasp), added to lip sync
  gazeX: number; // −1 screen-left … +1 screen-right
  gazeY: number; // −1 up … +1 down
  headTilt: number; // degrees (roll)
  headTurn: number; // −1 … +1 (yaw, screen-right +)
  headNod: number; // −1 up … +1 down
  lean: number; // degrees, + forward
  slump: number; // 0..1
  shrug: number; // 0..1
  armL: Arm; // screen-left arm (Bram's right)
  armR: Arm; // screen-right arm (Bram's left)
  stretch: number; // squash/stretch on accents (broad acting)
}

const ARM0: Arm = { up: 8, fore: 12, open: 0, fist: 0 };
export const NEUTRAL: Pose = {
  browInner: 0, browRaise: 0, browAsym: 0, lid: 0, squint: 0, smile: 0.1, smirk: 0, jaw: 0,
  gazeX: 0, gazeY: 0, headTilt: 0, headTurn: 0, headNod: 0, lean: 0, slump: 0, shrug: 0,
  armL: ARM0, armR: ARM0, stretch: 0,
};

type Anchor = "pre" | "w0" | "w1" | "w2" | "w3" | "w3e" | "end";
type PosePatch = Partial<Omit<Pose, "armL" | "armR">> & { armL?: Partial<Arm>; armR?: Partial<Arm> };
export interface Key {
  at: Anchor;
  dt?: number; // seconds after the anchor
  pose: PosePatch;
}

/** Body parameters scaled by "gesture intensity"; everything else is "face". */
export const BODY_KEYS = new Set<keyof Pose>(["lean", "slump", "shrug", "armL", "armR", "headTurn", "headNod", "headTilt"]);

/**
 * Choreography per emotion. Each key is a held target the pose eases toward.
 * Comments say what an animator would be going for.
 */
export const PERFORMANCES: Record<Emotion, { keys: Key[]; blinks: { at: Anchor; dt: number }[]; note: string }> = {
  neutral: {
    note: "A baseline read: small nods on the stressed words, eyes on the listener, hands at rest.",
    keys: [
      { at: "pre", pose: {} },
      { at: "w0", pose: { browRaise: 0.15, headNod: 0.1 } },
      { at: "w3", pose: { browRaise: 0.1, headNod: 0.2 } },
      { at: "end", pose: { headNod: 0 } },
    ],
    blinks: [{ at: "pre", dt: 0.2 }, { at: "w3e", dt: 0.3 }],
  },
  excited: {
    note: "Anticipation first: a gasp and a lift before he speaks, a dip on “just”, then the big open release on “great”.",
    keys: [
      { at: "pre", pose: {} },
      { at: "pre", dt: 0.35, pose: { browRaise: 0.8, lid: -0.5, jaw: 0.35, lean: -4, shrug: 0.25, smile: 0.4, armL: { up: 25, fore: 30 }, armR: { up: 25, fore: 30 } } },
      { at: "w0", pose: { browRaise: 1, smile: 0.9, jaw: 0.15, headTilt: 6, armL: { up: 70, fore: 70, open: 1 }, armR: { up: 70, fore: 70, open: 1 } } },
      { at: "w2", pose: { lean: 5, shrug: 0, headNod: 0.25, stretch: -0.6, armL: { up: 35, fore: 60, open: 0.6 }, armR: { up: 35, fore: 60, open: 0.6 } } },
      { at: "w3", pose: { smile: 1, squint: 0.45, headNod: -0.35, lean: -6, stretch: 1, armL: { up: 140, fore: 25, open: 1 }, armR: { up: 140, fore: 25, open: 1 } } },
      { at: "w3e", dt: 0.25, pose: { stretch: 0, headNod: -0.15 } },
      { at: "end", pose: { smile: 0.9, squint: 0.3, lean: -2, armL: { up: 60, fore: 50, open: 0.8 }, armR: { up: 60, fore: 50, open: 0.8 } } },
    ],
    blinks: [{ at: "w1", dt: 0.05 }],
  },
  sarcastic: {
    note: "Sarcasm lives in contrast and timing: heavy lids and a lopsided smirk, a beat of stillness, an eye-roll before “great”, and a small flat “ta-da” hand.",
    keys: [
      { at: "pre", pose: { lid: 0.35, browAsym: 0.45, smirk: 0.25, headTilt: -4 } },
      { at: "w0", pose: { lid: 0.4, browRaise: 0.2, browAsym: 0.5, smirk: 0.3 } },
      { at: "w2", dt: 0.1, pose: { lid: 0.2, gazeY: -0.95, gazeX: -0.35, headTurn: -0.15, headNod: -0.2 } },
      { at: "w3", pose: { lid: 0.5, gazeY: 0, gazeX: 0, headTilt: -10, headTurn: 0, headNod: 0.1, smirk: 0.75, browAsym: 0.7, armR: { up: 38, fore: 60, open: 1 } } },
      { at: "w3e", dt: 0.3, pose: { smirk: 0.6, armR: { up: 30, fore: 50, open: 0.9 } } },
      { at: "end", pose: { lid: 0.45, smirk: 0.5, headTilt: -6, armR: { up: 8, fore: 12, open: 0 } } },
    ],
    blinks: [{ at: "w3e", dt: 0.45 }],
  },
  nervous: {
    note: "Thought made visible: worried brows, a tight smile, shoulders up, hands wringing and eyes that can't settle on the listener.",
    keys: [
      { at: "pre", pose: { browInner: 0.7, lid: -0.2, smile: 0.25, shrug: 0.5, gazeX: -0.6, armL: { up: -12, fore: -95, fist: 0.3 }, armR: { up: -12, fore: -95, fist: 0.3 } } },
      { at: "w0", pose: { gazeX: 0, headTilt: 4 } },
      { at: "w1", pose: { gazeX: -0.7, gazeY: 0.4, headTurn: -0.15 } },
      { at: "w2", pose: { gazeX: 0.1, gazeY: 0, headTurn: 0.05, shrug: 0.65 } },
      { at: "w3", pose: { browInner: 1, shrug: 0.85, headTilt: 9, smile: 0.35, armL: { up: -8, fore: -105 }, armR: { up: -16, fore: -88 } } },
      { at: "w3e", dt: 0.2, pose: { gazeX: 0.6, gazeY: 0.5 } },
      { at: "end", pose: { lean: -3, shrug: 0.6, gazeX: -0.4, gazeY: 0.6, smile: 0.15 } },
    ],
    blinks: [{ at: "pre", dt: 0.15 }, { at: "w1", dt: 0.1 }, { at: "w3", dt: 0.35 }, { at: "end", dt: 0.3 }],
  },
  frustrated: {
    note: "Pressure building: knit brows, a forward lean and fists, a jab on “JUST”, hands thrown down on “great”, then hands on hips.",
    keys: [
      { at: "pre", pose: { browInner: -0.8, squint: 0.5, smile: -0.5, lean: 5, armL: { up: 18, fore: 75, fist: 0.9 }, armR: { up: 18, fore: 75, fist: 0.9 } } },
      { at: "w1", pose: { headNod: 0.2 } },
      { at: "w2", pose: { headNod: 0.45, jaw: 0.2, stretch: 0.6, armL: { up: 48, fore: 15, open: 0.9, fist: 0 }, armR: { up: 48, fore: 15, open: 0.9, fist: 0 } } },
      { at: "w3", pose: { browInner: -1, headNod: 0.1, headTurn: 0.3, stretch: 0, armL: { up: 14, fore: 4, open: 0.4 }, armR: { up: 14, fore: 4, open: 0.4 } } },
      { at: "w3e", pose: { headTurn: -0.3 } },
      { at: "end", pose: { headTurn: 0, headNod: 0.25, lid: 0.3, slump: 0.2, armL: { up: 45, fore: -105, open: 0, fist: 0.6 }, armR: { up: 45, fore: -105, open: 0, fist: 0.6 } } },
    ],
    blinks: [{ at: "w3e", dt: 0.1 }],
  },
  disappointed: {
    note: "Deflation: a sigh that lifts then drops the shoulders, eyes down, a half-hearted palms-up on “great” that gives up halfway.",
    keys: [
      { at: "pre", pose: { shrug: 0.45, browInner: 0.5 } },
      { at: "w0", pose: { shrug: 0, slump: 0.8, browInner: 0.8, lid: 0.4, smile: -0.6, gazeY: 0.7, headNod: 0.4, armL: { up: 3, fore: 2 }, armR: { up: 3, fore: 2 } } },
      { at: "w3", pose: { headTurn: 0.12, gazeY: 0.3, armL: { up: 26, fore: 42, open: 0.6 }, armR: { up: 26, fore: 42, open: 0.6 } } },
      { at: "w3e", dt: 0.25, pose: { headTurn: -0.1, armL: { up: 3, fore: 2, open: 0 }, armR: { up: 3, fore: 2, open: 0 } } },
      { at: "end", pose: { slump: 1, gazeY: 0.9, headNod: 0.55, headTurn: 0 } },
    ],
    blinks: [{ at: "w1", dt: 0.1 }, { at: "end", dt: 0.2 }],
  },
};

export interface Word {
  text: string;
  start: number;
  end: number;
}

export const LEAD_IN = 0.8; // seconds of acting before the first word
export const TAIL = 1.0; // seconds after the last word

/** Anchor times (on the performance clock) from a voice take's word timings. */
export function anchorsFor(words: Word[]): Record<Anchor, number> {
  const w = (i: number) => LEAD_IN + (words[i]?.start ?? 0);
  const last = words[words.length - 1];
  return { pre: 0, w0: w(0), w1: w(1), w2: w(2), w3: w(3), w3e: LEAD_IN + (words[3]?.end ?? last.end), end: LEAD_IN + last.end + 0.35 };
}
export const totalDuration = (words: Word[]) => LEAD_IN + words[words.length - 1].end + TAIL;

const EASE = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
/** How long the pose takes to arrive at each key (an animator would vary this; we keep it simple). */
const TRANSITION = 0.28;

function full(patch: PosePatch, base: Pose): Pose {
  return { ...base, ...patch, armL: { ...base.armL, ...patch.armL }, armR: { ...base.armR, ...patch.armR } } as Pose;
}
function lerpArm(a: Arm, b: Arm, u: number): Arm {
  return { up: a.up + (b.up - a.up) * u, fore: a.fore + (b.fore - a.fore) * u, open: a.open + (b.open - a.open) * u, fist: a.fist + (b.fist - a.fist) * u };
}
function lerpPose(a: Pose, b: Pose, u: number): Pose {
  const o = { ...a } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    if (k === "armL" || k === "armR") o[k] = lerpArm(a[k], b[k], u);
    else (o[k] as number) = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * u;
  }
  return o;
}

/** Resolve keys into absolute poses on the clock: each key accumulates on the previous. */
export function resolveKeys(emotion: Emotion, words: Word[]) {
  const A = anchorsFor(words);
  const keys = PERFORMANCES[emotion].keys.map((k) => ({ t: A[k.at] + (k.dt ?? 0), patch: k.pose })).sort((a, b) => a.t - b.t);
  let pose = NEUTRAL;
  return keys.map((k) => {
    pose = full(k.patch, pose);
    return { t: k.t, pose };
  });
}

export interface Direction {
  emotion: Emotion;
  exaggeration: number; // 0.4 subtle … 1.6 broad
  gesture: number; // 0.3 restrained … 1.6 theatrical
  eyes: EyeTarget;
}

const EYES: Record<EyeTarget, { x: number; y: number; turn: number }> = {
  partner: { x: 0.75, y: 0.35, turn: 0.18 },
  audience: { x: 0, y: 0, turn: 0 },
  down: { x: 0.1, y: 0.9, turn: 0 },
  away: { x: -0.85, y: -0.1, turn: -0.2 },
};

/** Scale a pose's deltas from neutral: face by exaggeration, body by exaggeration × gesture. */
export function direct(p: Pose, d: Direction): Pose {
  const o = { ...p } as Pose;
  for (const k of Object.keys(p) as (keyof Pose)[]) {
    const s = BODY_KEYS.has(k) ? d.exaggeration * d.gesture : d.exaggeration;
    if (k === "armL" || k === "armR") {
      const a = p[k];
      const n = NEUTRAL[k];
      o[k] = { up: n.up + (a.up - n.up) * s, fore: n.fore + (a.fore - n.fore) * s, open: Math.min(1, a.open * Math.min(1, s + 0.3)), fist: Math.min(1, a.fist * Math.min(1, s + 0.3)) };
    } else if (k === "stretch") {
      // squash and stretch only appears as acting gets broad
      o.stretch = p.stretch * Math.max(0, d.exaggeration - 0.8);
    } else {
      (o[k] as number) = (NEUTRAL[k] as number) + ((p[k] as number) - (NEUTRAL[k] as number)) * s;
    }
  }
  const eye = EYES[d.eyes];
  o.gazeX = clamp(o.gazeX + eye.x, -1, 1);
  o.gazeY = clamp(o.gazeY + eye.y, -1, 1);
  o.headTurn = clamp(o.headTurn + eye.turn, -1, 1);
  return o;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Sample the directed performance at time t (performance clock). */
export function samplePose(d: Direction, words: Word[], t: number): Pose {
  const keys = resolveKeys(d.emotion, words);
  let pose = NEUTRAL;
  for (const k of keys) {
    if (t < k.t) break;
    const u = Math.min(1, (t - k.t) / TRANSITION);
    pose = lerpPose(pose, k.pose, EASE(u));
  }
  return direct(pose, d);
}

/** Blink amount 0..1 at time t: authored blinks plus the emotion's own. */
export function blinkAt(emotion: Emotion, words: Word[], t: number) {
  const A = anchorsFor(words);
  for (const b of PERFORMANCES[emotion].blinks) {
    const bt = A[b.at] + b.dt;
    const u = (t - bt) / 0.14;
    if (u >= 0 && u <= 1) return Math.sin(u * Math.PI);
  }
  return 0;
}

/* ---------------- lip sync ---------------- */

export type VisemeId = "rest" | "A" | "E" | "O" | "M" | "F" | "L";
export const VISEME_SHAPES: Record<VisemeId, { open: number; wide: number; round: number }> = {
  rest: { open: 0, wide: 0, round: 0 },
  A: { open: 0.9, wide: 0.3, round: 0 },
  E: { open: 0.45, wide: 0.9, round: 0 },
  O: { open: 0.7, wide: -0.4, round: 1 },
  M: { open: 0, wide: 0.1, round: 0 },
  F: { open: 0.15, wide: 0.4, round: 0 },
  L: { open: 0.4, wide: 0.3, round: 0 },
};

/** Mouth shape at time s (seconds into the voice take), blending into each viseme over 50 ms. */
export function mouthAt(visemes: { t: number; v: string }[], s: number) {
  let i = -1;
  for (let k = 0; k < visemes.length; k++) if (visemes[k].t <= s) i = k;
  const cur = VISEME_SHAPES[(visemes[i]?.v as VisemeId) ?? "rest"] ?? VISEME_SHAPES.rest;
  const prev = VISEME_SHAPES[(visemes[i - 1]?.v as VisemeId) ?? "rest"] ?? VISEME_SHAPES.rest;
  const u = i < 0 ? 1 : Math.min(1, (s - visemes[i].t) / 0.05);
  return { open: prev.open + (cur.open - prev.open) * u, wide: prev.wide + (cur.wide - prev.wide) * u, round: prev.round + (cur.round - prev.round) * u };
}

export function envelopeAt(env: { hz: number; values: number[] }, s: number) {
  const i = Math.floor(s * env.hz);
  return i >= 0 && i < env.values.length ? env.values[i] : 0;
}
