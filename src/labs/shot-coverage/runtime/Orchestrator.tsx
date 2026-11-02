"use client";

import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { getScene } from "@/labs/lens-and-framing/config";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { LAYER_WORLD } from "@/scene/layers";
import { bodyFraction } from "@/labs/camera-movement/engine/analyze";
import { axisAt } from "../engine/axis";
import { poseOf, screenInfo } from "../engine/shots";
import { shotIndexAt } from "../engine/edit";
import { CAM_IDS, type CamId } from "../engine/types";
import { scClock, scStore, subjectsFor } from "../store";
import { live, slots, stageWindow, type SlotId } from "./live";

function makeShotCamera() {
  const c = new PerspectiveCamera(40, 16 / 9, 0.05, 80);
  c.filmGauge = 36;
  c.layers.set(LAYER_WORLD);
  return c;
}

const SLOT_ORDER: SlotId[] = ["W", "P", "A", "B", "C"];

/** One render camera per monitor window (module-level: there is only ever one canvas). */
const shotCams = new Map<SlotId, PerspectiveCamera>();
const shotCam = (slot: SlotId) => {
  let c = shotCams.get(slot);
  if (!c) {
    c = makeShotCamera();
    shotCams.set(slot, c);
  }
  return c;
};

/**
 * The lab's one positive-priority frame callback. Per frame: tick the clock once, solve the three
 * coverage cameras and the program (the edit at the playhead), run the scene updaters, update
 * shadows once, render the stage full-canvas (not in Watch), then every shot into its DOM window.
 */
export function Orchestrator({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((state, delta) => {
    const { gl, scene } = state;
    const t = scClock.tick();
    live.t = t;
    live.frameId++;
    const s = scStore.getState();
    const d = getScene(s.sceneId);
    const subj = subjectsFor(s.sceneId);
    for (const id of CAM_IDS) {
      const c = s.cameras[id];
      const pose = poseOf(c, d, subj, t);
      live.poses[id] = pose;
      live.info[id] = screenInfo(pose, d, subj, t);
      const fb = bodyFraction(pose, d, subj, "primary", t);
      const fp = bodyFraction(pose, d, subj, "secondary", t);
      live.fractions[id] = c.aim === "bram" ? fb : c.aim === "pip" ? fp : Math.max(fb, fp);
    }
    live.axis = axisAt(subj, t);
    live.observer = state.camera;
    live.shotIndex = shotIndexAt(s.edit, t);
    live.program = s.edit[live.shotIndex]?.cam ?? "A";
    runUpdaters({ t, dt: Math.min(Math.max(delta, 0), 1 / 30), frameId: live.frameId, playing: scClock.isPlaying, reducedMotion });

    gl.shadowMap.needsUpdate = true;
    const size = state.size;
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#101114", 1);
    gl.clear();
    const c = gl.domElement.getBoundingClientRect();
    const stage = stageWindow.current?.getBoundingClientRect();
    const renderStage = () => {
      if (s.mode === "watch" || !stage || stage.width < 2 || stage.height < 2) return;
      const observer = state.camera as PerspectiveCamera;
      observer.aspect = stage.width / stage.height;
      observer.updateProjectionMatrix();
      gl.setViewport(stage.left - c.left, c.height - stage.top + c.top - stage.height, stage.width, stage.height);
      gl.setScissor(stage.left - c.left, c.height - stage.top + c.top - stage.height, stage.width, stage.height);
      gl.setScissorTest(true);
      gl.render(scene, observer);
    };
    if (s.mode === "inspect") renderStage();
    for (const slot of SLOT_ORDER) {
      const el = slots.get(slot);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const id: CamId = slot === "P" || slot === "W" ? live.program : slot;
      const pose = live.poses[id];
      if (!pose) continue;
      const x = r.left - c.left;
      const y = c.height - (r.top - c.top) - r.height;
      const cam = shotCam(slot);
      cam.position.copy(pose.position);
      cam.quaternion.copy(pose.quaternion);
      cam.aspect = 16 / 9;
      cam.setFocalLength(pose.focalMm);
      cam.updateMatrixWorld();
      gl.setViewport(x, y, r.width, r.height);
      gl.setScissor(x, y, r.width, r.height);
      gl.setScissorTest(true);
      gl.render(scene, cam);
    }
    if (s.mode === "experiment") renderStage();
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
  }, 1);
  return null;
}
