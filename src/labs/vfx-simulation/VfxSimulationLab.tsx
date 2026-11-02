"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NeutralToneMapping, PCFShadowMap } from "three";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { TREATMENTS, type Treatment } from "./engine/beat";
import { FPS } from "./engine/timing";
import { categoryPhrase, syncPhrase, treatmentPhrase, type CategoryId } from "./engine/prompt";
import { EXP_INFO, QUESTION, TREATMENT_INFO } from "./content";
import { DEFAULTS, freshCats, freshPhys, freshTiming, isCategory, stateFromUrl, urlFor, vxClock, vxStore, useVX, type ExpId, type Mode, type VXState } from "./store";
import { Orchestrator, capCount, ensureBake, refreshMeasures, runtime } from "./runtime/Orchestrator";
import { live, measureStore, onAfterFrame } from "./runtime/live";
import { Cast } from "./stage/Cast";
import { ExpTabs, Header, Help, ModeSwitch, Toast, Transport } from "./ui/Chrome";
import { CategoryControls, PhysicsControls, SyncControls, TimingControls, Toggle, TreatmentBar } from "./ui/Controls";
import { CurvesChart, LegibilityStrip, Lesson, MeasureTable, PromptBox, Reading, Related, Scoreboard, SolverReadouts, SyncChart, ViewFrame } from "./ui/Panels";
import "./vfx-simulation.css";

type Tier = "e2e" | "low" | "high";

function boot() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = readUrlParams(search);
  const { t, ...patch } = stateFromUrl(search);
  vxStore.setState({ ...DEFAULTS, phys: freshPhys(), timing: freshTiming(), cats: freshCats(), ...patch, help: false, toast: null, version: vxStore.getState().version + 1 });
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  const frozen = t ?? params.freeze;
  vxClock.seek(frozen ?? 0);
  if (frozen !== null && frozen !== undefined) vxStore.getState().pause();
  else if (reduced) {
    // reduced motion: start paused on the splash peak, where every treatment shows its key shape
    vxClock.seek(1.55);
    vxStore.getState().pause();
  } else vxStore.getState().play();
  return { params, reduced };
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = vxStore.getState();
      if (e.key === "Escape") return s.setHelp(false);
      if (s.help) return;
      if (e.key === "?") return s.setHelp(true);
      const onControl = Boolean(t?.closest("button, a, summary"));
      const digit = /^Digit([1-3])$/.exec(e.code);
      if (digit && s.exp === "bucket") {
        const tr = TREATMENTS[Number(digit[1]) - 1];
        s.setTreatment(tr);
        s.say(TREATMENT_INFO[tr].label);
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case "KeyW":
          return s.setMode("watch");
        case "KeyI":
          return s.setMode("inspect");
        case "KeyE":
          return s.setMode("experiment");
        case "KeyC":
          if (s.exp === "bucket") s.setCompare(!s.compare);
          else if (isCategory(s.exp)) s.set({ catCompare: !s.catCompare });
          return;
        case "Space":
          if (onControl) return;
          s.togglePlay();
          e.preventDefault();
          return;
        case "Comma":
        case "Period":
          s.stepFrames(e.code === "Period" ? 1 : -1);
          e.preventDefault();
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

type HookPatch = Partial<Pick<VXState, "mode" | "exp" | "treatment" | "compare" | "offset" | "charSteps" | "vectors" | "raster" | "catCompare">> & { phys?: Partial<VXState["phys"]>; timing?: Partial<Record<Treatment, Partial<VXState["timing"]["real"]>>>; cat?: Partial<VXState["cats"]["fire"]> };

export interface VfxLabHook {
  getState: () => Pick<VXState, "mode" | "exp" | "treatment" | "compare" | "phys" | "timing" | "offset" | "cats" | "catCompare" | "playing" | "charSteps">;
  set: (patch: HookPatch) => void;
  live: () => typeof live;
  frames: (n?: number) => Promise<number>;
  seek: (t: number) => void;
  pause: () => void;
  play: () => void;
  /** Finish the realistic bake now and recompute the measurements. Returns the bake time (ms). */
  bake: () => number;
  measures: () => Record<Treatment, { run: number; frames: number; first: number; impact: number; pieces: number } | null>;
  prompts: () => Record<string, string>;
}

function installHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const hook: VfxLabHook = {
    getState: () => {
      const s = vxStore.getState();
      return { mode: s.mode, exp: s.exp, treatment: s.treatment, compare: s.compare, phys: s.phys, timing: s.timing, offset: s.offset, cats: s.cats, catCompare: s.catCompare, playing: s.playing, charSteps: s.charSteps };
    },
    set: ({ phys, timing, cat, ...rest }) => {
      const s = vxStore.getState();
      if (Object.keys(rest).length) vxStore.setState({ ...rest, version: s.version + 1 });
      if (phys) s.setPhys(phys);
      if (timing) for (const [tr, tm] of Object.entries(timing)) s.setTiming(tm!, tr as Treatment);
      if (cat && isCategory(vxStore.getState().exp)) s.setCat(vxStore.getState().exp as CategoryId, cat);
    },
    live: () => JSON.parse(JSON.stringify(live)),
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frameId;
        const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
        poll();
      }),
    seek: (t) => vxStore.getState().seek(t),
    pause: () => vxStore.getState().pause(),
    play: () => vxStore.getState().play(),
    bake: () => {
      const s = vxStore.getState();
      const b = ensureBake(s);
      b.bakeAll();
      refreshMeasures(s);
      return b.bakeMs;
    },
    measures: () => {
      const c = measureStore.getState().curves;
      const out = {} as ReturnType<VfxLabHook["measures"]>;
      for (const tr of TREATMENTS) {
        const m = c[tr];
        out[tr] = m ? { run: m.legibility.longestRun, frames: m.legibility.legibleFrames, first: m.legibility.firstAfterImpact, impact: m.impactFrame, pieces: m.legibility.piecesAtPeak } : null;
      }
      return out;
    },
    prompts: () => {
      const s = vxStore.getState();
      const p = { ...s.phys, count: capCount(s.phys.count, runtime.tier) };
      const out: Record<string, string> = {};
      for (const tr of TREATMENTS) out[tr] = treatmentPhrase(tr, p, s.timing[tr]);
      out.sync = syncPhrase(p, s.timing.cartoon, s.offset);
      for (const c of ["fire", "water", "rigid", "cloth", "magic", "drawn"] as CategoryId[]) out[c] = categoryPhrase(c, s.cats[c].look, s.cats[c].motion);
      return out;
    },
  };
  (window as unknown as { __vfxLab: VfxLabHook }).__vfxLab = hook;
  return () => {
    delete (window as unknown as { __vfxLab?: VfxLabHook }).__vfxLab;
  };
}

