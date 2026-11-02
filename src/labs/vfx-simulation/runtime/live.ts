import { createStore, useStore } from "zustand";
import type { Group } from "three";
import type { Treatment } from "../engine/beat";
import type { TreatmentCurve } from "../engine/measure";

/** DOM windows the orchestrator renders into (scissored), keyed by slot id. */
export const slots = new Map<string, HTMLElement>();

/** Pip instances (0 = realistic / sync-offset, 1 = cartoon / in-sync, 2 = hand-drawn, toon-shaded). */
export const actors = { pips: [null, null, null] as (Group | null)[] };

export interface ViewLive {
  /** What this view shows. */
  kind: string;
  /** Time the view sampled (after stepping / retime), and the frame. */
  t: number;
  frame: number;
  /** Drawing / phase name on screen. */
  phase: string;
  /** Particles drawn this frame. */
  particles: number;
  /** Impact flash on this frame. */
  flash: boolean;
}

/** Per-frame state outside React: written by the orchestrator, read by readouts, overlays and tests. */
export const live = {
  t: 0,
  frame: 0,
  frameId: 0,
  ready: false,
  views: {} as Record<string, ViewLive>,
  rendered: [] as string[],
  bake: { progress: 0, done: false, ms: 0, n: 0, key: "", firstContact: 0 },
  /** Category demo stats (counts, solver info). */
  demo: {} as Record<string, number | string>,
  fps: 0,
};

type Fn = () => void;
const after = new Set<Fn>();
/** Run once per frame after every pass (DOM readouts). */
export function onAfterFrame(fn: Fn) {
  after.add(fn);
  return () => void after.delete(fn);
}
export function runAfterFrame() {
  for (const f of after) f();
}

/** Measurements (legibility and curves). Changes only when settings or the bake change, so React may read it. */
export interface MeasureState {
  curves: Partial<Record<Treatment, TreatmentCurve>>;
  /** Sync tab: measured flinch lag in frames for view A / B. */
  key: string;
}
export const measureStore = createStore<MeasureState>()(() => ({ curves: {}, key: "" }));
export const useMeasure = <T,>(sel: (s: MeasureState) => T) => useStore(measureStore, sel);
