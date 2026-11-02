"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DirectionalLight, type PerspectiveCamera } from "three";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { acClock, acStore } from "../store";
import { Kit } from "./kit";
import { planFor, resetPipScale } from "./exps";
import { AC_LAYER, actors, live, runAfterFrame, stageWindow } from "./live";
import { vizHooks } from "../stage/Viz";

/**
 * The lab's one positive-priority frame callback. Per frame: tick the clock once, pose the cast at t,
 * plan the experiment (cameras, readouts, viz), run its captures, then render the stage (when it is
 * the main view), every camera slot (scissored, some through the post chain), and the inset stage last.
 */
export function Orchestrator({ reducedMotion, low }: { reducedMotion: boolean; low: boolean }) {
  const kit = useMemo(() => new Kit(), []);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    // Let characters on the cast-only layer keep casting shadows while they are hidden from a pass.
    let light: DirectionalLight | null = null;
    scene.traverse((o) => {
      if (!light && o instanceof DirectionalLight && o.castShadow) light = o;
    });
    actors.light = light;
    (light as DirectionalLight | null)?.shadow.camera.layers.enable(AC_LAYER.CAST);
  }, [scene]);

  useFrame((state, delta) => {
    const { gl } = state;
    const t = acClock.tick();
    live.t = t;
    live.frameId++;
    const s = acStore.getState();
    kit.begin(gl, state.scene, low);
    // The scale cheat re-applies Pip's scale after its passes; every frame starts from 1.
    resetPipScale();
    runUpdaters({ t, dt: Math.min(Math.max(delta, 0), 1 / 30), frameId: live.frameId, playing: acClock.isPlaying, reducedMotion });
    gl.shadowMap.needsUpdate = true;
    gl.autoClear = true;
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, state.size.width, state.size.height);
    gl.setClearColor(kit.clearColor, 1);
    gl.clear();

    const plan = planFor(kit, s, t);
    const stage = s.mode === "watch" ? null : kit.rectOfElement(stageWindow.current);
    const main = kit.rect("main");
    const stageMain = !!stage && (!main || stage.w * stage.h > main.w * main.h);
    const renderStage = () => {
      if (!stage) return;
      const observer = state.camera as PerspectiveCamera;
      observer.aspect = stage.w / stage.h;
      observer.updateProjectionMatrix();
      observer.layers.disableAll();
      for (const l of plan.observerLayers) observer.layers.enable(l);
      vizHooks.update?.();
      kit.render(observer, stage);
    };
    plan.pre?.();
    if (stageMain) renderStage();
    plan.render();
    if (stage && !stageMain) renderStage();
    gl.setScissorTest(false);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, state.size.width, state.size.height);
    runAfterFrame();
  }, 1);
  return null;
}
