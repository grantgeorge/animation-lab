"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { easeInOut, lerpRig, TRANSITION_S } from "./engine/interpolate";
import { DEFAULT_PRESET_ID, TAKE_APART_STEPS, cloneRig, getPreset, soloMask, type PresetId } from "./engine/presets";
import { clampPlacement } from "./engine/spherical";
import { FULL_MASK, type ChannelId, type ChannelMask, type Environment, type LightId, type LightParams, type Rig } from "./engine/types";
import type { ShotSize } from "./config";

export type View = "shot" | "inspect";

export interface Toast {
  id: number;
  text: string;
  key?: string;
}

interface Transition {
  from: Rig;
  to: Rig;
  startMs: number;
  durMs: number;
}

export interface StudioState {
  rig: Rig;
  presetId: PresetId;
  /** True once the user has edited the active preset. */
  modified: boolean;
  selected: ChannelId;
  view: View;
  shotSize: ShotSize;
  playing: boolean;
  solo: ChannelId | null;
  /** Take-apart step index, or null when off. */
  takeApart: number | null;
  helpOpen: boolean;
  toasts: Toast[];
  transition: Transition | null;
  dragging: boolean;
  reducedMotion: boolean;

  applyPreset: (id: PresetId, opts?: { instant?: boolean }) => void;
  setLight: (id: LightId, patch: Partial<LightParams>) => void;
  setEnv: (patch: Partial<Environment>) => void;
  select: (id: ChannelId) => void;
  setView: (v: View) => void;
  setShotSize: (s: ShotSize) => void;
  setPlaying: (p: boolean) => void;
  toggleSolo: (id: ChannelId) => void;
  setTakeApart: (step: number | null) => void;
  setHelpOpen: (open: boolean) => void;
  setDragging: (d: boolean) => void;
  toast: (text: string, key?: string) => void;
  /** Advance a running preset transition; returns true while it is still running. */
  advance: (nowMs: number) => boolean;
}

let toastId = 0;
const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

export const studioStore = create<StudioState>()(
  subscribeWithSelector((set, get) => ({
    rig: cloneRig(getPreset(DEFAULT_PRESET_ID)!.rig),
    presetId: DEFAULT_PRESET_ID,
    modified: false,
    selected: "key",
    view: "shot",
    shotSize: "close",
    playing: true,
    solo: null,
    takeApart: null,
    helpOpen: false,
    toasts: [],
    transition: null,
    dragging: false,
    reducedMotion: false,

    applyPreset: (id, opts) => {
      const p = getPreset(id);
      if (!p) return;
      const to = cloneRig(p.rig);
      const instant = opts?.instant || get().reducedMotion;
      set((s) => ({
        presetId: id,
        modified: false,
        solo: null,
        takeApart: s.takeApart === null ? null : TAKE_APART_STEPS.length - 1,
        rig: instant ? to : s.rig,
        transition: instant ? null : { from: cloneRig(s.rig), to, startMs: now(), durMs: TRANSITION_S * 1000 },
      }));
    },

    setLight: (id, patch) =>
      set((s) => {
        const p = clampPlacement(patch);
        return {
          transition: null,
          modified: true,
          rig: { ...s.rig, lights: { ...s.rig.lights, [id]: { ...s.rig.lights[id], ...p } } },
        };
      }),

    setEnv: (patch) => set((s) => ({ transition: null, modified: true, rig: { ...s.rig, env: { ...s.rig.env, ...patch } } })),

    select: (id) => set({ selected: id }),
    setView: (view) => set({ view }),
    setShotSize: (shotSize) => set({ shotSize }),
    setPlaying: (playing) => set({ playing }),
    toggleSolo: (id) => set((s) => ({ solo: s.solo === id ? null : id, selected: id })),
    setTakeApart: (step) =>
      set(() => {
        if (step === null) return { takeApart: null };
        const i = Math.max(0, Math.min(TAKE_APART_STEPS.length - 1, step));
        return { takeApart: i, solo: null, selected: TAKE_APART_STEPS[i].adds };
      }),
    setHelpOpen: (helpOpen) => set({ helpOpen }),
    setDragging: (dragging) => set({ dragging }),

    toast: (text, key) => {
      const t = { id: ++toastId, text, key };
      set((s) => ({ toasts: [...s.toasts.slice(-2), t] }));
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 1800);
    },

    advance: (nowMs) => {
      const tr = get().transition;
      if (!tr) return false;
      const u = (nowMs - tr.startMs) / tr.durMs;
      if (u >= 1) {
        set({ rig: tr.to, transition: null });
        return false;
      }
      set({ rig: lerpRig(tr.from, tr.to, easeInOut(u)) });
      return true;
    },
  })),
);

export const useStudio = studioStore;

/** Start each visit with a fresh rig; module state otherwise survives client navigation. */
export function initializeStudio(options: {
  reducedMotion: boolean;
  freeze: number | null;
  presetId?: PresetId;
  view?: View;
  shotSize?: ShotSize;
}) {
  const presetId = options.presetId ?? DEFAULT_PRESET_ID;
  studioStore.setState({
    ...studioStore.getInitialState(),
    rig: cloneRig(getPreset(presetId)!.rig),
    presetId,
    view: options.view ?? "shot",
    shotSize: options.shotSize ?? "close",
    reducedMotion: options.reducedMotion,
    playing: !options.reducedMotion && options.freeze === null,
    toasts: [],
  });
}

/** Channel visibility from solo / take-apart (the look itself is untouched). */
export function channelMask(s: Pick<StudioState, "solo" | "takeApart">): ChannelMask {
  if (s.solo) return soloMask(s.solo);
  if (s.takeApart !== null) return TAKE_APART_STEPS[s.takeApart].mask;
  return FULL_MASK;
}

/** The rig the transition is heading to (or the current one). */
export const targetRig = (s: StudioState) => s.transition?.to ?? s.rig;
