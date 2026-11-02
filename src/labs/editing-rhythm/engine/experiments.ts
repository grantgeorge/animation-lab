import { axisFrom, crossesAxis, reflectAcross, sideOf, type Axis } from "@/labs/shot-coverage/engine/axis";
import { runtime, withIds } from "./edit";
import { MARKS } from "./marks";
import { LAMPS_LIT, SLIP } from "./source";
import { SHOTS, type CamSpec } from "./shots";
import type { Clip, ShotId, V3 } from "./types";

/* ───────────────────────── Kuleshov ───────────────────────── */

export type KuleInsert = "box" | "gift" | "lantern";
export const KULE_INSERTS: readonly KuleInsert[] = ["box", "gift", "lantern"];
export const KULE_LABEL: Record<KuleInsert, string> = { box: "the glowing box", gift: "Pip offering a gift", lantern: "a fallen lantern" };
/** Readings audiences typically report for each pairing (the classic result; your answer may differ). */
export const KULE_READING: Record<KuleInsert, string> = { box: "dread, wariness", gift: "tenderness, being touched", lantern: "grief, concern" };
export const KULE_CHOICES = ["Fear", "Tenderness", "Sadness", "Curiosity", "Nothing"] as const;

/** Bram's neutral close-up: the SAME frames before and after every insert. */
export const KULE_FACE = { shot: "kNeutral" as ShotId, sourceIn: 1.0, duration: 2.8 };

export function kuleshovEdit(insert: KuleInsert): Clip[] {
  const mid: Omit<Clip, "id"> = insert === "box" ? { shot: "glow", sourceIn: 9.6, duration: 2.4 } : insert === "gift" ? { shot: "kGift", sourceIn: 2.0, duration: 2.4 } : { shot: "kLantern", sourceIn: 1.0, duration: 2.4 };
  return withIds([KULE_FACE, mid, KULE_FACE], "k");
}

/* ───────────────────────── Reaction shots ───────────────────────── */

export type ReactionOrder = "before" | "after";
/** The same three shots; only where the reaction sits around the event changes. */
export function reactionEdit(order: ReactionOrder): Clip[] {
  const est = { shot: "establish" as ShotId, sourceIn: 1.0, duration: 3.0 };
  const react = order === "before" ? { shot: "reaction" as ShotId, sourceIn: 7.0, duration: 3.0 } : { shot: "reaction" as ShotId, sourceIn: 14.5, duration: 3.0 };
  const event = { shot: "reveal" as ShotId, sourceIn: 14.3, duration: 3.0 };
  return withIds(order === "before" ? [est, react, event] : [est, event, react], "r");
}

/* ───────────────────────── Continuity (180° line) ───────────────────────── */

/** The axis of action between Bram and Pip on the floor plane. */
export const STAGE_AXIS: Axis = axisFrom([MARKS.bram.at[0], MARKS.bram.at[2]], [MARKS.pip.stepTo[0], MARKS.pip.stepTo[2]]);

/** Mirror a camera across the line (reusing the coverage lab's axis math). */
export function flipAcross(cam: CamSpec, axis: Axis = STAGE_AXIS): CamSpec {
  return { ...cam, position: reflectAcross(axis, cam.position), target: reflectAcross(axis, cam.target), push: 0 };
}

export type Look = "left" | "right";
/** Screen direction of a look from `from` toward `to`, as seen by a camera. */
export function screenDirection(cam: { position: V3; target: V3 }, from: V3, to: V3): Look {
  const fx = cam.target[0] - cam.position[0];
  const fz = cam.target[2] - cam.position[2];
  // camera right on the floor = forward × up
  const rx = -fz;
  const rz = fx;
  const dot = (to[0] - from[0]) * rx + (to[2] - from[2]) * rz;
  return dot >= 0 ? "right" : "left";
}

export interface EyelineReport {
  pipLooks: Look;
  bramLooks: Look;
  /** Do the two close-ups face each other across the cut? */
  matched: boolean;
  crossed: boolean;
  pipSide: -1 | 0 | 1;
  bramSide: -1 | 0 | 1;
}

const PIP_HEAD: V3 = [MARKS.pip.stepTo[0], 0.9, MARKS.pip.stepTo[2]];
const BRAM_HEAD: V3 = [MARKS.bram.at[0], 1.55, MARKS.bram.at[2]];

