"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PCFShadowMap } from "three";
import { getScene, isSceneId, setActiveScene, type SceneId } from "@/labs/lens-and-framing/config";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { SceneSet } from "@/scene/set/SceneSet";
import { Bram, Pip } from "@/scene/characters/Characters";
import { StageLighting } from "@/scene/StageLighting";
import { CAPTION } from "./content";
import { getLook, isLookId, lookFromPreset, simpleFromLook } from "./engine/look";
import { SHOW_STEPS, type ShowStep } from "./engine/shots";
import { Orchestrator } from "./runtime/Orchestrator";
import { loadPlates } from "./runtime/plates";
import { FlippedLighting } from "./stage/FlippedLighting";
import { gfClock, gfStore, NODE_ORDER, useGF, type Mode, type NodeId } from "./store";
import { installGradingHook } from "./testHook";
import { AdvancedPanel } from "./ui/AdvancedPanel";
import { DeliverPanel } from "./ui/DeliverPanel";
import { FieldGuide } from "./ui/FieldGuide";
import { Header, ModeSwitch, ShotPicker, Transport, ViewTabs } from "./ui/Header";
import { InspectPanel } from "./ui/InspectPanel";
import { MainMonitor } from "./ui/Monitor";
import { PipelineStrip } from "./ui/PipelineStrip";
import { ShowPanel, ShowWorkbench, useMetric } from "./ui/ShowView";
import { SimplePanel } from "./ui/SimplePanel";
import "./grading-finishing.css";

const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];

/**
 * URL: mode=watch|inspect|experiment, look=<preset id>, shot=doorway|alley|workshop, view=shot|show,
 * step=raw|match|look|override, wipe=0–1, freeze=<s>, nomotion=1, e2e=1 (test hook, low quality),
 * capture=plate|flipped (plate capture: installs the hook at full quality; flipped mirrors the key light).
 */
function boot() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = readUrlParams(search);
  const sp = new URLSearchParams(search);
  const shotParam = sp.get("shot");
  const shot: SceneId = isSceneId(shotParam) ? shotParam : "doorway";
  setActiveScene(shot);
  gfClock.durationS = getScene(shot).timeline.durationS;
  const look = sp.get("look");
  const mode = sp.get("mode");
  const view = sp.get("view");
  const step = sp.get("step");
  const wipe = sp.get("wipe");
  const m: Mode = MODES.includes(mode as Mode) ? (mode as Mode) : "experiment";
  gfStore.setState({
    shot,
    mode: m,
    view: view === "show" ? "show" : "shot",
    step: SHOW_STEPS.includes(step as ShowStep) ? (step as ShowStep) : "raw",
    wipe: wipe !== null && Number.isFinite(Number(wipe)) ? Math.min(1, Math.max(0, Number(wipe))) : m === "inspect" ? 0.5 : null,
    ...(isLookId(look) ? { look: lookFromPreset(look), lookId: look } : {}),
    help: false,
  });
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  gfClock.seek(params.freeze ?? 0);
  if (params.freeze !== null || reduced) gfStore.getState().pause();
  else gfStore.getState().play();
  const cap = sp.get("capture");
  return { params, reduced, capture: cap === "flipped" ? ("flipped" as const) : null, hook: params.e2e || cap !== null };
}

