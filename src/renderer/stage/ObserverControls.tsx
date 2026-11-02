"use client";

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Box3, Vector3 } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { useLab } from "@/ui/store/labStore";
import { viewports } from "@/renderer/runtime/viewports";
import { session } from "@/renderer/runtime/session";
import { LAYER_TECH } from "@/scene/layers";

/**
 * camera-controls smooth-damps with the frame delta. In demand mode R3F's clock keeps running while
 * idle, so the first frame after a pause carries seconds of delta and a transition would snap.
 */
class ClampedCameraControls extends CameraControlsImpl {
  update(delta: number) {
    return super.update(Math.min(Math.max(delta, 0), 1 / 30));
  }
}

const stageEl = () => viewports.get("stage")?.el ?? null;

/** The observer ("behind the scenes") camera. Independent of the film camera. */
export function ObserverControls() {
  const ref = useRef<CameraControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const el = useSyncExternalStore(viewports.subscribe, stageEl, () => null);
  const presetId = useLab((s) => s.ui.observerPresetId);
  const nonce = useLab((s) => s.ui.observerPresetNonce);
  const dragging = useLab((s) => s.interaction.dragging);
  const applied = useRef(false);

  useEffect(() => {
    camera.layers.enable(LAYER_TECH);
  }, [camera]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const b = d.observer.boundary;
    c.setBoundary(new Box3(new Vector3(...b.min), new Vector3(...b.max)));
  }, [el]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (presetId === "throughLens") {
      c.enabled = false;
      return;
    }
    c.enabled = dragging === null;
    const p = d.observer.presets[presetId];
    // The first apply after mount snaps (a scene switch remounts the canvas); later presets glide.
    const animate = applied.current && nonce > 0 && !session.reducedMotion;
    applied.current = true;
    invalidate();
    requestAnimationFrame(() => {
      void c.setLookAt(p.position[0], p.position[1], p.position[2], p.target[0], p.target[1], p.target[2], animate);
      invalidate();
    });
  }, [presetId, nonce, invalidate, dragging, el]);

  if (!el) return null;
  return (
    <CameraControls
      ref={ref}
      impl={ClampedCameraControls}
      makeDefault
      domElement={el}
      minPolarAngle={d.observer.limits.minPolar}
      maxPolarAngle={d.observer.limits.maxPolar}
      minDistance={d.observer.limits.minDist}
      maxDistance={d.observer.limits.maxDist}
      smoothTime={0.18}
      draggingSmoothTime={0.06}
      dollyToCursor
      onControlStart={() => {
        session.controlsActive = true;
      }}
      onRest={() => {
        session.controlsActive = false;
      }}
    />
  );
}