/** Mirror readiness and the measurements onto the root without re-rendering React per frame. */
function useRootAttrs(root: React.RefObject<HTMLElement | null>) {
  useEffect(
    () =>
      onAfterFrame(() => {
        const el = root.current;
        if (!el) return;
        const ready = live.ready ? "1" : "0";
        if (el.dataset.ready !== ready) el.dataset.ready = ready;
        const baked = live.bake.done ? "1" : "0";
        if (el.dataset.baked !== baked) el.dataset.baked = baked;
        const fr = String(live.frame);
        if (el.dataset.frame !== fr) el.dataset.frame = fr;
      }),
    [root],
  );
  useEffect(
    () =>
      measureStore.subscribe((m) => {
        const el = root.current;
        if (!el) return;
        for (const tr of TREATMENTS) {
          const c = m.curves[tr];
          el.dataset[`legible${tr[0].toUpperCase()}${tr.slice(1)}`] = c ? String(c.legibility.longestRun) : "";
        }
      }),
    [root],
  );
}

function Picture({ big = false }: { big?: boolean }) {
  const exp = useVX((s) => s.exp);
  const compare = useVX((s) => s.compare);
  const tr = useVX((s) => s.treatment);
  const offset = useVX((s) => s.offset);
  const split = useVX((s) => s.catCompare);
  const cats = useVX((s) => s.cats);
  if (exp === "bucket" && compare)
    return (
      <div className="vx-picture" data-testid="picture" data-layout="3">
        <div className="vx-views vx-views-3">
          {TREATMENTS.map((t, i) => (
            <ViewFrame key={t} slot={"ABC"[i]} label={`${i + 1} · ${TREATMENT_INFO[t].label}`} color={TREATMENT_INFO[t].color} tr={t} selectable selected={t === tr} />
          ))}
          <Scoreboard />
        </div>
      </div>
    );
  if (exp === "bucket")
    return (
      <div className="vx-picture" data-testid="picture" data-layout="1">
        <div className="vx-views vx-views-1">
          <ViewFrame slot="P" label={TREATMENT_INFO[tr].label} color={TREATMENT_INFO[tr].color} tr={tr} big={big} />
        </div>
      </div>
    );
  if (exp === "sync")
    return (
      <div className="vx-picture" data-testid="picture" data-layout="2">
        <div className="vx-views vx-views-2">
          <ViewFrame slot="A" label="In sync · flinch +2 f" color={TREATMENT_INFO.cartoon.color} />
          <ViewFrame slot="B" label={`Your flinch · ${offset > 0 ? "+" : ""}${offset} f`} color="#ff8fd0" />
        </div>
      </div>
    );
  const c = cats[exp as CategoryId];
  if (split)
    return (
      <div className="vx-picture" data-testid="picture" data-layout="2">
        <div className="vx-views vx-views-2">
          <ViewFrame slot="A" label="Realistic · simulated" color="#a7bccb" />
          <ViewFrame slot="B" label="Stylized · keyframed" color="#ffcf5a" />
        </div>
      </div>
    );
  return (
    <div className="vx-picture" data-testid="picture" data-layout="1">
      <div className="vx-views vx-views-1">
        <ViewFrame slot="P" label={`${EXP_INFO[exp].tab} · ${c.look === "real" ? "realistic" : "stylized"} · ${c.motion === "sim" ? "simulated" : "keyframed"}`} color="#eac18a" big={big} />
      </div>
    </div>
  );
}

