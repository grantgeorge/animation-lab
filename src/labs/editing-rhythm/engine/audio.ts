import { starts, runtime } from "./edit";
import { BEATS, LAMPS_LIT, SLIP, boxGlow } from "./source";
import { SHOTS } from "./shots";
import type { Clip, Edit, ReelId } from "./types";

/** Procedural sound effects (synthesised in the browser; see audio/synth.ts). */
export type SfxKind = "step" | "creak" | "gasp" | "breath" | "sting" | "thud" | "whistleUp" | "whistleDown" | "bonk" | "shimmer" | "ignite";

/** A sound recorded with the performance: it belongs to a reel at a source time, like the picture. */
export interface SfxEvent {
  reel: ReelId;
  t: number;
  kind: SfxKind;
  gain: number;
  label: string;
}

const ev = (reel: ReelId, t: number, kind: SfxKind, label: string, gain = 1): SfxEvent => ({ reel, t, kind, gain, label });

/** Every sound in the source, in reel-local seconds. */
export const SFX: readonly SfxEvent[] = [
  // the box scene
  ev("main", 2.25, "step", "Pip's step", 0.6),
  ev("main", 2.85, "step", "Pip's step", 0.5),
  ev("main", BEATS.bramNotices + 0.2, "gasp", "Bram's sharp breath", 0.8),
  ev("main", BEATS.lidCrack, "creak", "the lid creaks", 0.9),
  ev("main", 10.15, "breath", "Pip's held breath", 0.55),
  ev("main", 10.95, "breath", "Bram's pleading breath", 0.7),
  ev("main", 13.1, "step", "Pip's quick step", 0.7),
  ev("main", 13.85, "creak", "the lid rattles", 0.5),
  ev("main", BEATS.reveal, "sting", "the burst of light", 1),
  ev("main", BEATS.reveal + 0.08, "gasp", "Bram's gasp", 0.9),
  ev("main", 15.08, "thud", "Bram lands", 0.5),
  ...[15.4, 16.1, 16.9, 17.6, 18.5, 19.3, 20.2].map((t, i) => ev("main", t, "shimmer", "moths flutter", 0.45 - i * 0.03)),
  // the Kuleshov plates: room tone only (silence is part of the experiment)
  // the banana peel
  ...Array.from({ length: 11 }, (_, i) => 0.55 + i * 0.5).map((t) => ev("slip", t, "step", "confident step", 0.75)),
  ev("slip", SLIP.step, "whistleUp", "slide whistle (skid)", 0.8),
  ev("slip", SLIP.fall[0], "whistleDown", "slide whistle (fall)", 0.85),
  ev("slip", SLIP.land, "thud", "the landing", 1),
  ev("slip", SLIP.land + 0.35, "bonk", "the peel lands", 0.7),
  ev("slip", SLIP.embarrassed + 0.15, "breath", "a tiny embarrassed sigh", 0.6),
  // the lamplighter montage
  ...LAMPS_LIT.flatMap((L, k) => [
    ...[-6.2, -5.4, -4.6, -3.8, -3.0, -2.2].map((d) => ev("mont", L + d, "step", "footsteps", 0.45)),
    ev("mont", L, "ignite", `lamp ${k + 1} catches`, 0.8),
  ]),
];

/** Continuous hum of the box at a source moment (0 outside the box scene). */
export const humAt = (reel: ReelId, local: number) => (reel === "main" ? Math.min(1.4, boxGlow(local)) : 0);

/** One clip's stretch of the audio track: record range plus its source mapping (into handles). */
export interface AudioSeg {
  index: number;
  clip: Clip;
  reel: ReelId;
  recStart: number;
  recEnd: number;
  /** Record start of the clip's PICTURE (source mapping anchor). */
  picStart: number;
}

/**
 * The audio edit. Each clip's sound is the same source as its picture, but the boundary between two
 * clips' sound is moved by the incoming clip's `audioLead`: J-cuts start the next sound early,
 * L-cuts let the previous sound run on.
 */
export function audioSegments(e: Edit): AudioSeg[] {
  const s = starts(e);
  const T = runtime(e);
  return e.map((c, i) => {
    const lead = i > 0 ? (c.audioLead ?? 0) : 0;
    const nextLead = i + 1 < e.length ? (e[i + 1].audioLead ?? 0) : 0;
    return { index: i, clip: c, reel: SHOTS[c.shot].reel, recStart: Math.max(0, s[i] - lead), recEnd: i + 1 < e.length ? s[i + 1] - nextLead : T, picStart: s[i] };
  });
}

/** Source time a segment plays at record time t. */
export const segLocal = (g: AudioSeg, t: number) => g.clip.sourceIn + (t - g.picStart);

export interface Audible {
  /** Record time the sound plays. */
  rec: number;
  kind: SfxKind;
  gain: number;
  label: string;
  /** Which clip's sound it is. */
  index: number;
  /** True when it plays over another clip's picture (a J or L overlap). */
  overPicture: boolean;
}

/** Every sound the audience hears in this edit, in record time. */
export function audibleEvents(e: Edit): Audible[] {
  const out: Audible[] = [];
  const s = starts(e);
  for (const g of audioSegments(e)) {
    const a = segLocal(g, g.recStart);
    const b = segLocal(g, g.recEnd);
    for (const x of SFX) {
      if (x.reel !== g.reel || x.t < a || x.t >= b) continue;
      const rec = g.picStart + (x.t - g.clip.sourceIn);
      const picEnd = s[g.index] + g.clip.duration;
      out.push({ rec: Math.round(rec * 1000) / 1000, kind: x.kind, gain: x.gain, label: x.label, index: g.index, overPicture: rec < s[g.index] || rec >= picEnd });
    }
  }
  return out.sort((p, q) => p.rec - q.rec);
}

/** The audio segment playing at record time t. */
export function audioSegAt(e: Edit, t: number): AudioSeg | null {
  const segs = audioSegments(e);
  for (const g of segs) if (t >= g.recStart && t < g.recEnd) return g;
  return segs.at(-1) ?? null;
}

/** Hum level heard at record time t (follows the AUDIO edit, not the picture). */
export function humLevel(e: Edit, t: number): number {
  const g = audioSegAt(e, t);
  return g ? humAt(g.reel, segLocal(g, t)) : 0;
}

/** Envelope for drawing the audio lane: n samples of the hum across the edit. */
export function humEnvelope(e: Edit, n = 160): number[] {
  const T = runtime(e);
  return Array.from({ length: n }, (_, i) => humLevel(e, ((i + 0.5) / n) * T));
}
