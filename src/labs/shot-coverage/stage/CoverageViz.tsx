"use client";

import { useMemo, useRef, useState } from "react";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, LineSegments, Mesh, Plane, Vector3 } from "three";
import { getScene } from "@/labs/lens-and-framing/config";
import { frustumCornersAtDistance, intrinsics } from "@/engine/projection";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { TechLayer } from "@/scene/TechLayer";
import { frontSide } from "../engine/presets";
import { CAM_IDS, type CamId, type Vec3 } from "../engine/types";
import { AXIS_COLOR, BRAM_COLOR, CAM_COLOR, CROSS_COLOR, PIP_COLOR } from "../colors";
import { scStore, subjectsFor, useSC } from "../store";
import { live } from "../runtime/live";

/** A small cinema camera: body, lens barrel, viewfinder, a coloured ID band. Faces −Z. */
function CameraBody({ color }: { color: string }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.16, 0.15, 0.26]} />
        <meshStandardMaterial color="#262b33" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.165, 0.155, 0.05]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.19]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.13, 20]} />
        <meshStandardMaterial color="#14181e" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

function makeLines() {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(new Float32Array(16 * 3), 3));
  const ls = new LineSegments(g);
  ls.frustumCulled = false;
  return ls;
}

/** One coverage camera on the stage: body, live frustum to its subject, label and drag handle. */
function StageCamera({ id }: { id: CamId }) {
  const body = useRef<Group>(null);
  const lines = useMemo(() => makeLines(), []);
  const color = CAM_COLOR[id];
  const sceneId = useSC((s) => s.sceneId);
  const position = useSC((s) => s.cameras[id].position);
  const selected = useSC((s) => s.selected === id);
  const get = useThree((s) => s.get);
  const [hover, setHover] = useState(false);
  const drag = useRef<{ plane: Plane; offset: Vector3; vertical: boolean; start: Vec3 } | null>(null);
  const tmp = useMemo(() => new Vector3(), []);
  useFrameUpdater(() => {
    const p = live.poses[id];
    if (!p || !body.current) return;
    body.current.position.copy(p.position);
    body.current.quaternion.copy(p.quaternion);
    const dist = Math.min(4.5, Math.max(0.6, new Vector3(...p.target).distanceTo(p.position)));
    const c = frustumCornersAtDistance(p, intrinsics(p.focalMm, getScene(sceneId).gate), dist);
    const a = lines.geometry.getAttribute("position") as Float32BufferAttribute;
    const pts = [p.position, c[0], p.position, c[1], p.position, c[2], p.position, c[3], c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0]];
    pts.forEach((q, i) => a.setXYZ(i, q.x, q.y, q.z));
    a.needsUpdate = true;
  }, ORDER.TECH);

  const setControls = (on: boolean) => {
    const c = get().controls as unknown as { enabled: boolean } | null;
    if (c) c.enabled = on;
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    scStore.getState().select(id);
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    const p = new Vector3(...position);
    const vertical = e.shiftKey;
    const normal = vertical ? new Vector3().subVectors(e.ray.origin, p).setY(0).normalize() : new Vector3(0, 1, 0);
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, p);
    const hit = e.ray.intersectPlane(plane, new Vector3());
    drag.current = { plane, offset: hit ? p.clone().sub(hit) : new Vector3(), vertical, start: position };
    setControls(false);
    scStore.getState().setDragging(id);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const g = drag.current;
    if (!g) return;
    e.stopPropagation();
    const hit = e.ray.intersectPlane(g.plane, tmp);
    if (!hit) return;
    const p = hit.add(g.offset);
    const next: Vec3 = g.vertical ? [g.start[0], p.y, g.start[2]] : [p.x, g.start[1], p.z];
    scStore.getState().setCamera(id, { position: next });
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    drag.current = null;
    setControls(true);
    scStore.getState().setDragging(null);
  };
  return (
    <group>
      <group ref={body}>
        <CameraBody color={color} />
        <mesh
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = "grab";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "";
          }}
        >
          <sphereGeometry args={[0.3, 20, 14]} />
          <meshBasicMaterial color={color} transparent opacity={hover || selected ? 0.16 : 0.0} depthWrite={false} />
        </mesh>
      </group>
      <primitive object={lines}>
        <lineBasicMaterial color={color} transparent opacity={selected ? 0.95 : 0.55} />
      </primitive>
      {/* drop line to the floor so the camera's floor position reads */}
      <mesh position={[position[0], position[1] / 2, position[2]]}>
        <cylinderGeometry args={[0.006, 0.006, position[1], 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <mesh position={[position[0], 0.012, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.16, 28]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/**
 * The axis of action drawn on the floor from where Bram and Pip stand right now, extended past them,
 * with the front side tinted and the far side marked "across the line". Updates every frame.
 */
function AxisOfAction() {
  const sceneId = useSC((s) => s.sceneId);
  const group = useRef<Group>(null);
  const strip = useRef<Mesh>(null);
  const bram = useRef<Mesh>(null);
  const pip = useRef<Mesh>(null);
  const front = useRef<Mesh>(null);
  const back = useRef<Mesh>(null);
  const LEN = 14;
  const HALF = 5;
  useFrameUpdater(({ t }) => {
    const ax = live.axis;
    if (!ax || !group.current) return;
    const subj = subjectsFor(sceneId);
    const d = getScene(sceneId);
    const sb = subj("primary", t).feet;
    const sp = subj("secondary", t).feet;
    bram.current?.position.set(sb[0], sb[1] + 0.014, sb[2]);
    pip.current?.position.set(sp[0], sp[1] + 0.014, sp[2]);
    const mx = (ax.a[0] + ax.b[0]) / 2;
    const mz = (ax.a[1] + ax.b[1]) / 2;
    const yaw = Math.atan2(-ax.u[1], ax.u[0]);
    group.current.position.set(mx, 0.01, mz);
    group.current.rotation.set(0, yaw, 0);
    // local +z is +n after the yaw; the front side is +n unless the set opens the other way
    const f = frontSide(d, ax);
    front.current?.position.set(0, 0, f * (HALF / 2));
    back.current?.position.set(0, 0, -f * (HALF / 2));
  }, ORDER.TECH);
  return (
    <group>
      <group ref={group}>
        <mesh ref={strip} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[LEN, 0.05]} />
          <meshBasicMaterial color={AXIS_COLOR} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh ref={front} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LEN, HALF]} />
          <meshBasicMaterial color="#5FE3FF" transparent opacity={0.05} depthWrite={false} side={DoubleSide} />
        </mesh>
        <mesh ref={back} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LEN, HALF]} />
          <meshBasicMaterial color={CROSS_COLOR} transparent opacity={0.07} depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
      <mesh ref={bram} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.35, 40]} />
        <meshBasicMaterial color={BRAM_COLOR} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh ref={pip} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.29, 40]} />
        <meshBasicMaterial color={PIP_COLOR} toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Technical layer for Inspect / Experiment: cameras, frustums, the line, character marks. */
export function CoverageViz() {
  return (
    <TechLayer>
      <AxisOfAction />
      {CAM_IDS.map((id) => (
        <StageCamera key={id} id={id} />
      ))}
    </TechLayer>
  );
}
