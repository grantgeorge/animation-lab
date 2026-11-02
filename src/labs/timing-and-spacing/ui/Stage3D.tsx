"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TRAVEL } from "../engine";
import { useTiming } from "../store";
import { Critter } from "./Critter";
import { ACCENT_A, ACCENT_B, ACCENT_MAIN } from "./colors";

/** Lane centres (world x) for free play and for the side-by-side comparison. */
export const LANE_OFFSET = TRAVEL / 2 + 0.8;
export const lanesFor = (n: number) => (n === 2 ? [-LANE_OFFSET, LANE_OFFSET] : [0]);
const FOV = 20;
const COVE = 2.4;
/** World box the camera keeps in frame: floor margin to the highest possible apex plus the body and antenna. */
const VIEW_BOTTOM = -0.22;
/** Frame the presets' tallest arcs; only re-frame when an arc goes above that. */
const viewTop = (maxHeight: number) => Math.max(4.15, maxHeight + 1.55);

function CameraRig({ lanes }: { lanes: number }) {
  const maxHeight = useTiming((s) => Math.max(...s.variants.map((v) => v.timeline.maxHeight)));
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const halfW = lanes === 2 ? LANE_OFFSET + TRAVEL / 2 + 0.6 : TRAVEL / 2 + 1.05;
    const top = viewTop(maxHeight);
    const halfH = (top - VIEW_BOTTOM) / 2;
    const tan = Math.tan(((FOV / 2) * Math.PI) / 180);
    const d = Math.max(halfH / tan, halfW / (tan * aspect)) * 1.02;
    const cy = (top + VIEW_BOTTOM) / 2;
    camera.fov = FOV;
    camera.aspect = aspect;
    camera.near = 0.5;
    camera.far = d + 80;
    // A touch above the action so the floor plane reads.
    camera.position.set(0, cy + d * 0.06, d);
    camera.lookAt(0, cy - 0.05, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, size, lanes, invalidate, maxHeight]);
  return null;
}

/** Re-render on any store change (frame, params, comparison). */
function Invalidator() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => useTiming.subscribe(() => invalidate()), [invalidate]);
  return null;
}

function gradientTexture(stops: [number, string][], w = 4, h = 256, radial = false) {
  const c = document.createElement("canvas");
  c.width = radial ? 256 : w;
  c.height = radial ? 256 : h;
  const g = c.getContext("2d")!;
  const grad = radial ? g.createRadialGradient(128, 128, 0, 128, 128, 128) : g.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function StageSet() {
  const wall = useMemo(
    () =>
      gradientTexture([
        [0, "rgba(16,17,20,1)"],
        [0.6, "rgba(16,17,20,0.55)"],
        [1, "rgba(16,17,20,0)"],
      ]),
    [],
  );
  const pool = useMemo(
    () =>
      gradientTexture(
        [
          [0, "rgba(255,226,200,0.42)"],
          [0.5, "rgba(255,210,180,0.14)"],
          [1, "rgba(255,200,170,0)"],
        ],
        0,
        0,
        true,
      ),
    [],
  );
  const wash = useMemo(
    () =>
      gradientTexture(
        [
          [0, "rgba(110,95,80,0.2)"],
          [0.55, "rgba(65,60,55,0.08)"],
          [1, "rgba(40,38,36,0)"],
        ],
        0,
        0,
        true,
      ),
    [],
  );
  return (
    <>
      <color attach="background" args={["#101114"]} />
      <fog attach="fog" args={["#101114", 40, 90]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[120, 60]} />
        <meshStandardMaterial color="#202329" roughness={0.92} metalness={0} />
      </mesh>
      {/* Cyclorama: the wall meets the floor through a soft cove so there is no hard horizon. */}
      <mesh position={[0, COVE, -COVE]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[COVE, COVE, 120, 24, 1, true, Math.PI, Math.PI / 2]} />
        <meshStandardMaterial color="#202329" roughness={0.95} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, COVE + 14, -2 * COVE]}>
        <planeGeometry args={[120, 28]} />
        <meshStandardMaterial color="#202329" roughness={0.95} />
      </mesh>
      {/* Darken the wall toward the top so the set falls off into the void. */}
      <mesh position={[0, COVE + 7, -2 * COVE + 0.05]}>
        <planeGeometry args={[120, 14]} />
        <meshBasicMaterial map={wall} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.3]} scale={[24, 8, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={pool} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* A soft warm wash on the cyc behind the action. */}
      <mesh position={[0, 3.2, -2 * COVE + 0.08]} scale={[30, 9, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={wash} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

/** Floor marks: the travel path and a tick where each contact lands, in the lane's accent colour. */
function LaneMarks({ variant, laneX, color }: { variant: number; laneX: number; color: string }) {
  const v = useTiming((s) => s.variants[variant]);
  const contacts = useMemo(() => {
    if (!v) return [];
    return v.timeline.contacts.map((c) => v.frames[Math.min(c.frame, v.frames.length - 1)].x);
  }, [v]);
  return (
    <group position={[laneX, 0.006, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRAVEL + 0.9, 0.012]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} toneMapped={false} />
      </mesh>
      {contacts.map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.001, 0]}>
          <ringGeometry args={[0.07, 0.1, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Scene() {
  const n = useTiming((s) => s.variants.length);
  const lanes = lanesFor(n);
  const colors = n === 2 ? [ACCENT_A, ACCENT_B] : [ACCENT_MAIN];
  return (
    <>
      <CameraRig lanes={n} />
      <Invalidator />
      <StageSet />
      <hemisphereLight args={["#c9d6ff", "#2a1a14", 0.75]} />
      <directionalLight position={[-5, 9, 8]} intensity={2.3} color="#fff0e2" />
      <directionalLight position={[6, 5, -7]} intensity={2.4} color="#c8dce0" />
      <directionalLight position={[4, 2, 6]} intensity={0.45} color="#ffd0c0" />
      {lanes.map((x, i) => (
        <group key={`${n}-${i}`}>
          <LaneMarks variant={i} laneX={x} color={colors[i]} />
          <Critter variant={i} laneX={x} />
        </group>
      ))}
    </>
  );
}

export function Stage3D() {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: FOV, position: [0, 2, 30], near: 0.5, far: 120 }}
      data-testid="stage-canvas"
    >
      <Scene />
    </Canvas>
  );
}
