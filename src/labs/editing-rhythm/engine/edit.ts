import { REELS } from "./source";
import { SHOTS } from "./shots";
import type { Clip, Edit } from "./types";

/** Shortest clip the editor allows (seconds): about ten frames. */
export const MIN_CLIP = 0.4;
/** Longest single clip the duration slider offers (seconds). */
export const MAX_CLIP = 8;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export const reelLength = (c: Pick<Clip, "shot">) => REELS[SHOTS[c.shot].reel].length;

/** Unused media either side of the clip in its reel (the handles you can trim into). */
export function handles(c: Clip): { before: number; after: number } {
  return { before: r3(c.sourceIn), after: r3(reelLength(c) - c.sourceIn - c.duration) };
}

export const sourceOut = (c: Clip) => r3(c.sourceIn + c.duration);

/** Keep a clip inside its reel and at least MIN_CLIP long. */
export function clampClip(c: Clip): Clip {
  const L = reelLength(c);
  const duration = r3(Math.min(Math.max(c.duration, MIN_CLIP), L));
  const sourceIn = r3(Math.min(Math.max(c.sourceIn, 0), L - duration));
  return { ...c, sourceIn, duration };
}

export interface Stats {
  runtime: number;
  /** Average shot length (seconds). */
  asl: number;
  cuts: number;
  clips: number;
  shortest: number;
  longest: number;
}

export const runtime = (e: Edit) => r3(e.reduce((a, c) => a + c.duration, 0));

/** Record start of every clip (seconds from the head of the edit). */
export function starts(e: Edit): number[] {
  const out: number[] = [];
  let t = 0;
  for (const c of e) {
    out.push(r3(t));
    t += c.duration;
  }
  return out;
}

export function stats(e: Edit): Stats {
  const T = runtime(e);
  const n = e.length;
  return {
    runtime: T,
    asl: n ? r3(T / n) : 0,
    cuts: Math.max(0, n - 1),
    clips: n,
    shortest: n ? Math.min(...e.map((c) => c.duration)) : 0,
    longest: n ? Math.max(...e.map((c) => c.duration)) : 0,
  };
}

export interface At {
  index: number;
  clip: Clip;
  /** Record time the clip starts. */
  start: number;
  /** Reel-local source time on screen. */
  local: number;
}

/** What is on screen at record time t (clamped to the edit). */
export function clipAt(e: Edit, t: number): At | null {
  if (!e.length) return null;
  const s = starts(e);
  let i = e.length - 1;
  for (let k = 0; k < e.length; k++) {
    if (t < s[k] + e[k].duration) {
      i = k;
      break;
    }
  }
  const tt = Math.min(Math.max(t, 0), s[i] + e[i].duration);
  return { index: i, clip: e[i], start: s[i], local: e[i].sourceIn + (tt - s[i]) };
}

export interface Frame {
  a: At;
  /** During a dissolve: the other clip, its source time (into its handle), and its opacity 0..1. */
  b?: { index: number; clip: Clip; local: number; mix: number };
}

/**
 * The picture at record time t, including cross-dissolves: a dissolve of length D on clip i is
 * centred on its cut, so the outgoing clip plays D/2 into its tail handle and the incoming clip starts
 * D/2 early from its head handle.
 */
export function frameAt(e: Edit, t: number): Frame | null {
  const a = clipAt(e, t);
  if (!a) return null;
  const s = starts(e);
  const i = a.index;
  const next = e[i + 1];
  const cutOut = s[i] + e[i].duration;
  if (next?.dissolve && t > cutOut - next.dissolve / 2) {
    const mix = Math.min(1, (t - (cutOut - next.dissolve / 2)) / next.dissolve);
    return { a, b: { index: i + 1, clip: next, local: next.sourceIn + (t - cutOut), mix } };
  }
  const cur = e[i];
  if (cur.dissolve && i > 0 && t < s[i] + cur.dissolve / 2) {
    const prev = e[i - 1];
    const mix = Math.min(1, (t - (s[i] - cur.dissolve / 2)) / cur.dissolve);
    // the outgoing (previous) clip is the base; the current clip fades in over it
    const base: At = { index: i - 1, clip: prev, start: s[i - 1], local: prev.sourceIn + (t - s[i - 1]) };
    return { a: base, b: { index: i, clip: cur, local: a.local, mix } };
  }
  return { a };
}

