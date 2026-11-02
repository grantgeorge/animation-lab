"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, type CameraControlsImpl } from "@react-three/drei";
import { PCFShadowMap, Vector3 } from "three";
import { getScene, isSceneId } from "@/labs/lens-and-framing/config";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { LAYER_TECH } from "@/scene/layers";
import { SceneSet } from "@/scene/set/SceneSet";
import { Bram, Pip } from "@/scene/characters/Characters";
import { StageLighting } from "@/scene/StageLighting";
import { FloorGrid } from "@/scene/set/Set";
import { TechLayer } from "@/scene/TechLayer";
import { coverageFor, defaultCoverage } from "./engine/presets";
import { CAM_IDS, type CamId, type CamSpec, type Cut } from "./engine/types";
import { Orchestrator } from "./runtime/Orchestrator";
import { live, stageWindow } from "./runtime/live";
import { CoverageViz } from "./stage/CoverageViz";
import { StageLabels } from "./stage/StageLabels";
import { crossedNow, durationOf, scClock, scStore, subjectsFor, useSC, type Mode, type SCState } from "./store";
import { Header, ModeSwitch, ScenePicker } from "./ui/Header";
import { IsoRow, ProgramMonitor, WatchScreen } from "./ui/Monitors";
import { PlanView } from "./ui/PlanView";
import { CameraPanel, DirectionTable } from "./ui/CameraPanel";
import { EditTimeline } from "./ui/EditTimeline";
import { ConceptCard, Help, PromptBox, ShotCaption, Toast } from "./ui/Concept";
import "./shot-coverage.css";

const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];

function boot() {
  const params = readUrlParams(typeof window === "undefined" ? "" : window.location.search);
  const sp = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const scene = sp?.get("scene");
  const mode = sp?.get("mode");
  const st = scStore.getState();
  st.setScene(isSceneId(scene) ? scene : "doorway");
  scStore.setState({ mode: MODES.includes(mode as Mode) ? (mode as Mode) : "experiment", toast: null, help: false, dragging: null });
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  st.seek(params.freeze ?? 0);
  if (params.freeze !== null || reduced) st.pause();
  else st.play();
  return { params, reduced };
}

