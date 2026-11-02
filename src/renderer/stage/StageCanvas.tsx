"use client";

import { Canvas } from "@react-three/fiber";
import { PCFShadowMap } from "three";
import { useMemo, useRef } from "react";
import { FrameOrchestrator } from "@/renderer/runtime/FrameOrchestrator";
import { computePointer } from "@/renderer/events/computePointer";
import { resolveQuality } from "@/renderer/runtime/quality";
import { session } from "@/renderer/runtime/session";
import { labStore, useLab } from "@/ui/store/labStore";
import { TechSet } from "@/scene/set/Set";
import { SceneSet } from "@/scene/set/SceneSet";
import { Bram, Pip } from "@/scene/characters/Characters";
import { StageLighting } from "@/scene/StageLighting";
import { CameraRig, Frustum, Rail } from "./tech/CameraRig";
import { ObserverControls } from "./ObserverControls";
import { CameraHandle, RailLabels, TargetHitVolumes } from "./interaction/Interaction";

export function StageCanvas({ eventSource }: { eventSource: React.RefObject<HTMLElement | null> }) {
  const qualityPref = useLab((s) => s.ui.quality);
  const quality = useMemo(() => resolveQuality(qualityPref, session.params), [qualityPref]);
  const wrapper = useRef<HTMLDivElement>(null);
  const showTech = session.params.tech;
  return (
    <div ref={wrapper} className="absolute inset-0 z-0" data-testid="canvas-wrap">
      <Canvas
        frameloop="demand"
        dpr={quality.dpr}
        shadows={{ type: PCFShadowMap }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ manual: true, fov: 42, near: 0.1, far: 120, position: [-2.4, 4.3, 5.6] }}
        eventSource={eventSource as React.RefObject<HTMLElement>}
        onCreated={(state) => {
          state.setEvents({ compute: computePointer });
          state.raycaster.layers.enableAll();
          state.gl.shadowMap.autoUpdate = false;
          const el = state.gl.domElement;
          el.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            labStore.getState().setContextLost(true);
          });
          el.addEventListener("webglcontextrestored", () => {
            labStore.getState().setContextLost(false);
            state.gl.shadowMap.needsUpdate = true;
            state.invalidate();
          });
          if (session.params.e2e) (window as unknown as { __r3f?: typeof state }).__r3f = state;
        }}
      >
        <FrameOrchestrator />
        <StageLighting shadowMap={quality.spec.shadowMap} />
        <SceneSet />
        <Bram />
        <Pip />
        {showTech && (
          <>
            <TechSet />
            <Rail />
            <CameraRig />
            <Frustum />
            <CameraHandle />
            <TargetHitVolumes />
            <RailLabels />
          </>
        )}
        <ObserverControls />
      </Canvas>
    </div>
  );
}