/** Move a clip from one slot to another (drag to reorder). */
export function reorder(e: Edit, from: number, to: number): Clip[] {
  const out = [...e];
  if (from < 0 || from >= out.length) return out;
  const dest = Math.min(Math.max(to, 0), out.length - 1);
  const [c] = out.splice(from, 1);
  out.splice(dest, 0, c);
  return normalizeSplits(out);
}

/** Move earlier (−1) or later (+1) by one slot. */
export const moveClip = (e: Edit, index: number, dir: -1 | 1) => reorder(e, index, index + dir);

/** Change how long a clip plays, keeping its in-point; limited by its tail handle. */
export function setDuration(e: Edit, index: number, d: number): Clip[] {
  return e.map((c, i) => {
    if (i !== index) return c;
    const max = Math.min(MAX_CLIP, reelLength(c) - c.sourceIn);
    return { ...c, duration: r3(Math.min(Math.max(d, MIN_CLIP), max)) };
  });
}

/** Drag the head of a clip: moves the in-point, keeps the out-point. */
export function trimHead(e: Edit, index: number, newIn: number): Clip[] {
  return e.map((c, i) => {
    if (i !== index) return c;
    const out = c.sourceIn + c.duration;
    const sourceIn = r3(Math.min(Math.max(newIn, 0, out - MAX_CLIP), out - MIN_CLIP));
    return { ...c, sourceIn, duration: r3(out - sourceIn) };
  });
}

/** Drag the tail of a clip: moves the out-point. */
export const trimTail = (e: Edit, index: number, newOut: number) => setDuration(e, index, newOut - e[index].sourceIn);

/** Slip: move the in-point AND out-point together (same duration, different moment). */
export function slip(e: Edit, index: number, newIn: number): Clip[] {
  return e.map((c, i) => (i === index ? clampClip({ ...c, sourceIn: newIn }) : c));
}

/** Pacing: scale every clip's duration by `factor`, keeping in-points (each clip clamped to its handles). */
export function scaleTempo(e: Edit, factor: number): Clip[] {
  return e.map((c) => {
    const max = Math.min(MAX_CLIP, reelLength(c) - c.sourceIn);
    return { ...c, duration: r3(Math.min(Math.max(c.duration * factor, MIN_CLIP), max)) };
  });
}

/**
 * Limits for the split edit into clip i: a J-cut needs head handle on clip i and can't reach past the
 * start of the previous clip; an L-cut needs tail handle on clip i−1 and can't run past clip i's end.
 */
export function audioLeadRange(e: Edit, i: number): { min: number; max: number } {
  if (i <= 0 || i >= e.length) return { min: 0, max: 0 };
  const cur = e[i];
  const prev = e[i - 1];
  const max = Math.max(0, Math.min(cur.sourceIn, prev.duration - 0.1));
  const min = -Math.max(0, Math.min(handles(prev).after, cur.duration - 0.1));
  return { min: r3(min), max: r3(max) };
}

export function setAudioLead(e: Edit, index: number, lead: number): Clip[] {
  const { min, max } = audioLeadRange(e, index);
  return e.map((c, i) => (i === index ? { ...c, audioLead: r3(Math.min(max, Math.max(min, lead))) } : c));
}

/** After a reorder, split edits may no longer fit their new neighbours: clamp them (the first has none). */
function normalizeSplits(e: Clip[]): Clip[] {
  let out = e.map((c, i) => (i === 0 && c.audioLead ? { ...c, audioLead: 0 } : c));
  for (let i = 1; i < out.length; i++) if (out[i].audioLead) out = setAudioLead(out, i, out[i].audioLead!);
  return out;
}

/** Shallow structural equality (shot, in, duration, splits) – for "is this still the preset?". */
export function sameEdit(a: Edit, b: Edit): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => c.shot === b[i].shot && Math.abs(c.sourceIn - b[i].sourceIn) < 1e-3 && Math.abs(c.duration - b[i].duration) < 1e-3 && (c.audioLead ?? 0) === (b[i].audioLead ?? 0));
}

/** Fresh unique ids for a list of clips (presets are reused, edits must not share ids by accident). */
export function withIds(clips: readonly Omit<Clip, "id">[], prefix = "c"): Clip[] {
  return clips.map((c, i) => ({ ...c, id: `${prefix}${i + 1}` }));
}