function Under() {
  const exp = useVX((s) => s.exp);
  if (exp === "bucket")
    return (
      <div className="vx-under">
        <TreatmentBar />
        <Transport />
      </div>
    );
  if (exp === "sync")
    return (
      <div className="vx-under">
        <span className="vx-under-label">Same splash, same crown hold. Only the flinch moves.</span>
        <Transport />
      </div>
    );
  return (
    <div className="vx-under vx-under-cat">
      <CategoryControls id={exp as CategoryId} />
      <Transport />
    </div>
  );
}

function AsideHead({ mode }: { mode: Mode }) {
  const exp = useVX((s) => s.exp);
  return (
    <div className="vx-panel-heading">
      <span className="vx-eyebrow">VFX &amp; SIMULATION · {mode === "experiment" ? "CONTROLS" : "BREAKDOWN"}</span>
      <h2>{EXP_INFO[exp].title}</h2>
      <p>{QUESTION}</p>
    </div>
  );
}

function ExperimentLayout() {
  const exp = useVX((s) => s.exp);
  return (
    <div className="vx-workspace">
      <div className="vx-bench">
        <div className="vx-toolbar">
          <ModeSwitch />
          <ExpTabs />
        </div>
        <Picture />
        <Under />
        {exp === "bucket" && <LegibilityStrip />}
        {exp === "sync" && <SyncChart />}
      </div>
      <aside className="vx-inspector" aria-label="Controls" data-testid="inspector">
        <AsideHead mode="experiment" />
        <div data-testid="controls">
          {exp === "bucket" && (
            <>
              <TimingControls />
              <PhysicsControls />
            </>
          )}
          {exp === "sync" && <SyncControls />}
        </div>
        <Reading />
        <PromptBox />
        <Lesson exp={exp} />
        <Related />
      </aside>
    </div>
  );
}

function InspectLayout() {
  const exp = useVX((s) => s.exp);
  const vectors = useVX((s) => s.vectors);
  const raster = useVX((s) => s.raster);
  return (
    <div className="vx-workspace">
      <div className="vx-bench">
        <div className="vx-toolbar">
          <ModeSwitch />
          <ExpTabs />
        </div>
        <Picture />
        <div className="vx-under">
          {exp === "bucket" ? (
            <>
              <TreatmentBar />
              <div className="vx-overlays" data-testid="overlays">
                <Toggle label="Velocities & keyed paths" checked={vectors} onChange={(v) => vxStore.getState().set({ vectors: v })} testId="toggle-vectors" />
                <Toggle label="Legibility raster & sim grid" checked={raster} onChange={(v) => vxStore.getState().set({ raster: v })} testId="toggle-raster" />
              </div>
            </>
          ) : isCategory(exp) ? (
            <CategoryControls id={exp} />
          ) : (
            <span className="vx-under-label">The flinch, frame by frame.</span>
          )}
          <Transport />
        </div>
        {exp === "bucket" && (
          <div className="vx-inspect-row">
            <CurvesChart />
            <figure className="vx-card">
              <figcaption>
                <span className="vx-eyebrow">MEASURED</span>
              </figcaption>
              <MeasureTable />
            </figure>
          </div>
        )}
        {exp === "sync" && <SyncChart />}
      </div>
      <aside className="vx-inspector" aria-label="Readouts" data-testid="inspector">
        <AsideHead mode="inspect" />
        {(exp === "bucket" || exp === "sync") && (
          <section className="vx-section">
            <span className="vx-eyebrow">THE SOLVER</span>
            <SolverReadouts />
          </section>
        )}
        {isCategory(exp) && <DemoReadouts />}
        <Reading />
        <PromptBox />
        <Lesson exp={exp} />
        <Related />
      </aside>
    </div>
  );
}

