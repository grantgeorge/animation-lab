import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { MasterClock } from "@/engine/timeline/clock";
import { doorwayScene } from "@/labs/lens-and-framing/config";
import { CAMERAS, DEFAULT_CAMERA, getCamera, isCameraId, type CameraId } from "./engine/cameras";
import { FORMATS } from "./engine/formats";
import { equivalentFocal, equivalentStop } from "./engine/optics";
import { blindRound, assignGuess, type BlindRound, type Guesses } from "./engine/blind";
import { markDepth, type MarkId } from "./engine/shot";
import { playbackSpeed } from "./engine/shutter";
import type { LookId } from "./engine/looks";

/** The lab's own clock; ticked once per frame by the orchestrator. */
export const cfClock = new MasterClock({ durationS: doorwayScene.timeline.durationS, playing: true });

export type Mode = "watch" | "inspect" | "experiment";
export type Step = "sensor" | "focal" | "aperture" | "shutter" | "response" | "blind";
export const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];
export const STEPS: readonly Step[] = ["sensor", "focal", "aperture", "shutter", "response", "blind"];
export const isMode = (v: unknown): v is Mode => typeof v === "string" && (MODES as readonly string[]).includes(v);
export const isStep = (v: unknown): v is Step => typeof v === "string" && (STEPS as readonly string[]).includes(v);

/** "Same lens": the focal length stays when the format changes. "Same framing": it scales with the gate width. */
export type Framing = "lens" | "framing";
export type FocusTarget = MarkId | "manual";

export interface CFState {
  mode: Mode;
  step: Step;
  cameraId: CameraId;
  framing: Framing;
  /** In same-framing mode, also scale the T-stop so depth of field stays identical. */
  matchDof: boolean;
  openGate: boolean;
  focalMm: number;
  tStop: number;
  focusTarget: FocusTarget;
  focusM: number;
  showBand: boolean;
  shutterDeg: number;
  fps: number;
  slowMotion: boolean;
  move: "locked" | "pan";
  /** Rolling-shutter test: when on, rolling-shutter cameras skew on the pan. */
  rollingTest: boolean;
  lookId: LookId;
  exposureStops: number;
  blind: BlindRound & { guesses: Guesses; revealed: boolean };
  playing: boolean;
  help: boolean;
  toast: { text: string; id: number } | null;
  /** Bumped on every change that alters the picture (cheap cache key). */
  version: number;
  setMode(m: Mode): void;
  setStep(s: Step): void;
  selectCamera(id: CameraId): void;
  setFraming(f: Framing): void;
  setMatchDof(on: boolean): void;
  setOpenGate(on: boolean): void;
  setFocal(mm: number): void;
  setStop(t: number): void;
  setFocus(target: FocusTarget, manualM?: number): void;
  setShowBand(on: boolean): void;
  setShutter(deg: number): void;
  setFps(fps: number, slowMotion?: boolean): void;
  setMove(m: "locked" | "pan"): void;
  setRollingTest(on: boolean): void;
  setLook(id: LookId): void;
  setExposure(stops: number): void;
  guess(monitor: 0 | 1 | 2, look: LookId): void;
  reveal(): void;
  nextRound(): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  setHelp(open: boolean): void;
  say(text: string): void;
}

const clampStop = (t: number) => Math.min(32, Math.max(0.7, t));

function syncClock(fps: number, slowMotion: boolean) {
  cfClock.setSpeed(playbackSpeed(fps, slowMotion));
}

