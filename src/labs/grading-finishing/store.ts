import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { MasterClock } from "@/engine/timeline/clock";
import { getScene, setActiveScene, type SceneId } from "@/labs/lens-and-framing/config";
import { NEUTRAL_LOOK, applyPatch, applySimple, lookFromPreset, type Look, type LookId, type LookPatch, type SimpleSliders } from "./engine/look";
import { NEUTRAL_MATCH, type MatchParams } from "./engine/match";
import { NEUTRAL_OVERRIDE, SHOTS, SUGGESTED_OVERRIDE, type ShotOverride, type ShowShotState, type ShowStep } from "./engine/shots";

export type Mode = "watch" | "inspect" | "experiment";
export type View = "shot" | "show";
export type NodeId = "grade" | "stylize" | "lens" | "halation" | "bloom" | "vignette" | "sharpen" | "grain" | "weave";
export type Tab = "grade" | "finish" | "looks";
export type Isolate = null | "halation" | "bloom";

/** The finishing stack in pipeline order (grade → stylize → finish → deliver). */
export const NODE_ORDER: readonly NodeId[] = ["grade", "stylize", "lens", "halation", "bloom", "vignette", "sharpen", "grain", "weave"];

export const gfClock = new MasterClock({ durationS: 6, playing: true });

const freshShots = (): Record<SceneId, ShowShotState> =>
  Object.fromEntries(SHOTS.map((s) => [s.id, { match: { ...NEUTRAL_MATCH }, override: NEUTRAL_OVERRIDE }])) as Record<SceneId, ShowShotState>;

export interface GFState {
  mode: Mode;
  view: View;
  shot: SceneId;
  look: Look;
  /** The preset the look came from, or null once edited. */
  lookId: LookId | null;
  nodes: Record<NodeId, boolean>;
  advanced: boolean;
  tab: Tab;
  /** Before/after wipe position 0–1, or null when off. */
  wipe: number | null;
  isolate: Isolate;
  playing: boolean;
  step: ShowStep;
  shots: Record<SceneId, ShowShotState>;
  help: boolean;
  toast: { text: string; id: number } | null;
  /** Gallery stills for the show view are loaded (textures and CPU copies). */
  platesReady: boolean;
  setMode(m: Mode): void;
  setView(v: View): void;
  setShot(id: SceneId): void;
  applyLook(id: LookId): void;
  patchLook(p: LookPatch): void;
  setSimple(k: keyof SimpleSliders, v: number): void;
  resetLook(): void;
  setNode(id: NodeId, on: boolean): void;
  setAdvanced(v: boolean): void;
  setTab(t: Tab): void;
  setWipe(v: number | null): void;
  setIsolate(v: Isolate): void;
  setStep(s: ShowStep): void;
  setMatch(id: SceneId, m: Partial<MatchParams>): void;
  setOverride(id: SceneId, o: ShotOverride): void;
  suggestOverride(): void;
  resetShow(): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  setHelp(v: boolean): void;
  say(text: string): void;
}

const allNodes = (): Record<NodeId, boolean> => Object.fromEntries(NODE_ORDER.map((n) => [n, true])) as Record<NodeId, boolean>;

export const gfStore = createStore<GFState>()(
  subscribeWithSelector((set, get) => ({
    mode: "experiment",
    view: "shot",
    shot: "doorway",
    look: NEUTRAL_LOOK,
    lookId: "clean",
    nodes: allNodes(),
    advanced: false,
    tab: "grade",
    wipe: null,
    isolate: null,
    playing: true,
    step: "raw",
    shots: freshShots(),
    help: false,
    toast: null,
    platesReady: false,
    setMode: (mode) => set({ mode, wipe: mode === "inspect" ? (get().wipe ?? 0.5) : get().wipe, isolate: null }),
    setView: (view) => set({ view }),
    setShot: (id) => {
      if (id === get().shot) return;
      setActiveScene(id);
      const t = gfClock.peek();
      gfClock.durationS = getScene(id).timeline.durationS;
      gfClock.seek(Math.min(t, gfClock.durationS - 1 / 24));
      set({ shot: id });
    },
    applyLook: (id) => set({ look: lookFromPreset(id), lookId: id, nodes: allNodes(), isolate: null }),
    patchLook: (p) => set({ look: applyPatch(get().look, p), lookId: null }),
    setSimple: (k, v) => set({ look: applySimple(get().look, k, v), lookId: null }),
    resetLook: () => set({ look: NEUTRAL_LOOK, lookId: "clean", nodes: allNodes(), isolate: null }),
    setNode: (id, on) => set({ nodes: { ...get().nodes, [id]: on } }),
    setAdvanced: (advanced) => set({ advanced }),
    setTab: (tab) => set({ tab }),
    setWipe: (wipe) => set({ wipe: wipe === null ? null : Math.min(1, Math.max(0, wipe)) }),
    setIsolate: (isolate) => set({ isolate }),
    setStep: (step) => set({ step }),
    setMatch: (id, m) => {
      const shots = get().shots;
      set({ shots: { ...shots, [id]: { ...shots[id], match: { ...shots[id].match, ...m } } } });
    },
    setOverride: (id, o) => {
      const shots = get().shots;
      set({ shots: { ...shots, [id]: { ...shots[id], override: o } } });
    },
    suggestOverride: () => {
      get().setOverride(SUGGESTED_OVERRIDE.shot, SUGGESTED_OVERRIDE.override);
      get().setShot(SUGGESTED_OVERRIDE.shot);
    },
    resetShow: () => set({ shots: freshShots(), step: "raw" }),
    play: () => {
      gfClock.play();
      set({ playing: true });
    },
    pause: () => {
      gfClock.pause();
      set({ playing: false });
    },
    togglePlay: () => (get().playing ? get().pause() : get().play()),
    seek: (t) => gfClock.seek(t),
    setHelp: (help) => set({ help }),
    say: (text) => set({ toast: { text, id: Date.now() } }),
  })),
);

export const useGF = <T,>(sel: (s: GFState) => T) => useStore(gfStore, sel);
