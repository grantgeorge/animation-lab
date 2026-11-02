import type { Frame } from "../engine/scopes";

/**
 * Per-frame state outside React: the DOM windows the orchestrator renders into, the latest scope
 * readback and pending pixel-sample requests (test hook).
 */
export const live = {
  t: 0,
  frameId: 0,
  grainFrame: 0,
  /** Latest 160×90 readback of the main monitor (top row first). */
  scope: null as Frame | null,
  scopeVersion: 0,
  /** Small readbacks of each show monitor, for the per-shot strip. */
  sceneReady: false,
};

/**
 * Slot ids: "main" (the live shot), "thumb:<node>" (Inspect pipeline thumbnails),
 * "show:<shot>" (show-look monitors), "limit:same" / "limit:flipped" (what grading can't fix).
 */
export const slots = new Map<string, HTMLElement>();

export interface SampleRequest {
  slot: string;
  width: number;
  height: number;
  before: boolean;
  resolve: (f: Frame) => void;
}

export const sampleQueue: SampleRequest[] = [];

/** Capture of the clean develop output (plates are made from these). */
export const captureQueue: { width: number; height: number; resolve: (f: Frame) => void }[] = [];

export function registerSlot(id: string) {
  return (el: HTMLElement | null) => {
    if (el) slots.set(id, el);
    else slots.delete(id);
  };
}
