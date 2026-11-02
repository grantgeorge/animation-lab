import type { ComparisonId, MotionParams } from "./engine";
import { useTiming } from "./store";

export interface TimingLabHook {
  getState: () => {
    params: MotionParams;
    comparison: ComparisonId | null;
    frame: number;
    totalFrames: number;
    playing: boolean;
    loop: boolean;
    variants: {
      id: string;
      label: string;
      prompt: string;
      takeoffFrame: number;
      contacts: number[];
      arcs: { takeoff: number; apexFrame: number; land: number; height: number }[];
    }[];
  };
  /** Per-frame samples of one variant (index into variants). */
  frames: (variant?: number) => { frame: number; phase: string; x: number; y: number; stretch: number; blink: number; antenna: number }[];
  setParams: (patch: Partial<MotionParams>) => void;
  setComparison: (id: ComparisonId | null) => void;
  seek: (frame: number) => void;
  pause: () => void;
  play: () => void;
}

declare global {
  interface Window {
    __timingLab?: TimingLabHook;
  }
}

/** Installed only with ?e2e=1. Plain data out, store actions in. */
export function installTimingHook() {
  if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("e2e")) return () => {};
  const hook: TimingLabHook = {
    getState: () => {
      const s = useTiming.getState();
      return {
        params: s.params,
        comparison: s.comparison,
        frame: s.frame,
        totalFrames: s.totalFrames,
        playing: s.playing,
        loop: s.loop,
        variants: s.variants.map((v) => ({
          id: v.id,
          label: v.label,
          prompt: v.prompt,
          takeoffFrame: v.timeline.takeoffFrame,
          contacts: v.timeline.contacts.map((c) => c.frame),
          arcs: v.timeline.arcs.map((a) => ({ takeoff: a.takeoff, apexFrame: a.apexFrame, land: a.land, height: a.height })),
        })),
      };
    },
    frames: (i = 0) =>
      (useTiming.getState().variants[i]?.frames ?? []).map((p) => ({
        frame: p.frame,
        phase: p.phase,
        x: p.x,
        y: p.y,
        stretch: p.deform.stretch,
        blink: p.blink,
        antenna: p.antenna,
      })),
    setParams: (patch) => useTiming.getState().setParams(patch),
    setComparison: (id) => useTiming.getState().setComparison(id),
    seek: (f) => useTiming.getState().seek(f),
    pause: () => useTiming.getState().pause(),
    play: () => useTiming.getState().play(),
  };
  window.__timingLab = hook;
  return () => {
    if (window.__timingLab === hook) delete window.__timingLab;
  };
}
