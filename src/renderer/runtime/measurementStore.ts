import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useEffect, useRef } from "react";
import type { Measurements } from "@/engine/measure";
import { measure } from "@/engine/measure";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";

/** Per-frame readouts live here, outside React state; UI binds with subscribe → textContent. */
export const measurementStore = createStore<{ m: Measurements; key: string }>()(
  subscribeWithSelector(() => ({ m: measure(d, d.defaultRig, "primary"), key: "" })),
);

const q = (x: number | null, step: number) => (x === null || !Number.isFinite(x) ? "n" : Math.round(x / step).toString());

export function publishMeasurements(m: Measurements) {
  const key = [
    q(m.focalMm, 0.1),
    q(m.distanceM, 0.005),
    q(m.distanceToPrimaryM, 0.005),
    q(m.subjectFraction, 0.002),
    q(m.bodyFraction, 0.002),
    m.targetId,
    q(m.timeS, 1 / 48),
    q(m.bgRatioVs24, 0.01),
    q(m.faceStretch, 0.005),
    q(m.yawDeg, 0.05),
  ].join("|");
  if (key !== measurementStore.getState().key) measurementStore.setState({ m, key });
}

/** Bind a DOM node's text to a measurement without React re-renders. */
export function useMeasurementText<T>(select: (m: Measurements) => T, format: (v: T, m: Measurements) => string) {
  const ref = useRef<HTMLElement | null>(null);
  const fmt = useRef(format);
  const sel = useRef(select);
  useEffect(() => {
    fmt.current = format;
    sel.current = select;
  });
  useEffect(() => {
    const write = (m: Measurements) => {
      if (ref.current) ref.current.textContent = fmt.current(sel.current(m), m);
    };
    write(measurementStore.getState().m);
    return measurementStore.subscribe((s) => s.m, write);
  }, []);
  return ref;
}
