import type { CamId, Cut, Edit } from "./types";

/** Shortest shot the editor allows, seconds (6 frames at 24 fps). */
export const MIN_SHOT = 0.25;
export const FPS = 24;

export const snapFrame = (t: number) => Math.round(t * FPS) / FPS;
const near = (a: number, b: number) => Math.abs(a - b) < 0.5 / FPS;

/** Sorted, first cut at 0, all cuts inside [0, T − MIN_SHOT], at least MIN_SHOT apart. */
export function normalize(edit: Edit, T: number): Cut[] {
  const sorted = [...edit].map((c) => ({ t: Math.min(Math.max(0, c.t), T - MIN_SHOT), cam: c.cam })).sort((a, b) => a.t - b.t);
  const out: Cut[] = [];
  for (const c of sorted) {
    const prev = out[out.length - 1];
    if (prev && c.t - prev.t < MIN_SHOT - 1e-9) {
      // Too close: the later cut wins the earlier slot (what you pressed last is what you meant).
      out[out.length - 1] = { t: prev.t, cam: c.cam };
      continue;
    }
    out.push(c);
  }
  if (!out.length) return [{ t: 0, cam: "A" }];
  out[0] = { t: 0, cam: out[0].cam };
  return out;
}

/** Index of the shot playing at time t. */
export function shotIndexAt(edit: Edit, t: number): number {
  let i = 0;
  for (let k = 1; k < edit.length; k++) if (edit[k].t <= t + 1e-9) i = k;
  return i;
}

export const cameraAt = (edit: Edit, t: number): CamId => edit[shotIndexAt(edit, t)]?.cam ?? "A";

export interface Segment {
  index: number;
  cam: CamId;
  t0: number;
  t1: number;
}

export function segments(edit: Edit, T: number): Segment[] {
  return edit.map((c, i) => ({ index: i, cam: c.cam, t0: c.t, t1: i + 1 < edit.length ? edit[i + 1].t : T }));
}

/**
 * Live switching: cut to `cam` at time t. Cutting to the camera already on air does nothing; a cut
 * within half a frame of an existing one replaces its camera; a cut that would leave a shot shorter
 * than MIN_SHOT replaces the camera of that shot instead.
 */
export function insertCut(edit: Edit, t: number, cam: CamId, T: number): Cut[] {
  const tt = Math.min(Math.max(0, snapFrame(t)), T - MIN_SHOT);
  const i = shotIndexAt(edit, tt);
  if (edit[i].cam === cam) return [...edit];
  const out = [...edit];
  if (near(edit[i].t, tt) || tt - edit[i].t < MIN_SHOT) {
    out[i] = { t: edit[i].t, cam };
    return normalize(out, T);
  }
  const next = edit[i + 1];
  if (next && next.t - tt < MIN_SHOT) {
    out[i + 1] = { t: next.t, cam };
    return normalize(out, T);
  }
  out.splice(i + 1, 0, { t: tt, cam });
  return normalize(out, T);
}

export function setShotCamera(edit: Edit, index: number, cam: CamId): Cut[] {
  return edit.map((c, i) => (i === index ? { t: c.t, cam } : c));
}

/** Trim: move cut `index` (≥ 1) to time t, kept between its neighbours with MIN_SHOT either side. */
export function moveCut(edit: Edit, index: number, t: number, T: number): Cut[] {
  if (index < 1 || index >= edit.length) return [...edit];
  const lo = edit[index - 1].t + MIN_SHOT;
  const hi = (index + 1 < edit.length ? edit[index + 1].t : T) - MIN_SHOT;
  const tt = Math.min(hi, Math.max(lo, snapFrame(t)));
  return edit.map((c, i) => (i === index ? { t: tt, cam: c.cam } : c));
}

/** Remove cut `index` (≥ 1): the previous shot runs on through it. */
export function removeCut(edit: Edit, index: number): Cut[] {
  if (index < 1 || index >= edit.length) return [...edit];
  return edit.filter((_, i) => i !== index);
}

export interface EditStats {
  shots: number;
  cuts: number;
  /** Average shot length, seconds. */
  aslS: number;
  cutsPerMin: number;
}

export function editStats(edit: Edit, T: number): EditStats {
  const shots = edit.length;
  return { shots, cuts: shots - 1, aslS: T / Math.max(1, shots), cutsPerMin: ((shots - 1) / T) * 60 };
}

export function sameEdit(a: Edit, b: Edit): boolean {
  return a.length === b.length && a.every((c, i) => c.cam === b[i].cam && Math.abs(c.t - b[i].t) < 1e-6);
}

/** Undo history: push the edit being replaced (capped), or pop the last one. */
export interface History {
  past: Cut[][];
  present: Cut[];
}

export function commit(h: History, next: Cut[], cap = 60): History {
  if (sameEdit(h.present, next)) return h;
  return { past: [...h.past, h.present].slice(-cap), present: next };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1] };
}

export type EditPresetId = "classic" | "crossing" | "reaction" | "fast" | "slow";

export const EDIT_PRESET_ORDER: readonly EditPresetId[] = ["classic", "crossing", "reaction", "fast", "slow"];

export const EDIT_PRESET_LABEL: Record<EditPresetId, string> = {
  classic: "Classic coverage",
  crossing: "Crossing the line",
  reaction: "Reaction-heavy",
  fast: "Fast cutting",
  slow: "Slow cutting",
};

/**
 * Edit presets, snapped to frames. Classic coverage cuts on the scene's story beats (its timeline
 * markers: the reaction, the action) when it has three after the opening; the rest are fractions of
 * the loop. "crossing" is the classic edit; the caller also mirrors camera C across the line.
 */
export function editPreset(id: EditPresetId, T: number, beats: readonly number[] = []): Cut[] {
  const at = (pairs: [number, CamId][]) => normalize(pairs.map(([f, cam]) => ({ t: snapFrame(f * T), cam })), T);
  switch (id) {
    case "classic":
    case "crossing": {
      const b = beats.filter((t) => t > 1 && t < T - 1).slice(0, 3);
      if (b.length === 3) return normalize([{ t: 0, cam: "A" }, ...b.map((t, i) => ({ t: snapFrame(t), cam: (["B", "C", "A"] as const)[i] }))], T);
      return at([
        [0, "A"],
        [0.3, "B"],
        [0.5, "C"],
        [0.76, "A"],
      ]);
    }
    case "reaction":
      return at([
        [0, "A"],
        [0.16, "C"],
        [0.42, "B"],
        [0.56, "C"],
        [0.8, "B"],
        [0.88, "C"],
      ]);
    case "fast": {
      const cycle: CamId[] = ["A", "B", "C", "B", "C", "A"];
      const step = 0.6;
      const out: Cut[] = [];
      for (let k = 0; k * step < T - MIN_SHOT; k++) out.push({ t: snapFrame(k * step), cam: cycle[k % cycle.length] });
      return normalize(out, T);
    }
    case "slow":
      return at([
        [0, "A"],
        [0.55, "C"],
      ]);
  }
}
