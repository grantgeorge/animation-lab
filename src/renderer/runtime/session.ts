import type { UrlParams } from "./quality";
import { readUrlParams } from "./quality";

/** Per-page runtime facts that are not app state: URL params, reduced motion, frame records. */
export interface FrameRecord {
  frameId: number;
  t: number;
  dtMs: number;
  passes: string[];
  stageRect: { x: number; y: number; w: number; h: number } | null;
  shotRect: { x: number; y: number; w: number; h: number } | null;
  calls: number;
  triangles: number;
  phases: Record<string, number>;
}

export const session = {
  params: readUrlParams("") as UrlParams,
  reducedMotion: false,
  frames: [] as FrameRecord[],
  frameId: 0,
  controlsActive: false,
  init() {
    if (typeof window === "undefined") return;
    session.params = readUrlParams(window.location.search);
    session.reducedMotion =
      session.params.nomotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  },
  pushFrame(r: FrameRecord) {
    session.frames.push(r);
    if (session.frames.length > 120) session.frames.shift();
  },
};
