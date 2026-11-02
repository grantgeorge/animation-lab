import { isSceneId, sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { labStore } from "@/ui/store/labStore";
import { labEvents, type LabEvent } from "@/ui/store/events";
import { exerciseById } from "./exercises";
import { initialProgress, lessonStore, type ExerciseId, type ObjectiveId, type SavedShot } from "./lessonStore";
import { promptPhrase } from "@/engine/export/prompt";
import { measure } from "@/engine/measure";
import { distanceToPrimaryAlongRail } from "@/engine/rig";
import { labClock } from "@/renderer/runtime/clock";

export const HOLD_MS = 1000;
const PRESETS = d.focal.presets;
const snapPreset = (f: number) => PRESETS.find((p) => Math.abs(p - f) <= 0.5) ?? null;

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let armed = false;
let shotCounter = 0;

function cancelHold() {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
  armed = false;
}

function setProgress(fn: (p: ReturnType<typeof initialProgress>) => void) {
  const progress = structuredClone(lessonStore.getState().progress);
  fn(progress);
  lessonStore.setState({ progress });
  checkComplete();
}

function checkComplete() {
  const s = lessonStore.getState();
  if (!s.active || s.completed[s.active]) return;
  if (exerciseById(s.active).complete(s)) {
    lessonStore.setState({ completed: { ...s.completed, [s.active]: new Date().toISOString() } });
    labEvents.emit({ type: "exerciseCompleted", id: s.active });
    labStore.getState().toast(`Exercise ${exerciseById(s.active).number} complete`);
  }
}

function onPresetHeld(f: number) {
  const { camera } = labStore.getState();
  labEvents.emit({ type: "presetHeld", f, mode: camera.mode, target: camera.targetId });
  const active = lessonStore.getState().active;
  if (active === "ex1" && camera.mode === "fixed") setProgress((p) => void (p.ex1.held.includes(f) || p.ex1.held.push(f)));
  if (active === "ex2" && camera.mode === "match") {
    setProgress((p) => {
      if (p.ex2.target !== null && p.ex2.target !== camera.targetId) {
        p.ex2 = { target: camera.targetId, held: [], travelM: 0 };
      }
      p.ex2.target = camera.targetId;
      if (!p.ex2.held.includes(f)) p.ex2.held.push(f);
    });
  }
}

function onEvent(e: LabEvent) {
  if (e.type === "sceneChanged") {
    cancelHold();
    return;
  }
  if (e.type === "focalChanged" || e.type === "modeChanged" || e.type === "targetChanged") {
    if (e.type === "focalChanged" && (e.source === "exercise" || e.source === "restore")) return;
    armed = true;
  }
  if (e.type === "cameraTravelled" && lessonStore.getState().active === "ex2" && labStore.getState().camera.mode === "match") {
    setProgress((p) => void (p.ex2.travelM += e.metres));
  }
  if (!armed) return;
  if (e.type === "focalChanged" || e.type === "modeChanged" || e.type === "targetChanged") {
    if (holdTimer) clearTimeout(holdTimer);
    const f = snapPreset(labStore.getState().camera.rig.focalMm);
    if (f === null) return;
    holdTimer = setTimeout(() => {
      if (snapPreset(labStore.getState().camera.rig.focalMm) === f) onPresetHeld(f);
    }, HOLD_MS);
  }
}

let attached = false;
export function attachLessonEngine() {
  if (attached) return () => undefined;
  attached = true;
  const off = labEvents.on(onEvent);
  return () => {
    off();
    cancelHold();
    attached = false;
  };
}

export function startExercise(id: ExerciseId) {
  cancelHold();
  const st = labStore.getState();
  const s = lessonStore.getState();
  if (s.completed[id]) {
    // replaying: reset just this exercise
    const progress = structuredClone(s.progress);
    progress[id] = initialProgress()[id] as never;
    const completed = { ...s.completed };
    delete completed[id];
    lessonStore.setState({ progress, completed });
  }
  lessonStore.setState({ active: id, cardOpen: true, objective: id === "ex3" ? "reaction" : null });
  if (id === "ex1") {
    st.setMode("fixed");
    st.setTarget("primary");
    st.setDistance(3, "restore");
    st.setFocal(50, "exercise");
  } else if (id === "ex2") {
    st.setMode("fixed");
    st.setTarget("primary");
    st.setFocal(50, "exercise");
    st.setDistance(distanceForMetric(d.exercises.ex2Start.metric), "restore");
    st.setMode("match");
  }
  // Setup can emit mode/target changes; only subsequent learner choices count as a hold.
  cancelHold();
  labEvents.emit({ type: "exerciseStarted", id });
}

/** Distance at which Bram's head & shoulders fill `metric` of the frame at 50 mm. */
function distanceForMetric(metric: number) {
  const box = d.characters.primary.framingBox;
  return ((box.top - box.bottom) * 50) / (metric * d.gate.heightMm);
}

export function exitExercise() {
  cancelHold();
  lessonStore.setState({ active: null, objective: null });
}

export function setObjective(o: ObjectiveId) {
  lessonStore.setState({ objective: o });
}

export function saveShot(objective: ObjectiveId | null = lessonStore.getState().active === "ex3" ? lessonStore.getState().objective : null) {
  const { camera } = labStore.getState();
  const t = labClock.peek();
  const m = measure(d, camera.rig, camera.targetId, { timeS: t, matchRef: camera.matchRef, mode: camera.mode });
  const id = `shot-${Date.now().toString(36)}-${++shotCounter}`;
  const shot: SavedShot = {
    id,
    createdAt: new Date().toISOString(),
    objective,
    summary: `${m.shotSize} · ${Math.round(m.focalMm)} mm · ${distanceToPrimaryAlongRail(d, camera.rig.railS).toFixed(1)} m · ${camera.mode === "match" ? "Match" : "Fixed"} · ${m.targetName}`,
    phrase: promptPhrase(m).phrase,
    settings: { sceneId: labStore.getState().ui.sceneId, rig: { ...camera.rig }, mode: camera.mode, targetId: camera.targetId, matchRef: camera.matchRef ? structuredClone(camera.matchRef) : null, timeS: t },
  };
  const s = lessonStore.getState();
  const shots = [...s.shots, shot].slice(-12);
  const progress = structuredClone(s.progress);
  if (objective) progress.ex3.saved[objective] = id;
  lessonStore.setState({ shots, progress });
  labEvents.emit({ type: "shotSaved", id, objective });
  labStore.getState().toast(objective ? `Saved for “${objective === "reaction" ? "reaction" : "relationship"}”` : "Shot saved", "S");
  if (objective === "reaction" && !progress.ex3.saved.relationship) lessonStore.setState({ objective: "relationship" });
  checkComplete();
  return shot;
}

export function restoreShot(id: string) {
  const shot = lessonStore.getState().shots.find((x) => x.id === id);
  if (!shot) return;
  const { settings } = shot;
  const sceneId = isSceneId(settings.sceneId) ? settings.sceneId : "doorway";
  labStore.getState().setScene(sceneId);
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (sceneId === "doorway") url.searchParams.delete("scene");
    else url.searchParams.set("scene", sceneId);
    window.history.replaceState(window.history.state, "", url);
  }
  labStore.setState((s) => ({
    camera: {
      ...s.camera,
      rig: { ...settings.rig },
      mode: settings.mode,
      targetId: settings.targetId,
      matchRef: settings.matchRef,
      clampHint: null,
      version: s.camera.version + 1,
      lastSource: "restore",
    },
  }));
  labStore.getState().pause();
  labStore.getState().seek(settings.timeS);
  labEvents.emit({ type: "shotRestored", id });
  labStore.getState().toast(`Restored · paused at ${settings.timeS.toFixed(2)} s · Space to play`);
}

export function deleteShot(id: string) {
  const s = lessonStore.getState();
  lessonStore.setState({ shots: s.shots.filter((x) => x.id !== id) });
}
