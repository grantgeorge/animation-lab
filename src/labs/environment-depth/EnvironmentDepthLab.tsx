"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, type Group } from "three";
import { readUrlParams, resolveQuality } from "@/renderer/runtime/quality";
import { Pip } from "@/scene/characters/Characters";
import { CAMERA, MOVES, timeForU, type MoveId } from "./engine/camera";
import { HAZE_COLORS, type HazeColorId } from "./engine/haze";
import { SLICE } from "./engine/layers";
import { CONSTRUCT_COPY, CUE_COPY, LESSON, NOTICE, QUESTION } from "./content";
import { CONSTRUCTS, CUE_IDS, DEFAULTS, MODES, STEP_ORDER, cuesWith, CUES_DEFAULT, edClock, edStore, isCueOn, useED, type Construct, type CueId, type Cues, type EDState, type Mode, type Overlay } from "./store";
import { Orchestrator } from "./runtime/Orchestrator";
import { U } from "./runtime/shaders";
import { actors, live, onAfterFrame } from "./runtime/live";
import { buildForest } from "./stage/forest";
import { PIP_LOOK_UP } from "./stage/pipClip";
import { Header, Help, ModeSwitch, Toast, Transport } from "./ui/Chrome";
import { CaptionBar, MainPicture, RevealMeter } from "./ui/Picture";
import { Construction, Cues as CueControls } from "./ui/Controls";
import { InspectRow, Readouts } from "./ui/Inspect";
import { PromptBox } from "./ui/Prompt";
import "./environment-depth.css";

type UrlState = Partial<Pick<EDState, "mode" | "construct" | "move" | "moveSize" | "layerCount" | "cleanPlates" | "overlay" | "cues" | "step">> & { u?: number };

const CONSTRUCT_ALIASES: Record<string, Construct> = { "2d": "2d", "25d": "25d", "2.5d": "25d", "3d": "3d" };

/** Read the deep-link keys into a store patch. */
export function stateFromUrl(search: string): UrlState {
  const sp = new URLSearchParams(search);
  const out: UrlState = {};
  const mode = sp.get("mode");
  if (MODES.includes(mode as Mode)) out.mode = mode as Mode;
  const construct = CONSTRUCT_ALIASES[sp.get("construct") ?? ""];
  if (construct) out.construct = construct;
  const move = sp.get("move");
  if (MOVES.includes(move as MoveId)) out.move = move as MoveId;
  const size = Number(sp.get("size"));
  if (sp.has("size") && size >= 0.4 && size <= 2) out.moveSize = size;
  const layers = Number(sp.get("layers"));
  if (sp.has("layers") && layers >= SLICE.minLayers && layers <= SLICE.maxLayers) out.layerCount = Math.round(layers);
  if (sp.get("clean") === "1") out.cleanPlates = true;
  const overlay = sp.get("overlay");
  if (overlay === "reveal" || overlay === "bands" || overlay === "none") out.overlay = overlay as Overlay;
  let cues: Cues = structuredClone(CUES_DEFAULT);
  const cue = sp.get("cue");
  const step = Number(sp.get("step"));
  if (cue === "flat" || cue === "none") {
    cues = cuesWith([]);
    out.step = 0;
  } else if (cue === "all") out.step = STEP_ORDER.length;
  else if (CUE_IDS.includes(cue as CueId)) cues = cuesWith([cue as CueId]);
  if (sp.has("step") && step >= 0 && step <= STEP_ORDER.length) {
    cues = cuesWith(STEP_ORDER.slice(0, step));
    out.step = step;
  }
  const num = (k: string, lo: number, hi: number) => (sp.has(k) && Number(sp.get(k)) >= lo && Number(sp.get(k)) <= hi ? Number(sp.get(k)) : null);
  const parallax = num("parallax", 0, 1);
  if (parallax !== null) cues.parallax = parallax;
  const haze = num("haze", 0, 1);
  if (haze !== null) cues.haze = haze;
  const focal = num("focal", CAMERA.minFocalMm, CAMERA.maxFocalMm);
  if (focal !== null) cues.focalMm = focal;
  const hc = sp.get("hazeColor");
  if (hc && hc in HAZE_COLORS) cues.hazeColor = hc as HazeColorId;
  const story = sp.get("story");
  if (story === "giant" || story === "ordinary" || story === "tiny") cues.story = story;
  const refs = sp.get("refs");
  if (refs !== null) {
    const list = refs.split(",");
    cues.refs = { pip: list.includes("pip"), cabin: list.includes("cabin"), fence: list.includes("fence"), deer: list.includes("deer") };
    cues.scale = list.some((r) => r in cues.refs);
  }
  if (sp.get("guides") === "1") cues.guides = true;
  out.cues = cues;
  const u = num("u", 0, 1);
  if (u !== null) out.u = u;
  return out;
}

