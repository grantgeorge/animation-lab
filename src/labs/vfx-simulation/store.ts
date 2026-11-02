import { createStore, useStore } from "zustand";
import { MasterClock } from "@/engine/timeline/clock";
import { LIMITS, PHYS_DEFAULT, TIMING_DEFAULT, TREATMENTS, type Phys, type Timing, type Treatment } from "./engine/beat";
import type { CategoryId, Look, Motion } from "./engine/prompt";
import { FPS, LOOP_S, STEPS, type Step } from "./engine/timing";

/** The lab's clock, ticked once per frame by the orchestrator. */
export const vxClock = new MasterClock({ durationS: LOOP_S, playing: true });

export type Mode = "watch" | "inspect" | "experiment";
export const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];
export type ExpId = "bucket" | "sync" | CategoryId;
export const CATEGORIES: readonly CategoryId[] = ["fire", "water", "rigid", "cloth", "magic", "drawn"];
export const EXPS: readonly ExpId[] = ["bucket", "sync", ...CATEGORIES];
export const isCategory = (e: ExpId): e is CategoryId => e !== "bucket" && e !== "sync";

export interface CatState {
  look: Look;
  motion: Motion;
  /** The one category-specific dial (wind, drop size, impact, density, speed), 0..1. */
  value: number;
}
export const CAT_DEFAULT: Record<CategoryId, CatState> = {
  fire: { look: "real", motion: "sim", value: 0.25 },
  water: { look: "real", motion: "sim", value: 0.5 },
  rigid: { look: "real", motion: "sim", value: 0.6 },
  cloth: { look: "real", motion: "sim", value: 0.45 },
  magic: { look: "real", motion: "sim", value: 0.6 },
  drawn: { look: "stylized", motion: "keyed", value: 0.6 },
};

export interface VXState {
  mode: Mode;
  exp: ExpId;
  treatment: Treatment;
  compare: boolean;
  phys: Phys;
  timing: Record<Treatment, Timing>;
  /** Sync experiment: frames between the water landing and Pip's flinch (negative = before). */
  offset: number;
  /** Hand-drawn: Pip steps with the drawings. */
  charSteps: boolean;
  /** Inspect overlays. */
  vectors: boolean;
  raster: boolean;
  cats: Record<CategoryId, CatState>;
  catCompare: boolean;
  playing: boolean;
  version: number;
  help: boolean;
  toast: { text: string; id: number } | null;
  setMode(m: Mode): void;
  setExp(e: ExpId): void;
  setTreatment(t: Treatment): void;
  setCompare(v: boolean): void;
  setPhys(p: Partial<Phys>): void;
  setTiming(p: Partial<Timing>, tr?: Treatment): void;
  setOffset(n: number): void;
  setCat(c: CategoryId, p: Partial<CatState>): void;
  set(p: Partial<Pick<VXState, "charSteps" | "vectors" | "raster" | "catCompare">>): void;
  reset(): void;
  setHelp(open: boolean): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(t: number): void;
  stepFrames(n: number): void;
  say(text: string): void;
}

export const DEFAULTS = {
  mode: "experiment" as Mode,
  exp: "bucket" as ExpId,
  treatment: "cartoon" as Treatment,
  compare: true,
  offset: 8,
  charSteps: true,
  vectors: true,
  raster: false,
  catCompare: false,
};

const clampN = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

export const freshPhys = (): Phys => ({ ...PHYS_DEFAULT });
export const freshTiming = (): Record<Treatment, Timing> => ({ real: { ...TIMING_DEFAULT.real }, cartoon: { ...TIMING_DEFAULT.cartoon }, drawn: { ...TIMING_DEFAULT.drawn } });
export const freshCats = (): Record<CategoryId, CatState> => structuredClone(CAT_DEFAULT);

export const vxStore = createStore<VXState>()((set, get) => {
  const bump = (patch: Partial<VXState>) => set((s) => ({ ...patch, version: s.version + 1 }));
  return {
    ...DEFAULTS,
    phys: freshPhys(),
    timing: freshTiming(),
    cats: freshCats(),
    playing: true,
    version: 0,
    help: false,
    toast: null,
    setMode: (mode) => bump({ mode }),
    setExp: (exp) => bump({ exp }),
    setTreatment: (treatment) => bump({ treatment }),
    setCompare: (compare) => bump({ compare }),
    setPhys(p) {
      const cur = get().phys;
      const next = { ...cur, ...p };
      next.gravity = clampN(next.gravity, LIMITS.gravity);
      next.viscosity = clampN(next.viscosity, LIMITS.viscosity);
      next.intensity = clampN(next.intensity, LIMITS.intensity);
      next.turbulence = clampN(next.turbulence, LIMITS.turbulence);
      next.stylization = clampN(next.stylization, LIMITS.stylization);
      next.count = Math.round(Math.max(100, next.count));
      bump({ phys: next });
    },
    setTiming(p, tr) {
      const which = tr ?? get().treatment;
      const cur = get().timing[which];
      const next: Timing = { ...cur, ...p };
      next.step = (STEPS.includes(next.step) ? next.step : 1) as Step;
      next.hold = Math.round(clampN(next.hold, LIMITS.hold));
      next.antic = Math.round(clampN(next.antic, LIMITS.antic));
      bump({ timing: { ...get().timing, [which]: next } });
    },
    setOffset: (n) => bump({ offset: Math.round(clampN(n, LIMITS.offset)) }),
    setCat: (c, p) => bump({ cats: { ...get().cats, [c]: { ...get().cats[c], ...p, value: clampN(p.value ?? get().cats[c].value, [0, 1]) } } }),
    set: (p) => bump(p),
    reset: () => bump({ phys: freshPhys(), timing: freshTiming(), offset: DEFAULTS.offset, cats: freshCats() }),
    setHelp: (help) => set({ help }),
    play() {
      vxClock.play();
      set({ playing: true });
    },
    pause() {
      vxClock.pause();
      set({ playing: false });
    },
    togglePlay() {
      if (get().playing) get().pause();
      else get().play();
    },
    seek(t) {
      vxClock.seek(t);
      set((s) => ({ version: s.version + 1 }));
    },
    stepFrames(n) {
      if (get().playing) get().pause();
      const f = Math.round(vxClock.peek() * FPS) + n;
      get().seek(f / FPS + 1e-4);
    },
    say: (text) => set((s) => ({ toast: { text, id: (s.toast?.id ?? 0) + 1 } })),
  };
});

