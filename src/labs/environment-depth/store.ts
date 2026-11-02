import { createStore, useStore } from "zustand";
import { MasterClock } from "@/engine/timeline/clock";
import { CAMERA, FPS, LOOP_S, type MoveId } from "./engine/camera";
import type { HazeColorId } from "./engine/haze";
import type { RefId, StoryId } from "./engine/scale";
import type { Construct } from "./engine/prompt";
import { SLICE } from "./engine/layers";

export type { Construct };
/** The lab's own clock, ticked once per frame by the orchestrator. */
export const edClock = new MasterClock({ durationS: LOOP_S, playing: true });

export type Mode = "watch" | "inspect" | "experiment";
export const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];
export const CONSTRUCTS: readonly Construct[] = ["2d", "25d", "3d"];
export type Overlay = "none" | "reveal" | "bands";

export type CueId = "parallax" | "haze" | "layers" | "scale" | "occlusion" | "dof" | "perspective";
/** Control order (as in the brief). */
export const CUE_IDS: readonly CueId[] = ["parallax", "haze", "layers", "scale", "occlusion", "dof", "perspective"];
/** Take-apart order: rebuild the frame from flat, one cue at a time. */
export const STEP_ORDER: readonly CueId[] = ["occlusion", "perspective", "layers", "scale", "haze", "parallax", "dof"];

export interface Cues {
  parallax: number;
  haze: number;
  hazeColor: HazeColorId;
  layers: boolean;
  scale: boolean;
  refs: Record<RefId, boolean>;
  story: StoryId;
  occlusion: boolean;
  dof: boolean;
  fStop: number;
  focalMm: number;
  guides: boolean;
}

export const CUES_DEFAULT: Cues = {
  parallax: 1,
  haze: 1,
  hazeColor: "blue",
  layers: true,
  scale: true,
  refs: { pip: true, cabin: false, fence: true, deer: false },
  story: "giant",
  occlusion: true,
  dof: true,
  fStop: 1.4,
  focalMm: CAMERA.defaultFocalMm,
  guides: false,
};

export const FLAT_FOCAL = 85;

const ON: Record<CueId, Partial<Cues>> = {
  parallax: { parallax: 1 },
  haze: { haze: 1 },
  layers: { layers: true },
  scale: { scale: true },
  occlusion: { occlusion: true },
  dof: { dof: true },
  perspective: { focalMm: CAMERA.defaultFocalMm },
};
const OFF: Record<CueId, Partial<Cues>> = {
  parallax: { parallax: 0 },
  haze: { haze: 0 },
  layers: { layers: false },
  scale: { scale: false },
  occlusion: { occlusion: false },
  dof: { dof: false },
  perspective: { focalMm: FLAT_FOCAL },
};

export function isCueOn(c: Cues, id: CueId) {
  switch (id) {
    case "parallax":
      return c.parallax > 0.05;
    case "haze":
      return c.haze > 0.05;
    case "perspective":
      return c.focalMm <= 50;
    default:
      return c[id];
  }
}

export function cuesWith(on: readonly CueId[], base: Cues = CUES_DEFAULT): Cues {
  let c: Cues = structuredClone(base);
  for (const id of CUE_IDS) c = { ...c, ...(on.includes(id) ? ON[id] : OFF[id]) };
  if (on.includes("scale") && !Object.values(c.refs).some(Boolean)) c.refs = { ...CUES_DEFAULT.refs };
  return c;
}

export interface EDState {
  mode: Mode;
  construct: Construct;
  move: MoveId;
  moveSize: number;
  layerCount: number;
  cleanPlates: boolean;
  overlay: Overlay;
  cues: Cues;
  /** Take-apart step: how many cues of STEP_ORDER are on (null = hand-tuned). */
  step: number | null;
  playing: boolean;
  version: number;
  help: boolean;
  toast: { text: string; id: number } | null;
  setMode(m: Mode): void;
  setConstruct(c: Construct): void;
  setMove(m: MoveId): void;
  setMoveSize(v: number): void;
  setLayerCount(n: number): void;
  setCleanPlates(v: boolean): void;
  setOverlay(o: Overlay): void;
  setCues(p: Partial<Cues>): void;
  toggleCue(id: CueId): void;
  setStep(n: number): void;
  isolate(id: CueId | "flat" | "all"): void;
  setHelp(open: boolean): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  stepFrames(n: number): void;
  say(text: string): void;
}

export const DEFAULTS = {
  mode: "experiment" as Mode,
  construct: "3d" as Construct,
  move: "track" as MoveId,
  moveSize: 1,
  layerCount: SLICE.defaultLayers,
  cleanPlates: false,
  overlay: "none" as Overlay,
};

export const edStore = createStore<EDState>()((set, get) => {
  const bump = (patch: Partial<EDState>) => set((s) => ({ ...patch, version: s.version + 1 }));
  return {
    ...DEFAULTS,
    cues: structuredClone(CUES_DEFAULT),
    step: null,
    playing: true,
    version: 0,
    help: false,
    toast: null,
    setMode: (mode) => bump({ mode }),
    setConstruct: (construct) => bump({ construct }),
    setMove: (move) => bump({ move }),
    setMoveSize: (moveSize) => bump({ moveSize }),
    setLayerCount: (layerCount) => bump({ layerCount: Math.round(Math.min(SLICE.maxLayers, Math.max(SLICE.minLayers, layerCount))) }),
    setCleanPlates: (cleanPlates) => bump({ cleanPlates }),
    setOverlay: (overlay) => bump({ overlay }),
    setCues: (p) => bump({ cues: { ...get().cues, ...p }, step: null }),
    toggleCue(id) {
      const c = get().cues;
      bump({ cues: { ...c, ...(isCueOn(c, id) ? OFF[id] : ON[id]) }, step: null });
    },
    setStep(n) {
      const step = Math.max(0, Math.min(STEP_ORDER.length, n));
      bump({ step, cues: cuesWith(STEP_ORDER.slice(0, step), get().cues) });
    },
    isolate(id) {
      if (id === "all") bump({ cues: cuesWith(CUE_IDS, get().cues), step: STEP_ORDER.length });
      else if (id === "flat") bump({ cues: cuesWith([], get().cues), step: 0 });
      else bump({ cues: cuesWith([id], get().cues), step: null });
    },
    setHelp: (help) => set({ help }),
    play() {
      edClock.play();
      set({ playing: true });
    },
    pause() {
      edClock.pause();
      set({ playing: false });
    },
    togglePlay() {
      if (get().playing) get().pause();
      else get().play();
    },
    seek(t) {
      edClock.seek(t);
      set((s) => ({ version: s.version + 1 }));
    },
    stepFrames(n) {
      if (get().playing) get().pause();
      const f = Math.round(edClock.peek() * FPS) + n;
      get().seek(f / FPS + 1e-4);
    },
    say: (text) => set((s) => ({ toast: { text, id: (s.toast?.id ?? 0) + 1 } })),
  };
});

export const useED = <T,>(sel: (s: EDState) => T) => useStore(edStore, sel);
