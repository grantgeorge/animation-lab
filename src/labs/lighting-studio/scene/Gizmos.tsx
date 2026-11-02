"use client";

import { useMemo, useRef } from "react";
import { useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  type LineSegments,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { useShallow } from "zustand/react/shallow";
import { kelvinToHex } from "../engine/color";
import { anglesFromPosition, lightPosition, raySphereNearest, sourceRadiusM, type Vec3 } from "../engine/spherical";
import { illuminance } from "../engine/ratio";
import { LIGHT_IDS, type LightId } from "../engine/types";
import { studio } from "../config";
import { studioStore, useStudio } from "../store";
import { ORDER, useStudioFrame } from "./bus";
import { filmCamera } from "./filmCamera";

const T = studio.subject.target;
const NAMES: Record<LightId, string> = { key: "Key", fill: "Fill", rim: "Rim" };

/** Cone with its apex at the origin opening along +Z, length 1, radius 1. */
function beamGeometry() {
  const g = new ConeGeometry(1, 1, 40, 1, true);
  g.translate(0, -0.5, 0);
  g.rotateX(-Math.PI / 2);
  return g;
}

function blindsGeometry() {
  const g = new BufferGeometry();
  const pts: number[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const y = -0.24 + (0.48 * i) / (n - 1);
    pts.push(-0.26, y, 0, 0.26, y, 0);
  }
  pts.push(-0.26, -0.26, 0, -0.26, 0.26, 0, 0.26, -0.26, 0, 0.26, 0.26, 0);
  g.setAttribute("position", new Float32BufferAttribute(pts, 3));
  return g;
}

interface ControlsLike {
  enabled: boolean;
}

/** Switch orbiting off synchronously while a lamp is dragged (before React re-renders). */
function setOrbitEnabled(get: () => RootState, enabled: boolean) {
  const c = get().controls as unknown as ControlsLike | null;
  if (c) c.enabled = enabled;
}

function LampGizmo({ id }: { id: LightId }) {
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const source = useRef<Mesh>(null);
  const stand = useRef<Mesh>(null);
  const blinds = useRef<LineSegments>(null);
  const ring = useRef<Mesh>(null);
  const beamGeo = useMemo(() => beamGeometry(), []);
  const blindsGeo = useMemo(() => blindsGeometry(), []);
  const ui = studio.ui[id];
  const getState = useThree((s) => s.get);
  const dragging = useRef(false);
  const { view, selected, on, lux, mainView } = useStudio(
    useShallow((s) => ({
      view: s.view,
      selected: s.selected === id,
      on: s.rig.lights[id].on,
      lux: illuminance(s.rig.lights[id]),
      mainView: s.view === "inspect",
    })),
  );

  useStudioFrame(() => {
    const st = studioStore.getState();
    const l = st.rig.lights[id];
    const p = lightPosition(l.azimuthDeg, l.elevationDeg, l.distanceM, T);
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    o.position.set(p[0], p[1], p[2]);
    o.updateMatrixWorld();
    i.lookAt(T[0], T[1], T[2]);
    const sel = st.selected === id;
    const lit = l.on && l.intensity > 0;
    if (beam.current) {
      const len = l.distanceM * 1.05;
      const r = Math.tan((l.spreadDeg / 2) * (Math.PI / 180)) * len;
      beam.current.scale.set(r, r, len);
      (beam.current.material as MeshBasicMaterial).opacity = lit ? (sel ? 0.075 : 0.035) : 0.012;
    }
    if (source.current) {
      const s = sourceRadiusM(l.softness);
      source.current.scale.set(s, s, 1);
      const m = source.current.material as MeshBasicMaterial;
      m.color.set(lit ? kelvinToHex(l.kelvin) : "#3A3F48");
      m.opacity = lit ? 0.22 : 0.12;
    }
    if (ring.current) ring.current.scale.setScalar(sel ? 1.25 : 1);
    if (stand.current) {
      stand.current.visible = p[1] > 0.25;
      stand.current.position.set(p[0], p[1] / 2, p[2]);
      stand.current.scale.set(1, Math.max(0.01, p[1] - 0.12), 1);
    }
    if (blinds.current) {
      blinds.current.visible = l.gobo > 0.02;
      (blinds.current.material as MeshBasicMaterial).opacity = Math.min(1, l.gobo) * 0.9;
    }
  }, ORDER.GIZMOS);

  const dragTo = (e: ThreeEvent<PointerEvent>) => {
    const st = studioStore.getState();
    const l = st.rig.lights[id];
    const prefer = lightPosition(l.azimuthDeg, l.elevationDeg, l.distanceM, T);
    const hit = raySphereNearest(e.ray.origin.toArray() as unknown as Vec3, e.ray.direction.toArray() as unknown as Vec3, T, l.distanceM, prefer);
    const a = anglesFromPosition(hit, T);
    st.setLight(id, { azimuthDeg: a.azimuthDeg, elevationDeg: a.elevationDeg });
  };

  return (
    <>
      <group ref={outer} name={`gizmo-${id}`}>
        <group ref={inner}>
          {/* lamp head: housing, coloured identity ring, emitting face sized by softness */}
          <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.085, 0.1, 0.2, 24]} />
            <meshBasicMaterial color={on ? "#2A2F38" : "#1A1D22"} />
          </mesh>
          <mesh ref={ring} position={[0, 0, 0.005]}>
            <torusGeometry args={[0.105, 0.012, 8, 40]} />
            <meshBasicMaterial color={ui} toneMapped={false} />
          </mesh>
          <mesh ref={source} position={[0, 0, 0.012]}>
            <circleGeometry args={[1, 40]} />
            <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={DoubleSide} />
          </mesh>
          <mesh ref={beam}>
            <primitive object={beamGeo} attach="geometry" />
            <meshBasicMaterial color={ui} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
          <lineSegments ref={blinds} position={[0, 0, 0.42]}>
            <primitive object={blindsGeo} attach="geometry" />
            <lineBasicMaterial color="#C9CED6" transparent />
          </lineSegments>
          {/* generous invisible grab volume */}
          <mesh
            name={`grab-${id}`}
            onPointerDown={(e) => {
              if (studioStore.getState().view !== "inspect") return;
              e.stopPropagation();
              (e.target as unknown as Element).setPointerCapture(e.pointerId);
              setOrbitEnabled(getState, false);
              dragging.current = true;
              studioStore.getState().select(id);
              studioStore.getState().setDragging(true);
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              e.stopPropagation();
              dragTo(e);
            }}
            onPointerUp={(e) => {
              if (!dragging.current) return;
              e.stopPropagation();
              (e.target as unknown as Element).releasePointerCapture(e.pointerId);
              dragging.current = false;
              setOrbitEnabled(getState, true);
              studioStore.getState().setDragging(false);
            }}
            onPointerOver={() => {
              if (studioStore.getState().view === "inspect") document.body.style.cursor = "grab";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            <sphereGeometry args={[0.3, 12, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
        {view === "inspect" && mainView && (
          <Html position={[0, 0.34, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
            <div
              className="mono whitespace-nowrap rounded-[6px] border px-1.5 py-0.5 text-[10.5px] text-ink-0"
              style={{ borderColor: ui, background: "rgb(10 13 19 / 0.82)", boxShadow: selected ? `0 0 0 1px ${ui}` : undefined }}
              data-testid={`gizmo-label-${id}`}
            >
              <span style={{ color: ui }}>{NAMES[id].toUpperCase()}</span> {on ? `${lux.toFixed(1)} lx` : "off"}
            </div>
          </Html>
        )}
      </group>
      <mesh ref={stand}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        <meshBasicMaterial color="#5A616C" />
      </mesh>
    </>
  );
}

function frustumGeometry() {
  // unit frustum: apex at origin, far rectangle at z = −1 with half-size (1, 1)
  const c = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
  ];
  const pts: number[] = [];
  for (const p of c) pts.push(0, 0, 0, ...p);
  for (let i = 0; i < 4; i++) pts.push(...c[i], ...c[(i + 1) % 4]);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pts, 3));
  return g;
}

function CameraGizmo() {
  const g = useRef<Group>(null);
  const fr = useRef<LineSegments>(null);
  const geo = useMemo(() => frustumGeometry(), []);
  const showLabel = useStudio((s) => s.view === "inspect");
  const shot = useStudio((s) => studio.shots[s.shotSize]);
  useStudioFrame(() => {
    if (!g.current || !fr.current) return;
    g.current.position.copy(filmCamera.position);
    g.current.quaternion.copy(filmCamera.quaternion);
    const d = Math.hypot(filmCamera.position.x - T[0], filmCamera.position.y - T[1], filmCamera.position.z - T[2]);
    const h = Math.tan((filmCamera.fov * Math.PI) / 360) * d;
    fr.current.scale.set(h * (16 / 9), h, d);
  }, ORDER.GIZMOS + 1);
  return (
    <group ref={g} name="gizmo-camera">
      <mesh position={[0, 0, 0.16]}>
        <boxGeometry args={[0.16, 0.2, 0.3]} />
        <meshBasicMaterial color="#2B2F36" />
      </mesh>
      <mesh position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.1, 20]} />
        <meshBasicMaterial color="#9AA3AD" />
      </mesh>
      <lineSegments ref={fr}>
        <primitive object={geo} attach="geometry" />
        <lineBasicMaterial color="#E9EEF4" transparent opacity={0.45} />
      </lineSegments>
      {showLabel && (
        <Html position={[0, 0.24, 0.1]} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <div className="mono whitespace-nowrap rounded-[6px] border border-white/25 bg-[#0a0d13d0] px-1.5 py-0.5 text-[10.5px] text-ink-1">
            CAMERA · {shot.short} {shot.focalMm} mm
          </div>
        </Html>
      )}
    </group>
  );
}

/** A tape mark on the floor at the subject's feet. */
function FloorMark() {
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([-0.3, 0.005, 0.25, 0.3, 0.005, 0.25, 0, 0.005, 0.25, 0, 0.005, -0.15], 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#FFB547" transparent opacity={0.7} />
    </lineSegments>
  );
}

/** Everything only the inspect camera sees (layer 1): lamps, beams, stands, the film camera. */
export function Gizmos() {
  const root = useRef<Group>(null);
  useStudioFrame(() => {
    root.current?.traverse((o) => o.layers.set(1));
  }, ORDER.GIZMOS + 2);
  return (
    <group ref={root} name="gizmos">
      {LIGHT_IDS.map((id) => (
        <LampGizmo key={id} id={id} />
      ))}
      <CameraGizmo />
      <FloorMark />
    </group>
  );
}
