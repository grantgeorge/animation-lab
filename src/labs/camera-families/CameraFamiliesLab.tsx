"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, type CameraControlsImpl } from "@react-three/drei";
import { PCFShadowMap } from "three";
import { setActiveScene } from "@/labs/lens-and-framing/config";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { LAYER_TECH } from "@/scene/layers";
import { SceneSet } from "@/scene/set/SceneSet";
import { Bram, Pip } from "@/scene/characters/Characters";
import { StageLighting } from "@/scene/StageLighting";
import { FORMATS } from "./engine/formats";
import { getCamera } from "./engine/cameras";
import { deriveShot, type ShotDerived } from "./engine/derive";
import { SHOT } from "./engine/shot";
import { Orchestrator } from "./runtime/Orchestrator";
import { live, slotRef } from "./runtime/live";
import { RigViz } from "./stage/RigViz";
import { bootStore, cfClock, cfStore, STEPS, useCF, type CFState } from "./store";
import { Header, ModeSwitch, StepTabs, stepFrame, Toast, Transport } from "./ui/Header";
import { BlindMonitors, ShotMonitor } from "./ui/Monitor";
import { CameraBrowser } from "./ui/CameraBrowser";
import { PromptBar, Readouts, StepPanel } from "./ui/Controls";
import { CurvePlot, DofBand, GateDiagram } from "./ui/Diagrams";
import { APPROX_NOTE, KEYS, THESIS } from "./content";
import { useDerived } from "./ui/useDerived";
import "./camera-families.css";

function boot() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = readUrlParams(search);
  // Another lab may have left a different scene active; this lab always shoots the doorway.
  setActiveScene("doorway");
  bootStore(search);
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  const st = cfStore.getState();
  st.seek(params.freeze ?? 0);
  if (params.freeze !== null || reduced) st.pause();
  else st.play();
  return { params, reduced };
}

