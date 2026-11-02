import type { CameraMode, TargetId } from "@/engine/types";

export type FocalSource = "slider" | "preset" | "key" | "ring" | "restore" | "exercise";
export type DistanceSource = "slider" | "drag" | "key" | "restore" | "solver";

export type LabEvent =
  | { type: "focalChanged"; f: number; source: FocalSource }
  | { type: "modeChanged"; mode: CameraMode }
  | { type: "targetChanged"; target: TargetId }
  | { type: "distanceChanged"; d: number; railS: number; source: DistanceSource }
  | { type: "cameraTravelled"; metres: number }
  | { type: "clampHit"; kind: "min" | "max" | "both" }
  | { type: "playbackChanged"; playing: boolean }
  | { type: "timeScrubbed"; t: number }
  | { type: "viewSwapped"; primary: "stage" | "shot" }
  | { type: "shotSaved"; id: string; objective: string | null }
  | { type: "shotRestored"; id: string }
  | { type: "exportCopied"; kind: "json" | "phrase" }
  | { type: "overlayToggled"; key: string; on: boolean }
  | { type: "exerciseStarted"; id: string }
  | { type: "exerciseCompleted"; id: string }
  | { type: "presetHeld"; f: number; mode: CameraMode; target: TargetId }
  | { type: "sceneChanged"; scene: string };

type Listener = (e: LabEvent & { at: number }) => void;

const RING = 500;
const listeners = new Set<Listener>();
const ring: (LabEvent & { at: number })[] = [];

export const labEvents = {
  emit(e: LabEvent) {
    const stamped = { ...e, at: typeof performance !== "undefined" ? performance.now() : Date.now() };
    ring.push(stamped);
    if (ring.length > RING) ring.shift();
    for (const l of listeners) l(stamped);
  },
  on(l: Listener) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  recent(n = RING) {
    return ring.slice(-n);
  },
  clear() {
    ring.length = 0;
  },
};