function DemoReadouts() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="vx-section" data-testid="demo-readouts">
      <span className="vx-eyebrow">THIS DEMO</span>
      <table className="vx-table">
        <tbody>
          {Object.entries(live.demo).map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td className="mono">{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WatchLayout() {
  const exp = useVX((s) => s.exp);
  return (
    <div className="vx-watch">
      <div className="vx-toolbar">
        <ModeSwitch />
        <ExpTabs />
      </div>
      <Picture big />
      <div className="vx-watch-foot">
        <div className="vx-caption" data-testid="caption">
          <span className="vx-eyebrow">WATCH · {EXP_INFO[exp].tab.toUpperCase()}</span>
          <h2>{EXP_INFO[exp].title}</h2>
          <p>{EXP_INFO[exp].lesson}</p>
          {exp === "bucket" && <LegibilityStrip compact />}
        </div>
        <div className="vx-watch-side">
          <PromptBox compact />
          <Transport />
        </div>
      </div>
    </div>
  );
}

export default function VfxSimulationLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const tier: Tier = params.e2e ? "e2e" : quality.level <= 1 ? "low" : "high";
  const s = useVX((x) => x);
  const root = useRef<HTMLElement>(null);
  useShortcuts();
  useRootAttrs(root);
  useEffect(() => {
    runtime.tier = tier;
  }, [tier]);
  useEffect(() => installHook(params.e2e || params.debug), [params.e2e, params.debug]);
  useEffect(() => {
    const url = urlFor(s, window.location.pathname, window.location.search);
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [s]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) vxClock.pause();
      else if (vxStore.getState().playing) vxClock.play();
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      vxClock.pause();
    };
  }, []);
  const tm = s.timing[s.treatment];
  const cat = isCategory(s.exp) ? s.cats[s.exp] : null;
  return (
    <main
      ref={root}
      className="lab-root vx-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-mode={s.mode}
      data-exp={s.exp}
      data-treatment={s.treatment}
      data-compare={s.compare ? "1" : "0"}
      data-step={tm.step}
      data-hold={tm.hold}
      data-antic={tm.antic}
      data-gravity={s.phys.gravity.toFixed(2)}
      data-viscosity={s.phys.viscosity.toFixed(2)}
      data-intensity={s.phys.intensity.toFixed(2)}
      data-count={capCount(s.phys.count, tier)}
      data-turbulence={s.phys.turbulence.toFixed(2)}
      data-stylization={s.phys.stylization.toFixed(2)}
      data-offset={s.offset}
      data-look={cat?.look ?? ""}
      data-motion={cat?.motion ?? ""}
      data-split={s.catCompare ? "1" : "0"}
      data-tier={tier}
      data-nomotion={reduced ? "1" : "0"}
    >
      <div className="vx-canvas">
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: tier === "high", powerPreference: "high-performance" }}
          camera={{ fov: 31, near: 0.05, far: 40, position: [0, 1, 3.5] }}
          onCreated={(state) => {
            state.gl.toneMapping = NeutralToneMapping;
            state.gl.toneMappingExposure = 1.0;
          }}
        >
          <Orchestrator reducedMotion={reduced} tier={tier} />
          <Cast />
        </Canvas>
      </div>
      <Header />
      {s.mode === "watch" ? <WatchLayout /> : s.mode === "inspect" ? <InspectLayout /> : <ExperimentLayout />}
      <Toast />
      <Help />
    </main>
  );
}

export const LAB_FPS = FPS;
export type { ExpId };
