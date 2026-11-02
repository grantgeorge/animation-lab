"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PCFShadowMap } from "three";
import { setActiveScene } from "@/labs/lens-and-framing/config";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { StageLighting } from "@/scene/StageLighting";
import { audibleEvents } from "./engine/audio";
import { runtime, stats } from "./engine/edit";
import { analyseKnows } from "./engine/explain";
import { comedyBeats, compression, montageEdit } from "./engine/experiments";
import { SHOTS } from "./engine/shots";
import type { Edit } from "./engine/types";
import { sound } from "./audio/synth";
import { Orchestrator } from "./runtime/Orchestrator";
import { live, onTick } from "./runtime/live";
import { Cast } from "./stage/Cast";
import { EditSet } from "./stage/EditSet";
import { Props } from "./stage/Props";
import { activeEdit, camOverrides, compareEdit, erClock, erStore, readDeepLink, useER, type ERState } from "./store";
import { AxisDiagram } from "./ui/AxisDiagram";
import { ExpTabs, Header, ModeSwitch, Transport } from "./ui/Chrome";
import { EXP_INFO } from "./ui/content";
import { PresetTabs, SelectedClip, StatCards } from "./ui/Controls";
import { ComedyPanel, ContinuityPanel, JLPanel, KuleshovPanel, MontagePanel, PacingPanel, ReactionPanel } from "./ui/ExpPanels";
import { ExplainPanel } from "./ui/Explain";
import { explanationFor } from "./ui/explainExp";
import { Exports } from "./ui/Exports";
import { AslGraph } from "./ui/Inspect";
import { Monitor } from "./ui/Monitor";
import { Timeline } from "./ui/Timeline";
import "./editing-rhythm.css";

function boot() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = readUrlParams(search);
  const link = readDeepLink(search);
  setActiveScene("doorway");
  const s = erStore.getState();
  s.loadPreset(link.preset);
  erStore.setState({ mode: link.mode, exp: link.exp, compare: link.compare !== null && link.exp === "timeline", compareWith: link.compare ?? (link.preset === "action" ? "suspense" : "action"), previous: null, history: [], change: { kind: "preset", preset: link.preset } });
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  erClock.seek(params.freeze ?? 0);
  if (params.freeze !== null || reduced) s.pause();
  else s.play();
  return { params, reduced };
}

