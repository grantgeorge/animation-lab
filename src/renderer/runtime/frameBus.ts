import { useEffect, useRef } from "react";

export const ORDER = { POSE: 0, PRESENTATION: 10, FILM_CAMERA: 20, TECH: 30, MEASURE: 40 } as const;

export interface FrameCtx {
  t: number;
  dt: number;
  frameId: number;
  playing: boolean;
  reducedMotion: boolean;
}

type Updater = { fn: (ctx: FrameCtx) => void; order: number };
const updaters: Updater[] = [];

export function registerUpdater(fn: (ctx: FrameCtx) => void, order: number) {
  const u = { fn, order };
  updaters.push(u);
  updaters.sort((a, b) => a.order - b.order);
  return () => {
    const i = updaters.indexOf(u);
    if (i >= 0) updaters.splice(i, 1);
  };
}

export function runUpdaters(ctx: FrameCtx) {
  for (const u of updaters) u.fn(ctx);
}

/** Register a per-frame updater for the lifetime of a component. */
export function useFrameUpdater(fn: (ctx: FrameCtx) => void, order: number) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => registerUpdater((ctx) => ref.current(ctx), order), [order]);
}
