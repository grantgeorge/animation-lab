"use client";

import { labStore } from "./labStore";
import { labEvents } from "./events";
import { session } from "@/renderer/runtime/session";
import { measurementStore } from "@/renderer/runtime/measurementStore";
import { presentation } from "@/renderer/runtime/presentation";
import { viewports } from "@/renderer/runtime/viewports";

export interface AnimationLabHook {
  getState: typeof labStore.getState;
  setState: typeof labStore.setState;
  events: () => ReturnType<typeof labEvents.recent>;
  frames: () => typeof session.frames;
  measurements: () => ReturnType<typeof measurementStore.getState>["m"];
  presentation: () => { railS: number; focalMm: number; yawDeg: number; pitchDeg: number; settled: boolean };
  rects: () => { stage: unknown; shot: unknown };
  settle: (opts?: { timeoutMs?: number }) => Promise<number>;
}

/** Test hook, inert unless the URL has e2e=1. */
export function installTestHook(invalidate: () => void) {
  if (!session.params.e2e || typeof window === "undefined") return () => {};
  const hook: AnimationLabHook = {
    getState: labStore.getState,
    setState: labStore.setState,
    events: () => labEvents.recent(),
    frames: () => session.frames,
    measurements: () => measurementStore.getState().m,
    presentation: () => ({
      railS: presentation.railS,
      focalMm: presentation.focalMm,
      yawDeg: presentation.yawDeg,
      pitchDeg: presentation.pitchDeg,
      settled: presentation.settled,
    }),
    rects: () => ({ stage: viewports.get("stage")?.gl ?? null, shot: viewports.get("shot")?.gl ?? null }),
    settle: ({ timeoutMs = 30000 } = {}) =>
      new Promise((resolve, reject) => {
        const start = performance.now();
        const startFrame = session.frameId;
        let readyFrame: number | null = null;
        const poll = () => {
          if (performance.now() - start > timeoutMs) {
            reject(new Error(`settle timeout at frame ${session.frameId}: camera=${presentation.settled ? "settled" : "moving"}, layout=${viewports.layoutTransitioning ? "moving" : "settled"}`));
            return;
          }
          invalidate();
          const ok = presentation.settled && !viewports.layoutTransitioning && session.frameId > startFrame + 1;
          if (!ok) readyFrame = null;
          else if (readyFrame === null) readyFrame = session.frameId;
          else if (session.frameId > readyFrame) {
            resolve(session.frameId);
            return;
          }
          requestAnimationFrame(poll);
        };
        poll();
      }),
  };
  (window as unknown as { __animationLab: AnimationLabHook }).__animationLab = hook;
  return () => {
    const w = window as unknown as { __animationLab?: AnimationLabHook };
    if (w.__animationLab === hook) delete w.__animationLab;
  };
}