/** Keep ?mode= / ?exp= / ?preset= in the address bar so every state is a deep link. */
function useUrlSync() {
  useEffect(
    () =>
      erStore.subscribe((s, p) => {
        if (s.mode === p.mode && s.exp === p.exp && s.preset === p.preset && s.compare === p.compare && s.compareWith === p.compareWith) return;
        const u = new URL(window.location.href);
        u.searchParams.set("mode", s.mode);
        u.searchParams.set("exp", s.exp);
        u.searchParams.set("preset", s.preset);
        if (s.compare) u.searchParams.set("compare", s.compareWith);
        else u.searchParams.delete("compare");
        window.history.replaceState(window.history.state, "", u);
      }),
    [],
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = erStore.getState();
      const onControl = Boolean(t?.closest("button, a, summary, [role=button]"));
      switch (e.code) {
        case "Space":
          if (onControl) return;
          s.togglePlay();
          e.preventDefault();
          break;
        case "KeyW":
          s.setMode("watch");
          break;
        case "KeyI":
          s.setMode("inspect");
          break;
        case "KeyE":
          s.setMode("experiment");
          break;
        case "KeyZ":
          s.undo();
          break;
        case "Home":
          s.seek(0);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Sound: unlocked by the first user gesture (never autoplays), driven once per frame by the audio edit. */
function useSound() {
  useEffect(() => {
    const unlock = () => {
      const s = erStore.getState();
      if (s.audioUnlocked) return;
      s.unlockAudio();
      sound.unlock();
      sound.setMuted(s.muted);
    };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    const off = onTick(() => {
      const s = erStore.getState();
      const v = live.views.P ?? live.views.W ?? live.views.A;
      if (!v) return;
      sound.tick(activeEdit(s), v.t, s.playing && !s.muted && !document.hidden);
    });
    const onVis = () => {
      if (document.hidden) {
        erClock.pause();
        sound.suspend();
      } else if (erStore.getState().playing) {
        erClock.play();
        if (erStore.getState().audioUnlocked) sound.unlock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      document.removeEventListener("visibilitychange", onVis);
      off();
      erClock.pause();
      sound.suspend();
    };
  }, []);
}

export interface EditLabHook {
  getState: () => ERState;
  edit: () => Edit;
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  explanation: () => { headline: string; points: string[] };
  live: () => { t: number; frameId: number; views: typeof live.views; rendered: string[] };
  frames: (n?: number) => Promise<number>;
  audible: () => ReturnType<typeof audibleEvents>;
  sound: () => { ready: boolean; fired: number };
}

function installHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const hook: EditLabHook = {
    getState: erStore.getState,
    edit: () => activeEdit(erStore.getState()),
    seek: (t) => erStore.getState().seek(t),
    play: () => erStore.getState().play(),
    pause: () => erStore.getState().pause(),
    explanation: () => {
      const ex = explanationFor(erStore.getState());
      return { headline: ex.headline, points: ex.points.map((p) => p.text) };
    },
    live: () => ({ t: live.t, frameId: live.frameId, views: JSON.parse(JSON.stringify(live.views)), rendered: [...live.rendered] }),
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frameId;
        const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
        poll();
      }),
    audible: () => audibleEvents(activeEdit(erStore.getState())),
    sound: () => ({ ready: sound.ready, fired: sound.fired }),
  };
  (window as unknown as { __editLab: EditLabHook }).__editLab = hook;
  return () => {
    delete (window as unknown as { __editLab?: EditLabHook }).__editLab;
  };
}

/** Mirrors what is on the program monitor onto the root's data attributes without re-rendering React. */
function useProgramAttr() {
  useEffect(
    () =>
      onTick(() => {
        const el = document.querySelector<HTMLElement>("[data-testid='lab-root']");
        const v = live.views.W ?? live.views.P ?? live.views.A;
        if (!el || !v) return;
        if (el.dataset.programShot !== v.shot) el.dataset.programShot = v.shot;
        const idx = String(v.index);
        if (el.dataset.programIndex !== idx) el.dataset.programIndex = idx;
      }),
    [],
  );
}

function ConceptCard() {
  const exp = useER((s) => s.exp);
  const info = EXP_INFO[exp];
  return (
    <section className="er-concept" data-testid="concept-card">
      <div className="er-eyebrow">{exp === "timeline" ? "The signature experiment" : `Concept · ${info.technique}`}</div>
      <h2>{info.title}</h2>
      <p>{info.lesson}</p>
      <p className="er-try">{info.try}</p>
    </section>
  );
}

function ExpControls() {
  const exp = useER((s) => s.exp);
  switch (exp) {
    case "pacing":
      return <PacingPanel />;
    case "kuleshov":
      return <KuleshovPanel />;
    case "reaction":
      return <ReactionPanel />;
    case "continuity":
      return <ContinuityPanel />;
    case "jl":
      return <JLPanel />;
    case "montage":
      return <MontagePanel />;
    case "comedy":
      return <ComedyPanel />;
    default:
      return <SelectedClip />;
  }
}

function useActive() {
  const s = useER((x) => x);
  return { s, edit: activeEdit(s) };
}

function ExperimentLayout() {
  const { s, edit } = useActive();
  const playground = s.exp === "timeline" || s.exp === "pacing";
  const compare = s.compare && s.exp === "timeline";
  const flags = s.exp === "continuity" && s.flipped ? [2, 3] : [];
  return (
    <div className="er-workspace">
      <div className="er-bench">
        <div className="er-toolbar">
          <ModeSwitch />
          <ExpTabs />
        </div>
        <div className={`er-picture${compare ? " er-picture-compare" : ""}`} data-testid="picture">
          {compare ? (
            <div className="er-compare" data-testid="compare">
              <Monitor slot="A" label={`A · ${s.preset}${s.edit !== s.baseline ? " (yours)" : ""}`} accent="#e9c58f" />
              <Monitor slot="B" label={`B · ${s.compareWith}`} accent="#8fb8e9" />
            </div>
          ) : (
            <div className="er-program">
              <Monitor slot="P" label="Program" />
            </div>
          )}
        </div>
        <section className="er-panel" data-testid="playground">
          <div className="er-panel-head">
            <h2>{playground ? "Editing Timeline Playground" : EXP_INFO[s.exp].title}</h2>
            {playground && <PresetTabs />}
            <Transport compareToggle={s.exp === "timeline"} />
          </div>
          <Timeline edit={edit} editable={playground} slot={compare ? "A" : "P"} label={compare ? `A · ${s.preset}` : "Picture"} flags={flags} showKnows={s.exp !== "montage" && s.exp !== "comedy" && s.exp !== "kuleshov"} scale={compare ? Math.max(runtime(edit), runtime(compareEdit(s))) : undefined} />
          {compare && (
            <div className="er-compare-strip">
              <Timeline edit={compareEdit(s)} slot="B" compact showAudio={false} showKnows={false} testid="timeline-b" label={`B · ${s.compareWith}`} scale={Math.max(runtime(edit), runtime(compareEdit(s)))} />
            </div>
          )}
          <div className="er-under">
            <ExpControls />
            <StatCards edit={edit} />
          </div>
          {s.exp === "timeline" && <p className="er-hint">Try adjusting the duration of the reaction shot or moving the box reveal before the reaction. This changes the editorial rhythm and what the audience learns first.</p>}
        </section>
      </div>
      <aside className="er-inspector" aria-label="Explanation and exports">
        <ConceptCard />
        <ExplainPanel />
        <Exports />
      </aside>
    </div>
  );
}

function KnowsCard({ edit }: { edit: Edit }) {
  const k = analyseKnows(edit);
  const rows = [
    { label: "The danger is visible", t: k.dangerAt, cls: "er-k-danger" },
    { label: "Bram reacts on screen", t: k.reactionAt, cls: "er-k-react" },
    { label: "The box opens", t: k.revealAt, cls: "er-k-reveal" },
  ].sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
  return (
    <section className="er-card" data-testid="knows-card">
      <div className="er-card-head">
        <span className="er-eyebrow">What the audience knows, when</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.cls} className={`er-knows-row ${r.cls}`}>
          <span>
            <i className="mono">{i + 1}</i> {r.label}
          </span>
          <b className="mono">{r.t === null ? "never" : `${r.t.toFixed(1)}s`}</b>
        </div>
      ))}
      <p className="er-note">{k.reactionBeforeDanger ? "Fear before cause: the audience is anxious before they know why." : k.dangerAt !== null && k.reactionAt !== null ? "Cause before fear: the audience is ahead of Bram, waiting for him." : k.reactionAfterReveal ? "The reaction answers the reveal." : "No reaction on screen."}</p>
    </section>
  );
}

