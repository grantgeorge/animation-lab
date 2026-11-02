"use client";

import { useFrame, useThree, type RootState } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { measure } from "@/engine/measure";
import { clamp } from "@/engine/math";
import { labStore } from "@/ui/store/labStore";
import { labClock } from "./clock";
import { advancePresentation, presentation, presentationRig } from "./presentation";
import { filmCamera, syncFilmCamera } from "./filmCamera";
import { publishMeasurements } from "./measurementStore";
import { runUpdaters } from "./frameBus";
import { viewports } from "./viewports";
import { session } from "./session";
import { updateHtmlLayerClip } from "./htmlLayer";
import { ThumbnailRenderer } from "@/live/thumbnails/ThumbnailRenderer";
import { useEffect, useState } from "react";

let wasTransitioning = false;

const SNAP_SOURCES = new Set(["slider", "drag", "ring"]);

/**
 * The only place that renders. Positive priority disables R3F's automatic render.
 * Per frame: one clock tick → updaters → shadows once → stage pass → shot pass (scissored) → keep-alive.
 */
export function FrameOrchestrator({ renderFrame }: { renderFrame?: (state: RootState, delta: number) => void } = {}) {
  const custom = Boolean(renderFrame);
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);
  const [thumbs] = useState(() => new ThumbnailRenderer());
  useEffect(() => () => thumbs.dispose(), [thumbs]);
  useEffect(() => {
    if (custom) return;
    viewports.setCanvas(canvas);
    return () => viewports.setCanvas(null);
  }, [canvas, custom]);

  useFrame((state, delta) => {
    if (renderFrame) {
      renderFrame(state, delta);
      return;
    }
    const t0 = performance.now();
    const t = labClock.tick();
    // dt is clamped so a transition started after idle doesn't snap. Under e2e (headless software
    // rendering, often < 10 fps) the clamp would stretch a 0.3 s ease over many seconds of wall
    // time, so tests allow up to 0.1 s per frame; exponential easing is stable at any step.
    const dt = clamp(delta, 0, session.params.e2e ? 0.1 : 1 / 30);
    const s = labStore.getState();
    const cam = s.camera;
    const phases: Record<string, number> = {};

    advancePresentation(
      { rig: cam.rig, mode: cam.mode, targetId: cam.targetId, matchRef: cam.matchRef },
      dt,
      {
        dragging: SNAP_SOURCES.has(cam.lastSource) || s.interaction.dragging !== null,
        reducedMotion: session.reducedMotion,
        travel: cam.mode === "match",
      },
    );
    syncFilmCamera(presentation.pose, presentation.focalMm);
    session.frameId++;
    runUpdaters({ t, dt, frameId: session.frameId, playing: labClock.isPlaying, reducedMotion: session.reducedMotion });
    publishMeasurements(measure(d, presentationRig(), cam.targetId, { timeS: t, matchRef: cam.matchRef, mode: cam.mode }));
    const t1 = performance.now();
    phases.update = t1 - t0;

    const { gl, scene, size } = state;
    const transitioning = viewports.layoutTransitioning;
    if (transitioning || wasTransitioning) {
      viewports.measureAll();
      updateHtmlLayerClip();
    }
    wasTransitioning = transitioning;
    gl.shadowMap.needsUpdate = true;
    gl.info.reset();

    const observer = state.camera as PerspectiveCamera;
    if (s.ui.observerPresetId === "throughLens") {
      observer.position.copy(filmCamera.position);
      observer.quaternion.copy(filmCamera.quaternion);
    }

    const order: ("stage" | "shot")[] = s.ui.fullscreenShot ? ["shot"] : s.ui.primaryView === "stage" ? ["stage", "shot"] : ["shot", "stage"];
    const passes: string[] = [];
    // Slots can move or shrink between frames; clear their old pixels before drawing the new layout.
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#101114", 1);
    gl.clear();
    gl.setScissorTest(true);
    for (const id of order) {
      const rect = viewports.get(id);
      if (!rect || rect.gl.w < 2 || rect.gl.h < 2) continue;
      const tp = performance.now();
      gl.setRenderTarget(null);
      gl.setViewport(rect.gl.x, rect.gl.y, rect.gl.w, rect.gl.h);
      gl.setScissor(rect.gl.x, rect.gl.y, rect.gl.w, rect.gl.h);
      if (id === "stage") {
        const aspect = rect.gl.w / rect.gl.h;
        if (s.ui.observerPresetId === "throughLens") {
          const tanH = Math.tan((filmCamera.getEffectiveFOV() * Math.PI) / 360);
          const hfovHalf = Math.atan(tanH * d.aspect);
          observer.zoom = 1;
          observer.fov = aspect >= d.aspect ? filmCamera.getEffectiveFOV() : (2 * Math.atan(Math.tan(hfovHalf) / aspect) * 180) / Math.PI;
        }
        observer.aspect = aspect;
        observer.updateProjectionMatrix();
        gl.render(scene, observer);
      } else {
        gl.render(scene, filmCamera);
      }
      phases[id] = performance.now() - tp;
      passes.push(id);
    }
    const previewsVisible = !s.ui.fullscreenShot && !s.ui.uiHidden && session.params.ui;
    if (previewsVisible) {
      const tt = performance.now();
      thumbs.render(gl, scene, { rig: cam.rig, mode: cam.mode, target: cam.targetId, ref: cam.matchRef, version: cam.version, playing: labClock.isPlaying, t });
      thumbs.blit(gl);
      phases.thumbs = performance.now() - tt;
      passes.push("thumbs");
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);

    const stage = viewports.get("stage");
    const shot = viewports.get("shot");
    session.pushFrame({
      frameId: session.frameId,
      t,
      dtMs: delta * 1000,
      passes,
      stageRect: stage ? stage.gl : null,
      shotRect: shot ? shot.gl : null,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      phases,
    });

    if (labClock.isPlaying || !presentation.settled || viewports.layoutTransitioning || session.controlsActive || (previewsVisible && thumbs.isDirty)) invalidate();
  }, 1);

  return null;
}
