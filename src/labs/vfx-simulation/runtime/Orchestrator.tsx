"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, MeshBasicMaterial, type Object3D, type PerspectiveCamera, type Scene, type WebGLRenderer } from "three";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { COUNT_RANGE, beatTimes, type Phys, type Timing, type Treatment } from "../engine/beat";
import { FluidBake } from "../engine/fluid";
import { measureTreatment } from "../engine/measure";
import { FPS, frameOf, stepped } from "../engine/timing";
import type { CategoryId } from "../engine/prompt";
import { isCategory, vxClock, vxStore, type CatState, type VXState } from "../store";
import { BucketStage } from "./bucketStage";
import { makeDemo, type Demo } from "./demos";
import { actors, live, measureStore, runAfterFrame, slots } from "./live";
import { toonRamp, toonify } from "./materials";
import { PAL } from "../engine/drawn";

/** Effective realistic droplet count for this quality tier. */
export function capCount(count: number, tier: "e2e" | "low" | "high") {
  return Math.max(COUNT_RANGE.min, Math.min(count, COUNT_RANGE[tier]));
}

export function bakeKey(p: Phys, tm: Timing, n: number) {
  return JSON.stringify([n, p.gravity, p.viscosity, p.intensity, p.turbulence, tm.antic]);
}

/** Shared between the orchestrator and the test hook. */
export const runtime = {
  bake: null as FluidBake | null,
  tier: "high" as "e2e" | "low" | "high",
  measureKey: "",
};

export function ensureBake(s: Pick<VXState, "phys" | "timing">): FluidBake {
  const n = capCount(s.phys.count, runtime.tier);
  const key = bakeKey(s.phys, s.timing.real, n);
  if (!runtime.bake || runtime.bake.key !== key) {
    const p = s.phys;
    runtime.bake = new FluidBake({ n, gravity: p.gravity, viscosity: p.viscosity, intensity: p.intensity, turbulence: p.turbulence, seed: 1 }, beatTimes("real", p, s.timing.real), key);
  }
  return runtime.bake;
}

/** Recompute the legibility curves when settings (or the finished bake) change. */
export function refreshMeasures(s: Pick<VXState, "phys" | "timing">) {
  const bake = runtime.bake;
  const done = !!bake?.done;
  const key = JSON.stringify([s.phys, s.timing, done ? bake!.key : "pending"]);
  if (key === runtime.measureKey) return;
  runtime.measureKey = key;
  const p = { ...s.phys, count: capCount(s.phys.count, runtime.tier) };
  const curves: ReturnType<typeof measureStore.getState>["curves"] = {};
  for (const tr of ["real", "cartoon", "drawn"] as Treatment[]) {
    const c = measureTreatment(tr, p, s.timing[tr], done ? bake : null);
    if (c) curves[tr] = c;
  }
  measureStore.setState({ curves, key });
}

interface View {
  slot: string;
  bucket?: { tr: Treatment; offset: number; pip: number };
  cat?: { id: CategoryId; st: CatState };
}

export function viewsFor(s: VXState): View[] {
  if (s.exp === "bucket") {
    if (s.compare) return (["real", "cartoon", "drawn"] as Treatment[]).map((tr, i) => ({ slot: "ABC"[i], bucket: { tr, offset: 0, pip: i } }));
    return [{ slot: "P", bucket: { tr: s.treatment, offset: 0, pip: ["real", "cartoon", "drawn"].indexOf(s.treatment) } }];
  }
  if (s.exp === "sync")
    return [
      { slot: "A", bucket: { tr: "cartoon", offset: 0, pip: 1 } },
      { slot: "B", bucket: { tr: "cartoon", offset: s.offset, pip: 0 } },
    ];
  const id = s.exp as CategoryId;
  const st = s.cats[id];
  if (s.catCompare)
    return [
      { slot: "A", cat: { id, st: { ...st, look: "real", motion: "sim" } } },
      { slot: "B", cat: { id, st: { ...st, look: "stylized", motion: "keyed" } } },
    ];
  return [{ slot: "P", cat: { id, st } }];
}

const pipsLoaded = () => actors.pips.every((g) => {
  let found = false;
  g?.traverse((o) => {
    if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) found = true;
  });
  return found;
});

function fit(cam: PerspectiveCamera, aspect: number) {
  if (Math.abs(cam.aspect - aspect) < 1e-6) return;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
}

function renderFlash(gl: WebGLRenderer, scene: Scene, cam: Parameters<WebGLRenderer["render"]>[1], hide: Object3D[], white: MeshBasicMaterial) {
  const keep = hide.map((o) => o.visible);
  hide.forEach((o) => (o.visible = false));
  const bg = scene.background;
  scene.background = new Color(PAL.ink);
  scene.overrideMaterial = white;
  gl.render(scene, cam);
  scene.overrideMaterial = null;
  scene.background = bg;
  hide.forEach((o, i) => (o.visible = keep[i]));
}

/**
 * The lab's one positive-priority frame callback. Per frame: tick the clock; advance the realistic bake
 * a few milliseconds; refresh the measurements if anything changed; then for every visible view, pose
 * the right Pip (at that view's time), pose the stage or the category demo, and render into the view's
 * DOM rectangle (scissored).
 */