function Observer({ element }: { element: HTMLElement | null }) {
  const ref = useRef<CameraControlsImpl>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.camera.layers.enable(LAYER_TECH);
    void c.setLookAt(5.2, 4.4, 3.4, SHOT.position[0] * 0.3, 0.9, -3.4, false);
  }, [element]);
  if (!element) return null;
  return <CameraControls ref={ref} makeDefault domElement={element} minPolarAngle={0.12} maxPolarAngle={Math.PI / 2 - 0.04} minDistance={1.2} maxDistance={30} smoothTime={0.18} draggingSmoothTime={0.06} />;
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = cfStore.getState();
      if (e.key === "Escape") { s.setHelp(false); return; }
      if (s.help) return;
      if (e.key === "?") { s.setHelp(true); return; }
      const nativeControl = Boolean(t?.closest("button, a, summary"));
      const digit = /^Digit([1-5])$/.exec(e.code);
      if (digit) { s.setStep(STEPS[Number(digit[1]) - 1]); e.preventDefault(); return; }
      switch (e.code) {
        case "KeyW": s.setMode("watch"); break;
        case "KeyI": s.setMode("inspect"); break;
        case "KeyE": s.setMode("experiment"); break;
        case "KeyB": s.setStep("blind"); break;
        case "KeyF": s.setFraming(s.framing === "lens" ? "framing" : "lens"); break;
        case "Space":
          if (nativeControl) return;
          s.togglePlay();
          e.preventDefault();
          break;
        case "Comma":
        case "Period":
          stepFrame(e.code === "Period" ? 1 : -1);
          e.preventDefault();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Keep ?mode, ?step and ?camera in the address bar so any state is a deep link. */
function useUrlSync() {
  useEffect(() => cfStore.subscribe(
    (s) => `${s.mode}|${s.step}|${s.cameraId}`,
    () => {
      const s = cfStore.getState();
      const sp = new URLSearchParams(window.location.search);
      sp.set("mode", s.mode);
      sp.set("step", s.step);
      sp.set("camera", s.cameraId);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${sp.toString()}`);
    },
  ), []);
}

export interface CameraFamiliesHook {
  getState: () => CFState;
  derived: () => ShotDerived;
  live: () => typeof live;
  frames: (n?: number) => Promise<number>;
}

function installHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const hook: CameraFamiliesHook = {
    getState: cfStore.getState,
    derived: () => deriveShot(cfStore.getState()),
    live: () => ({ ...live, sampleTimes: [...live.sampleTimes], lookIds: [...live.lookIds] }),
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frameId;
        const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
        poll();
      }),
  };
  (window as unknown as { __cameraFamilies: CameraFamiliesHook }).__cameraFamilies = hook;
  return () => { delete (window as unknown as { __cameraFamilies?: CameraFamiliesHook }).__cameraFamilies; };
}

function Help() {
  const open = useCF((s) => s.help);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="cf-guide" data-testid="help-dialog" onClose={() => cfStore.getState().setHelp(false)}>
      <button type="button" className="cf-guide-close" aria-label="Close" onClick={() => cfStore.getState().setHelp(false)}>×</button>
      <span className="cf-eyebrow">FIELD GUIDE</span>
      <h2>Think like a cinematographer, not a spec sheet</h2>
      <p>{THESIS}</p>
      <p>So the lab follows the order a director of photography decides in: sensor format → focal length → aperture → movement and shutter → image rendering. Every camera card only sets the first of those; the rest is yours.</p>
      <h3>For AI video prompts</h3>
      <p>Describe the result: format, lens, T-stop, depth of field, shutter, highlight roll-off. Brand names are a weak signal for a video model; the words for what the camera does are a strong one. Copy the prompt line under the picture.</p>
      <h3>Honesty notes</h3>
      <p>{APPROX_NOTE} Depth of field and motion blur are computed from thin-lens and shutter physics; the rolling-shutter readout time is illustrative.</p>
      <dl>{KEYS.map(([k, v]) => <div key={k} className="cf-key"><dt className="mono">{k}</dt><dd>{v}</dd></div>)}</dl>
    </dialog>
  );
}

function ExperimentLayout() {
  const step = useCF((s) => s.step);
  return (
    <div className="cf-workspace">
      <div className="cf-workbench">
        <div className="cf-toolbar"><ModeSwitch /><StepTabs /><Transport /></div>
        <div className="cf-picture" data-testid="picture">{step === "blind" ? <BlindMonitors /> : <ShotMonitor />}</div>
        <PromptBar />
        {step !== "blind" && <CameraBrowser />}
      </div>
      <aside className="cf-inspector" aria-label="Controls"><StepPanel /></aside>
    </div>
  );
}

function InspectLayout({ registerStage }: { registerStage: (el: HTMLDivElement | null) => void }) {
  return (
    <div className="cf-workspace">
      <div className="cf-workbench">
        <div className="cf-toolbar"><ModeSwitch /><span className="cf-toolbar-note">Drag the stage to orbit · amber: focus plane · cyan: depth of field</span><Transport /></div>
        <div className="cf-picture cf-picture-inspect" data-testid="picture">
          <div ref={registerStage} className="cf-stage" data-testid="stage-window" aria-label="Stage view: drag to orbit" />
          <div className="cf-pip"><ShotMonitor chips={false} /></div>
        </div>
        <div className="cf-diagram-row" data-testid="inspect-diagrams">
          <div><span className="cf-eyebrow">GATES TO SCALE</span><GateDiagram compact /></div>
          <div><span className="cf-eyebrow">DEPTH OF FIELD</span><DofBand /></div>
          <div><span className="cf-eyebrow">RESPONSE CURVE</span><CurvePlot /></div>
        </div>
      </div>
      <aside className="cf-inspector" aria-label="Readouts">
        <div className="cf-panel-heading"><span className="cf-eyebrow">INSPECT</span><h2>Every number behind the shot</h2><p>The stage shows the camera, its frustum for this gate and lens, the focus plane (amber) and the slab that stays sharp (cyan). Below it, the same numbers drawn: the gate to scale, the depth-of-field band and the response curve. The picture-in-picture is the graded shot.</p></div>
        <div className="cf-panel-body"><Readouts /></div>
        <div className="cf-panel-body"><PromptBar /></div>
      </aside>
    </div>
  );
}

function WatchLayout() {
  const d = useDerived();
  return (
    <div className="cf-watch">
      <div className="cf-toolbar"><ModeSwitch /><span className="cf-toolbar-note">{d.camera.name} · {d.format.label} · {d.look.label}</span><Transport /></div>
      <div className="cf-picture" data-testid="picture"><ShotMonitor /></div>
      <PromptBar />
    </div>
  );
}

function RootAttrs({ children, rootRef }: { children: React.ReactNode; rootRef: React.RefObject<HTMLElement | null> }) {
  const s = useCF((st) => st);
  const d = useDerived();
  return (
    <main
      ref={rootRef}
      className="lab-root cf-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-mode={s.mode}
      data-step={s.step}
      data-camera={s.cameraId}
      data-format={FORMATS[getCamera(s.cameraId).format].id}
      data-framing={s.framing}
      data-focal={s.focalMm.toFixed(2)}
      data-tstop={s.tStop.toFixed(2)}
      data-focus={s.focusM.toFixed(2)}
      data-shutter={s.shutterDeg}
      data-fps={s.fps}
      data-move={s.move}
      data-look={s.lookId}
      data-hfov={d.hfov.toFixed(2)}
      data-blind-revealed={s.blind.revealed ? "1" : "0"}
    >
      {children}
    </main>
  );
}

export default function CameraFamiliesLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const budget = quality.level >= 3 ? 16 : quality.level === 2 ? 10 : 4;
  const mode = useCF((s) => s.mode);
  const root = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const stageSlot = useMemo(() => slotRef("stage"), []);
  const registerStage = useCallback((el: HTMLDivElement | null) => { stageSlot(el); setStage(el); }, [stageSlot]);
  useShortcuts();
  useUrlSync();
  useEffect(() => installHook(params.e2e), [params.e2e]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) cfClock.pause();
      else if (cfStore.getState().playing) cfClock.play();
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => { document.removeEventListener("visibilitychange", onVis); cfClock.pause(); };
  }, []);
  return (
    <RootAttrs rootRef={root}>
      <div className="cf-canvas">
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 40, near: 0.1, far: 140, position: [5, 4, 3] }}
          eventSource={root as React.RefObject<HTMLElement>}
          onCreated={(state) => {
            state.gl.shadowMap.autoUpdate = false;
            state.camera.layers.enable(LAYER_TECH);
          }}
        >
          <Orchestrator reducedMotion={reduced} budget={budget} />
          <StageLighting shadowMap={quality.spec.shadowMap} />
          <SceneSet />
          <Bram />
          <Pip />
          {mode === "inspect" && <RigViz />}
          <Observer element={mode === "inspect" ? stage : null} />
        </Canvas>
      </div>
      <Header />
      {mode === "watch" ? <WatchLayout /> : mode === "inspect" ? <InspectLayout registerStage={registerStage} /> : <ExperimentLayout />}
      <Toast />
      <Help />
    </RootAttrs>
  );
}
