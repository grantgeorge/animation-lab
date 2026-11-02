"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, type CameraControlsImpl } from "@react-three/drei";
import { PCFShadowMap, Vector3 } from "three";
import { getScene, isSceneId, sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { LAYER_TECH } from "@/scene/layers";
import { SceneSet } from "@/scene/set/SceneSet";
import { Bram, Pip } from "@/scene/characters/Characters";
import { StageLighting } from "@/scene/StageLighting";
import { FloorGrid } from "@/scene/set/Set";
import { TechLayer } from "@/scene/TechLayer";
import { MOVE_ORDER } from "./engine/moves";
import { Orchestrator } from "./runtime/Orchestrator";
import { live, stageWindow } from "./runtime/live";
import { PathViz } from "./stage/PathViz";
import { ConceptCard, FieldGuide, Header, Monitors, MovePicker, ParamsPanel, ScenePicker, Timeline, Toast } from "./ui/Panels";
import { cmClock, cmStore, currentViews, useCM, type CMState } from "./store";
import "./camera-movement.css";

function boot() {
  const params = readUrlParams(typeof window === "undefined" ? "" : window.location.search);
  const sp = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const scene = sp?.get("scene");
  const version = cmStore.getState().version;
  cmStore.setState({ ...cmStore.getInitialState(), version: version + 1 });
  const st = cmStore.getState();
  if (isSceneId(scene)) st.setScene(scene);
  else st.setScene("doorway");
  // The lens lab may have left another scene active; make sure the clock matches this one.
  cmClock.durationS = getScene(cmStore.getState().sceneId).timeline.durationS;
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  cmClock.seek(params.freeze ?? 0);
  if (params.freeze !== null || reduced) st.pause();
  else st.play();
  return { params, reduced };
}

function Observer({ element }: { element: HTMLElement | null }) {
  const ref = useRef<CameraControlsImpl>(null);
  const sceneId = useCM((s) => s.sceneId);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.camera.layers.enable(LAYER_TECH);
    const p = getScene(sceneId).observer.presets.overview;
    void c.setLookAt(p.position[0], p.position[1] + 0.6, p.position[2] + 1.2, p.target[0], p.target[1], p.target[2], false);
  }, [sceneId, element]);
  if (!element) return null;
  return (
    <CameraControls
      ref={ref}
      makeDefault
      domElement={element}
      minPolarAngle={d.observer.limits.minPolar}
      maxPolarAngle={d.observer.limits.maxPolar}
      minDistance={1.2}
      maxDistance={34}
      smoothTime={0.18}
      draggingSmoothTime={0.06}
    />
  );
}

function useShortcuts(help: boolean, setHelp: (open: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { setHelp(false); return; }
      if (help) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = cmStore.getState();
      const nativeControl = Boolean(t?.closest("button, a, summary"));
      if (e.key === "?") { setHelp(true); return; }
      const digit = /^Digit(\d)$/.exec(e.code);
      if (digit) {
        const n = Number(digit[1]);
        const moves = MOVE_ORDER.filter((k) => k !== "dollyZoom");
        const k = moves[(n + 9) % 10];
        if (k) s.setKind(k);
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case "Space":
          if (nativeControl) return;
          s.togglePlay();
          s.say(cmStore.getState().playing ? "Play" : "Pause");
          e.preventDefault();
          break;
        case "KeyC":
          s.setExperiment(s.experiment === "dollyVsZoom" ? "move" : "dollyVsZoom");
          break;
        case "KeyZ":
          s.setKind("dollyZoom");
          break;
        case "KeyR":
          s.resetPath();
          break;
        case "Home":
          if (nativeControl) return;
          s.seek(0);
          break;
        case "Comma":
        case "Period":
          if (s.playing) s.pause();
          s.seek(cmClock.peek() + (e.code === "Period" ? 1 : -1) / 24);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help, setHelp]);
}