function boot() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = readUrlParams(search);
  const { u, ...patch } = stateFromUrl(search);
  edStore.setState({ ...DEFAULTS, cues: structuredClone(CUES_DEFAULT), step: null, ...patch, help: false, toast: null, version: edStore.getState().version + 1 });
  const reduced = params.nomotion || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  const frozen = u !== undefined ? timeForU(u) : params.freeze;
  edClock.seek(frozen ?? 0);
  if (frozen !== null || reduced) edStore.getState().pause();
  else edStore.getState().play();
  return { params, reduced };
}

/** Keep the address bar a shareable deep link. */
function urlFor(s: EDState, search: string) {
  const sp = new URLSearchParams(search);
  for (const k of ["mode", "construct", "move", "size", "layers", "clean", "overlay", "cue", "step", "parallax", "haze", "focal", "hazeColor", "story", "refs", "guides", "u"]) sp.delete(k);
  sp.set("mode", s.mode);
  sp.set("construct", s.construct);
  sp.set("move", s.move);
  if (s.moveSize !== 1) sp.set("size", String(s.moveSize));
  if (s.construct === "25d" && s.layerCount !== SLICE.defaultLayers) sp.set("layers", String(s.layerCount));
  if (s.cleanPlates) sp.set("clean", "1");
  if (s.overlay !== "none") sp.set("overlay", s.overlay);
  if (s.step !== null) sp.set("step", String(s.step));
  else {
    const c = s.cues;
    const d = CUES_DEFAULT;
    if (c.parallax !== d.parallax) sp.set("parallax", String(c.parallax));
    if (c.haze !== d.haze) sp.set("haze", String(c.haze));
    if (c.focalMm !== d.focalMm) sp.set("focal", String(c.focalMm));
  }
  if (s.cues.hazeColor !== "blue") sp.set("hazeColor", s.cues.hazeColor);
  if (s.cues.story !== "giant") sp.set("story", s.cues.story);
  const refs = (Object.keys(s.cues.refs) as (keyof Cues["refs"])[]).filter((k) => s.cues.scale && s.cues.refs[k]).join(",");
  if (refs !== "pip,fence") sp.set("refs", refs);
  if (s.cues.guides) sp.set("guides", "1");
  return `${window.location.pathname}?${sp.toString()}`;
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = edStore.getState();
      if (e.key === "Escape") return s.setHelp(false);
      if (s.help) return;
      if (e.key === "?") return s.setHelp(true);
      const nativeControl = Boolean(t?.closest("button, a, summary"));
      const digit = /^Digit([1-3])$/.exec(e.code);
      if (digit) {
        const c = CONSTRUCTS[Number(digit[1]) - 1];
        s.setConstruct(c);
        s.say(`${CONSTRUCT_COPY[c].label}: ${CONSTRUCT_COPY[c].short}`);
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
        case "KeyP":
          return s.setMove("push");
        case "KeyT":
          return s.setMove("track");
        case "KeyA":
          return s.setMove("arc");
        case "KeyF":
          s.isolate("flat");
          return s.say("Flattened: every cue off");
        case "KeyN": {
          const next = s.step === null ? 1 : Math.min(STEP_ORDER.length, s.step + 1);
          s.setStep(next);
          return s.say(`+ ${CUE_COPY[STEP_ORDER[next - 1]].label}`);
        }
        case "KeyR":
          return s.setOverlay(s.overlay === "reveal" ? "none" : "reveal");
        case "KeyB":
          return s.setOverlay(s.overlay === "bands" ? "none" : "bands");
        case "Space":
          if (nativeControl) return;
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

export interface EnvLabHook {
  getState: () => Pick<EDState, "mode" | "construct" | "move" | "moveSize" | "layerCount" | "cleanPlates" | "overlay" | "cues" | "step" | "playing">;
  set: (patch: UrlState) => void;
  live: () => typeof live;
  frames: (n?: number) => Promise<number>;
  seek: (t: number) => void;
  setU: (u: number) => void;
  pause: () => void;
  play: () => void;
  revealed: () => { total: number; edge: number; disoccluded: number };
}

function installHook(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const hook: EnvLabHook = {
    getState: () => {
      const s = edStore.getState();
      return { mode: s.mode, construct: s.construct, move: s.move, moveSize: s.moveSize, layerCount: s.layerCount, cleanPlates: s.cleanPlates, overlay: s.overlay, cues: s.cues, step: s.step, playing: s.playing };
    },
    set: ({ u, cues, ...patch }) => {
      const s = edStore.getState();
      edStore.setState({ ...patch, ...(cues ? { cues: { ...s.cues, ...cues } } : {}), version: s.version + 1 });
      if (u !== undefined) hook.setU(u);
    },
    live: () => JSON.parse(JSON.stringify(live)),
    frames: (n = 2) =>
      new Promise((resolve) => {
        const start = live.frameId;
        const poll = () => (live.frameId >= start + n ? resolve(live.frameId) : requestAnimationFrame(poll));
        poll();
      }),
    seek: (t) => edStore.getState().seek(t),
    setU: (u) => {
      edStore.getState().pause();
      edStore.getState().seek(timeForU(u));
    },
    pause: () => edStore.getState().pause(),
    play: () => edStore.getState().play(),
    revealed: () => ({ total: live.reveal.total, edge: live.reveal.edge, disoccluded: live.reveal.disoccluded }),
  };
  (window as unknown as { __envLab: EnvLabHook }).__envLab = hook;
  return () => {
    delete (window as unknown as { __envLab?: EnvLabHook }).__envLab;
  };
}

/** Mirror readiness and the live revealed area onto the root, without re-rendering React. */
function useRootAttrs(root: React.RefObject<HTMLElement | null>) {
  useEffect(
    () =>
      onAfterFrame(() => {
        const el = root.current;
        if (!el) return;
        const ready = live.ready ? "1" : "0";
        if (el.dataset.ready !== ready) el.dataset.ready = ready;
        const rv = live.reveal.total.toFixed(3);
        if (el.dataset.revealed !== rv) el.dataset.revealed = rv;
      }),
    [root],
  );
}

function Aside({ mode }: { mode: Exclude<Mode, "watch"> }) {
  return (
    <aside className="ed-inspector" aria-label={mode === "experiment" ? "Controls" : "Readouts"} data-testid="inspector">
      <div className="ed-panel-heading">
        <span className="ed-eyebrow">ENVIRONMENT &amp; DEPTH · {mode === "experiment" ? "CONTROLS" : "BREAKDOWN"}</span>
        <h2>One forest, seven depth cues</h2>
        <p>{QUESTION}</p>
      </div>
      {mode === "experiment" ? (
        <div data-testid="controls">
          <Construction />
          <CueControls />
        </div>
      ) : (
        <>
          <section className="ed-section">
            <RevealMeter />
          </section>
          <Readouts />
        </>
      )}
      <PromptBox />
      <div className="ed-lesson" data-testid="lesson">
        <p>{LESSON}</p>
        <ul>
          {NOTICE.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function StudioLayout({ mode }: { mode: Exclude<Mode, "watch"> }) {
  return (
    <div className="ed-workspace">
      <div className="ed-workbench">
        <div className="ed-picture" data-testid="picture">
          <MainPicture />
        </div>
        {mode === "inspect" ? <InspectRow /> : <CaptionBar />}
        <Transport />
      </div>
      <Aside mode={mode} />
    </div>
  );
}

function CueStrip() {
  const cues = useED((s) => s.cues);
  return (
    <ul className="ed-cue-strip" aria-label="Depth cues on">
      {CUE_IDS.map((id) => (
        <li key={id} data-on={isCueOn(cues, id) ? "1" : "0"}>
          {CUE_COPY[id].label}
        </li>
      ))}
    </ul>
  );
}

function WatchLayout() {
  return (
    <div className="ed-watch">
      <div className="ed-watch-picture">
        <MainPicture />
      </div>
      <div className="ed-watch-foot">
        <div className="ed-caption" data-testid="caption">
          <span className="ed-eyebrow">WATCH · THE SAME FOREST, SEVEN DEPTH CUES</span>
          <h2>{QUESTION}</h2>
          <p>{LESSON}</p>
          <CueStrip />
        </div>
        <div className="ed-watch-side">
          <PromptBox compact />
          <Transport />
        </div>
      </div>
    </div>
  );
}

export default function EnvironmentDepthLab() {
  const [{ params, reduced }] = useState(boot);
  const quality = useMemo(() => resolveQuality("auto", params), [params]);
  const low = params.e2e || quality.level <= 1;
  const [forest] = useState(buildForest);
  const s = useED((x) => x);
  const root = useRef<HTMLElement>(null);
  useShortcuts();
  useRootAttrs(root);
  useEffect(() => installHook(params.e2e || params.debug), [params.e2e, params.debug]);
  useEffect(() => {
    actors.fg = forest.fg;
    actors.refs = forest.refs;
    actors.shafts = forest.shafts;
    actors.pipDecals = forest.pipDecals;
    return () => {
      actors.fg = null;
      actors.refs = { cabin: null, fence: null, deer: null };
      actors.shafts = null;
      actors.pipDecals = null;
      forest.dispose();
    };
  }, [forest]);
  useEffect(() => {
    const url = urlFor(s, window.location.search);
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [s]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) edClock.pause();
      else if (edStore.getState().playing) edClock.play();
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      edClock.pause();
    };
  }, []);
  const c = s.cues;
  return (
    <main
      ref={root}
      className="lab-root ed-root fixed inset-0 overflow-hidden"
      data-testid="lab-root"
      data-mode={s.mode}
      data-construct={s.construct}
      data-move={s.move}
      data-overlay={s.overlay}
      data-step={s.step ?? "custom"}
      data-cue-parallax={c.parallax.toFixed(2)}
      data-cue-haze={c.haze.toFixed(2)}
      data-cue-layers={c.layers ? "on" : "off"}
      data-cue-scale={c.scale ? (Object.keys(c.refs) as (keyof Cues["refs"])[]).filter((k) => c.refs[k]).join(",") || "none" : "off"}
      data-scale-story={c.story}
      data-cue-occlusion={c.occlusion ? "on" : "off"}
      data-cue-dof={c.dof ? `f${c.fStop.toFixed(1)}` : "off"}
      data-cue-perspective={Math.round(c.focalMm)}
      data-cues-on={CUE_IDS.filter((id) => isCueOn(c, id)).join(",")}
    >
      <div className="ed-canvas">
        <Canvas
          frameloop="always"
          dpr={quality.dpr}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          camera={{ fov: 40, near: 0.2, far: 6000, position: [0, 2, 10] }}
          onCreated={(state) => {
            state.gl.toneMapping = ACESFilmicToneMapping;
            state.gl.toneMappingExposure = 1.05;
          }}
        >
          <Orchestrator reducedMotion={reduced} low={low} />
          <hemisphereLight args={[U.uSkyColor.value, U.uGroundColor.value, Math.PI]} />
          <directionalLight position={U.uSunDir.value.clone().multiplyScalar(100)} color={U.uSunColor.value} intensity={Math.PI * 0.85} />
          <primitive object={forest.root} />
          <group
            ref={(g: Group | null) => {
              actors.pip = g;
            }}
          >
            <Pip root={[0, 0, 0]} clip={PIP_LOOK_UP} restYawDeg={140} />
          </group>
        </Canvas>
      </div>
      <Header />
      <div className="ed-toolbar">
        <ModeSwitch />
        <div className="ed-toolbar-construct" role="radiogroup" aria-label="Scene construction">
          <span className="ed-eyebrow">SCENE CONSTRUCTION</span>
          {CONSTRUCTS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={s.construct === k} data-testid={`construct-${k}`} onClick={() => edStore.getState().setConstruct(k)}>
              {CONSTRUCT_COPY[k].label}
            </button>
          ))}
        </div>
      </div>
      {s.mode === "watch" ? <WatchLayout /> : <StudioLayout mode={s.mode} />}
      <Toast />
      <Help />
    </main>
  );
}