function Observer({ element }: { element: HTMLElement | null }) {
  const ref = useRef<CameraControlsImpl>(null);
  const sceneId = useSC((s) => s.sceneId);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.camera.layers.enable(LAYER_TECH);
    const d = getScene(sceneId);
    const subj = subjectsFor(sceneId);
    const cams = defaultCoverage(d, subj);
    const t = coverageFor(d).tRef;
    const pts = [...Object.values(cams).map((k) => k.position), subj("primary", t).feet, subj("secondary", t).feet];
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cz = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    const span = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[2] - cz)));
    const o = d.observer.presets.overview;
    const dir = [o.position[0] - o.target[0], o.position[1] - o.target[1], o.position[2] - o.target[2]];
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    const dist = 2.2 * span + 3.2;
    void c.setLookAt(cx + (dir[0] / len) * dist, 0.7 + (dir[1] / len) * dist, cz + (dir[2] / len) * dist, cx, 0.7, cz, false);
  }, [sceneId, element]);
  if (!element) return null;
  return (
    <CameraControls
      ref={ref}
      makeDefault
      domElement={element}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={1.2}
      maxDistance={34}
      smoothTime={0.18}
      draggingSmoothTime={0.06}
    />
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = scStore.getState();
      if (e.key === "Escape") { s.setHelp(false); return; }
      if (s.help) return;
      const nativeControl = Boolean(t?.closest("button, a, summary"));
      const digit = /^Digit([123])$/.exec(e.code);
      if (digit) {
        const id = CAM_IDS[Number(digit[1]) - 1];
        if (s.mode === "experiment" && s.playing) s.cutTo(id);
        else s.select(id);
        e.preventDefault();
        return;
      }
      if (e.key === "?") {
        s.setHelp(!s.help);
        return;
      }
      switch (e.code) {
        case "Space":
          if (nativeControl) return;
          s.togglePlay();
          e.preventDefault();
          break;
        case "Escape":
          s.setHelp(false);
          break;
        case "KeyX":
          if (s.mode !== "watch") s.crossLine();
          break;
        case "KeyZ":
          s.undo();
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
        case "Home":
          if (nativeControl) return;
          s.seek(0);
          break;
        case "Comma":
        case "Period":
          s.step(e.code === "Period" ? 1 : -1);
          e.preventDefault();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export interface CoverageLive {
  t: number;
  frameId: number;
  program: CamId;
  shotIndex: number;
  crossed: boolean;
  cams: Record<CamId, { bramX: number; pipX: number; bramSide: "L" | "R"; pipSide: "L" | "R"; bramLook: string; pipLook: string; axisSide: number; fraction: number }>;
}

export interface CoverageLabHook {
  getState: () => SCState;
  setCamera: (id: CamId, partial: Partial<CamSpec>) => void;
  setEdit: (cuts: Cut[]) => void;
  seek: (t: number) => void;
  pause: () => void;
  live: () => CoverageLive;
  frames: (n?: number) => Promise<number>;
}

function installHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const hook: CoverageLabHook = {
    getState: scStore.getState,
    setCamera: (id, partial) => scStore.getState().setCamera(id, partial),
    setEdit: (cuts) => scStore.getState().setEdit(cuts),
    seek: (t) => scStore.getState().seek(t),
    pause: () => scStore.getState().pause(),
    live: () => {
      const cams = {} as CoverageLive["cams"];
      for (const id of CAM_IDS) {
        const i = live.info[id];
        cams[id] = {
          bramX: i?.primary.x ?? NaN,
          pipX: i?.secondary.x ?? NaN,
          bramSide: i?.primary.side ?? "L",
          pipSide: i?.secondary.side ?? "R",
          bramLook: i?.primary.look ?? "",
          pipLook: i?.secondary.look ?? "",
          axisSide: i?.axisSide ?? 0,
          fraction: live.fractions[id] ?? 0,
        };
      }
      return { t: live.t, frameId: live.frameId, program: live.program, shotIndex: live.shotIndex, crossed: crossedNow(), cams };
    },
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frameId;
        const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
        poll();
      }),
  };
  (window as unknown as { __coverageLab: CoverageLabHook }).__coverageLab = hook;
  return () => { delete (window as unknown as { __coverageLab?: CoverageLabHook }).__coverageLab; };
}

/** Mirrors the program camera onto the root's data attribute without re-rendering React. */
function ProgramAttr() {
  useFrameUpdater(() => {
    const el = document.querySelector<HTMLElement>("[data-testid='lab-root']");
    if (el && el.dataset.programCamera !== live.program) el.dataset.programCamera = live.program;
  }, ORDER.MEASURE);
  return null;
}

