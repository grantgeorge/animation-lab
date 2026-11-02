import { createStore, useStore } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { sceneDescriptor as d, setActiveScene, type SceneId } from "@/labs/lens-and-framing/config";
import type { CameraMode, CameraRig, ClampHint, MatchRef, TargetId } from "@/engine/types";
import { clamp } from "@/engine/math";
import { captureMatchRef, solveMatchedFraming } from "@/engine/matchFraming";
import { clampRailS, distanceToPrimaryAlongRail, railSForPrimaryDistance } from "@/engine/rig";
import { memoryStorage } from "@/lib/storage";
import { labClock } from "@/renderer/runtime/clock";
import { type DistanceSource, type FocalSource, labEvents } from "./events";

export type PrimaryView = "stage" | "shot";
export type QualityPref = "auto" | "high" | "low";
export type ViewKey = "frustum" | "grid" | "rulers" | "labels" | "thirds" | "safeAreas" | "perspectiveGuide" | "shotVignette";

export interface Toast {
  id: number;
  key?: string;
  text: string;
}

export interface LabState {
  camera: {
    rig: CameraRig;
    targetId: TargetId;
    mode: CameraMode;
    matchRef: MatchRef | null;
    clampHint: ClampHint;
    /** Bumped on every camera change so the presentation knows whether to travel. */
    version: number;
    lastSource: FocalSource | DistanceSource | "target" | "mode" | "reset";
  };
  timeline: { playing: boolean; speed: 0.25 | 0.5 | 1; seekTime: number };
  viz: Record<ViewKey, boolean>;
  ui: {
    primaryView: PrimaryView;
    fullscreenShot: boolean;
    uiHidden: boolean;
    helpOpen: boolean;
    exportOpen: boolean;
    quality: QualityPref;
    observerPresetId: "overview" | "profile" | "topdown" | "throughLens";
    /** The active scene (set + performance). Switching remounts the lab's scene subtree. */
    sceneId: SceneId;
    observerPresetNonce: number;
    contextLost: boolean;
    toasts: Toast[];
  };
  interaction: { dragging: null | "dolly" | "ring"; hover: null | string; selected: null | "camera" };

  // camera actions
  setFocal(mm: number, source: FocalSource): void;
  nudgeFocal(deltaMm: number): void;
  setRailS(s: number, source: DistanceSource): void;
  setDistance(dPrimary: number, source: DistanceSource): void;
  nudgeDistance(deltaM: number): void;
  nudgeFraming(factor: number): void;
  setTarget(id: TargetId): void;
  cycleTarget(): void;
  setMode(mode: CameraMode): void;
  setFraming(metric: number): void;
  resetCamera(): void;
  setScene(id: SceneId): void;
  // timeline
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  step(frames: number): void;
  restart(): void;
  // view / ui
  toggleViz(key: ViewKey): void;
  setPrimaryView(v: PrimaryView): void;
  swapViews(): void;
  toggleFullscreenShot(): void;
  setUiHidden(v: boolean): void;
  setHelpOpen(v: boolean): void;
  setExportOpen(v: boolean): void;
  setQuality(q: QualityPref): void;
  setObserverPreset(id: LabState["ui"]["observerPresetId"]): void;
  setContextLost(v: boolean): void;
  toast(text: string, key?: string): void;
  dismissToast(id: number): void;
  setInteraction(patch: Partial<LabState["interaction"]>): void;
}

const initialCamera = (): LabState["camera"] => ({
  rig: { ...d.defaultRig },
  targetId: "primary",
  mode: "fixed",
  matchRef: null,
  clampHint: null,
  version: 0,
  lastSource: "reset",
});

let toastId = 0;

