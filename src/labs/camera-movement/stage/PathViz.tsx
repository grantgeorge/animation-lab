"use client";

import { useMemo, useRef, useState } from "react";
import { Line } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, Group, LineSegments, Plane, Vector3, type Mesh } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { frustumCornersAtDistance, intrinsics } from "@/engine/projection";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { TechLayer } from "@/scene/TechLayer";
import { lookAtPose, v3 } from "../engine/math";
import { samplePath } from "../engine/path";
import type { CameraKey, Vec3 } from "../engine/types";
import { cmStore, currentViews, subjectsFor, useCM } from "../store";
import { live } from "../runtime/live";

const CYAN = "#5FE3FF";
const AMBER = "#FFB547";
const MINT = "#8EF0C3";
const VIEW_COLORS = [CYAN, "#C9A7FF"];

/** A small cinema camera: body, lens barrel, viewfinder. Faces −Z. */
function CameraBody({ color = "#2A3038", scale = 1 }: { color?: string; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh>
        <boxGeometry args={[0.16, 0.15, 0.26]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, -0.19]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.13, 20]} />
        <meshStandardMaterial color="#14181e" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0.0, 0.1, 0.04]}>
        <boxGeometry args={[0.05, 0.05, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}

/** Frustum wire from a pose to `dist`, as one reusable line-segments object. */
function useFrustumLines(color: string, opacity: number) {
  return useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(16 * 3), 3));
    const ls = new LineSegments(g);
    ls.frustumCulled = false;
    return { ls, color, opacity };
  }, [color, opacity]);
}

function writeFrustum(ls: LineSegments, position: Vector3, corners: Vector3[]) {
  const a = ls.geometry.getAttribute("position") as Float32BufferAttribute;
  const pts = [position, corners[0], position, corners[1], position, corners[2], position, corners[3], corners[0], corners[1], corners[1], corners[2], corners[2], corners[3], corners[3], corners[0]];
  pts.forEach((p, i) => a.setXYZ(i, p.x, p.y, p.z));
  a.needsUpdate = true;
  ls.geometry.computeBoundingSphere();
}

/** The live camera of one view: body + frustum to the subject, following the pose every frame. */
function LiveCamera({ index }: { index: number }) {
  const body = useRef<Group>(null);
  const fr = useFrustumLines(VIEW_COLORS[index], 0.9);
  useFrameUpdater(() => {
    const p = live.poses[index];
    if (!p || !body.current) return;
    body.current.position.copy(p.position);
    body.current.quaternion.copy(p.quaternion);
    const dist = Math.max(0.5, v3(p.target).distanceTo(p.position));
    writeFrustum(fr.ls, p.position, frustumCornersAtDistance(p, intrinsics(p.focalMm, d.gate), dist));
  }, ORDER.TECH);
  return (
    <group>
      <group ref={body}>
        <CameraBody color={index ? "#3a3350" : "#2A3038"} />
      </group>
      <primitive object={fr.ls}>
        <lineBasicMaterial color={fr.color} transparent opacity={fr.opacity} />
      </primitive>
    </group>
  );
}

/** A static ghost camera + frustum at a key. */
function KeyGhost({ k, color }: { k: CameraKey; color: string }) {
  const { pose, lines } = useMemo(() => {
    const pose = lookAtPose(k.position, k.target);
    const dist = Math.max(0.5, v3(k.target).distanceTo(pose.position));
    const c = frustumCornersAtDistance(pose, intrinsics(k.focalMm, d.gate), dist);
    const pts = [pose.position, c[0], pose.position, c[1], pose.position, c[2], pose.position, c[3], c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0]].flatMap((p) => [p.x, p.y, p.z]);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return { pose, lines: g };
  }, [k]);
  return (
    <group>
      <group position={pose.position} quaternion={pose.quaternion}>
        <CameraBody color="#20252c" scale={0.85} />
      </group>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={color} transparent opacity={0.28} />
      </lineSegments>
    </group>
  );
}