export interface CameraLabHook {
  getState: () => CMState;
  views: () => ReturnType<typeof currentViews>;
  live: () => { t: number; frameId: number; focal: number[]; fractions: number[]; positions: number[][] };
  frames: (n?: number) => Promise<number>;
}

function installHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const hook: CameraLabHook = {
    getState: cmStore.getState,
    views: () => currentViews(),
    live: () => ({ t: live.t, frameId: live.frameId, focal: live.poses.map((p) => p.focalMm), fractions: [...live.fractions], positions: live.poses.map((p) => p.position.toArray()) }),
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frameId;
        const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
        poll();
      }),
  };
  (window as unknown as { __cameraLab: CameraLabHook }).__cameraLab = hook;
  return () => {
    delete (window as unknown as { __cameraLab?: CameraLabHook }).__cameraLab;
    delete (window as unknown as { __cameraR3f?: unknown }).__cameraR3f;
  };
}

export default function CameraMovementLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const sceneId = useCM((s) => s.sceneId);
  const kind = useCM((s) => s.kind);
  const experiment = useCM((s) => s.experiment);
  const dragging = useCM((s) => s.dragging);
  const root = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const registerStage = useCallback((el: HTMLDivElement | null) => { stageWindow.current = el; setStage(el); }, []);
  const [studio, setStudio] = useState(false);
  const [help, setHelp] = useState(false);
  useShortcuts(help, setHelp);
  useEffect(() => installHook(params.e2e), [params.e2e]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) cmClock.pause();
      else if (cmStore.getState().playing) cmClock.play();
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => { document.removeEventListener("visibilitychange", onVis); cmClock.pause(); };
  }, []);
  return (
    <main ref={root} className="lab-root cm-root fixed inset-0 overflow-hidden" data-testid="lab-root" data-scene={sceneId} data-kind={kind} data-experiment={experiment} data-dragging={dragging ?? ""} data-primary={studio ? "studio" : "camera"}>
      <div className="cm-canvas" key={sceneId}>
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 42, near: 0.1, far: 140, position: [2, 6, 8] }}
          eventSource={root as React.RefObject<HTMLElement>}
          onCreated={(state) => {
            state.gl.shadowMap.autoUpdate = false;
            state.raycaster.layers.enableAll();
            state.camera.layers.enable(LAYER_TECH);
            if (params.e2e) (window as unknown as { __cameraR3f: typeof state }).__cameraR3f = state;
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
          <PathViz />
          <Observer element={stage} />
        </Canvas>
      </div>
      <Header onHelp={() => setHelp(true)} />
      <div className="cm-workspace">
        <div className="cm-workbench">
          <div className="cm-toolbar">
            <div className="cm-view-switch" role="group" aria-label="Main view">
              <button type="button" aria-pressed={!studio} data-testid="view-camera" onClick={() => setStudio(false)}>Camera</button>
              <button type="button" aria-pressed={studio} data-testid="view-studio" onClick={() => setStudio(true)}>Studio</button>
            </div>
            <ScenePicker />
          </div>
          <div className="cm-picture" data-testid="movement-picture">
            <div ref={registerStage} className="cm-stage" data-testid="stage-window" aria-label="Studio: drag to orbit or move the amber path handles" />
            <Monitors />
            <button type="button" className="cm-swap" onClick={() => setStudio(!studio)}>{studio ? "Camera view" : "Studio view"} <span>↗</span></button>
          </div>
          <Timeline key={`t-${sceneId}`} />
          <ConceptCard />
        </div>
        <aside className="cm-inspector" aria-label="Choose and shape a camera move">
          <div className="cm-panel-heading"><span className="cm-eyebrow">THE CAMERA MOVE</span><h2>Give the shot intention</h2></div>
          <MovePicker />
          <ParamsPanel key={`p-${sceneId}`} />
        </aside>
      </div>
      <Toast />
      <FieldGuide open={help} onClose={() => setHelp(false)} />
    </main>
  );
}