export const labStore = createStore<LabState>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
        const commitCamera = (patch: Partial<LabState["camera"]>, source: LabState["camera"]["lastSource"]) =>
          set((s) => ({ camera: { ...s.camera, ...patch, version: s.camera.version + 1, lastSource: source } }));

        return {
          camera: initialCamera(),
          timeline: { playing: true, speed: 1, seekTime: 0 },
          viz: {
            frustum: true,
            grid: true,
            rulers: true,
            labels: true,
            thirds: false,
            safeAreas: false,
            perspectiveGuide: false,
            shotVignette: true,
          },
          ui: {
            primaryView: "shot",
            fullscreenShot: false,
            uiHidden: false,
            helpOpen: false,
            exportOpen: false,
            quality: "auto",
            observerPresetId: "overview",
            observerPresetNonce: 0,
            sceneId: "doorway",
            contextLost: false,
            toasts: [],
          },
          interaction: { dragging: null, hover: null, selected: null },

          setFocal(mm, source) {
            const f = clamp(Math.round(mm * 10) / 10, d.focal.min, d.focal.max);
            const cam = get().camera;
            if (f === cam.rig.focalMm) return;
            if (cam.mode === "fixed" || !cam.matchRef) {
              commitCamera({ rig: { ...cam.rig, focalMm: f } }, source);
              labEvents.emit({ type: "focalChanged", f, source });
              return;
            }
            const sol = solveMatchedFraming(d, cam.rig, cam.targetId, cam.matchRef, f);
            const travelled = Math.abs(sol.rig.railS - cam.rig.railS);
            commitCamera({ rig: sol.rig, clampHint: sol.clamped }, source);
            labEvents.emit({ type: "focalChanged", f, source });
            labEvents.emit({
              type: "distanceChanged",
              d: distanceToPrimaryAlongRail(d, sol.rig.railS),
              railS: sol.rig.railS,
              source: "solver",
            });
            if (travelled > 1e-6) labEvents.emit({ type: "cameraTravelled", metres: travelled });
            if (sol.clamped) labEvents.emit({ type: "clampHit", kind: sol.clamped });
          },
          nudgeFocal(deltaMm) {
            get().setFocal(Math.round(get().camera.rig.focalMm + deltaMm), "key");
          },
          setRailS(s, source) {
            const cam = get().camera;
            const c = clampRailS(d, s);
            const rig = { ...cam.rig, railS: c.railS };
            const matchRef = cam.mode === "match" ? captureMatchRef(d, rig, cam.targetId) : null;
            commitCamera({ rig, matchRef, clampHint: c.hint }, source);
            labEvents.emit({ type: "distanceChanged", d: distanceToPrimaryAlongRail(d, c.railS), railS: c.railS, source });
            if (c.hint) labEvents.emit({ type: "clampHit", kind: c.hint });
          },
          setDistance(dPrimary, source) {
            get().setRailS(railSForPrimaryDistance(d, dPrimary), source);
          },
          nudgeDistance(deltaM) {
            const cam = get().camera;
            get().setDistance(distanceToPrimaryAlongRail(d, cam.rig.railS) + deltaM, "key");
          },
          nudgeFraming(factor) {
            const cam = get().camera;
            if (cam.mode !== "match" || !cam.matchRef) return;
            get().setFraming(cam.matchRef.metric * factor);
          },
          setTarget(id) {
            const cam = get().camera;
            if (id === cam.targetId) return;
            const matchRef = cam.mode === "match" ? captureMatchRef(d, cam.rig, id) : null;
            commitCamera({ targetId: id, matchRef, clampHint: null }, "target");
            labEvents.emit({ type: "targetChanged", target: id });
          },
          cycleTarget() {
            const order: TargetId[] = ["primary", "secondary", "both"];
            const i = order.indexOf(get().camera.targetId);
            get().setTarget(order[(i + 1) % order.length]);
          },
          setMode(mode) {
            const cam = get().camera;
            if (mode === cam.mode) return;
            const matchRef = mode === "match" ? captureMatchRef(d, cam.rig, cam.targetId) : null;
            commitCamera({ mode, matchRef, clampHint: null }, "mode");
            labEvents.emit({ type: "modeChanged", mode });
          },
          setFraming(metric) {
            const cam = get().camera;
            if (cam.mode !== "match" || !cam.matchRef) return;
            const matchRef = { ...cam.matchRef, metric };
            const sol = solveMatchedFraming(d, cam.rig, cam.targetId, matchRef, cam.rig.focalMm);
            commitCamera({ rig: sol.rig, matchRef, clampHint: sol.clamped }, "solver");
            labEvents.emit({
              type: "distanceChanged",
              d: distanceToPrimaryAlongRail(d, sol.rig.railS),
              railS: sol.rig.railS,
              source: "solver",
            });
          },
          resetCamera() {
            set((s) => ({ camera: { ...initialCamera(), version: s.camera.version + 1 } }));
          },
          setScene(id) {
            if (id === get().ui.sceneId && id === d.scene.id) return;
            setActiveScene(id);
            labClock.durationS = d.timeline.durationS;
            labClock.seek(0);
            set((s) => ({
              ui: { ...s.ui, sceneId: id, observerPresetId: "overview", observerPresetNonce: s.ui.observerPresetNonce + 1 },
              camera: { ...initialCamera(), version: s.camera.version + 1 },
              timeline: { ...s.timeline, seekTime: 0 },
            }));
            labEvents.emit({ type: "sceneChanged", scene: id });
          },

          play() {
            labClock.play();
            set((s) => ({ timeline: { ...s.timeline, playing: true } }));
            labEvents.emit({ type: "playbackChanged", playing: true });
          },
          pause() {
            labClock.pause();
            set((s) => ({ timeline: { ...s.timeline, playing: false, seekTime: labClock.peek() } }));
            labEvents.emit({ type: "playbackChanged", playing: false });
          },
          togglePlay() {
            if (get().timeline.playing) get().pause();
            else get().play();
          },
          seek(t) {
            labClock.seek(t);
            set((s) => ({ timeline: { ...s.timeline, seekTime: labClock.peek() } }));
            labEvents.emit({ type: "timeScrubbed", t: labClock.peek() });
          },
          step(frames) {
            if (get().timeline.playing) get().pause();
            get().seek(labClock.peek() + frames / d.timeline.fps);
          },
          restart() {
            get().seek(0);
          },

          toggleViz(key) {
            const on = !get().viz[key];
            set((s) => ({ viz: { ...s.viz, [key]: on } }));
            labEvents.emit({ type: "overlayToggled", key, on });
          },
          setPrimaryView(v) {
            set((s) => ({ ui: { ...s.ui, primaryView: v } }));
            labEvents.emit({ type: "viewSwapped", primary: v });
          },
          swapViews() {
            get().setPrimaryView(get().ui.primaryView === "stage" ? "shot" : "stage");
          },
          toggleFullscreenShot() {
            set((s) => ({ ui: { ...s.ui, fullscreenShot: !s.ui.fullscreenShot } }));
          },
          setUiHidden(v) {
            set((s) => ({ ui: { ...s.ui, uiHidden: v } }));
          },
          setHelpOpen(v) {
            set((s) => ({ ui: { ...s.ui, helpOpen: v } }));
          },
          setExportOpen(v) {
            set((s) => ({ ui: { ...s.ui, exportOpen: v } }));
          },
          setQuality(q) {
            set((s) => ({ ui: { ...s.ui, quality: q } }));
          },
          setObserverPreset(id) {
            set((s) => ({ ui: { ...s.ui, observerPresetId: id, observerPresetNonce: s.ui.observerPresetNonce + 1 } }));
          },
          setContextLost(v) {
            set((s) => ({ ui: { ...s.ui, contextLost: v } }));
          },
          toast(text, key) {
            const id = ++toastId;
            set((s) => ({ ui: { ...s.ui, toasts: [...s.ui.toasts.slice(-1), { id, text, key }] } }));
            if (typeof window !== "undefined") window.setTimeout(() => get().dismissToast(id), 1600);
          },
          dismissToast(id) {
            set((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } }));
          },
          setInteraction(patch) {
            set((s) => ({ interaction: { ...s.interaction, ...patch } }));
          },
        };
      },
      {
        name: "animation-lab:lens-framing",
        version: 1,
        skipHydration: true,
        storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage() : window.localStorage)),
        partialize: (s) => ({ viz: s.viz, ui: { quality: s.ui.quality } }),
        merge: (persisted, current) => {
          const p = persisted as Partial<{ viz: LabState["viz"]; ui: { quality: QualityPref } }>;
          return {
            ...current,
            viz: { ...current.viz, ...(p?.viz ?? {}) },
            ui: { ...current.ui, quality: p?.ui?.quality ?? current.ui.quality },
          };
        },
      },
    ),
  ),
);

