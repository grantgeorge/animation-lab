import { useEffect, useRef } from "react";
import { MasterClock } from "@/engine/timeline/clock";
import { CHANNEL_IDS, FULL_MASK, LIGHT_IDS, type ChannelMask, type LightId } from "../engine/types";
import { lookAround } from "./lookAround";

/**
 * Lab-local frame bus. The single positive-priority useFrame in StudioCanvas ticks the clock once,
 * then runs these updaters in order, then renders. Nothing here depends on the Lens lab runtime.
 */
export const ORDER = { POSE: 0, LIGHTS: 10, GIZMOS: 20, CAMERA: 30 } as const;

export interface StudioFrame {
  t: number;
  dt: number;
  nowMs: number;
}

type Updater = { fn: (f: StudioFrame) => void; order: number };
const updaters: Updater[] = [];

export function runStudioFrame(f: StudioFrame) {
  for (const u of updaters) u.fn(f);
}

export function useStudioFrame(fn: (f: StudioFrame) => void, order: number) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const u: Updater = { fn: (f) => ref.current(f), order };
    updaters.push(u);
    updaters.sort((a, b) => a.order - b.order);
    return () => {
      const i = updaters.indexOf(u);
      if (i >= 0) updaters.splice(i, 1);
    };
  }, [order]);
}

/** The performance clock (7 s loop). */
export const studioClock = new MasterClock({ durationS: lookAround.durationS, playing: false });

/** Mutable per-frame values the renderer eases toward (never stored in React state). */
export const live = {
  mask: { ...FULL_MASK } as ChannelMask,
  shadow: { key: 1, fill: 0, rim: 1 } as Record<LightId, number>,
  frames: 0,
  /** DOM element the picture-in-picture is drawn under. */
  pipEl: null as HTMLElement | null,
  /** Screen position (CSS px) of a lamp in the inspect camera; set by the canvas, used by tests. */
  projectLamp: null as null | ((id: LightId) => { x: number; y: number } | null),
};

/** Ease the channel mask and shadow strengths toward their targets; returns true while moving. */
export function easeLive(mask: ChannelMask, shadows: Record<LightId, boolean>, dt: number, instant: boolean): boolean {
  const k = instant ? 1 : 1 - Math.exp(-dt / 0.09);
  let moving = false;
  for (const id of CHANNEL_IDS) {
    const d = mask[id] - live.mask[id];
    if (Math.abs(d) > 1e-3) {
      live.mask[id] += d * k;
      moving = true;
    } else live.mask[id] = mask[id];
  }
  for (const id of LIGHT_IDS) {
    const target = shadows[id] ? 1 : 0;
    const d = target - live.shadow[id];
    if (Math.abs(d) > 1e-3) {
      live.shadow[id] += d * k;
      moving = true;
    } else live.shadow[id] = target;
  }
  return moving;
}
