import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { MasterClock } from "@/engine/timeline/clock";
import { painterly } from "./config";
import { buildUp, DEFAULT_PARAMS, LAYER_IDS, type LayerId, type Layers, type PaintParams } from "./engine/types";
import type { TestVersion } from "./engine/seeds";

export type Mode = "watch" | "inspect" | "experiment";
export type Section = "look" | "test";
export type TestMotion = "head" | "orbit";

/** The lab's own clock, ticked once per frame by the Orchestrator. */
export const ptClock = new MasterClock({ durationS: painterly.durationS, playing: true });

export interface PTState {
  section: Section;
  mode: Mode;
  layers: Layers;
  /** The technique being explained / inspected. */
  focus: LayerId;
  paintChar: boolean;
  paintEnv: boolean;
  /** Wipe position: left of it is clean 3D, right of it painted (0 = all painted, 1 = all clean). */
  wipe: number;
  params: PaintParams;
  /** Experiment: swing the shot camera this many degrees off the matte's projector. */
  projYaw: number;
  /** Highlighted version of the consistency test. */
  test: TestVersion;
  testMotion: TestMotion;
  /** Boil: frames each drawing is held (1 = ones, 2 = twos, 3 = threes). */
  boilHold: number;
  playing: boolean;
  help: boolean;
  toast: { text: string; id: number } | null;
  setSection(s: Section): void;
  setMode(m: Mode): void;
  setLayer(id: LayerId, on: boolean): void;
  toggleLayer(id: LayerId): void;
  setStep(step: number): void;
  setFocus(id: LayerId): void;
  setPaint(scope: "char" | "env", on: boolean): void;
  setWipe(v: number): void;
  setParams(p: Partial<PaintParams>): void;
  setProjYaw(v: number): void;
  setTest(v: TestVersion): void;
  setTestMotion(m: TestMotion): void;
  setBoilHold(n: number): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  step(frames: number): void;
  setHelp(v: boolean): void;
  say(text: string): void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const ptStore = createStore<PTState>()(
  subscribeWithSelector((set, get) => ({
    section: "look",
    mode: "watch",
    layers: buildUp(5),
    focus: "texture",
    paintChar: true,
    paintEnv: true,
    wipe: 0,
    params: { ...DEFAULT_PARAMS },
    projYaw: 0,
    test: "surface",
    testMotion: "head",
    boilHold: 2,
    playing: true,
    help: false,
    toast: null,
    setSection: (section) => set({ section }),
    setMode: (mode) => set((s) => ({ mode, wipe: mode === "experiment" && s.wipe === 0 ? 0.5 : mode === "watch" ? 0 : s.wipe, projYaw: mode === "watch" ? 0 : s.projYaw })),
    setLayer: (id, on) => set((s) => ({ layers: { ...s.layers, [id]: on }, focus: on ? id : s.focus })),
    toggleLayer: (id) => get().setLayer(id, !get().layers[id]),
    setStep: (step) => set({ layers: buildUp(step), focus: LAYER_IDS[Math.max(0, Math.min(4, step - 1))] }),
    setFocus: (focus) => set({ focus }),
    setPaint: (scope, on) => set(scope === "char" ? { paintChar: on } : { paintEnv: on }),
    setWipe: (v) => set({ wipe: clamp01(v) }),
    setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
    setProjYaw: (v) => set({ projYaw: Math.max(-painterly.projYawMaxDeg, Math.min(painterly.projYawMaxDeg, v)) }),
    setTest: (test) => set({ test }),
    setTestMotion: (testMotion) => set({ testMotion }),
    setBoilHold: (n) => set({ boilHold: Math.max(1, Math.min(3, Math.round(n))) }),
    play: () => {
      ptClock.play();
      set({ playing: true });
    },
    pause: () => {
      ptClock.pause();
      set({ playing: false });
    },
    togglePlay: () => (get().playing ? get().pause() : get().play()),
    seek: (t) => ptClock.seek(t),
    step: (frames) => {
      get().pause();
      ptClock.seek(ptClock.peek() + frames / 24);
    },
    setHelp: (help) => set({ help }),
    say: (text) => set({ toast: { text, id: Date.now() } }),
  })),
);

export const usePT = <T,>(sel: (s: PTState) => T) => useStore(ptStore, sel);
