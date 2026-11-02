"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, Vector3, type PerspectiveCamera } from "three";
import { lightPosition } from "../engine/spherical";
import { studio } from "../config";
import { channelMask, studioStore, useStudio } from "../store";
import { easeLive, live, runStudioFrame, studioClock } from "./bus";
import { filmCamera, filmViewport, fitFilmViewport, updateFilmCamera } from "./filmCamera";
import { StudioSet } from "./StudioSet";
import { StudioCharacter } from "./StudioCharacter";
import { StudioLights } from "./StudioLights";
import { Gizmos } from "./Gizmos";

/**
 * The only positive-priority frame callback in this lab, and the only place that renders.
 * Per frame: one clock tick → preset transition → eased masks → updaters → shadows once →
 * main view (fitted film gate or full-canvas inspection) → picture-in-picture (scissored).
 */
function Driver() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => studioStore.subscribe(() => invalidate()), [invalidate]);

  useFrame((state, delta) => {
    const nowMs = performance.now();
    const dt = Math.min(delta, 1 / 20);
    const t = studioClock.tick();
    const st = studioStore.getState();
    const transitioning = st.advance(nowMs);
    const s = studioStore.getState();
    const instant = s.reducedMotion;
    const lights = s.rig.lights;
    const maskMoving = easeLive(channelMask(s), { key: lights.key.shadows, fill: lights.fill.shadows, rim: lights.rim.shadows }, dt, instant);
    const camMoving = updateFilmCamera(s.shotSize, dt, instant);
    const { gl, scene, size } = state;
    const inspect = state.camera as PerspectiveCamera;
    inspect.aspect = size.width / Math.max(1, size.height);
    inspect.updateProjectionMatrix();
    runStudioFrame({ t, dt, nowMs });

    const main = s.view === "shot" ? filmCamera : inspect;
    const pip = s.view === "shot" ? inspect : filmCamera;
    const mainViewport = s.view === "shot"
      ? fitFilmViewport(size.width, size.height)
      : { x: 0, y: 0, width: size.width, height: size.height };

    gl.shadowMap.needsUpdate = true;
    // Clear the whole canvas first so a change of aspect/view leaves no stale pixels in the matte.
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#060708", 1);
    gl.clear();
    gl.setScissorTest(true);
    gl.setScissor(mainViewport.x, mainViewport.y, mainViewport.width, mainViewport.height);
    gl.setViewport(mainViewport.x, mainViewport.y, mainViewport.width, mainViewport.height);
    gl.render(scene, main);
    if (main === filmCamera) Object.assign(filmViewport, mainViewport);

    const el = live.pipEl;
    if (el) {
      const c = gl.domElement.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w > 4 && h > 4) {
        const x = Math.round(r.left - c.left);
        const y = Math.round(c.height - (r.bottom - c.top));
        gl.setScissor(x, y, w, h);
        gl.setViewport(x, y, w, h);
        gl.setClearColor("#060708", 1);
        gl.clear();
        if (pip === filmCamera) {
          const fitted = fitFilmViewport(w, h);
          Object.assign(filmViewport, { x: x + fitted.x, y: y + fitted.y, width: fitted.width, height: fitted.height });
          gl.setScissor(filmViewport.x, filmViewport.y, filmViewport.width, filmViewport.height);
          gl.setViewport(filmViewport.x, filmViewport.y, filmViewport.width, filmViewport.height);
        } else {
          inspect.aspect = w / h;
          inspect.updateProjectionMatrix();
        }
        gl.render(scene, pip);
        if (pip === inspect) {
          inspect.aspect = size.width / Math.max(1, size.height);
          inspect.updateProjectionMatrix();
        }
      }
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    live.frames++;
    if (s.playing || transitioning || maskMoving || camMoving || s.dragging) invalidate();
  }, 1);

  return null;
}

function InspectControls() {
  const view = useStudio((s) => s.view);
  const dragging = useStudio((s) => s.dragging);
  const setEvents = useThree((s) => s.setEvents);
  useEffect(() => setEvents({ enabled: view === "inspect" }), [view, setEvents]);
  return (
    <OrbitControls
      makeDefault
      enabled={view === "inspect" && !dragging}
      enableDamping
      dampingFactor={0.12}
      target={studio.inspect.target as unknown as [number, number, number]}
      minDistance={studio.inspect.minDistance}
      maxDistance={studio.inspect.maxDistance}
      maxPolarAngle={Math.PI / 2 - 0.03}
    />
  );
}

/** In the shot view, dragging on the picture swings the selected light around the subject. */
function useSwingDrag() {
  const drag = useRef<{ x: number; y: number; az: number; el: number; id: "key" | "fill" | "rim" } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = studioStore.getState();
    if (s.view !== "shot" || e.button !== 0) return;
    const id = s.selected === "ambient" ? "key" : s.selected;
    const l = s.rig.lights[id];
    drag.current = { x: e.clientX, y: e.clientY, az: l.azimuthDeg, el: l.elevationDeg, id };
    e.currentTarget.setPointerCapture(e.pointerId);
    s.setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const s = studioStore.getState();
    s.setLight(d.id, { azimuthDeg: d.az + (e.clientX - d.x) * 0.4, elevationDeg: d.el - (e.clientY - d.y) * 0.3 });
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    studioStore.getState().setDragging(false);
  };
  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}

export function StudioCanvas({ dpr, shadowMapSize, e2e }: { dpr: number | [number, number]; shadowMapSize: number; e2e: boolean }) {
  const view = useStudio((s) => s.view);
  const handlers = useSwingDrag();
  return (
    <div className={`absolute inset-0 z-0 ${view === "shot" ? "cursor-grab active:cursor-grabbing" : ""}`} data-testid="canvas-wrap" {...handlers}>
      <Canvas
        frameloop="demand"
        dpr={dpr}
        shadows={{ type: PCFShadowMap }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace, preserveDrawingBuffer: e2e }}
        camera={{ fov: 40, near: 0.1, far: 80, position: studio.inspect.position as unknown as [number, number, number] }}
        onCreated={(state) => {
          state.gl.shadowMap.autoUpdate = false;
          state.raycaster.layers.enableAll();
          state.camera.layers.enable(1);
          state.camera.lookAt(...studio.inspect.target);
          live.projectLamp = (id) => {
            const st = studioStore.getState();
            if (st.view !== "inspect") return null;
            const l = st.rig.lights[id];
            const p = lightPosition(l.azimuthDeg, l.elevationDeg, l.distanceM, studio.subject.target);
            const v = new Vector3(p[0], p[1], p[2]).project(state.get().camera);
            const r = state.gl.domElement.getBoundingClientRect();
            return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
          };
          const el = state.gl.domElement;
          el.addEventListener("webglcontextlost", (ev) => {
            ev.preventDefault();
            studioStore.getState().toast("Graphics context lost: reload the page");
          });
          el.addEventListener("webglcontextrestored", () => state.invalidate());
        }}
      >
        <Driver />
        <StudioSet />
        <Suspense fallback={null}>
          <StudioCharacter />
        </Suspense>
        <StudioLights shadowMapSize={shadowMapSize} />
        <Gizmos />
        <InspectControls />
      </Canvas>
    </div>
  );
}