export function useLab<T>(selector: (s: LabState) => T): T {
  return useStore(labStore, selector);
}

export function useLabShallow<T extends object>(selector: (s: LabState) => T): T {
  return useStore(labStore, useShallow(selector));
}

/** A new visit keeps user preferences, but starts from a clean camera and playback session. */
export function initializeLabSession(options: {
  sceneId?: SceneId;
  reducedMotion?: boolean;
  freeze?: number | null;
  observerPreset?: LabState["ui"]["observerPresetId"];
  uiHidden?: boolean;
} = {}) {
  const previous = labStore.getState();
  const initial = labStore.getInitialState();
  const sceneId = options.sceneId ?? "doorway";
  setActiveScene(sceneId);
  labClock.pause();
  labClock.durationS = d.timeline.durationS;
  labClock.setSpeed(1);
  labClock.seek(options.freeze ?? 0);
  const playing = !options.reducedMotion && options.freeze == null;
  labStore.setState({
    camera: { ...initialCamera(), version: previous.camera.version + 1 },
    timeline: { playing, speed: 1, seekTime: labClock.peek() },
    viz: { ...previous.viz },
    ui: {
      ...initial.ui,
      sceneId,
      quality: previous.ui.quality,
      observerPresetId: options.observerPreset ?? "overview",
      observerPresetNonce: previous.ui.observerPresetNonce + 1,
      uiHidden: options.uiHidden ?? false,
      toasts: [],
    },
    interaction: { ...initial.interaction },
  });
  labEvents.clear();
  if (playing) labClock.play();
}
