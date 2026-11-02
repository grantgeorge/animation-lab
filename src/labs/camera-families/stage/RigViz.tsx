"use client";

import { useRef, useState } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { TechLayer } from "@/scene/TechLayer";
import { FORMATS, shotGate } from "../engine/formats";
import { getCamera } from "../engine/cameras";
import { depthOfField } from "../engine/optics";
import { moveYawDeg, SHOT, shotQuaternion } from "../engine/shot";
import { cfStore } from "../store";
import { live } from "../runtime/live";

const FRUSTUM_M = 11;

function plane(color: string, opacity: number) {
  const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color, transparent: true, opacity, side: DoubleSide, depthWrite: false, toneMapped: false }));
  m.frustumCulled = false;
  return m;
}

/**
 * The shot camera on the stage (Inspect): body, live frustum for the current gate and lens, the
 * focus plane (amber) and the near/far limits of the depth of field (cyan), all in camera space.
 */
function makeViz() {
  const seg = (color: string, opacity: number) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(16 * 3), 3));
    const l = new LineSegments(g, new LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false }));
    l.frustumCulled = false;
    return l;
  };
  return { lines: seg("#8febff", 0.85), band: seg("#5fe3ff", 0.5), focus: plane("#ffb547", 0.22), near: plane("#5fe3ff", 0.1), far: plane("#5fe3ff", 0.1) };
}
/** Module-level (one stage per page): mutated every frame outside React. */
let viz: ReturnType<typeof makeViz> | null = null;
const getViz = () => (viz ??= makeViz());

/**
 * The shot camera on the stage (Inspect): body, live frustum for the current gate and lens, the
 * focus plane (amber) and the near/far limits of the depth of field (cyan), all in camera space.
 */
export function RigViz() {
  const rig = useRef<Group>(null);
  const [{ lines, band, focus, near, far }] = useState(getViz);
  useFrameUpdater(() => {
    const g = rig.current;
    if (!g) return;
    const { lines, band, focus, near, far } = getViz();
    const s = cfStore.getState();
    const gate = shotGate(FORMATS[getCamera(s.cameraId).format], s.openGate);
    g.position.set(...SHOT.position);
    shotQuaternion(moveYawDeg(s.move, live.frameT), g.quaternion);
    const kx = gate.widthMm / (2 * s.focalMm);
    const ky = gate.heightMm / (2 * s.focalMm);
    const corner = (d: number, sx: number, sy: number) => [sx * kx * d, sy * ky * d, -d];
    const pos = lines.geometry.getAttribute("position") as Float32BufferAttribute;
    const cs = [corner(FRUSTUM_M, -1, -1), corner(FRUSTUM_M, 1, -1), corner(FRUSTUM_M, 1, 1), corner(FRUSTUM_M, -1, 1)];
    const v: number[] = [];
    for (const p of cs) v.push(0, 0, 0, ...p);
    for (let i = 0; i < 4; i++) v.push(...cs[i], ...cs[(i + 1) % 4]);
    pos.array.set(v);
    pos.needsUpdate = true;
    const dof = depthOfField(s.focalMm, s.tStop, s.focusM, gate);
    const place = (m: Mesh, d: number) => {
      m.visible = Number.isFinite(d) && d < 40;
      if (!m.visible) return;
      m.position.set(0, 0, -d);
      m.scale.set(2 * kx * d, 2 * ky * d, 1);
    };
    place(focus, s.focusM);
    place(near, dof.nearM);
    place(far, Math.min(dof.farM, 40));
    // Edges of the in-focus slab along the frustum.
    const bpos = band.geometry.getAttribute("position") as Float32BufferAttribute;
    const nf = Math.min(dof.farM, 40);
    const bv: number[] = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bv.push(...corner(dof.nearM, sx, sy), ...corner(nf, sx, sy));
    for (let i = 0; i < 4; i++) bv.push(0, 0, 0, 0, 0, 0);
    bpos.array.set(bv);
    bpos.needsUpdate = true;
  }, ORDER.TECH);

  return (
    <TechLayer>
      <group ref={rig}>
        <mesh position={[0, 0, 0.13]}>
          <boxGeometry args={[0.16, 0.15, 0.26]} />
          <meshStandardMaterial color="#8a93a3" emissive="#2a3340" roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.06, 0.12, 20]} />
          <meshStandardMaterial color="#14181e" roughness={0.4} metalness={0.6} />
        </mesh>
        <primitive object={lines} />
        <primitive object={band} />
        <primitive object={focus} />
        <primitive object={near} />
        <primitive object={far} />
      </group>
    </TechLayer>
  );
}
