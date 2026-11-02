import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { MasterClock } from "@/engine/timeline/clock";
import { getScene, setActiveScene, type SceneId } from "@/labs/lens-and-framing/config";
import { clipFor } from "@/scene/animation/performances";
import { buildMove, defaultParams, dollyVsZoom, MOVE_INFO, withPosition } from "./engine/moves";
import { makeSubjectFn } from "./engine/subject";
import type { Move, MoveKind, MoveParams, SubjectFn, Vec3 } from "./engine/types";

/** The lab's own clock (the Lens lab has another). Ticked once per frame by the orchestrator. */
export const cmClock = new MasterClock({ durationS: 6, playing: true });

export type Experiment = "move" | "dollyVsZoom";

export interface CMState {
  sceneId: SceneId;
  kind: MoveKind;
  experiment: Experiment;
  params: MoveParams;
  /** Dragged key positions; cleared when the move or scene changes. */
  overrides: { start?: Vec3; end?: Vec3 };
  playing: boolean;
  dragging: null | "start" | "end";
  toast: { text: string; id: number } | null;
  /** Bumped whenever anything that changes the move changes (cheap cache key for the renderer). */
  version: number;
  setScene(id: SceneId): void;
  setKind(kind: MoveKind): void;
  setExperiment(e: Experiment): void;
  setParams(p: Partial<MoveParams>): void;
  setOverride(which: "start" | "end", pos: Vec3): void;
  resetPath(): void;
  setDragging(v: null | "start" | "end"): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  say(text: string): void;
}

const subjectCache = new Map<string, SubjectFn>();
/** Where Bram and Pip are at time t in a scene (cached per scene). */
export function subjectsFor(id: SceneId): SubjectFn {
  let f = subjectCache.get(id);
  if (!f) {
    f = makeSubjectFn(getScene(id), { primary: clipFor(id, "bram"), secondary: clipFor(id, "pip") });
    subjectCache.set(id, f);
  }
  return f;
}

export const cmStore = createStore<CMState>()(
  subscribeWithSelector((set, get) => {
    const bump = (patch: Partial<CMState>) => set((s) => ({ ...patch, version: s.version + 1 }));
    return {
      sceneId: "doorway",
      kind: "dollyIn",
      experiment: "move",
      params: defaultParams("dollyIn", getScene("doorway")),
      overrides: {},
      playing: true,
      dragging: null,
      toast: null,
      version: 0,
      setScene(id) {
        setActiveScene(id);
        const d = getScene(id);
        cmClock.durationS = d.timeline.durationS;
        cmClock.seek(0);
        bump({ sceneId: id, params: defaultParams(get().kind, d), overrides: {}, dragging: null });
      },
      setKind(kind) {
        bump({ kind, experiment: "move", params: defaultParams(kind, getScene(get().sceneId)), overrides: {} });
        get().say(MOVE_INFO[kind].label);
      },
      setExperiment(e) {
        if (e === "dollyVsZoom") bump({ experiment: e, kind: "dollyIn", params: { ...defaultParams("dollyIn", getScene(get().sceneId)), focalMm: 28 }, overrides: {} });
        else bump({ experiment: e, overrides: {} });
        get().say(e === "dollyVsZoom" ? "Dolly vs zoom" : MOVE_INFO[get().kind].label);
      },
      setParams(p) {
        bump({ params: { ...get().params, ...p } });
      },
      setOverride(which, pos) {
        bump({ overrides: { ...get().overrides, [which]: pos } });
      },
      resetPath() {
        bump({ overrides: {} });
        get().say("Path reset");
      },
      setDragging(v) {
        set({ dragging: v });
      },
      play() {
        cmClock.play();
        set({ playing: true });
      },
      pause() {
        cmClock.pause();
        set({ playing: false });
      },
      togglePlay() {
        if (get().playing) get().pause();
        else get().play();
      },
      seek(t) {
        cmClock.seek(t);
        set({ version: get().version });
      },
      say(text) {
        set((s) => ({ toast: { text, id: (s.toast?.id ?? 0) + 1 } }));
      },
    };
  }),
);

export const useCM = <T,>(sel: (s: CMState) => T) => useStore(cmStore, sel);

/** The views the monitors show: one move, or the dolly and the zoom side by side. */
export interface ShotView {
  id: "A" | "B";
  label: string;
  move: Move;
}

let cache: { version: number; views: ShotView[] } | null = null;
export function currentViews(s: CMState = cmStore.getState()): ShotView[] {
  if (cache && cache.version === s.version) return cache.views;
  const subj = subjectsFor(s.sceneId);
  let views: ShotView[];
  if (s.experiment === "dollyVsZoom") {
    const d0 = 4.2;
    const d1 = Math.max(1.0, d0 - s.params.amount);
    const { dolly, zoom } = dollyVsZoom(s.params, subj, d0, d1);
    views = [
      { id: "A", label: "Dolly", move: dolly },
      { id: "B", label: "Zoom", move: zoom },
    ];
  } else {
    let m = buildMove(s.kind, s.params, subj);
    if (s.overrides.start) m = withPosition(m, "start", s.overrides.start);
    if (s.overrides.end) m = withPosition(m, "end", s.overrides.end);
    views = [{ id: "A", label: MOVE_INFO[s.kind].label, move: m }];
  }
  cache = { version: s.version, views };
  return views;
}
