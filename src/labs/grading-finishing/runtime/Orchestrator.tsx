"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { WebGLRenderer } from "three";
import { sceneDescriptor } from "@/labs/lens-and-framing/config";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { resolveGrade } from "../engine/grade";
import { grainFrame } from "../engine/grain";
import { NEUTRAL_LOOK, type FinishParams } from "../engine/look";
import { SHOTS } from "../engine/shots";
import { resolveLayers, shotFinish, shotLayers } from "../engine/showlook";
import { aimShotCamera, makeShotCamera } from "../stage/shotCamera";
import { gfClock, gfStore, NODE_ORDER, type GFState, type NodeId } from "../store";
import { captureQueue, live, sampleQueue, slots } from "./live";
import { Pipeline, Programs, develop, makeTarget, readTarget, type CompositeOpts, type RunParams } from "./pipeline";
import { plateTexture, type PlateId } from "./plates";

const OFF_LENS = { distortion: 0, aberration: 0, streaks: 0 };

/** Switch finishing nodes off: `on(node)` decides which survive. */
export function maskFinish(f: FinishParams, on: (n: NodeId) => boolean): FinishParams {
  return {
    grain: on("grain") ? f.grain : { ...f.grain, amount: 0 },
    halation: on("halation") ? f.halation : { ...f.halation, amount: 0 },
    bloom: on("bloom") ? f.bloom : { ...f.bloom, amount: 0 },
    lens: on("lens") ? f.lens : OFF_LENS,
    vignette: on("vignette") ? f.vignette : { ...f.vignette, amount: 0 },
    sharpen: on("sharpen") ? f.sharpen : 0,
    weave: on("weave") ? f.weave : 0,
  };
}

export function mainParams(s: GFState): RunParams {
  const on = (n: NodeId) => s.nodes[n];
  return {
    layers: on("grade") ? [resolveGrade(s.look.grade)] : [],
    stylize: on("stylize") && s.look.stylize.mode !== "none" ? s.look.stylize : null,
    finish: maskFinish(s.look.finish, on),
  };
}

export function showParams(s: GFState, id: (typeof SHOTS)[number]["id"]): RunParams {
  const st = s.shots[id];
  const lookOn = s.step !== "raw" && s.step !== "match";
  const look = s.nodes.grade ? s.look : { ...s.look, grade: NEUTRAL_LOOK.grade };
  return {
    layers: resolveLayers(shotLayers(id, s.step, look, st)),
    stylize: lookOn && s.nodes.stylize && s.look.stylize.mode !== "none" ? s.look.stylize : null,
    finish: maskFinish(shotFinish(s.step, s.look, st), (n) => s.nodes[n]),
  };
}

/** The two "can't fix" monitors: the same clean doorway grade on two plates lit from opposite sides. */
export function limitParams(s: GFState): RunParams {
  return { layers: [resolveGrade(s.look.grade)], stylize: s.look.stylize.mode !== "none" ? s.look.stylize : null, finish: s.look.finish };
}

interface SlotRect { x: number; y: number; w: number; h: number }

function rectOf(el: HTMLElement, canvas: DOMRect): SlotRect | null {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { x: r.left - canvas.left, y: canvas.height - (r.top - canvas.top) - r.height, w: r.width, h: r.height };
}

function drawInto(gl: WebGLRenderer, p: Pipeline, r: SlotRect, dpr: number, o: CompositeOpts) {
  gl.setRenderTarget(null);
  gl.setViewport(r.x, r.y, r.w, r.h);
  gl.setScissor(r.x, r.y, r.w, r.h);
  gl.setScissorTest(true);
  p.composite(gl, null, Math.round(r.w * dpr), Math.round(r.h * dpr), o);
  gl.setScissorTest(false);
}

/** GPU resources for one canvas: shared programs, the live targets and one pipeline per monitor. */
class Resources {
  readonly programs = new Programs();
  readonly main = new Pipeline(this.programs);
  readonly pipes = new Map<string, Pipeline>();
  readonly sceneRT;
  readonly plateRT = makeTarget(16, 9);
  readonly scopeRT = makeTarget(160, 90, { bytes: true });
  readonly sampleRT = makeTarget(16, 9, { bytes: true });
  readonly capScene = makeTarget(16, 9, { depth: true, samples: 4 });
  readonly capPlate = makeTarget(16, 9, { bytes: true });
  readonly cam = makeShotCamera();
  private lastScope = 0;
  constructor(msaa: number) {
    this.sceneRT = makeTarget(16, 9, { depth: true, samples: msaa });
  }
  pipe(id: string) {
    let p = this.pipes.get(id);
    if (!p) {
      p = new Pipeline(this.programs);
      this.pipes.set(id, p);
    }
    return p;
  }
  /** Scope readbacks run about five times a second. */
  scopeDue(now: number) {
    if (now - this.lastScope < 200) return false;
    this.lastScope = now;
    return true;
  }
  dispose() {
    this.main.dispose();
    for (const p of this.pipes.values()) p.dispose();
    for (const t of [this.sceneRT, this.plateRT, this.scopeRT, this.sampleRT, this.capScene, this.capPlate]) t.dispose();
    this.programs.dispose();
  }
}

/**
 * The lab's one positive-priority frame callback. Per frame: tick the clock once, run the scene
 * updaters (on twos when the comic stylization asks for it), render the live shot into a
 * scene-linear target, develop it into the clean plate, then grade → stylize → finish it into the
 * main monitor. Inspect adds one composite per pipeline thumbnail and a 160×90 scope readback;
 * the show view runs one pipeline per gallery still.
 */