/** Eyeline check for the Pip close-up → Bram close-up cut. */
export function eyelines(pipCam: CamSpec, bramCam: CamSpec): EyelineReport {
  const pipLooks = screenDirection(pipCam, PIP_HEAD, BRAM_HEAD);
  const bramLooks = screenDirection(bramCam, BRAM_HEAD, PIP_HEAD);
  return {
    pipLooks,
    bramLooks,
    matched: pipLooks !== bramLooks,
    crossed: crossesAxis(STAGE_AXIS, pipCam.position, bramCam.position),
    pipSide: sideOf(STAGE_AXIS, pipCam.position),
    bramSide: sideOf(STAGE_AXIS, bramCam.position),
  };
}

/** Continuity sequence: Pip looks to Bram, Bram looks back (main reel, the exchange of looks). */
export function continuityEdit(): Clip[] {
  return withIds(
    [
      { shot: "establish", sourceIn: 9.6, duration: 2.0 },
      { shot: "hesitate", sourceIn: 10.8, duration: 1.8 },
      { shot: "reaction", sourceIn: 11.0, duration: 2.0 },
      { shot: "hesitate", sourceIn: 12.0, duration: 1.6 },
    ],
    "x",
  );
}

/** Camera overrides for the continuity experiment: the reaction camera jumped across the line. */
export function continuityCams(flipped: boolean): Partial<Record<ShotId, CamSpec>> {
  return flipped ? { reaction: flipAcross(SHOTS.reaction.cam) } : {};
}

/* ───────────────────────── J / L cuts ───────────────────────── */

/** Bram's worried close-up into the reveal; the split slides the sound edit around the picture cut. */
export function jlEdit(lead: number): Clip[] {
  const clips = withIds(
    [
      { shot: "reaction", sourceIn: 7.2, duration: 3.2 },
      { shot: "reveal", sourceIn: 15.2, duration: 3.4 },
    ],
    "j",
  );
  return [clips[0], { ...clips[1], audioLead: Math.max(-1.6, Math.min(1.6, lead)) }];
}
export const JL_RANGE = { min: -1.6, max: 1.6 };

/* ───────────────────────── Montage & compression ───────────────────────── */

export type MontageStyle = "realtime" | "jump" | "dissolve";
export const MONTAGE_LABEL: Record<MontageStyle, string> = { realtime: "Real time", jump: "Jump cuts", dissolve: "Dissolves" };

export function montageEdit(style: MontageStyle): Clip[] {
  if (style === "realtime") return withIds([{ shot: "mWide", sourceIn: 0, duration: 59.8 }], "m");
  const ins = [0.6, LAMPS_LIT[0] - 1.2, LAMPS_LIT[1] - 1.2, LAMPS_LIT[2] - 1.2, 57.4];
  const clips = withIds(ins.map((sourceIn) => ({ shot: "mWide" as ShotId, sourceIn, duration: 2.0 })), "m");
  return style === "dissolve" ? clips.map((c, i) => (i ? { ...c, dissolve: 0.6 } : c)) : clips;
}

/** Story time spanned (first in → last out in the source) ÷ screen time. */
export function compression(e: readonly Clip[]): { story: number; screen: number; ratio: number } {
  if (!e.length) return { story: 0, screen: 0, ratio: 1 };
  const first = e[0].sourceIn;
  const last = e[e.length - 1].sourceIn + e[e.length - 1].duration;
  const story = last - first;
  const screen = runtime(e);
  return { story: Math.round(story * 100) / 100, screen, ratio: Math.round((story / screen) * 100) / 100 };
}

/* ───────────────────────── Comedy timing ───────────────────────── */