function InspectLayout() {
  const { s, edit } = useActive();
  const st = stats(edit);
  return (
    <div className="er-workspace">
      <div className="er-bench">
        <div className="er-toolbar">
          <ModeSwitch />
          <ExpTabs />
        </div>
        <div className="er-inspect-top">
          <div className="er-picture er-picture-inspect">
            <div className="er-program">
              <Monitor slot="P" label="Program" />
            </div>
          </div>
          <section className="er-card er-axis-card" data-testid="axis-card">
            <div className="er-card-head">
              <span className="er-eyebrow">Cameras & the line</span>
              <span className="mono">{edit.length} clips · {new Set(edit.map((c) => c.shot)).size} cameras</span>
            </div>
            <AxisDiagram highlight={[...new Set(edit.map((c) => c.shot))].filter((id) => SHOTS[id].reel === "main")} overrides={camOverrides(s)} />
          </section>
        </div>
        <section className="er-panel er-panel-inspect">
          <div className="er-panel-head">
            <h2>Timeline analysis</h2>
            <span className="mono er-dim">{st.runtime.toFixed(1)}s · ASL {st.asl.toFixed(2)}s · {st.cuts} cuts</span>
            <Transport />
          </div>
          <Timeline edit={edit} slot="P" testid="timeline" />
        </section>
        <div className="er-inspect-bottom">
          <AslGraph edit={edit} />
          <KnowsCard edit={edit} />
        </div>
      </div>
      <aside className="er-inspector">
        <ExplainPanel />
        <Exports />
      </aside>
    </div>
  );
}

