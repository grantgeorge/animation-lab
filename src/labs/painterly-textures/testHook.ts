"use client";

import { invalidate } from "@react-three/fiber";
import type { TestVersion } from "./engine/seeds";
import { live } from "./live";
import { ptClock, ptStore, type PTState } from "./store";

export interface PainterlyLabHook {
  getState: () => PTState & { t: number; frames: number; stretch: number };
  set: (patch: Partial<Pick<PTState, "section" | "mode" | "layers" | "focus" | "paintChar" | "paintEnv" | "wipe" | "params" | "projYaw" | "test" | "testMotion" | "boilHold">>) => void;
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  /** Resolves after n more frames have rendered. */
  frames: (n?: number) => Promise<number>;
  /** Measure crawl now (3 frame pairs ending at the current time); raw, unsmoothed, % of full scale. */
  crawl: () => Promise<Record<TestVersion, number>>;
  /** Smoothed live crawl readout. */
  crawlLive: () => Record<TestVersion, number>;
  /** Diagnostics of the last measurement. */
  lastMeasure: () => typeof live.lastMeasure;
  /** Mean texel stretch of the projected matte from the current shot camera (1 = projector). */
  stretch: () => number;
  /** PNG data URL of the clean, empty set from the shot camera (the matte painter's plate). */
  plate: () => Promise<string>;
}

declare global {
  interface Window {
    __painterlyLab?: PainterlyLabHook;
  }
}

/** Test hook, installed only with ?e2e=1. */
export function installPainterlyHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return () => {};
  const hook: PainterlyLabHook = {
    getState: () => ({ ...ptStore.getState(), t: live.t, frames: live.frames, stretch: live.stretch }),
    set: (patch) => {
      ptStore.setState(patch as Partial<PTState>);
      invalidate();
    },
    seek: (t) => {
      ptClock.seek(t);
      invalidate();
    },
    play: () => ptStore.getState().play(),
    pause: () => ptStore.getState().pause(),
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frames;
        const poll = () => {
          if (live.frames >= start + n) resolve(live.frames);
          else {
            invalidate();
            requestAnimationFrame(poll);
          }
        };
        poll();
      }),
    crawl: () =>
      new Promise((resolve) => {
        live.pendingMeasure.push(resolve);
        invalidate();
      }),
    crawlLive: () => ({ surface: live.crawl.surface.value, screen: live.crawl.screen.value, random: live.crawl.random.value, boil: live.crawl.boil.value }),
    stretch: () => live.stretch,
    lastMeasure: () => live.lastMeasure,
    plate: () =>
      new Promise((resolve) => {
        live.pendingPlate.push(resolve);
        invalidate();
      }),
  };
  window.__painterlyLab = hook;
  return () => {
    if (window.__painterlyLab === hook) delete window.__painterlyLab;
  };
}
