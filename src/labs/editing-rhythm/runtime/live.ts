import type { ShotId } from "../engine/types";

/** DOM windows the orchestrator renders into: P program, W watch, A/B compare. */
export type SlotId = "P" | "W" | "A" | "B";
export const slots = new Map<SlotId, HTMLElement>();

export interface ViewInfo {
  /** Record time on this view's edit. */
  t: number;
  index: number;
  shot: ShotId;
  /** Reel-local source time on screen. */
  local: number;
  /** Dissolve in progress: the incoming clip and its opacity. */
  mix: number;
  runtime: number;
}

/** Per-frame state outside React (written by the orchestrator, read by overlays and the test hook). */
export const live = {
  t: 0,
  frameId: 0,
  views: {} as Partial<Record<SlotId, ViewInfo>>,
  rendered: [] as SlotId[],
};

type Tick = () => void;
const ticks = new Set<Tick>();
/** Run once per rendered frame, after the views are drawn (DOM overlays, audio, playheads). */
export function onTick(fn: Tick): () => void {
  ticks.add(fn);
  return () => {
    ticks.delete(fn);
  };
}
export function emitTick() {
  for (const fn of ticks) fn();
}