function SceneContent({ shadowMap, capture }: { shadowMap: number; capture: "flipped" | null }) {
  const shot = useGF((s) => s.shot);
  // The shared set, cast and lights read the active scene at render time; remount them per shot.
  return (
    <Fragment key={shot}>
      {capture === "flipped" ? <FlippedLighting shadowMap={shadowMap} /> : <StageLighting shadowMap={shadowMap} />}
      <SceneSet />
      <Bram />
      <Pip />
    </Fragment>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = gfStore.getState();
      if (e.key === "Escape") return s.setHelp(false);
      if (s.help) return;
      const native = Boolean(t?.closest("button, a, summary, [role=slider]"));
      const digit = /^Digit([123])$/.exec(e.code);
      if (digit) return s.setShot((["doorway", "alley", "workshop"] as const)[Number(digit[1]) - 1]);
      switch (e.code) {
        case "KeyW": return s.setMode("watch");
        case "KeyI": return s.setMode("inspect");
        case "KeyE": return s.setMode("experiment");
        case "KeyC": return s.setWipe(s.wipe === null ? 0.5 : null);
        case "Space":
          if (native) return;
          e.preventDefault();
          return s.togglePlay();
      }
      if (e.key === "?") s.setHelp(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Keep ?mode, ?view, ?shot, ?look and ?step in the URL so any state can be linked. */
function useUrlSync() {
  useEffect(
    () =>
      gfStore.subscribe(
        (s) => [s.mode, s.view, s.shot, s.lookId, s.step] as const,
        ([mode, view, shot, lookId, step]) => {
          const sp = new URLSearchParams(window.location.search);
          sp.set("mode", mode);
          sp.set("shot", shot);
          if (view === "show") sp.set("view", "show");
          else sp.delete("view");
          if (lookId && lookId !== "clean") sp.set("look", lookId);
          else sp.delete("look");
          if (view === "show" && step !== "raw") sp.set("step", step);
          else sp.delete("step");
          window.history.replaceState(window.history.state, "", `${window.location.pathname}?${sp.toString()}`);
        },
        { equalityFn: (a, b) => a.every((v, i) => v === b[i]) },
      ),
    [],
  );
}

function Toolbar({ showViewTabs }: { showViewTabs: boolean }) {
  return (
    <div className="gf-toolbar">
      <ModeSwitch />
      {showViewTabs && <ViewTabs />}
      <ShotPicker />
      <Transport />
    </div>
  );
}

function WatchLayout() {
  const lookId = useGF((s) => s.lookId);
  const look = lookId ? getLook(lookId) : null;
  return (
    <div className="gf-watch">
      <Toolbar showViewTabs={false} />
      <div className="gf-picture gf-picture-watch">
        <MainMonitor watch />
      </div>
      <p className="gf-watch-caption" data-testid="watch-caption">
        <b>{look ? look.label : "Custom look"}</b>
        {look && look.id !== "clean" ? ` · ${look.note}` : ""}
        <span>{CAPTION}</span>
      </p>
    </div>
  );
}

function Workspace({ mode }: { mode: Exclude<Mode, "watch"> }) {
  const view = useGF((s) => s.view);
  const [node, setNode] = useState<NodeId | "source">("grade");
  const inspect = mode === "inspect";
  const show = !inspect && view === "show";
  return (
    <div className="gf-workspace">
      <div className="gf-workbench">
        <Toolbar showViewTabs={!inspect} />
        <div className="gf-picture">{show ? <ShowWorkbench /> : <MainMonitor />}</div>
        <PipelineStrip thumbs={inspect} selected={inspect ? node : null} onSelect={setNode} />
      </div>
      <aside className="gf-panel" aria-label={inspect ? "Scopes" : "Controls"}>
        {inspect ? (
          <InspectPanel node={node} />
        ) : show ? (
          <>
            <ShowPanel />
            <DeliverPanel />
          </>
        ) : (
          <>
            <div className="gf-panel-heading">
              <span className="gf-eyebrow">Film look</span>
              <h2>Four sliders, one picture</h2>
            </div>
            <SimplePanel />
            <AdvancedPanel />
            <DeliverPanel />
            <button type="button" className="gf-show-cta" data-testid="show-cta" onClick={() => gfStore.getState().setView("show")}>
              <span className="gf-eyebrow">The payoff</span>
              <b>One show look across three AI shots →</b>
              <span>Balance mismatched clips, apply one look, override one shot, and see what grading can’t fix.</span>
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

export default function GradingFinishingLab() {
  const [{ params, reduced, capture, hook }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const mode = useGF((s) => s.mode);
  const view = useGF((s) => s.view);
  const shot = useGF((s) => s.shot);
  const lookId = useGF((s) => s.lookId);
  const look = useGF((s) => s.look);
  const nodes = useGF((s) => s.nodes);
  const step = useGF((s) => s.step);
  const wipe = useGF((s) => s.wipe);
  const playing = useGF((s) => s.playing);
  const platesReady = useGF((s) => s.platesReady);
  const metric = useMetric();
  const simple = simpleFromLook(look);
  useShortcuts();
  useUrlSync();
  useEffect(() => installGradingHook(hook), [hook]);
  useEffect(() => {
    let alive = true;
    loadPlates()
      .then(() => alive && gfStore.setState({ platesReady: true }))
      .catch(() => alive && gfStore.setState({ platesReady: false }));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) gfClock.pause();
      else if (gfStore.getState().playing) gfClock.play();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); gfClock.pause(); };
  }, []);
  const activeNodes = NODE_ORDER.filter((n) => nodes[n]).join(",");
  return (
    <main
      className="lab-root gf-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-lab="grading-finishing"
      data-mode={mode}
      data-view={mode === "experiment" ? view : "shot"}
      data-shot={shot}
      data-look={lookId ?? "custom"}
      data-grain={Math.round(simple.grain * 100)}
      data-temperature={Math.round(simple.temperature * 100)}
      data-contrast={Math.round(simple.contrast * 100)}
      data-bloom={Math.round(simple.bloom * 100)}
      data-nodes={activeNodes}
      data-stylize={look.stylize.mode}
      data-stepped={look.stylize.mode !== "none" && look.stylize.stepped && nodes.stylize ? "1" : "0"}
      data-step={step}
      data-wipe={wipe === null ? "" : wipe.toFixed(2)}
      data-playing={playing ? "1" : "0"}
      data-plates={platesReady ? "1" : "0"}
      data-mismatch={metric ? metric.now.toFixed(4) : ""}
    >
      <div className="gf-canvas">
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          camera={{ fov: 40, near: 0.1, far: 100, position: [0, 2, 6] }}
          onCreated={(state) => {
            state.gl.autoClear = false;
            state.gl.shadowMap.autoUpdate = false;
          }}
        >
          <Orchestrator reducedMotion={reduced} msaa={quality.spec.msaa} />
          <SceneContent shadowMap={quality.spec.shadowMap} capture={capture} />
        </Canvas>
      </div>
      <Header />
      {mode === "watch" ? <WatchLayout /> : <Workspace mode={mode} />}
      <FieldGuide />
    </main>
  );
}
