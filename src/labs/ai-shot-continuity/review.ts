import type { LensId, Note, SetId, Shot } from './shots';

/** Frames are 16:9; distances are measured in frame widths so a circle is round on screen. */
export const ASPECT = 16 / 9;
export const MAX_PINS = 6;

export interface Pin { id: number; x: number; y: number; lens: LensId }
export const pinDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) / ASPECT);

export interface Hit { pin: Pin; note: Note; lensOk: boolean }
export interface Result { hits: Hit[]; misses: Note[]; falseAlarms: Pin[]; found: number; total: number; lensRight: number; clean: boolean }

/**
 * Match pins to reviewed notes. Each note can be claimed by one pin and each pin by one note, nearest
 * pairs first; a pin counts only inside a note's radius. A pin in the wrong lens still finds the drift,
 * but is reported so the student learns to name it.
 */
export function scorePins(pins: readonly Pin[], notes: readonly Note[]): Result {
  const pairs: { p: Pin; n: Note; d: number }[] = [];
  for (const p of pins) for (const n of notes) {
    const d = pinDistance(p, n);
    if (d <= n.r) pairs.push({ p, n, d: d - (p.lens === n.lens ? 1e-3 : 0) });
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedP = new Set<number>(), usedN = new Set<string>(), hits: Hit[] = [];
  for (const { p, n } of pairs) {
    if (usedP.has(p.id) || usedN.has(n.id)) continue;
    usedP.add(p.id); usedN.add(n.id);
    hits.push({ pin: p, note: n, lensOk: p.lens === n.lens });
  }
  const misses = notes.filter((n) => !usedN.has(n.id));
  const falseAlarms = pins.filter((p) => !usedP.has(p.id));
  return { hits, misses, falseAlarms, found: hits.length, total: notes.length, lensRight: hits.filter((h) => h.lensOk).length, clean: notes.length === 0 && pins.length === 0 };
}

export function verdict(r: Result): string {
  if (r.total === 0) return r.falseAlarms.length === 0 ? 'Right: nothing drifted in this shot.' : `This shot matches the references. ${r.falseAlarms.length === 1 ? 'That pin is' : 'Those pins are'} a false alarm.`;
  const parts = [`Found ${r.found} of ${r.total}`];
  if (r.found) parts.push(`${r.lensRight} in the right lens`);
  if (r.falseAlarms.length) parts.push(`${r.falseAlarms.length} false alarm${r.falseAlarms.length > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

/** Reviewed drift notes per lens for a set of shots: the "what references fixed" table. */
export function tally(shots: readonly Shot[], set: SetId): Record<LensId | 'total', number> {
  const out = { identity: 0, costume: 0, lighting: 0, spatial: 0, total: 0 };
  for (const s of shots) if (s.set === set) for (const n of s.notes) { out[n.lens]++; out.total++; }
  return out;
}

/* ---------- compare maths ---------- */

export type CompareMode = 'side' | 'onion' | 'flicker' | 'wipe';

/** Flicker: which image shows at time t (ms). A then B, each held for half the period. */
export const flickerShows = (tMs: number, periodMs: number): 'a' | 'b' => (Math.floor(Math.max(0, tMs) / (periodMs / 2)) % 2 === 0 ? 'a' : 'b');

/** Wipe: B is revealed left of the divider. pos is 0..1 of the frame width. */
export const wipeClip = (pos: number) => `inset(0 ${((1 - clamp01(pos)) * 100).toFixed(2)}% 0 0)`;

/**
 * Zoom on a point without showing past the frame edge. With transform-origin at the top-left, a point p
 * lands at p·z + t; we want the focus at the centre, clamped so the image still covers the frame.
 * Returns a CSS transform (translate in % of the frame, then scale).
 */
export function zoomTransform(focus: readonly [number, number], z: number): string {
  if (z <= 1) return 'none';
  const t = (f: number) => Math.min(0, Math.max(1 - z, 0.5 - f * z));
  return `translate(${(t(focus[0]) * 100).toFixed(2)}%, ${(t(focus[1]) * 100).toFixed(2)}%) scale(${z})`;
}

/** Where a frame point lands on screen after zoomTransform (for drawing note rings over a zoomed image). */
export function zoomPoint(p: { x: number; y: number }, focus: readonly [number, number], z: number): { x: number; y: number } {
  if (z <= 1) return { x: p.x, y: p.y };
  const t = (f: number) => Math.min(0, Math.max(1 - z, 0.5 - f * z));
  return { x: p.x * z + t(focus[0]), y: p.y * z + t(focus[1]) };
}

export const ZOOM = { full: 1, face: 2.6, costume: 2, set: 1.7 } as const;

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }
