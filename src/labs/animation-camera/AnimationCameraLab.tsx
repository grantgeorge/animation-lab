"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, type CameraControlsImpl } from "@react-three/drei";
import { PCFShadowMap, Vector3, type Group } from "three";
import { setActiveScene } from "@/labs/lens-and-framing/config";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { LAYER_TECH } from "@/scene/layers";
import { SceneSet } from "@/scene/set/SceneSet";
import { Bram, Pip } from "@/scene/characters/Characters";
import { StageLighting } from "@/scene/StageLighting";
import { E2 } from "./engine/lens";
import { DEMOS, type Demo } from "./engine/impossible";
import { Orchestrator } from "./runtime/Orchestrator";
import { actors, live, onAfterFrame, stageWindow } from "./runtime/live";
import { Viz } from "./stage/Viz";
import { Guides } from "./stage/Guides";
import { FlatWorld } from "./stage/FlatWorld";
import { DEFAULTS, EXPS, MODES, acClock, acStore, useAC, type ACState, type ExpId, type Mode } from "./store";
import { EXP_COPY } from "./content";
import { ExpPicker, Header, Help, ModeSwitch, Toast, Transport } from "./ui/Chrome";
import { CompareRow, MainPicture } from "./ui/Picture";
import { Controls } from "./ui/Controls";
import { Readouts } from "./ui/Readouts";
import { PromptBox } from "./ui/Prompt";
import "./animation-camera.css";

const EXP_NAMES: Record<string, ExpId> = { projection: 1, lens: 2, multiplane: 3, style: 4, impossible: 5 };

/** Read ?mode, ?exp and the per-experiment deep-link keys into a fresh store state. */
export function stateFromUrl(search: string): Partial<ACState> {
  const sp = new URLSearchParams(search);
  const out: Partial<ACState> = structuredClone(DEFAULTS);
  const mode = sp.get("mode");
  if (MODES.includes(mode as Mode)) out.mode = mode as Mode;
  const exp = sp.get("exp");
  const n = Number(exp);
  if (EXPS.includes(n as ExpId)) out.exp = n as ExpId;
  else if (exp && EXP_NAMES[exp]) out.exp = EXP_NAMES[exp];
  const proj = sp.get("proj");
  if (proj === "ortho" || proj === "orthographic") out.e1!.proj = "orthographic";
  if (proj === "iso" || sp.get("view") === "iso") Object.assign(out.e1!, { view: "iso", proj: "orthographic" });
  if (sp.get("compare") === "wipe") out.e1!.compare = "wipe";
  const focal = Number(sp.get("focal"));
  if (Number.isFinite(focal) && focal >= E2.min && focal <= E2.max) out.e2!.focal = focal;
  if (sp.get("sweep") === "1") out.e2!.sweep = true;
  const move = sp.get("move");
  if (move === "2d" || move === "2.5d" || move === "3d" || move === "25d") out.e3 = { style: move === "25d" ? "2.5d" : move, move: move === "3d" ? "orbit" : "track" };
  const kind = sp.get("kind");
  if (kind === "orbit" || kind === "track") out.e3!.move = kind;
  const style = sp.get("style");
  if (style === "photoreal" || style === "anime" || style === "split") out.e4!.style = style;
  const step = Number(sp.get("step"));
  if (step === 1 || step === 2 || step === 3) out.e4!.step = step;
  if (sp.get("cel") === "1") out.e4!.cel = true;
  const demo = sp.get("demo");
  if (DEMOS.includes(demo as Demo)) out.e5!.demo = demo as Demo;
  return out;
}

function boot() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = readUrlParams(search);
  setActiveScene("doorway");
  acStore.setState({ ...stateFromUrl(search), help: false, toast: null, version: acStore.getState().version + 1 });
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  acClock.seek(params.freeze ?? 0);
  if (params.freeze !== null || reduced) acStore.getState().pause();
  else acStore.getState().play();
  return { params, reduced };
}

/** Keep the address bar a shareable deep link for the current experiment state. */
function urlFor(s: ACState, search: string) {
  const sp = new URLSearchParams(search);
  for (const k of ["mode", "exp", "proj", "view", "compare", "focal", "sweep", "move", "kind", "style", "step", "demo"]) sp.delete(k);
  sp.set("exp", String(s.exp));
  sp.set("mode", s.mode);
  if (s.exp === 1) {
    sp.set("proj", s.e1.view === "iso" ? "iso" : s.e1.proj === "orthographic" ? "ortho" : "persp");
    if (s.e1.compare === "wipe") sp.set("compare", "wipe");
  } else if (s.exp === 2) {
    if (s.e2.sweep) sp.set("sweep", "1");
    else sp.set("focal", String(Math.round(s.e2.focal)));
  } else if (s.exp === 3) {
    sp.set("move", s.e3.style);
    sp.set("kind", s.e3.move);
  } else if (s.exp === 4) {
    sp.set("style", s.e4.style);
    sp.set("step", String(s.e4.step));
  } else sp.set("demo", s.e5.demo);
  return `${window.location.pathname}?${sp.toString()}`;
}