function StudioLayout({ mode, registerStage }: { mode: Exclude<Mode, "watch">; registerStage: (el: HTMLDivElement | null) => void }) {
  const exp = mode === "experiment";
  return <div className="sc-workspace">
    <div className="sc-workbench">
      <div className="sc-toolbar"><ModeSwitch compact /><ScenePicker compact /></div>
      <div className="sc-picture" data-testid="coverage-picture">
        <div ref={registerStage} className="sc-stage" data-testid="stage-window" aria-label="Studio: drag to orbit or reposition cameras" />
        <div className="sc-program"><ProgramMonitor /></div>
        <button type="button" className="sc-swap" onClick={() => scStore.getState().setMode(exp ? "inspect" : "experiment")}>{exp ? "Studio view" : "Program view"} <span>↗</span></button>
      </div>
      <div className="sc-compare-heading"><span className="sc-eyebrow">THREE ANGLES · ONE PERFORMANCE</span><span>Select a camera to compose its shot</span></div>
      <IsoRow />
      <section className="sc-timeline" aria-label="Edit timeline"><EditTimeline editable={exp} /></section>
    </div>
    <aside className="sc-inspector" aria-label="Compose and learn">
      <div className="sc-panel-heading"><span className="sc-eyebrow">{exp ? "THE COVERAGE" : "SCREEN DIRECTION"}</span><h2>{exp ? "Build the scene in the cut" : "Keep the audience oriented"}</h2><p>Try crossing the line, then compare the characters’ eyelines.</p></div>
      {exp ? <CameraPanel /> : <DirectionTable />}
      <section className="sc-plan" data-testid="plan-panel"><div><span className="sc-eyebrow">CAMERA POSITIONS</span><span>Drag A, B or C</span></div><PlanView /></section>
      <ConceptCard />
      <details className="sc-notes"><summary>Shot notes <span>Copy the sequence as a prompt</span></summary><PromptBox /></details>
    </aside>
  </div>;
}

function WatchLayout() {
  return <div className="sc-watch-workspace">
    <div className="sc-toolbar"><ModeSwitch compact /><ScenePicker compact /></div>
    <div className="sc-watch-picture"><WatchScreen /></div>
    <section className="sc-watch-timeline" aria-label="The cut"><ShotCaption /><EditTimeline editable={false} compact /></section>
  </div>;
}

export default function ShotCoverageLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const sceneId = useSC((s) => s.sceneId);
  const mode = useSC((s) => s.mode);
  const version = useSC((s) => s.version);
  const dragging = useSC((s) => s.dragging);
  const root = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const registerStage = useCallback((el: HTMLDivElement | null) => { stageWindow.current = el; setStage(el); }, []);
  const crossed = useMemo(() => crossedNow(), [version, sceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  useShortcuts();
  useEffect(() => installHook(params.e2e), [params.e2e]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) scClock.pause();
      else if (scStore.getState().playing) scClock.play();
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => { document.removeEventListener("visibilitychange", onVis); scClock.pause(); };
  }, []);
  return (
    <main
      ref={root}
      className="lab-root sc-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-mode={mode}
      data-scene={sceneId}
      data-crossed={crossed ? "1" : "0"}
      data-duration={durationOf(sceneId)}
      data-dragging={dragging ?? ""}
    >
      <div className="sc-canvas" key={sceneId}>
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 40, near: 0.1, far: 140, position: [2, 6, 8] }}
          eventSource={root as React.RefObject<HTMLElement>}
          onCreated={(state) => {
            state.gl.shadowMap.autoUpdate = false;
            state.raycaster.layers.enableAll();
            state.camera.layers.enable(LAYER_TECH);
            state.setEvents({ compute: (event, st) => {
              const el = stageWindow.current;
              if (!el || !(event.target instanceof Node) || !el.contains(event.target)) { st.raycaster.set(new Vector3(0, -1e6, 0), new Vector3(0, -1, 0)); return; }
              const r = el.getBoundingClientRect();
              st.pointer.set((event.clientX - r.left) / r.width * 2 - 1, 1 - (event.clientY - r.top) / r.height * 2);
              st.raycaster.setFromCamera(st.pointer, st.camera);
            } });
          }}
        >
          <Orchestrator reducedMotion={reduced} />
          <StageLighting shadowMap={quality.spec.shadowMap} />
          <SceneSet />
          <Bram />
          <Pip />
          <TechLayer>
            <FloorGrid />
          </TechLayer>
          {mode !== "watch" && <CoverageViz />}
          <Observer element={stage} />
        </Canvas>
      </div>
      <Header />
      {mode !== "watch" && <StageLabels />}
      {mode === "watch" ? <WatchLayout /> : <StudioLayout mode={mode} registerStage={registerStage} />}
      <ProgramAttr />
      <Toast />
      <Help />
    </main>
  );
}