/** The four gaps the comedy exercise controls (seconds). */
export interface ComedyGaps {
  /** How long we watch Bram's confident strut before the step. */
  setup: number;
  /** A peel insert before the step: the audience sees the danger first (0 = none). */
  anticipation: number;
  /** Frozen mid-slip, staring into the lens, before the fall (0 = instant). */
  hold: number;
  /** Seconds sitting still after landing before the tiny embarrassed reaction. */
  aftermath: number;
}
export type ComedyPreset = "instant" | "anticipation" | "hold" | "aftermath";
export const COMEDY_PRESETS: Record<ComedyPreset, { label: string; gaps: ComedyGaps; note: string }> = {
  instant: { label: "Instant slip", gaps: { setup: 1.6, anticipation: 0, hold: 0, aftermath: 0.3 }, note: "No warning, no pause: a sudden physical surprise." },
  anticipation: { label: "Long anticipation", gaps: { setup: 1.4, anticipation: 2.2, hold: 0, aftermath: 0.5 }, note: "We see the peel before he does. The laugh comes from waiting for the inevitable." },
  hold: { label: "Reaction hold", gaps: { setup: 1.4, anticipation: 0, hold: 2.4, aftermath: 0.4 }, note: "He freezes and stares at us before falling: he knows, we know, and the pause is the joke." },
  aftermath: { label: "Delayed aftermath", gaps: { setup: 1.4, anticipation: 0, hold: 0, aftermath: 2.4 }, note: "He lands, nothing happens… then a tiny embarrassed reaction. The silence does the work." },
};
export const COMEDY_RANGE: Record<keyof ComedyGaps, [number, number]> = { setup: [0.6, 2.6], anticipation: [0, 2.8], hold: [0, 2.9], aftermath: [0, 2.8] };

/**
 * Build the comedy edit from the gaps. The fall itself is staged on a CUT-AWAY (the peel spins
 * through frame while we hear the landing): the rig can't take a convincing pratfall, and the cut-away
 * is the classic editing answer anyway.
 */
export function comedyEdit(g: ComedyGaps): Clip[] {
  const setup = Math.min(Math.max(g.setup, COMEDY_RANGE.setup[0]), COMEDY_RANGE.setup[1]);
  const ant = Math.min(Math.max(g.anticipation, 0), COMEDY_RANGE.anticipation[1]);
  const hold = Math.min(Math.max(g.hold, 0), COMEDY_RANGE.hold[1]);
  const after = Math.min(Math.max(g.aftermath, 0), COMEDY_RANGE.aftermath[1]);
  const out: Omit<Clip, "id">[] = [];
  const skidEnd = SLIP.skid[1];
  if (ant > 0.05) {
    // wide strut → the peel, seen before Bram sees it → back to the wide for the step
    const back = SLIP.step - 0.4;
    out.push({ shot: "cWide", sourceIn: back - ant - setup, duration: setup });
    out.push({ shot: "cPeel", sourceIn: back - ant, duration: ant });
    out.push({ shot: "cWide", sourceIn: back, duration: skidEnd - back });
  } else {
    out.push({ shot: "cWide", sourceIn: SLIP.step - setup, duration: setup + (skidEnd - SLIP.step) });
  }
  if (hold > 0.05) out.push({ shot: "cFace", sourceIn: SLIP.stare[0], duration: hold });
  out.push({ shot: "cAway", sourceIn: SLIP.fall[0] - 0.1, duration: 0.95 });
  out.push({ shot: "cWide", sourceIn: Math.max(SLIP.sitFrom, SLIP.embarrassed - after), duration: Math.min(after, SLIP.embarrassed - SLIP.sitFrom) + 1.9 });
  return withIds(out.map((c) => ({ ...c, duration: Math.round(c.duration * 1000) / 1000, sourceIn: Math.round(c.sourceIn * 1000) / 1000 })), "s");
}

/** Record times of the comedy beats in an edit built by comedyEdit: when the step, fall and reaction land. */
export function comedyBeats(g: ComedyGaps): { step: number; fall: number; reaction: number; runtime: number; gaps: ComedyGaps } {
  const e = comedyEdit(g);
  let t = 0;
  let step = 0;
  let fall = 0;
  let reaction = 0;
  for (const c of e) {
    const inside = (x: number) => x >= c.sourceIn - 1e-6 && x < c.sourceIn + c.duration - 1e-6;
    if (c.shot === "cWide" && inside(SLIP.step)) step = t + (SLIP.step - c.sourceIn);
    if (c.shot === "cAway") fall = t + (SLIP.land - c.sourceIn);
    if (c.shot === "cWide" && inside(SLIP.embarrassed)) reaction = t + (SLIP.embarrassed - c.sourceIn);
    t += c.duration;
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return { step: r(step), fall: r(fall), reaction: r(reaction), runtime: r(t), gaps: g };
}
