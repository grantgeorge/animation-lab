import { createStore, useStore } from "zustand";
import { MasterClock } from "@/engine/timeline/clock";
import { moveClip, reorder, runtime, sameEdit, scaleTempo, setAudioLead, setDuration, slip, trimHead, trimTail } from "./engine/edit";
import { explain, type Change, type Explanation } from "./engine/explain";
import { COMEDY_PRESETS, comedyEdit, continuityCams, jlEdit, kuleshovEdit, montageEdit, reactionEdit, continuityEdit, type ComedyGaps, type ComedyPreset, type KuleInsert, type MontageStyle, type ReactionOrder } from "./engine/experiments";
import { presetEdit } from "./engine/presets";
import type { CamSpec } from "./engine/shots";
import { EDIT_PRESETS, EXPERIMENTS, MODES, type Clip, type Edit, type EditPresetId, type ExperimentId, type Mode, type ShotId } from "./engine/types";

/** The lab's own clock (record time of the active edit). Ticked once per frame by the orchestrator. */
export const erClock = new MasterClock({ durationS: 19, playing: false });

export interface ERState {
  mode: Mode;
  exp: ExperimentId;
  preset: EditPresetId;
  /** The playground edit. */
  edit: Clip[];
  /** The treatment's own cut (what "longer/shorter than the preset" compares against). */
  baseline: Clip[];
  /** The edit before the latest change, and what that change was (drives the headline). */
  previous: Clip[] | null;
  /** The latest change when known (preset, tempo); null = infer it by diffing previous → edit. */
  change: Change | null;
  history: Clip[][];
  selected: string | null;
  compare: boolean;
  compareWith: EditPresetId;
  playing: boolean;
  muted: boolean;
  /** Set once the user has interacted (browser autoplay policy): only then may sound start. */
  audioUnlocked: boolean;
  kuleInsert: KuleInsert;
  kuleAnswers: Partial<Record<KuleInsert, string>>;
  reactionOrder: ReactionOrder;
  flipped: boolean;
  jlLead: number;
  montage: MontageStyle;
  comedy: ComedyGaps;
  comedyPreset: ComedyPreset | null;
  tempo: number;
  version: number;
  setMode(m: Mode): void;
  setExp(x: ExperimentId): void;
  loadPreset(p: EditPresetId): void;
  select(id: string | null): void;
  setDuration(index: number, d: number, record?: boolean): void;
  move(index: number, dir: -1 | 1): void;
  reorder(from: number, to: number): void;
  trimHead(index: number, sourceIn: number, record?: boolean): void;
  trimTail(index: number, sourceOut: number, record?: boolean): void;
  slip(index: number, sourceIn: number): void;
  setTempo(f: number): void;
  setAudioLead(index: number, lead: number): void;
  setEdit(e: Clip[]): void;
  beginGesture(): void;
  undo(): void;
  resetPreset(): void;
  setCompare(on: boolean, with_?: EditPresetId): void;
  setKule(i: KuleInsert): void;
  answerKule(i: KuleInsert, answer: string): void;
  setReactionOrder(o: ReactionOrder): void;
  setFlipped(v: boolean): void;
  setJl(v: number): void;
  setMontage(m: MontageStyle): void;
  setComedy(g: Partial<ComedyGaps>): void;
  setComedyPreset(p: ComedyPreset): void;
  setMuted(v: boolean): void;
  unlockAudio(): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
}

const isMode = (v: unknown): v is Mode => MODES.includes(v as Mode);
const isExp = (v: unknown): v is ExperimentId => EXPERIMENTS.includes(v as ExperimentId);
const isPreset = (v: unknown): v is EditPresetId => EDIT_PRESETS.includes(v as EditPresetId);

export function readDeepLink(search: string): { mode: Mode; exp: ExperimentId; preset: EditPresetId; compare: EditPresetId | null } {
  const p = new URLSearchParams(search);
  const c = p.get("compare");
  return { mode: isMode(p.get("mode")) ? (p.get("mode") as Mode) : "experiment", exp: isExp(p.get("exp")) ? (p.get("exp") as ExperimentId) : "timeline", preset: isPreset(p.get("preset")) ? (p.get("preset") as EditPresetId) : "suspense", compare: isPreset(c) ? c : null };
}