/** A draggable key handle. Drag slides it on the floor plane at its height; Shift-drag raises/lowers it. */
function Handle({ which, at, disabled }: { which: "start" | "end"; at: Vec3; disabled: boolean }) {
  const get = useThree((s) => s.get);
  const setControls = (on: boolean) => {
    const c = get().controls as unknown as { enabled: boolean } | null;
    if (c) c.enabled = on;
  };
  const [hover, setHover] = useState(false);
  const drag = useRef<{ plane: Plane; offset: Vector3; vertical: boolean } | null>(null);
  const tmp = useMemo(() => new Vector3(), []);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (disabled) return;
    e.stopPropagation();
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    const p = v3(at);
    const vertical = e.shiftKey;
    const normal = vertical ? new Vector3().subVectors(e.ray.origin, p).setY(0).normalize() : new Vector3(0, 1, 0);
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, p);
    const hit = e.ray.intersectPlane(plane, new Vector3());
    drag.current = { plane, offset: hit ? p.clone().sub(hit) : new Vector3(), vertical };
    setControls(false);
    cmStore.getState().setDragging(which);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const g = drag.current;
    if (!g) return;
    e.stopPropagation();
    const hit = e.ray.intersectPlane(g.plane, tmp);
    if (!hit) return;
    const p = hit.add(g.offset);
    const b = d.observer.boundary;
    const next: Vec3 = g.vertical
      ? [at[0], Math.min(6, Math.max(0.25, p.y)), at[2]]
      : [Math.min(b.max[0], Math.max(b.min[0], p.x)), at[1], Math.min(b.max[2], Math.max(b.min[2], p.z))];
    cmStore.getState().setOverride(which, next);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    drag.current = null;
    setControls(true);
    cmStore.getState().setDragging(null);
  };
  const ref = useRef<Mesh>(null);
  return (
    <group position={at}>
      <mesh
        ref={ref}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = disabled ? "" : "grab";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[0.22, 20, 14]} />
        <meshBasicMaterial color={AMBER} transparent opacity={hover ? 0.35 : 0.14} depthWrite={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.2, 0.012, 8, 32]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      {/* drop line to the floor */}
      <Line points={[[0, 0, 0], [0, -at[1], 0]]} color={AMBER} lineWidth={1} dashed dashSize={0.08} gapSize={0.06} transparent opacity={0.6} />
    </group>
  );
}

/** Path line(s), key ghosts and handles for the current move; the live camera(s). */
export function PathViz() {
  const version = useCM((s) => s.version);
  const sceneId = useCM((s) => s.sceneId);
  const experiment = useCM((s) => s.experiment);
  const views = useMemo(() => currentViews(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const subj = subjectsFor(sceneId);
  const paths = useMemo(() => views.map((v) => samplePath(v.move, subj, 64)), [views, subj]);
  const editable = experiment === "move" && views[0].move.interp !== "track";
  return (
    <TechLayer>
      {views.map((v, i) => (
        <group key={`${v.id}-${version}`}>
          {paths[i].length > 1 && paths[i].some((p, k) => k > 0 && Math.hypot(p[0] - paths[i][0][0], p[1] - paths[i][0][1], p[2] - paths[i][0][2]) > 0.01) && (
            <Line points={paths[i] as [number, number, number][]} color={VIEW_COLORS[i]} lineWidth={2} transparent opacity={0.9} />
          )}
          <KeyGhost k={v.move.start} color={VIEW_COLORS[i]} />
          {(v.move.end.position !== v.move.start.position || v.move.end.focalMm !== v.move.start.focalMm) && <KeyGhost k={v.move.end} color={VIEW_COLORS[i]} />}
          <LiveCamera index={i} />
        </group>
      ))}
      {editable && (
        <>
          <Handle which="start" at={views[0].move.start.position} disabled={false} />
          {views[0].move.kind !== "static" && <Handle which="end" at={views[0].move.end.position} disabled={false} />}
        </>
      )}
      <SubjectMarker />
    </TechLayer>
  );
}

/** Mint ring at the framed subject's feet. */
function SubjectMarker() {
  const ring = useRef<Group>(null);
  const sceneId = useCM((s) => s.sceneId);
  const subject = useCM((s) => s.params.subject);
  useFrameUpdater(({ t }) => {
    const s = subjectsFor(sceneId)(subject, t);
    ring.current?.position.set(s.feet[0], s.feet[1] + 0.015, s.feet[2]);
  }, ORDER.TECH);
  return (
    <group ref={ring}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.36, 40]} />
        <meshBasicMaterial color={MINT} toneMapped={false} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
