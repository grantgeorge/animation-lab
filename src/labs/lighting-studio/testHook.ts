"use client";

import type { PresetId } from "./engine/presets";
import type { LightId, LightParams } from "./engine/types";
import { live } from "./scene/bus";
import { filmCamera, filmViewport } from "./scene/filmCamera";
import { studioStore } from "./store";
import { currentAnalysis, currentPrompt } from "./ui/shortcuts";

export interface LightingStudioHook {
  getState: () => ReturnType<typeof studioStore.getState> & { prompt: string; ratio: number; stops: number; frames: number };
  applyPreset: (id: PresetId, opts?: { instant?: boolean }) => void;
  setLight: (id: LightId, patch: Partial<LightParams>) => void;
  /** Resolves once transitions are done and two more frames have rendered. */
  settle: (opts?: { timeoutMs?: number }) => Promise<number>;
  frames: () => number;
  /** Screen position of a lamp gizmo in the inspect view (null in the shot view). */
  lampScreenPosition: (id: LightId) => { x: number; y: number } | null;
  /** Actual film projection and rendered viewport, so view swaps can be checked for reframing. */
  cameraFrame: () => { aspect: number; projection: number[]; cameraWorld: number[]; viewport: { x: number; y: number; width: number; height: number } };
}

declare global {
  interface Window {
    __lightingStudio?: LightingStudioHook;
  }
}

/** Test hook, installed only when the URL has e2e=1. */
export function installLightingTestHook(invalidate: () => void) {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("e2e") !== "1") return () => {};
  const hook: LightingStudioHook = {
    getState: () => {
      const a = currentAnalysis();
      return { ...studioStore.getState(), prompt: currentPrompt(), ratio: a.ratio, stops: a.stops, frames: live.frames };
    },
    applyPreset: (id, opts) => studioStore.getState().applyPreset(id, opts),
    setLight: (id, patch) => studioStore.getState().setLight(id, patch),
    frames: () => live.frames,
    lampScreenPosition: (id) => live.projectLamp?.(id) ?? null,
    cameraFrame: () => ({
      aspect: filmCamera.aspect,
      projection: filmCamera.projectionMatrix.toArray(),
      cameraWorld: filmCamera.matrixWorld.toArray(),
      viewport: { ...filmViewport },
    }),
    settle: ({ timeoutMs = 15000 } = {}) =>
      new Promise((resolve, reject) => {
        const start = performance.now();
        const poll = () => {
          invalidate();
          if (studioStore.getState().transition === null) {
            const f = live.frames;
            const wait = () => {
              invalidate();
              if (live.frames >= f + 2) resolve(live.frames);
              else if (performance.now() - start > timeoutMs) reject(new Error(`settle timeout at frame ${live.frames}`));
              else requestAnimationFrame(wait);
            };
            requestAnimationFrame(wait);
          } else if (performance.now() - start > timeoutMs) reject(new Error("settle timeout: transition still running"));
          else requestAnimationFrame(poll);
        };
        poll();
      }),
  };
  window.__lightingStudio = hook;
  return () => {
    if (window.__lightingStudio === hook) delete window.__lightingStudio;
  };
}