export const cfStore = createStore<CFState>()(
  subscribeWithSelector((set, get) => {
    const bump = (patch: Partial<CFState>) => set((s) => ({ ...patch, version: s.version + 1 }));
    const cam0 = getCamera(DEFAULT_CAMERA);
    return {
      mode: "experiment",
      step: "sensor",
      cameraId: DEFAULT_CAMERA,
      framing: "lens",
      matchDof: false,
      openGate: false,
      focalMm: 32,
      tStop: 2.8,
      focusTarget: "bram",
      focusM: markDepth("bram"),
      showBand: false,
      shutterDeg: 180,
      fps: 24,
      slowMotion: false,
      move: "locked",
      rollingTest: false,
      lookId: cam0.look,
      exposureStops: 0,
      blind: { ...blindRound(0), guesses: [null, null, null], revealed: false },
      playing: true,
      help: false,
      toast: null,
      version: 0,
      setMode(mode) {
        if (mode === get().mode) return;
        bump({ mode });
        get().say(mode === "watch" ? "Watch: the finished shot" : mode === "inspect" ? "Inspect: gate, depth of field, curve, stage" : "Experiment: every control");
      },
      setStep(step) {
        if (step === get().step) return;
        const patch: Partial<CFState> = { step };
        if (get().mode === "watch") patch.mode = "experiment";
        if (step !== "shutter" && get().rollingTest) Object.assign(patch, { rollingTest: false });
        bump(patch);
      },
      selectCamera(id) {
        const s = get();
        if (id === s.cameraId) return;
        const from = FORMATS[getCamera(s.cameraId).format];
        const cam = getCamera(id);
        const to = FORMATS[cam.format];
        const patch: Partial<CFState> = { cameraId: id, lookId: cam.look };
        if (s.framing === "framing") {
          patch.focalMm = equivalentFocal(s.focalMm, from, to);
          if (s.matchDof) patch.tStop = clampStop(equivalentStop(s.tStop, from, to));
        }
        if (cam.lens) Object.assign(patch, { focalMm: cam.lens.focalMm, tStop: cam.lens.tStop });
        bump(patch);
        get().say(`${cam.name} · ${to.label}`);
      },
      setFraming(framing) {
        bump({ framing });
        get().say(framing === "lens" ? "Same lens: the field of view follows the sensor" : "Same framing: the focal length follows the sensor");
      },
      setMatchDof(matchDof) {
        bump({ matchDof });
      },
      setOpenGate(openGate) {
        bump({ openGate });
      },
      setFocal(mm) {
        bump({ focalMm: Math.min(600, Math.max(1.5, mm)) });
      },
      setStop(t) {
        bump({ tStop: clampStop(t) });
      },
      setFocus(target, manualM) {
        const focusM = target === "manual" ? Math.min(30, Math.max(0.4, manualM ?? get().focusM)) : markDepth(target);
        bump({ focusTarget: target, focusM });
      },
      setShowBand(showBand) {
        bump({ showBand });
      },
      setShutter(shutterDeg) {
        bump({ shutterDeg });
      },
      setFps(fps, slowMotion) {
        const slow = slowMotion ?? (fps > 60 ? true : get().slowMotion && fps > 24);
        syncClock(fps, slow);
        bump({ fps, slowMotion: slow });
      },
      setMove(move) {
        bump({ move, rollingTest: move === "pan" ? get().rollingTest : false });
      },
      setRollingTest(on) {
        bump({ rollingTest: on, move: on ? "pan" : get().move });
      },
      setLook(lookId) {
        bump({ lookId });
      },
      setExposure(stops) {
        bump({ exposureStops: Math.min(4, Math.max(-3, stops)) });
      },
      guess(monitor, look) {
        const b = get().blind;
        if (b.revealed) return;
        bump({ blind: { ...b, guesses: assignGuess(b.guesses, monitor, look) } });
      },
      reveal() {
        bump({ blind: { ...get().blind, revealed: true } });
      },
      nextRound() {
        const n = get().blind.round + 1;
        bump({ blind: { ...blindRound(n), guesses: [null, null, null], revealed: false } });
      },
      play() {
        cfClock.play();
        set({ playing: true });
      },
      pause() {
        cfClock.pause();
        set({ playing: false });
      },
      togglePlay() {
        if (get().playing) get().pause();
        else get().play();
      },
      seek(t) {
        cfClock.seek(t);
        bump({});
      },
      setHelp(help) {
        set({ help });
      },
      say(text) {
        set((s) => ({ toast: { text, id: (s.toast?.id ?? 0) + 1 } }));
      },
    };
  }),
);

export const useCF = <T,>(sel: (s: CFState) => T) => useStore(cfStore, sel);

/** Reset to defaults and apply deep-link parameters (?mode, ?camera, ?step). */
export function bootStore(search: string) {
  const sp = new URLSearchParams(search);
  cfStore.setState({ ...cfStore.getInitialState(), version: cfStore.getState().version + 1 });
  const s = cfStore.getState();
  const camera = sp.get("camera");
  if (isCameraId(camera)) {
    // A deep-linked camera opens on the same framing as the default (32 mm on the ALEXA 35 gate).
    const cam = getCamera(camera);
    const focalMm = cam.lens?.focalMm ?? equivalentFocal(s.focalMm, FORMATS[getCamera(DEFAULT_CAMERA).format], FORMATS[cam.format]);
    cfStore.setState({ cameraId: camera, lookId: cam.look, focalMm, ...(cam.lens ? { tStop: cam.lens.tStop } : {}) });
  }
  const mode = sp.get("mode");
  if (isMode(mode)) cfStore.setState({ mode });
  const step = sp.get("step");
  const n = Number(step);
  if (isStep(step)) cfStore.setState({ step });
  else if (Number.isInteger(n) && n >= 1 && n <= STEPS.length) cfStore.setState({ step: STEPS[n - 1] });
  syncClock(s.fps, s.slowMotion);
  cfClock.seek(0);
}

export const CAMERA_IDS = CAMERAS.map((c) => c.id);
