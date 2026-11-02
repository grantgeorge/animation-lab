"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { LAYER_WORLD } from "@/scene/layers";
import { poseAt } from "../engine/path";
import { bodyFraction } from "../engine/analyze";
import { cmClock, cmStore, currentViews, subjectsFor } from "../store";
import { live, slots, stageWindow } from "./live";

function makeShotCamera() {
  const c = new PerspectiveCamera(40, 16 / 9, 0.05, 80);
  c.filmGauge = 36;
  c.layers.set(LAYER_WORLD);
  return c;
}

/**
 * The lab's one positive-priority frame callback. Per frame: tick the clock once, solve every
 * view's camera, run the scene updaters (characters, props, viz), update shadows once, render the
 * stage full-canvas with the observer camera, then each shot into its monitor window (scissored).
 */
export function Orchestrator({ reducedMotion }: { reducedMotion: boolean }) {
  const shotCams = useMemo(() => [makeShotCamera(), makeShotCamera()], []);

  useFrame((state, delta) => {
    const { gl, scene } = state;
    const t = cmClock.tick();
    live.t = t;
    live.frameId++;
    const s = cmStore.getState();
    const subj = subjectsFor(s.sceneId);
    const views = currentViews(s);
    live.poses = views.map((v) => poseAt(v.move, t, subj));
    live.fractions = live.poses.map((p, i) => bodyFraction(p, d, subj, views[i].move.subject, t));
    runUpdaters({ t, dt: Math.min(Math.max(delta, 0), 1 / 30), frameId: live.frameId, playing: cmClock.isPlaying, reducedMotion });

    gl.shadowMap.needsUpdate = true;
    const size = state.size;
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#101114", 1);
    gl.clear();
    const c = gl.domElement.getBoundingClientRect();
    const stage = stageWindow.current?.getBoundingClientRect();
    const renderStage = () => { if (stage && stage.width > 2 && stage.height > 2) {
      const observer = state.camera as PerspectiveCamera;
      observer.aspect = stage.width / stage.height;
      observer.updateProjectionMatrix();
      gl.setViewport(stage.left - c.left, c.height - stage.top + c.top - stage.height, stage.width, stage.height);
      gl.setScissor(stage.left - c.left, c.height - stage.top + c.top - stage.height, stage.width, stage.height);
      gl.setScissorTest(true);
      gl.render(scene, observer);
    } };
    const cameraRect = slots.get("A")?.getBoundingClientRect();
    const stageMain = stage && cameraRect && stage.width * stage.height > cameraRect.width * cameraRect.height;
    if (stageMain) renderStage();
    views.forEach((v, i) => {
      const el = slots.get(v.id);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const x = r.left - c.left;
      const y = c.height - (r.top - c.top) - r.height;
      const cam = shotCams[i];
      const pose = live.poses[i];
      cam.position.copy(pose.position);
      cam.quaternion.copy(pose.quaternion);
      cam.aspect = 16 / 9;
      cam.setFocalLength(pose.focalMm);
      cam.updateMatrixWorld();
      gl.setViewport(x, y, r.width, r.height);
      gl.setScissor(x, y, r.width, r.height);
      gl.setScissorTest(true);
      gl.render(scene, cam);
    });
    if (!stageMain) renderStage();
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
  }, 1);
  return null;
}
