import { createStore, useStore } from "zustand";
import { MasterClock } from "@/engine/timeline/clock";
import { FPS, LOOP_S } from "./engine/common";
import type { Projection, ViewPreset } from "./engine/projection";
import type { MoveKind, MoveStyle } from "./engine/multiplane";
import type { LookStyle, Stepping } from "./engine/timing";
import type { Demo } from "./engine/impossible";

/** The lab's own clock, ticked once per frame by the orchestrator. */
export const acClock = new MasterClock({ durationS: LOOP_S, playing: true });

export type Mode = "watch" | "inspect" | "experiment";
export type ExpId = 1 | 2 | 3 | 4 | 5;
export const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];
export const EXPS: readonly ExpId[] = [1, 2, 3, 4, 5];

export interface E1State {
  proj: Projection;
  view: ViewPreset;
  compare: "off" | "wipe";
  wipe: number;
  guides: boolean;
}
export interface E2State {
  focal: number;
  sweep: boolean;
}
export interface E3State {
  style: MoveStyle;
  move: MoveKind;
}
export interface E4State {
  style: LookStyle;
  step: Stepping;
  cameraOnTwos: boolean;
  dof: boolean;
  fStop: number;
  motionBlur: boolean;
  speedLines: boolean;
  cel: boolean;
}
export interface E5State {
  demo: Demo;
  compare: boolean;
  fisheye: number;
}

export interface ACState {
  mode: Mode;
  exp: ExpId;
  playing: boolean;
  /** Bumped on every state change (cheap cache key). */
  version: number;
  help: boolean;
  toast: { text: string; id: number } | null;
  e1: E1State;
  e2: E2State;
  e3: E3State;
  e4: E4State;
  e5: E5State;
  setMode(m: Mode): void;
  setExp(e: ExpId): void;
  setE1(p: Partial<E1State>): void;
  setE2(p: Partial<E2State>): void;
  setE3(p: Partial<E3State>): void;
  setE4(p: Partial<E4State>): void;
  setE5(p: Partial<E5State>): void;
  setHelp(open: boolean): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  step(frames: number): void;
  say(text: string): void;
}

export const DEFAULTS = {
  e1: { proj: "perspective", view: "street", compare: "off", wipe: 0.5, guides: true } as E1State,
  e2: { focal: 50, sweep: false } as E2State,
  e3: { style: "2.5d", move: "track" } as E3State,
  e4: { style: "split", step: 2, cameraOnTwos: false, dof: true, fStop: 1.4, motionBlur: true, speedLines: true, cel: true } as E4State,
  e5: { demo: "cheat", compare: true, fisheye: 0.42 } as E5State,
};

export const acStore = createStore<ACState>()((set, get) => {
  const bump = (patch: Partial<ACState>) => set((s) => ({ ...patch, version: s.version + 1 }));
  return {
    mode: "experiment",
    exp: 1,
    playing: true,
    version: 0,
    help: false,
    toast: null,
    ...structuredClone(DEFAULTS),
    setMode: (mode) => bump({ mode }),
    setExp: (exp) => bump({ exp }),
    setE1: (p) => bump({ e1: { ...get().e1, ...p } }),
    setE2: (p) => bump({ e2: { ...get().e2, ...p } }),
    setE3: (p) => bump({ e3: { ...get().e3, ...p } }),
    setE4: (p) => bump({ e4: { ...get().e4, ...p } }),
    setE5: (p) => bump({ e5: { ...get().e5, ...p } }),
    setHelp: (help) => set({ help }),
    play() {
      acClock.play();
      set({ playing: true });
    },
    pause() {
      acClock.pause();
      set({ playing: false });
    },
    togglePlay() {
      if (get().playing) get().pause();
      else get().play();
    },
    seek(t) {
      acClock.seek(t);
      set((s) => ({ version: s.version + 1 }));
    },
    step(frames) {
      if (get().playing) get().pause();
      const f = Math.round(acClock.peek() * FPS) + frames;
      get().seek(f / FPS + 1e-4);
    },
    say: (text) => set((s) => ({ toast: { text, id: (s.toast?.id ?? 0) + 1 } })),
  };
});

export const useAC = <T,>(sel: (s: ACState) => T) => useStore(acStore, sel);
