"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from "three";
import { setActiveScene } from "@/labs/lens-and-framing/config";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { LAYER_TECH } from "@/scene/layers";
import { painterly } from "./config";
import { TEST_VERSIONS, type TestVersion } from "./engine/seeds";
import { buildUp, isLayerId, LAYER_IDS, stepOf } from "./engine/types";
import { live } from "./live";
import { Orchestrator } from "./render/Orchestrator";
import { releaseResources, resources } from "./render/resources";
import { World } from "./stage/World";
import { installPainterlyHook } from "./testHook";
import { ptClock, ptStore, usePT, type Mode } from "./store";
import { Header, Toolbar } from "./ui/Chrome";
import { BuildUp, LookPicture } from "./ui/LookStage";
import { ExperimentPanel, InspectPanel, WatchPanel } from "./ui/Panels";
import { TestPanel, TestStage } from "./ui/TestStage";
import { Help, Toast } from "./ui/Help";
import "./painterly.css";

const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];

/** Read the URL once: ?mode=, ?layer= (build up to it), ?test= (opens the consistency test), e2e/freeze/quality. */
function boot() {
  const search = window.location.search;
  const params = readUrlParams(search);
  const sp = new URLSearchParams(search);
  setActiveScene(painterly.sceneId);
  const mode = sp.get("mode");
  const layer = sp.get("layer");
  const test = sp.get("test");
  const m: Mode = MODES.includes(mode as Mode) ? (mode as Mode) : "watch";
  const st = ptStore.getState();
  ptStore.setState({
    mode: m,
    section: test && (TEST_VERSIONS as readonly string[]).includes(test) ? "test" : sp.get("section") === "test" ? "test" : "look",
    test: test && (TEST_VERSIONS as readonly string[]).includes(test) ? (test as TestVersion) : "surface",
    layers: isLayerId(layer) ? buildUp(LAYER_IDS.indexOf(layer) + 1) : layer === "clean" ? buildUp(0) : buildUp(5),
    focus: isLayerId(layer) ? layer : "texture",
    wipe: m === "experiment" ? 0.5 : 0,
    projYaw: 0,
    help: false,
    toast: null,
  });
  const reduced = params.nomotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  st.seek(params.freeze ?? 0);
  if (params.freeze !== null || reduced) st.pause();
  else st.play();
  return { params, reduced };
}

/** Keep the address bar a shareable deep link (?mode, ?layer, ?test). */
function useUrlSync() {
  const mode = usePT((s) => s.mode);
  const section = usePT((s) => s.section);
  const test = usePT((s) => s.test);
  const layers = usePT((s) => s.layers);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    if (section === "test") {
      url.searchParams.set("test", test);
      url.searchParams.delete("layer");
    } else {
      url.searchParams.delete("test");
      const k = stepOf(layers);
      if (k === null || k === 5) url.searchParams.delete("layer");
      else url.searchParams.set("layer", k === 0 ? "clean" : LAYER_IDS[k - 1]);
    }
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [mode, section, test, layers]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = ptStore.getState();
      if (e.key === "Escape") return s.setHelp(false);
      if (e.key === "?") return s.setHelp(!s.help);
      if (s.help) return;
      const digit = /^Digit([0-5])$/.exec(e.code);
      if (digit && s.section === "look") {
        const n = Number(digit[1]);
        if (s.mode === "inspect" && n > 0) s.setFocus(LAYER_IDS[n - 1]);
        else s.setStep(n);
        return;
      }
      if (digit && s.section === "test") {
        const n = Number(digit[1]);
        if (n >= 1 && n <= 4) s.setTest(TEST_VERSIONS[n - 1]);
        return;
      }
      switch (e.code) {
        case "KeyW":
          return s.setMode("watch");
        case "KeyI":
          return s.setMode("inspect");
        case "KeyE":
          return s.setMode("experiment");
        case "KeyT":
          return s.setSection(s.section === "look" ? "test" : "look");
        case "Space":
          if (t?.closest("button, a, summary")) return;
          e.preventDefault();
          return s.togglePlay();
        case "Comma":
        case "Period":
          e.preventDefault();
          return s.step(e.code === "Period" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Inspect orbit camera, bound to the observer window; each breakdown frames its subject. */
function Observer() {
  const mode = usePT((s) => s.mode);
  const section = usePT((s) => s.section);
  const focus = usePT((s) => s.focus);
  const camera = useThree((s) => s.camera);
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setEl(live.slots.get("picture") ?? null), 120);
    return () => window.clearInterval(id);
  }, []);
  const active = mode === "inspect" && section === "look";
  const preset = focus === "texture" ? painterly.inspect.texture : focus === "overlays" ? painterly.inspect.overlays : painterly.inspect.overview;
  useEffect(() => {
    camera.layers.enable(LAYER_TECH);
    camera.position.set(preset.position[0], preset.position[1], preset.position[2]);
    camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);
  }, [camera, preset]);
  if (!active || !el) return null;
  return (
    <OrbitControls
      key={`${focus}-${el.dataset.testid}`}
      makeDefault
      domElement={el}
      target={preset.target as unknown as [number, number, number]}
      enableDamping
      dampingFactor={0.12}
      minDistance={0.6}
      maxDistance={14}
      maxPolarAngle={Math.PI / 2 - 0.02}
      autoRotate={focus === "texture"}
      autoRotateSpeed={1.6}
    />
  );
}