const OBSERVER: Record<string, [number, number, number, number, number, number]> = {
  "1": [6.8, 7.6, 8.6, -0.4, 0.8, -2.6],
  "2": [4.2, 6.2, 2.6, -0.7, 1.0, -0.8],
  "3": [7.0, 5.2, 3.8, 0.0, 1.1, -4.0],
  "3f": [27, 11, 12, -0.1, 1.3, -6.0],
  "4": [5.8, 3.8, 3.4, 0.4, 1.0, -2.4],
  "5": [7.2, 5.4, 4.2, 0.0, 1.0, -3.4],
};

function Observer({ element }: { element: HTMLElement | null }) {
  const ref = useRef<CameraControlsImpl>(null);
  const exp = useAC((s) => s.exp);
  const flat = useAC((s) => s.exp === 3 && s.e3.style !== "3d");
  const key = flat ? "3f" : String(exp);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.camera.layers.enable(LAYER_TECH);
    const p = OBSERVER[key];
    void c.setLookAt(p[0], p[1], p[2], p[3], p[4], p[5], false);
  }, [key, element]);
  if (!element) return null;
  return <CameraControls ref={ref} makeDefault domElement={element} minPolarAngle={0.08} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={1.2} maxDistance={80} smoothTime={0.18} draggingSmoothTime={0.06} />;
}

const cycle = <T,>(list: readonly T[], v: T, d = 1) => list[(list.indexOf(v) + d + list.length) % list.length];

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = acStore.getState();
      if (e.key === "Escape") return s.setHelp(false);
      if (s.help) return;
      if (e.key === "?") return s.setHelp(true);
      const nativeControl = Boolean(t?.closest("button, a, summary"));
      const digit = /^Digit([1-5])$/.exec(e.code);
      if (digit) {
        s.setExp(Number(digit[1]) as ExpId);
        s.say(EXP_COPY[Number(digit[1]) as ExpId].title);
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
        case "Space":
          if (nativeControl) return;
          s.togglePlay();
          e.preventDefault();
          return;
        case "Comma":
        case "Period":
          s.step(e.code === "Period" ? 1 : -1);
          e.preventDefault();
          return;
        case "Home":
          if (!nativeControl) s.seek(0);
          return;
      }
      if (s.exp === 1) {
        if (e.code === "KeyP") s.setE1({ proj: s.e1.proj === "perspective" ? "orthographic" : "perspective" });
        if (e.code === "KeyV") s.setE1(s.e1.view === "iso" ? { view: "street" } : { view: "iso", proj: "orthographic" });
        if (e.code === "KeyC") s.setE1({ compare: s.e1.compare === "wipe" ? "off" : "wipe" });
      } else if (s.exp === 2) {
        if (e.code === "BracketLeft" || e.code === "BracketRight") {
          const list = [...E2.focals];
          const cur = list.reduce((a, b) => (Math.abs(b - s.e2.focal) < Math.abs(a - s.e2.focal) ? b : a));
          s.setE2({ focal: cycle(list, cur, e.code === "BracketRight" ? 1 : -1), sweep: false });
        }
      } else if (s.exp === 3) {
        if (e.code === "KeyM") {
          const style = cycle(["2d", "2.5d", "3d"] as const, s.e3.style);
          s.setE3({ style, move: style === "3d" ? "orbit" : "track" });
        }
        if (e.code === "KeyO") s.setE3({ move: s.e3.move === "orbit" ? "track" : "orbit" });
      } else if (s.exp === 4) {
        if (e.code === "KeyS") s.setE4({ style: cycle(["photoreal", "anime", "split"] as const, s.e4.style) });
      } else if (e.code === "KeyD") s.setE5({ demo: cycle(DEMOS, s.e5.demo) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export interface AnimationCameraHook {
  getState: () => ACState;
  live: () => typeof live;
  frames: (n?: number) => Promise<number>;
  seek: (t: number) => void;
  pause: () => void;
}

function installHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const hook: AnimationCameraHook = {
    getState: acStore.getState,
    live: () => JSON.parse(JSON.stringify(live, (k, v) => (k === "viz" ? undefined : v))),
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frameId;
        const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
        poll();
      }),
    seek: (t) => acStore.getState().seek(t),
    pause: () => acStore.getState().pause(),
  };
  (window as unknown as { __animCamLab: AnimationCameraHook }).__animCamLab = hook;
  return () => {
    delete (window as unknown as { __animCamLab?: AnimationCameraHook }).__animCamLab;
  };
}

/** Mirror the rendered camera type and loop time onto the root, without re-rendering React. */
function useRootAttrs(root: React.RefObject<HTMLElement | null>) {
  useEffect(
    () =>
      onAfterFrame(() => {
        const el = root.current;
        if (!el) return;
        const type = live.camType.main ?? "";
        if (el.dataset.cameraType !== type) el.dataset.cameraType = type;
        const ready = live.frameId > 2 ? "1" : "0";
        if (el.dataset.ready !== ready) el.dataset.ready = ready;
      }),
    [root],
  );
}