function WatchLayout() {
  const { s, edit } = useActive();
  return (
    <div className="er-watch">
      <div className="er-toolbar">
        <ModeSwitch />
        {(s.exp === "timeline" || s.exp === "pacing") && <PresetTabs testid="watch-presets" />}
        <Transport />
      </div>
      <div className="er-watch-picture">
        <Monitor slot="W" label={s.exp === "timeline" || s.exp === "pacing" ? s.preset : EXP_INFO[s.exp].tab} big />
      </div>
      <div className="er-watch-foot">
        <Timeline edit={edit} slot="W" compact showAudio={false} showKnows={false} testid="timeline" />
        <ExplainPanel compact />
      </div>
    </div>
  );
}

export default function EditingRhythmLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const s = useER((x) => x);
  const edit = activeEdit(s);
  const st = stats(edit);
  const k = analyseKnows(edit);
  const comedy = comedyBeats(s.comedy);
  useShortcuts();
  useUrlSync();
  useSound();
  useProgramAttr();
  useEffect(() => installHook(params.e2e), [params.e2e]);
  const sel = s.edit.findIndex((c) => c.id === s.selected);
  return (
    <main
      className="lab-root er-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-mode={s.mode}
      data-exp={s.exp}
      data-preset={s.preset}
      data-selected={s.selected ?? ""}
      data-selected-index={sel}
      data-selected-shot={sel >= 0 ? s.edit[sel].shot : ""}
      data-runtime={runtime(edit).toFixed(2)}
      data-cuts={st.cuts}
      data-asl={st.asl.toFixed(2)}
      data-order={edit.map((c) => c.shot).join(",")}
      data-info-order={k.reactionAt === null ? "no-reaction" : k.reactionBeforeDanger ? "reaction-first" : k.reactionAfterReveal ? "reaction-after-reveal" : "danger-first"}
      data-compare={s.compare && s.exp === "timeline" ? s.compareWith : ""}
      data-jl={s.jlLead.toFixed(2)}
      data-flipped={s.flipped ? "1" : "0"}
      data-montage={s.montage}
      data-compression={compression(montageEdit(s.montage)).ratio}
      data-comedy-step={comedy.step}
      data-comedy-fall={comedy.fall}
      data-comedy-reaction={comedy.reaction}
      data-sound={!s.audioUnlocked ? "locked" : s.muted ? "muted" : "on"}
      data-nomotion={reduced ? "1" : "0"}
    >
      <div className="er-canvas">
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 40, near: 0.1, far: 140, position: [0, 2, 6] }}
          onCreated={(state) => {
            state.gl.shadowMap.autoUpdate = false;
          }}
        >
          <Orchestrator reducedMotion={reduced} />
          <StageLighting shadowMap={quality.spec.shadowMap} />
          <EditSet />
          <Cast />
          <Props />
        </Canvas>
      </div>
      <Header />
      {s.mode === "watch" ? <WatchLayout /> : s.mode === "inspect" ? <InspectLayout /> : <ExperimentLayout />}
    </main>
  );
}