export const useVX = <T,>(sel: (s: VXState) => T) => useStore(vxStore, sel);

/** Deep links: every state the lab can be in is a URL. */
export function stateFromUrl(search: string): Partial<VXState> & { t?: number } {
  const sp = new URLSearchParams(search);
  const out: Partial<VXState> & { t?: number } = {};
  const mode = sp.get("mode");
  if (MODES.includes(mode as Mode)) out.mode = mode as Mode;
  const exp = sp.get("exp");
  if (EXPS.includes(exp as ExpId)) out.exp = exp as ExpId;
  const tr = sp.get("tr");
  if (TREATMENTS.includes(tr as Treatment)) out.treatment = tr as Treatment;
  if (sp.has("compare")) out.compare = sp.get("compare") === "1";
  const num = (k: string) => (sp.has(k) && Number.isFinite(Number(sp.get(k))) ? Number(sp.get(k)) : null);
  const phys = freshPhys();
  const map: [string, keyof Phys][] = [["g", "gravity"], ["visc", "viscosity"], ["int", "intensity"], ["count", "count"], ["turb", "turbulence"], ["styl", "stylization"]];
  for (const [k, key] of map) {
    const v = num(k);
    if (v !== null) phys[key] = v;
  }
  out.phys = phys;
  const timing = freshTiming();
  const which = out.treatment ?? DEFAULTS.treatment;
  const step = num("step");
  if (step !== null && STEPS.includes(step as Step)) timing[which].step = step as Step;
  const hold = num("hold");
  if (hold !== null) timing[which].hold = Math.round(clampN(hold, LIMITS.hold));
  const antic = num("antic");
  if (antic !== null) timing[which].antic = Math.round(clampN(antic, LIMITS.antic));
  out.timing = timing;
  const off = num("offset");
  if (off !== null) out.offset = Math.round(clampN(off, LIMITS.offset));
  const cats = freshCats();
  if (out.exp && isCategory(out.exp)) {
    const c = cats[out.exp];
    const look = sp.get("look");
    if (look === "real" || look === "stylized") c.look = look;
    const motion = sp.get("motion");
    if (motion === "sim" || motion === "keyed") c.motion = motion;
    const v = num("v");
    if (v !== null) c.value = clampN(v, [0, 1]);
  }
  out.cats = cats;
  if (sp.has("split")) out.catCompare = sp.get("split") === "1";
  if (sp.has("vectors")) out.vectors = sp.get("vectors") === "1";
  if (sp.has("raster")) out.raster = sp.get("raster") === "1";
  if (sp.has("charsteps")) out.charSteps = sp.get("charsteps") === "1";
  const t = num("t");
  if (t !== null) out.t = clampN(t, [0, LOOP_S - 1 / FPS]);
  return out;
}

export function urlFor(s: VXState, path: string, search: string) {
  const sp = new URLSearchParams(search);
  for (const k of ["mode", "exp", "tr", "compare", "g", "visc", "int", "count", "turb", "styl", "step", "hold", "antic", "offset", "look", "motion", "v", "split", "vectors", "raster", "charsteps", "t"]) sp.delete(k);
  sp.set("mode", s.mode);
  sp.set("exp", s.exp);
  if (s.exp === "bucket") {
    sp.set("tr", s.treatment);
    sp.set("compare", s.compare ? "1" : "0");
  }
  const d = PHYS_DEFAULT;
  const p = s.phys;
  if (p.gravity !== d.gravity) sp.set("g", String(p.gravity));
  if (p.viscosity !== d.viscosity) sp.set("visc", String(p.viscosity));
  if (p.intensity !== d.intensity) sp.set("int", String(p.intensity));
  if (p.count !== d.count) sp.set("count", String(p.count));
  if (p.turbulence !== d.turbulence) sp.set("turb", String(p.turbulence));
  if (p.stylization !== d.stylization) sp.set("styl", String(p.stylization));
  const tm = s.timing[s.treatment];
  const td = TIMING_DEFAULT[s.treatment];
  if (s.exp === "bucket") {
    if (tm.step !== td.step) sp.set("step", String(tm.step));
    if (tm.hold !== td.hold) sp.set("hold", String(tm.hold));
    if (tm.antic !== td.antic) sp.set("antic", String(tm.antic));
  }
  if (s.exp === "sync") sp.set("offset", String(s.offset));
  if (isCategory(s.exp)) {
    const c = s.cats[s.exp];
    sp.set("look", c.look);
    sp.set("motion", c.motion);
    if (c.value !== CAT_DEFAULT[s.exp].value) sp.set("v", String(c.value));
    if (s.catCompare) sp.set("split", "1");
  }
  return `${path}?${sp.toString()}`;
}