export function Orchestrator({ reducedMotion, msaa }: { reducedMotion: boolean; msaa: number }) {
  const res = useMemo(() => new Resources(msaa), [msaa]);
  useEffect(() => () => res.dispose(), [res]);

  useFrame((state, delta) => {
    const { gl, scene } = state;
    const t = gfClock.tick();
    const s = gfStore.getState();
    const stepped = s.nodes.stylize && s.look.stylize.mode !== "none" && s.look.stylize.stepped;
    const ts = stepped ? Math.floor(t * 12 + 1e-6) / 12 : t;
    live.t = t;
    live.frameId++;
    live.grainFrame = grainFrame(t);
    runUpdaters({ t: ts, dt: Math.min(Math.max(delta, 0), 1 / 30), frameId: live.frameId, playing: gfClock.isPlaying, reducedMotion });

    const dpr = gl.getPixelRatio();
    const canvas = gl.domElement.getBoundingClientRect();
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, state.size.width, state.size.height);
    gl.setClearColor("#0b0c0f", 1);
    gl.clear();
    const frame = live.grainFrame;

    // Live shot: scene → develop → main pipeline.
    const mainEl = slots.get("main");
    const mainRect = mainEl ? rectOf(mainEl, canvas) : null;
    const thumbEls = [...slots.entries()].filter(([k]) => k.startsWith("thumb:"));
    const needLive = !!mainRect || captureQueue.length > 0 || sampleQueue.some((q) => q.slot === "main");
    aimShotCamera(res.cam, sceneDescriptor);
    if (needLive) {
      const w = Math.min(1920, Math.round((mainRect?.w ?? 960) * dpr));
      const h = Math.round((w * 9) / 16);
      if (res.sceneRT.width !== w || res.sceneRT.height !== h) {
        res.sceneRT.setSize(w, h);
        res.plateRT.setSize(w, h);
      }
      gl.shadowMap.needsUpdate = true;
      gl.setRenderTarget(res.sceneRT);
      gl.clear();
      gl.render(scene, res.cam);
      develop(gl, res.programs, res.sceneRT, res.plateRT);
      live.sceneReady = true;
      const params = mainParams(s);
      res.main.run(gl, res.plateRT.texture, w, h, params);
      if (mainRect) {
        drawInto(gl, res.main, mainRect, dpr, {
          frame,
          wipe: s.mode === "watch" ? null : s.wipe,
          isolate: s.isolate === "halation" ? 1 : s.isolate === "bloom" ? 2 : 0,
        });
      }
      for (const [k, el] of thumbEls) {
        const r = rectOf(el, canvas);
        if (!r) continue;
        const node = k.slice(6);
        if (node === "source") {
          drawInto(gl, res.main, r, dpr, { frame, base: "source" });
          continue;
        }
        const idx = NODE_ORDER.indexOf(node as NodeId);
        const upTo = (n: NodeId) => NODE_ORDER.indexOf(n) <= idx && s.nodes[n];
        drawInto(gl, res.main, r, dpr, { frame, base: upTo("stylize") ? "styled" : "graded", finish: maskFinish(params.finish, upTo) });
      }
      const now = performance.now();
      if (s.mode === "inspect" && res.scopeDue(now)) {
        res.main.composite(gl, res.scopeRT, 160, 90, { frame });
        live.scope = { width: 160, height: 90, data: readTarget(gl, res.scopeRT) };
        live.scopeVersion++;
      }
    }

    // Show view: one pipeline per gallery still.
    for (const shot of SHOTS) {
      const el = slots.get(`show:${shot.id}`);
      const tex = plateTexture(shot.id);
      if (!el || !tex) continue;
      const r = rectOf(el, canvas);
      const needed = r || sampleQueue.some((q) => q.slot === `show:${shot.id}`);
      if (!needed) continue;
      const p = res.pipe(`show:${shot.id}`);
      const w = Math.round((r?.w ?? 480) * dpr);
      p.run(gl, tex, w, Math.round((w * 9) / 16), showParams(s, shot.id));
      if (r) drawInto(gl, p, r, dpr, { frame });
    }
    for (const [slot, plate] of [["limit:same", "doorway"], ["limit:flipped", "doorway-flipped"]] as [string, PlateId][]) {
      const el = slots.get(slot);
      const tex = plateTexture(plate);
      if (!el || !tex) continue;
      const r = rectOf(el, canvas);
      if (!r) continue;
      const p = res.pipe(slot);
      const w = Math.round(r.w * dpr);
      p.run(gl, tex, w, Math.round((w * 9) / 16), limitParams(s));
      drawInto(gl, p, r, dpr, { frame });
    }

    // Test hook: pixel samples of any monitor's finished output (never the wipe).
    while (sampleQueue.length) {
      const q = sampleQueue.shift()!;
      const p = q.slot === "main" ? res.main : res.pipes.get(q.slot);
      if (!p || !p.size.width) {
        q.resolve({ width: 0, height: 0, data: new Uint8Array() });
        continue;
      }
      if (res.sampleRT.width !== q.width || res.sampleRT.height !== q.height) res.sampleRT.setSize(q.width, q.height);
      p.composite(gl, res.sampleRT, q.width, q.height, { frame, base: q.before ? "source" : undefined });
      q.resolve({ width: q.width, height: q.height, data: readTarget(gl, res.sampleRT) });
    }
    // Plate capture: the clean develop output at a fixed size (scripts/review/capture-gf-plates.mjs).
    while (captureQueue.length) {
      const q = captureQueue.shift()!;
      res.capScene.setSize(q.width, q.height);
      res.capPlate.setSize(q.width, q.height);
      gl.setRenderTarget(res.capScene);
      gl.clear();
      gl.render(scene, res.cam);
      develop(gl, res.programs, res.capScene, res.capPlate);
      q.resolve({ width: q.width, height: q.height, data: readTarget(gl, res.capPlate) });
    }
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, state.size.width, state.size.height);
  }, 1);
  return null;
}
