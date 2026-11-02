import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { MasterClock } from "@/engine/timeline/clock";
import { getScene, setActiveScene, type SceneId } from "@/labs/lens-and-framing/config";
import { clipFor } from "@/scene/animation/performances";
import { makeSubjectFn } from "@/labs/camera-movement/engine/subject";
import { clampToZone, coverageFor, crossLine, defaultCoverage, isCrossed, presetCamera, PRESET_LABEL, camSides } from "./engine/presets";
import { aimPoint } from "./engine/shots";
import { commit, editPreset, EDIT_PRESET_LABEL, insertCut, moveCut, normalize, removeCut, setShotCamera, undo, type EditPresetId } from "./engine/edit";
import { CAM_IDS, type CamId, type Cams, type CamSpec, type Cut, type PresetKind, type SubjectFn, type Who } from "./engine/types";

/** The lab's own clock (other labs have theirs). Ticked once per frame by the orchestrator. */
export const scClock = new MasterClock({ durationS: 6, playing: true });

export type Mode = "watch" | "inspect" | "experiment";

export interface SCState {
  sceneId: SceneId;
  mode: Mode;
  cameras: Cams;
  selected: CamId;
  edit: Cut[];
  past: Cut[][];
  editPreset: EditPresetId | null;
  playing: boolean;
  dragging: CamId | null;
  help: boolean;
  toast: { text: string; id: number } | null;
  /** Bumped whenever cameras or the edit change (cheap memo key for derived analysis). */
  version: number;
  setScene(id: SceneId): void;
  setMode(m: Mode): void;
  select(id: CamId): void;
  setCamera(id: CamId, patch: Partial<CamSpec>): void;
  applyPreset(id: CamId, kind: PresetKind, who?: Who): void;
  crossLine(id?: CamId): void;
  resetCameras(): void;
  cutTo(cam: CamId): void;
  setEdit(cuts: Cut[], record?: boolean): void;
  setShotCamera(index: number, cam: CamId): void;
  moveCut(index: number, t: number, record?: boolean): void;
  removeCut(index: number): void;
  beginTrim(): void;
  undo(): void;
  clearEdit(): void;
  applyEditPreset(id: EditPresetId): void;
  setDragging(id: CamId | null): void;
  setHelp(v: boolean): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  step(frames: number): void;
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

export const durationOf = (id: SceneId) => getScene(id).timeline.durationS;
/** The scene's story beats (timeline markers), where the classic edit cuts. */
export const beatsOf = (id: SceneId) => getScene(id).timeline.markers.map(([t]) => t);

const initialCams = (id: SceneId) => defaultCoverage(getScene(id), subjectsFor(id));

export const scStore = createStore<SCState>()(
  subscribeWithSelector((set, get) => {
    const bump = (patch: Partial<SCState>) => set((s) => ({ ...patch, version: s.version + 1 }));
    const T = () => durationOf(get().sceneId);
    const record = (next: Cut[], extra: Partial<SCState> = {}) => {
      const h = commit({ past: get().past, present: get().edit }, next);
      bump({ edit: h.present, past: h.past, ...extra });
    };
    return {
      sceneId: "doorway",
      mode: "experiment",
      cameras: initialCams("doorway"),
      selected: "C",
      edit: editPreset("classic", 6, beatsOf("doorway")),
      past: [],
      editPreset: "classic",
      playing: true,
      dragging: null,
      help: false,
      toast: null,
      version: 0,
      setScene(id) {
        setActiveScene(id);
        const T = durationOf(id);
        scClock.durationS = T;
        scClock.seek(0);
        bump({ sceneId: id, cameras: initialCams(id), edit: editPreset("classic", T, beatsOf(id)), past: [], editPreset: "classic", selected: "C" });
      },
      setMode(mode) {
        if (mode === get().mode) return;
        set({ mode, dragging: null });
        get().say(mode === "watch" ? "Watch: the cut, full frame" : mode === "inspect" ? "Inspect: cameras and the line" : "Experiment: shoot and cut");
      },
      select(id) {
        set({ selected: id });
      },
      setCamera(id, patch) {
        const s = get();
        const d = getScene(s.sceneId);
        const cur = s.cameras[id];
        const next: CamSpec = { ...cur, ...patch };
        if (patch.position) next.position = clampToZone(coverageFor(d).zone, patch.position);
        if (patch.aim === "free" && cur.aim !== "free" && !patch.target) next.target = aimPoint(cur, d, subjectsFor(s.sceneId), scClock.peek());
        const custom = patch.position || patch.aim || patch.focalMm || patch.target;
        if (custom && patch.preset === undefined) next.preset = "custom";
        bump({ cameras: { ...s.cameras, [id]: next }, editPreset: null });
      },
      applyPreset(id, kind, who) {
        const s = get();
        const d = getScene(s.sceneId);
        const cur = s.cameras[id];
        const w: Who = who ?? (cur.aim === "bram" || cur.aim === "pip" ? cur.aim : id === "B" ? "bram" : "pip");
        const cam = presetCamera(kind, w, d, subjectsFor(s.sceneId));
        bump({ cameras: { ...s.cameras, [id]: cam }, selected: id, editPreset: null });
        get().say(`${id}: ${kind === "ots" ? `OTS on ${w === "bram" ? "Bram" : "Pip"}` : kind === "master" ? PRESET_LABEL.master : `${PRESET_LABEL[kind]} · ${w === "bram" ? "Bram" : "Pip"}`}`);
      },
      crossLine(id) {
        const s = get();
        const which = id ?? s.selected;
        const d = getScene(s.sceneId);
        const subj = subjectsFor(s.sceneId);
        const cam = crossLine(s.cameras[which], d, subj);
        const cameras = { ...s.cameras, [which]: { ...cam, preset: s.cameras[which].preset } };
        bump({ cameras, selected: which, editPreset: null });
        const side = camSides(cameras, d, subj)[which];
        get().say(side < 0 ? `Camera ${which} crossed the line` : `Camera ${which} back on the front side`);
      },
      resetCameras() {
        bump({ cameras: initialCams(get().sceneId), editPreset: null });
        get().say("Default coverage");
      },
      cutTo(cam) {
        const next = insertCut(get().edit, scClock.peek(), cam, T());
        record(next, { editPreset: null });
        get().say(`Cut to ${cam}`);
      },
      setEdit(cuts, rec = true) {
        const next = normalize(cuts, T());
        if (rec) record(next, { editPreset: null });
        else bump({ edit: next, editPreset: null });
      },
      setShotCamera(index, cam) {
        record(setShotCamera(get().edit, index, cam), { editPreset: null });
      },
      beginTrim() {
        // Snapshot for undo at the start of a drag; the drag itself updates without recording.
        set((s) => ({ past: [...s.past, s.edit].slice(-60) }));
      },
      moveCut(index, t, rec = false) {
        const next = moveCut(get().edit, index, t, T());
        if (rec) record(next, { editPreset: null });
        else bump({ edit: next, editPreset: null });
      },
      removeCut(index) {
        record(removeCut(get().edit, index), { editPreset: null });
      },
      undo() {
        const h = undo({ past: get().past, present: get().edit });
        if (h.present === get().edit) {
          get().say("Nothing to undo");
          return;
        }
        bump({ edit: h.present, past: h.past, editPreset: null });
        get().say("Undo");
      },
      clearEdit() {
        record([{ t: 0, cam: get().edit[0]?.cam ?? "A" }], { editPreset: null });
        get().say("Edit cleared: one shot");
      },
      applyEditPreset(id) {
        const s = get();
        const d = getScene(s.sceneId);
        const subj = subjectsFor(s.sceneId);
        let cameras = defaultCoverage(d, subj);
        if (id === "crossing") cameras = { ...cameras, C: crossLine(cameras.C, d, subj) };
        const h = commit({ past: s.past, present: s.edit }, editPreset(id, T(), beatsOf(s.sceneId)));
        bump({ cameras, edit: h.present, past: h.past, editPreset: id, selected: "C" });
        get().say(EDIT_PRESET_LABEL[id]);
      },
      setDragging(id) {
        set({ dragging: id });
      },
      setHelp(v) {
        set({ help: v });
      },
      play() {
        scClock.play();
        set({ playing: true });
      },
      pause() {
        scClock.pause();
        set({ playing: false });
      },
      togglePlay() {
        if (get().playing) get().pause();
        else get().play();
      },
      seek(t) {
        scClock.seek(Math.min(T() - 1e-3, Math.max(0, t)));
      },
      step(frames) {
        if (get().playing) get().pause();
        const fps = getScene(get().sceneId).timeline.fps;
        const T0 = T();
        scClock.seek((((scClock.peek() + frames / fps) % T0) + T0) % T0);
      },
      say(text) {
        set((s) => ({ toast: { text, id: (s.toast?.id ?? 0) + 1 } }));
      },
    };
  }),
);

export const useSC = <T,>(sel: (s: SCState) => T) => useStore(scStore, sel);

/** Whether the cameras are split across the line (at the scene's reference time). */
export function crossedNow(s: SCState = scStore.getState()): boolean {
  return isCrossed(s.cameras, getScene(s.sceneId), subjectsFor(s.sceneId));
}

export { CAM_IDS };