export default function PainterlyLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const section = usePT((s) => s.section);
  const mode = usePT((s) => s.mode);
  const layers = usePT((s) => s.layers);
  const focus = usePT((s) => s.focus);
  const test = usePT((s) => s.test);
  const paintChar = usePT((s) => s.paintChar);
  const paintEnv = usePT((s) => s.paintEnv);
  const playing = usePT((s) => s.playing);
  useShortcuts();
  useUrlSync();
  useEffect(() => installPainterlyHook(params.e2e), [params.e2e]);
  useEffect(() => {
    // (re)sync on every mount: React's dev double-mount runs the cleanup below once
    resources();
    const onVis = () => {
      if (document.hidden) ptClock.pause();
      else if (ptStore.getState().playing) ptClock.play();
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      ptClock.pause();
      releaseResources();
    };
  }, []);
  const activeLayers = LAYER_IDS.filter((id) => layers[id]).join(" ");
  return (
    <main
      className="lab-root pt-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-lab="painterly-textures"
      data-section={section}
      data-mode={mode}
      data-layers={activeLayers}
      data-focus={focus}
      data-test={test}
      data-paint-char={paintChar ? "1" : "0"}
      data-paint-env={paintEnv ? "1" : "0"}
      data-playing={String(playing)}
      data-nomotion={reduced ? "1" : "0"}
    >
      <div className="pt-canvas" aria-hidden>
        <Canvas
          frameloop="demand"
          dpr={quality.dpr}
          shadows={{ type: PCFShadowMap }}
          gl={{ antialias: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace, preserveDrawingBuffer: params.e2e }}
          camera={{ fov: 38, near: 0.05, far: 60, position: painterly.inspect.overview.position as unknown as [number, number, number] }}
          onCreated={(state) => {
            state.gl.shadowMap.autoUpdate = false;
            state.camera.layers.enable(LAYER_TECH);
            state.setEvents({ enabled: false });
            const el = state.gl.domElement;
            el.addEventListener("webglcontextlost", (ev) => {
              ev.preventDefault();
              ptStore.getState().say("Graphics context lost: reload the page");
            });
          }}
        >
          <Orchestrator e2e={params.e2e} />
          <Suspense fallback={null}>
            <World shadowMap={quality.spec.shadowMap} />
          </Suspense>
          <Observer />
        </Canvas>
      </div>
      <Header />
      <Toolbar />
      <div className="pt-workspace">
        <div className="pt-main">{section === "look" ? <><LookPicture /><BuildUp /></> : <TestStage />}</div>
        <aside className="pt-side" aria-label="Learn and adjust" data-testid="side-panel">
          {section === "test" ? <TestPanel /> : mode === "watch" ? <WatchPanel /> : mode === "inspect" ? <InspectPanel /> : <ExperimentPanel />}
        </aside>
      </div>
      <Toast />
      <Help />
    </main>
  );
}
