"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderTarget, type WebGLRenderer } from "three";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { LAYER_WORLD } from "@/scene/layers";
import { frameAt, runtime } from "../engine/edit";
import { masterT } from "../engine/source";
import { SHOTS, camAt, type CamSpec } from "../engine/shots";
import type { Clip, Edit, ShotId } from "../engine/types";
import { activeEdit, camOverrides, clockLength, compareEdit, erClock, erStore } from "../store";
import { emitTick, live, slots, type SlotId } from "./live";

const ORDER: SlotId[] = ["W", "P", "A", "B"];
const cams = new Map<SlotId, PerspectiveCamera>();
function camFor(slot: SlotId) {
  let c = cams.get(slot);
  if (!c) {
    c = new PerspectiveCamera(40, 16 / 9, 0.05, 80);
    c.filmGauge = 36;
    c.layers.set(LAYER_WORLD);
    cams.set(slot, c);
  }
  return c;
}

/**
 * The lab's one positive-priority frame callback. Per frame: tick the record clock once; for every
 * visible monitor, find the clip on screen in that monitor's edit, pose the whole stage at that
 * clip's SOURCE time (runUpdaters), aim the clip's camera, and render into the monitor's rectangle.
 * Dissolves render the incoming clip into a target and lay it over the outgoing one.
 */
export function Orchestrator({ reducedMotion }: { reducedMotion: boolean }) {
  const blend = useMemo(() => {
    const rt = new WebGLRenderTarget(2, 2, { samples: 4 });
    const mat = new MeshBasicMaterial({ map: rt.texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const scene = new Scene();
    scene.add(new Mesh(new PlaneGeometry(2, 2), mat));
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { rt, mat, scene, cam };
  }, []);
  useEffect(() => () => blend.rt.dispose(), [blend]);

  useFrame((state, delta) => {
    const { gl, scene } = state;
    const s = erStore.getState();
    const len = clockLength(s);
    if (Math.abs(erClock.durationS - len) > 1e-6) {
      const cur = erClock.peek();
      erClock.durationS = Math.max(0.5, len);
      if (cur >= len) erClock.seek(0);
    }
    const t = erClock.tick();
    live.t = t;
    live.frameId++;
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    const edit = activeEdit(s);
    const over = camOverrides(s);
    const size = state.size;
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#0b0c0f", 1);
    gl.clear();
    const canvasRect = gl.domElement.getBoundingClientRect();
    live.rendered = [];
    const pose = (c: Clip, local: number) => {
      runUpdaters({ t: masterT(SHOTS[c.shot].reel, local), dt, frameId: live.frameId, playing: erClock.isPlaying, reducedMotion });
      gl.shadowMap.needsUpdate = true;
    };
    const aim = (cam: PerspectiveCamera, shot: ShotId, local: number, aspect: number) => {
      const spec: CamSpec = over[shot] ?? SHOTS[shot].cam;
      const p = camAt(spec, local);
      cam.position.set(p.position[0], p.position[1], p.position[2]);
      cam.up.set(0, 1, 0);
      cam.lookAt(p.target[0], p.target[1], p.target[2]);
      cam.aspect = aspect;
      cam.setFocalLength(p.focalMm);
      cam.updateMatrixWorld();
    };
    for (const slot of ORDER) {
      const el = slots.get(slot);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight) continue;
      const e: Edit = slot === "B" ? compareEdit(s) : edit;
      const T = runtime(e);
      const tt = Math.min(t, Math.max(0, T - 1e-3));
      const f = frameAt(e, tt);
      if (!f) continue;
      const x = r.left - canvasRect.left;
      const y = canvasRect.height - (r.top - canvasRect.top) - r.height;
      const cam = camFor(slot);
      const aspect = r.width / r.height;
      let mix = 0;
      if (f.b) {
        // incoming clip into the blend target first (so the outgoing pose is the last one applied)
        const w = Math.max(2, Math.round(r.width * gl.getPixelRatio()));
        const h = Math.max(2, Math.round(r.height * gl.getPixelRatio()));
        if (blend.rt.width !== w || blend.rt.height !== h) blend.rt.setSize(w, h);
        pose(f.b.clip, f.b.local);
        aim(cam, f.b.clip.shot, f.b.local, aspect);
        gl.setRenderTarget(blend.rt);
        gl.setScissorTest(false);
        gl.setViewport(0, 0, r.width, r.height);
        gl.setClearColor("#0b0c0f", 1);
        gl.clear();
        gl.render(scene, cam);
        gl.setRenderTarget(null);
        mix = f.b.mix;
      }
      pose(f.a.clip, f.a.local);
      aim(cam, f.a.clip.shot, f.a.local, aspect);
      gl.setViewport(x, y, r.width, r.height);
      gl.setScissor(x, y, r.width, r.height);
      gl.setScissorTest(true);
      gl.render(scene, cam);
      if (f.b) overlay(gl, blend, mix);
      const shown = f.b && mix >= 0.5 ? { index: f.b.index, shot: f.b.clip.shot, local: f.b.local } : { index: f.a.index, shot: f.a.clip.shot, local: f.a.local };
      live.views[slot] = { t: tt, ...shown, mix, runtime: T };
      live.rendered.push(slot);
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    emitTick();
  }, 1);
  return null;
}

function overlay(gl: WebGLRenderer, b: { mat: MeshBasicMaterial; scene: Scene; cam: OrthographicCamera }, mix: number) {
  b.mat.opacity = mix;
  const auto = gl.autoClear;
  gl.autoClear = false;
  gl.render(b.scene, b.cam);
  gl.autoClear = auto;
}