export function Orchestrator({ reducedMotion, tier }: { reducedMotion: boolean; tier: "e2e" | "low" | "high" }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const stage = useMemo(() => new BucketStage(gl, { low: tier !== "high", maxDroplets: COUNT_RANGE[tier] }), [gl, tier]);
  const demos = useRef(new Map<CategoryId, Demo>());
  const ramp = useMemo(() => toonRamp(), []);
  const white = useMemo(() => new MeshBasicMaterial({ color: "#ffffff" }), []);
  const fpsRef = useRef({ last: 0, frames: 0 });

  useEffect(() => {
    runtime.tier = tier;
    scene.add(stage.root);
    const d = demos.current;
    return () => {
      scene.remove(stage.root);
      stage.dispose();
      for (const demo of d.values()) demo.dispose();
      d.clear();
      ramp.dispose();
      white.dispose();
    };
  }, [scene, stage, tier, ramp, white]);

  useFrame((state, delta) => {
    const { gl, scene: frameScene } = state;
    const t = vxClock.tick();
    const s = vxStore.getState();
    live.t = t;
    live.frame = frameOf(t);
    live.frameId++;
    const now = performance.now();
    const fp = fpsRef.current;
    fp.frames++;
    if (now - fp.last > 500) {
      live.fps = (fp.frames * 1000) / (now - fp.last);
      fp.last = now;
      fp.frames = 0;
    }
    const bucketExp = s.exp === "bucket" || s.exp === "sync";
    // the realistic bake runs whenever the bucket is on screen
    if (bucketExp) {
      const bake = ensureBake(s);
      if (!bake.done) bake.advance(tier === "high" ? 9 : 14);
      live.bake = { progress: bake.progress, done: bake.done, ms: bake.bakeMs, n: bake.sim.n, key: bake.key, firstContact: bake.sim.firstContact };
      refreshMeasures(s);
    }
    // the hand-drawn Pip is cel-shaded with an ink line, once his GLB is in
    const p2 = actors.pips[2];
    if (p2 && !p2.userData.vxToon) {
      let has = false;
      p2.traverse((o) => {
        if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) has = true;
      });
      if (has) {
        toonify(p2, PAL.ink, ramp, 0.0065);
        p2.userData.vxToon = true;
      }
    }
    const size = state.size;
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#0b0d11", 1);
    gl.autoClear = true;
    gl.clear();
    const canvasRect = gl.domElement.getBoundingClientRect();
    live.rendered = [];
    const measured = measureStore.getState().curves;
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    for (const v of viewsFor(s)) {
      const el = slots.get(v.slot);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > window.innerHeight) continue;
      const x = r.left - canvasRect.left;
      const y = canvasRect.height - (r.top - canvasRect.top) - r.height;
      gl.setViewport(x, y, r.width, r.height);
      gl.setScissor(x, y, r.width, r.height);
      gl.setScissorTest(true);
      if (v.bucket) {
        const { tr, offset, pip } = v.bucket;
        const tm = s.timing[tr];
        const beat = beatTimes(tr, s.phys, tm, offset);
        actors.pips.forEach((g, i) => {
          if (g) g.visible = i === pip;
        });
        // the whole picture steps with the timing; in the hybrid 2D-over-3D case Pip can stay on ones
        const pipT = tr === "drawn" && !s.charSteps ? t : stepped(t, tm.step);
        runUpdaters({ t: pipT, dt, frameId: live.frameId, playing: vxClock.isPlaying, reducedMotion });
        fit(stage.camera, r.width / r.height);
        const shown = stage.show({
          treatment: tr,
          t,
          timing: tm,
          phys: { ...s.phys, count: capCount(s.phys.count, tier) },
          beat,
          bake: tr === "real" ? runtime.bake : null,
          vectors: s.vectors,
          raster: s.raster,
          inspect: s.mode === "inspect",
          legibility: measured[tr]?.legibility ?? null,
        });
        gl.setClearColor("#0b0d11", 1);
        gl.clear();
        if (shown.flash) stage.renderFlash(gl, frameScene);
        else gl.render(frameScene, stage.camera);
        live.views[v.slot] = { kind: `bucket:${tr}${s.exp === "sync" ? `:${offset}` : ""}`, t: shown.sampleT, frame: frameOf(t), phase: shown.phase, particles: shown.particles, flash: shown.flash };
      } else if (v.cat) {
        let demo = demos.current.get(v.cat.id);
        if (!demo) {
          demo = makeDemo(v.cat.id, gl, tier !== "high");
          demos.current.set(v.cat.id, demo);
        }
        fit(demo.camera, r.width / r.height);
        demo.update(t, v.cat.st, r.height * gl.getPixelRatio());
        gl.clear();
        if (demo.flash) {
          const hide: Object3D[] = [];
          demo.scene.traverse((o) => {
            if (o.userData.vxSet) hide.push(o);
          });
          renderFlash(gl, demo.scene, demo.camera, hide, white);
        } else gl.render(demo.scene, demo.camera);
        live.views[v.slot] = { kind: `${v.cat.id}:${v.cat.st.look}:${v.cat.st.motion}`, t, frame: frameOf(t), phase: String(demo.stats().phase ?? ""), particles: Number(demo.stats().particles ?? 0), flash: !!demo.flash };
        live.demo = demo.stats();
      }
      live.rendered.push(v.slot);
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    live.ready = live.frameId > 3 && live.rendered.length > 0 && (isCategory(s.exp) || (pipsLoaded() && (s.exp === "sync" || live.bake.done || (!s.compare && s.treatment !== "real"))));
    runAfterFrame();
  }, 1);
  return null;
}

export const FRAME_S = 1 / FPS;