function Aside({ mode }: { mode: Exclude<Mode, "watch"> }) {
  const exp = useAC((s) => s.exp);
  const c = EXP_COPY[exp];
  return (
    <aside className="ac-inspector" aria-label={mode === "experiment" ? "Controls" : "Readouts"} data-testid="inspector">
      <div className="ac-panel-heading">
        <span className="ac-eyebrow">
          EXPERIMENT {exp} · {mode === "experiment" ? "CONTROLS" : "BREAKDOWN"}
        </span>
        <h2>{c.title}</h2>
        <p>{c.question}</p>
      </div>
      {mode === "experiment" ? <Controls /> : <Readouts />}
      <PromptBox />
      <div className="ac-lesson" data-testid="lesson">
        <p>{c.lesson}</p>
        <ul>
          {c.notice.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function StudioLayout({ mode, registerStage }: { mode: Exclude<Mode, "watch">; registerStage: (el: HTMLDivElement | null) => void }) {
  const showCompare = useAC((s) => mode === "experiment" && (s.exp !== 5 || s.e5.compare));
  return (
    <div className="ac-workspace">
      <div className="ac-workbench">
        <div className="ac-picture" data-testid="picture">
          <div ref={registerStage} className="ac-stage" data-testid="stage-window" aria-label="Stage: drag to orbit the technical view" />
          <MainPicture />
          <button type="button" className="ac-swap" onClick={() => acStore.getState().setMode(mode === "experiment" ? "inspect" : "experiment")}>
            {mode === "experiment" ? "Stage view" : "Camera view"} <span>↗</span>
          </button>
        </div>
        {showCompare && <CompareRow />}
        <Transport />
      </div>
      <Aside mode={mode} />
    </div>
  );
}

function WatchLayout() {
  const exp = useAC((s) => s.exp);
  const c = EXP_COPY[exp];
  return (
    <div className="ac-watch">
      <div className="ac-watch-picture">
        <MainPicture />
      </div>
      <div className="ac-watch-foot">
        <div className="ac-caption" data-testid="caption">
          <span className="ac-eyebrow">EXPERIMENT {exp}</span>
          <h2>{c.title}</h2>
          <p>{c.lesson}</p>
        </div>
        <div className="ac-watch-side">
          <PromptBox compact />
          <Transport />
        </div>
      </div>
    </div>
  );
}

export default function AnimationCameraLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const low = params.e2e || quality.level <= 1;
  const s = useAC((x) => x);
  const root = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const registerStage = useCallback((el: HTMLDivElement | null) => {
    stageWindow.current = el;
    setStage(el);
  }, []);
  useShortcuts();
  useRootAttrs(root);
  useEffect(() => installHook(params.e2e), [params.e2e]);
  useEffect(() => {
    const url = urlFor(s, window.location.search);
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [s]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) acClock.pause();
      else if (acStore.getState().playing) acClock.play();
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      acClock.pause();
    };
  }, []);
  const groupRef = (key: "set" | "bram" | "pip") => (g: Group | null) => {
    actors[key] = g;
  };
  return (
    <main
      ref={root}
      className="lab-root ac-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-mode={s.mode}
      data-exp={s.exp}
      data-projection={s.e1.proj}
      data-view={s.e1.view}
      data-compare={s.e1.compare}
      data-focal={s.e2.sweep ? "sweep" : Math.round(s.e2.focal)}
      data-move={s.e3.style}
      data-move-kind={s.e3.move}
      data-style={s.e4.style}
      data-step={s.e4.step}
      data-demo={s.e5.demo}
    >
      <div className="ac-canvas">
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 38, near: 0.1, far: 140, position: [7, 6, 6] }}
          eventSource={root as React.RefObject<HTMLElement>}
          onCreated={(state) => {
            state.gl.shadowMap.autoUpdate = false;
            state.camera.layers.enable(LAYER_TECH);
            state.setEvents({
              compute: (event, st) => {
                const el = stageWindow.current;
                if (!el || !(event.target instanceof Node) || !el.contains(event.target)) {
                  st.raycaster.set(new Vector3(0, -1e6, 0), new Vector3(0, -1, 0));
                  return;
                }
                const r = el.getBoundingClientRect();
                st.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, 1 - ((event.clientY - r.top) / r.height) * 2);
                st.raycaster.setFromCamera(st.pointer, st.camera);
              },
            });
          }}
        >
          <Orchestrator reducedMotion={reduced} low={low} />
          <StageLighting shadowMap={quality.spec.shadowMap} />
          <group ref={groupRef("set")}>
            <SceneSet />
          </group>
          <group ref={groupRef("bram")}>
            <Bram />
          </group>
          <group ref={groupRef("pip")}>
            <Pip />
          </group>
          <Guides />
          <FlatWorld />
          <Viz />
          <Observer element={stage} />
        </Canvas>
      </div>
      <Header />
      <div className="ac-toolbar">
        <ModeSwitch />
        <ExpPicker />
      </div>
      {s.mode === "watch" ? <WatchLayout /> : <StudioLayout mode={s.mode} registerStage={registerStage} />}
      <Toast />
      <Help />
    </main>
  );
}
