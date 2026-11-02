import type { Texture } from "three";
import type { TestVersion } from "./engine/seeds";

/**
 * Mutable per-frame state shared between the Orchestrator (writer) and DOM readouts (readers).
 * Module-level: there is only ever one Painterly canvas.
 */
export type SlotId = "picture" | "pip" | "swatch" | `panel-${TestVersion}`;

export interface CrawlReading {
  /** Smoothed crawl, % of full scale. */
  value: number;
  /** Latest single measurement. */
  last: number;
  /** Recent measurements, oldest first (sparkline). */
  history: number[];
}

export const live = {
  slots: new Map<SlotId, HTMLElement>(),
  frames: 0,
  t: 0,
  crawl: {
    surface: { value: 0, last: 0, history: [] },
    screen: { value: 0, last: 0, history: [] },
    random: { value: 0, last: 0, history: [] },
    boil: { value: 0, last: 0, history: [] },
  } as Record<TestVersion, CrawlReading>,
  crawlCount: 0,
  /** Diagnostics of the last measurement (raw change, cells), for the hook and docs. */
  lastMeasure: null as null | Record<TestVersion, { crawl: number; raw: number; cells: number; moving: number }>,
  /** Frame-to-frame difference heat maps (w × h, 0–1) of the last measurement, for Inspect. */
  diff: { width: 0, height: 0, maps: {} as Partial<Record<TestVersion, Float32Array>>, coords: null as Uint8Array | null },
  stretch: 1,
  /** Measurement requested by the test hook: resolves with raw (unsmoothed) crawl values. */
  pendingMeasure: [] as ((r: Record<TestVersion, number>) => void)[],
  /** Plate render requested by scripts/painterly (clean set, no cast, from the shot camera). */
  pendingPlate: [] as ((dataUrl: string) => void)[],
  /** The matte texture (Inspect). */
  matte: null as Texture | null,
  listeners: new Set<() => void>(),
};

export function registerSlot(id: SlotId, el: HTMLElement | null) {
  if (el) live.slots.set(id, el);
  else live.slots.delete(id);
}

/** Notify DOM readouts (throttled by the caller). */
export function emitLive() {
  for (const l of live.listeners) l();
}