export const erStore = createStore<ERState>()((set, get) => {
  const bump = (patch: Partial<ERState>) => set((s) => ({ ...patch, version: s.version + 1 }));
  /** Commit a playground change: remember the previous edit for the headline and for undo. */
  const commit = (next: Clip[], change: Change | null = null, record = true) => {
    const s = get();
    if (sameEdit(next, s.edit)) return;
    bump({ edit: next, previous: s.edit, change, history: record ? [...s.history, s.edit].slice(-80) : s.history });
  };
  return {
    mode: "experiment",
    exp: "timeline",
    preset: "suspense",
    edit: presetEdit("suspense"),
    baseline: presetEdit("suspense"),
    previous: null,
    change: { kind: "preset", preset: "suspense" },
    history: [],
    selected: null,
    compare: false,
    compareWith: "action",
    playing: false,
    muted: false,
    audioUnlocked: false,
    kuleInsert: "box",
    kuleAnswers: {},
    reactionOrder: "before",
    flipped: false,
    jlLead: 0,
    montage: "jump",
    comedy: COMEDY_PRESETS.instant.gaps,
    comedyPreset: "instant",
    tempo: 1,
    version: 0,
    setMode(mode) {
      if (mode !== get().mode) bump({ mode });
    },
    setExp(exp) {
      if (exp === get().exp) return;
      bump({ exp, compare: exp === "timeline" ? get().compare : false });
      erClock.seek(0);
    },
    loadPreset(preset) {
      const e = presetEdit(preset);
      const s = get();
      bump({ preset, baseline: e, edit: e, previous: s.edit, change: { kind: "preset", preset }, history: [...s.history, s.edit].slice(-80), selected: e.find((c) => c.shot === "reaction")?.id ?? e[0].id, tempo: 1, compareWith: s.compareWith === preset ? (preset === "action" ? "suspense" : "action") : s.compareWith });
      erClock.seek(0);
    },
    select(selected) {
      bump({ selected });
    },
    setDuration(i, d, record = true) {
      commit(setDuration(get().edit, i, d), undefined, record);
    },
    move(i, dir) {
      const e = get().edit;
      const j = i + dir;
      if (j < 0 || j >= e.length) return;
      commit(moveClip(e, i, dir));
    },
    reorder(from, to) {
      if (from === to) return;
      commit(reorder(get().edit, from, to));
    },
    trimHead(i, sourceIn, record = true) {
      commit(trimHead(get().edit, i, sourceIn), undefined, record);
    },
    trimTail(i, out, record = true) {
      commit(trimTail(get().edit, i, out), undefined, record);
    },
    slip(i, sourceIn) {
      commit(slip(get().edit, i, sourceIn));
    },
    setTempo(f) {
      const s = get();
      const base = s.baseline.length === s.edit.length && s.baseline.every((c, i) => c.id === s.edit[i].id) ? s.edit.map((c) => ({ ...c, duration: s.baseline.find((b) => b.id === c.id)!.duration })) : s.edit;
      const next = scaleTempo(base, f);
      bump({ tempo: f, edit: next, previous: s.edit, change: { kind: "tempo", factor: f } });
    },
    setAudioLead(i, lead) {
      commit(setAudioLead(get().edit, i, lead));
    },
    setEdit(e) {
      commit(e);
    },
    beginGesture() {
      const s = get();
      set({ history: [...s.history, s.edit].slice(-80) });
    },
    undo() {
      const s = get();
      const prev = s.history.at(-1);
      if (!prev) return;
      bump({ edit: prev, previous: s.edit, change: null, history: s.history.slice(0, -1) });
    },
    resetPreset() {
      get().loadPreset(get().preset);
    },
    setCompare(on, with_) {
      bump({ compare: on, compareWith: with_ ?? get().compareWith, exp: on ? "timeline" : get().exp });
      erClock.seek(0);
    },
    setKule(kuleInsert) {
      bump({ kuleInsert });
      erClock.seek(0);
    },
    answerKule(i, answer) {
      bump({ kuleAnswers: { ...get().kuleAnswers, [i]: answer } });
    },
    setReactionOrder(reactionOrder) {
      bump({ reactionOrder });
      erClock.seek(0);
    },
    setFlipped(flipped) {
      bump({ flipped });
    },
    setJl(v) {
      bump({ jlLead: Math.round(v * 100) / 100 });
    },
    setMontage(montage) {
      bump({ montage });
      erClock.seek(0);
    },
    setComedy(g) {
      bump({ comedy: { ...get().comedy, ...g }, comedyPreset: null });
    },
    setComedyPreset(p) {
      bump({ comedy: COMEDY_PRESETS[p].gaps, comedyPreset: p });
      erClock.seek(0);
    },
    setMuted(muted) {
      bump({ muted });
    },
    unlockAudio() {
      if (!get().audioUnlocked) set({ audioUnlocked: true });
    },
    play() {
      erClock.play();
      set({ playing: true });
    },
    pause() {
      erClock.pause();
      set({ playing: false });
    },
    togglePlay() {
      if (get().playing) get().pause();
      else get().play();
    },
    seek(t) {
      erClock.seek(Math.min(Math.max(0, t), Math.max(0, erClock.durationS - 1e-3)));
    },
  };
});

export const useER = <T,>(sel: (s: ERState) => T) => useStore(erStore, sel);

/** The edit the program monitor plays for the current experiment. */
export function activeEdit(s: Pick<ERState, "exp" | "edit" | "kuleInsert" | "reactionOrder" | "jlLead" | "montage" | "comedy">): Edit {
  switch (s.exp) {
    case "kuleshov":
      return kuleshovEdit(s.kuleInsert);
    case "reaction":
      return reactionEdit(s.reactionOrder);
    case "continuity":
      return continuityEdit();
    case "jl":
      return jlEdit(s.jlLead);
    case "montage":
      return montageEdit(s.montage);
    case "comedy":
      return comedyEdit(s.comedy);
    default:
      return s.edit;
  }
}

/** Camera overrides (continuity: the reaction camera flipped across the line). */
export function camOverrides(s: Pick<ERState, "exp" | "flipped">): Partial<Record<ShotId, CamSpec>> {
  return s.exp === "continuity" ? continuityCams(s.flipped) : {};
}

export const compareEdit = (s: Pick<ERState, "compareWith">) => presetEdit(s.compareWith);

/** Is the playground edit still exactly the preset? */
export const isPristine = (s: Pick<ERState, "edit" | "baseline">) => sameEdit(s.edit, s.baseline);

const exCache = new WeakMap<Clip[], Explanation>();
/** Explanation of the playground edit (memoised per edit array). */
export function playgroundExplanation(s: Pick<ERState, "edit" | "baseline" | "previous" | "change">): Explanation {
  let ex = exCache.get(s.edit);
  if (!ex) {
    ex = explain(s.edit, { baseline: s.baseline, previous: s.previous, change: s.change ?? undefined });
    exCache.set(s.edit, ex);
  }
  return ex;
}

/** Clock length for what is on screen (compare mode plays both edits from the same head). */
export function clockLength(s: ERState): number {
  const a = runtime(activeEdit(s));
  return s.compare && s.exp === "timeline" ? Math.max(a, runtime(compareEdit(s))) : a;
}
