"use client";

import { useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group, Vector3 } from "three";
import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { tokens } from "@/lib/tokens";
import { anchorFor } from "@/engine/rig";
import { frustumCornersAtDistance, intrinsics } from "@/engine/projection";
import { mats } from "@/scene/materials";
import { TechLayer } from "@/scene/TechLayer";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { presentation } from "@/renderer/runtime/presentation";
import { labStore, useLab } from "@/ui/store/labStore";

const LENS_AXIS = d.rail.y;

/** A restrained cinema camera on a fluid head, column and dolly. Its pinhole sits exactly at the film camera position. */
export function CameraRig() {
  const body = useRef<Group>(null);
  const dolly = useRef<Group>(null);
  useFrameUpdater(() => {
    const p = presentation.pose;
    body.current?.position.copy(p.position);
    body.current?.quaternion.copy(p.quaternion);
    dolly.current?.position.set(p.position.x, 0, p.position.z);
  }, ORDER.TECH);
  return (
    <TechLayer>
      <group ref={body}>
        {/* body sits behind the pinhole */}
        <RoundedBox args={[0.2, 0.18, 0.28]} radius={0.015} position={[0, 0.02, 0.2]} material={mats.gunmetal()} />
        <RoundedBox args={[0.12, 0.09, 0.05]} radius={0.01} position={[0, 0.0, 0.37]} material={mats.rubber()} />
        <mesh position={[0, 0.135, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={mats.aluminum()}>
          <capsuleGeometry args={[0.014, 0.2, 4, 8]} />
        </mesh>
        <RoundedBox args={[0.14, 0.09, 0.015]} radius={0.005} position={[0.09, 0.16, 0.12]} rotation={[0, -0.5, 0]} material={mats.gunmetal()} />
        {/* lens: barrel, focus ring, focal ring, front element */}
        <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass()}>
          <cylinderGeometry args={[0.056, 0.056, 0.012, 32]} />
        </mesh>
        <mesh position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]} material={mats.gunmetal()}>
          <cylinderGeometry args={[0.05, 0.052, 0.11, 32]} />
        </mesh>
        <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={mats.rubber()}>
          <cylinderGeometry args={[0.058, 0.058, 0.03, 32]} />
        </mesh>
        <mesh position={[0, 0, -0.055]} rotation={[Math.PI / 2, 0, 0]} material={mats.rubber()}>
          <cylinderGeometry args={[0.058, 0.058, 0.035, 32]} />
        </mesh>
        <mesh position={[0, 0, -0.092]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.046, 0.046, 0.006, 32]} />
          <meshPhysicalMaterial color="#06101C" roughness={0.06} clearcoat={1} emissive="#4FA9FF" emissiveIntensity={0.25} />
        </mesh>
      </group>
      <group ref={dolly}>
        <mesh position={[0, (LENS_AXIS - 0.2) / 2 + 0.15, 0.22]} material={mats.aluminum()}>
          <cylinderGeometry args={[0.035, 0.035, LENS_AXIS - 0.35, 12]} />
        </mesh>
        <mesh position={[0, LENS_AXIS - 0.16, 0.22]} material={mats.gunmetal()}>
          <sphereGeometry args={[0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <RoundedBox args={[0.62, 0.05, 0.9]} radius={0.01} position={[0, 0.12, 0.22]} material={mats.gunmetal()} />
        {[
          [-0.31, -0.15],
          [0.31, -0.15],
          [-0.31, 0.59],
          [0.31, 0.59],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.06, z]} rotation={[0, 0, Math.PI / 2]} material={mats.rubber()}>
            <cylinderGeometry args={[0.06, 0.06, 0.035, 18]} />
          </mesh>
        ))}
      </group>
    </TechLayer>
  );
}

/** The dolly track: two aluminum tubes on sleepers, amber end stops. */
export function Rail() {
  const [z0, z1] = d.rail.meshZ;
  const len = z1 - z0;
  const sleepers = Math.floor(len / 0.6);
  return (
    <TechLayer>
      <group position={[d.rail.x, 0, (z0 + z1) / 2]}>
        {[-0.31, 0.31].map((x) => (
          <mesh key={x} position={[x, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.aluminum()}>
            <cylinderGeometry args={[0.024, 0.024, len, 10]} />
          </mesh>
        ))}
        {Array.from({ length: sleepers + 1 }, (_, k) => (
          <mesh key={k} position={[0, 0.008, -len / 2 + k * (len / sleepers)]} material={mats.wood()}>
            <boxGeometry args={[0.76, 0.016, 0.08]} />
          </mesh>
        ))}
        {[-len / 2, len / 2].map((z) =>
          [-0.31, 0.31].map((x) => (
            <mesh key={`${z}${x}`} position={[x, 0.05, z]} material={mats.lampGlow()}>
              <boxGeometry args={[0.08, 0.06, 0.04]} />
            </mesh>
          )),
        )}
      </group>
    </TechLayer>
  );
}

/** The single lit accent: the field of view from the pinhole to the subject plane, with a 16:9 target rectangle. */
export function Frustum() {
  const size = useThree((s) => s.size);
  const visible = useLab((s) => s.viz.frustum);
  const { line, faint, mat, faintMat, wire, wireMat } = useMemo(() => {
    const mat = new LineMaterial({ color: tokens.focal, linewidth: 1.6, transparent: true, opacity: 0.95, worldUnits: false });
    const faintMat = new LineMaterial({ color: tokens.focal, linewidth: 1, transparent: true, opacity: 0.28, worldUnits: false, dashed: false });
    const wireMat = new LineMaterial({ color: tokens.subject, linewidth: 1.2, transparent: true, opacity: 0.9, worldUnits: false });
    return {
      mat,
      faintMat,
      wireMat,
      line: new LineSegments2(new LineSegmentsGeometry(), mat),
      faint: new LineSegments2(new LineSegmentsGeometry(), faintMat),
      wire: new LineSegments2(new LineSegmentsGeometry(), wireMat),
    };
  }, []);
  const facesGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(4 * 3 * 3), 3));
    return g;
  }, []);
  mat.resolution.set(size.width, size.height);
  faintMat.resolution.set(size.width, size.height);
  wireMat.resolution.set(size.width, size.height);

  useFrameUpdater(() => {
    const s = labStore.getState();
    const pose = presentation.pose;
    const i = intrinsics(presentation.focalMm, d.gate);
    const anchor = new Vector3(...anchorFor(d, s.camera.targetId));
    const fwd = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
    const depth = Math.max(0.2, anchor.clone().sub(pose.position).dot(fwd));
    const c = frustumCornersAtDistance(pose, i, depth);
    const o = pose.position;
    const seg: number[] = [];
    const push = (a: Vector3, b: Vector3) => seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (const k of [0, 1, 2, 3]) push(o, c[k]);
    for (const k of [0, 1, 2, 3]) push(c[k], c[(k + 1) % 4]);
    // corner ticks and centre cross on the target rectangle
    const center = c[0].clone().add(c[2]).multiplyScalar(0.5);
    const right = c[1].clone().sub(c[0]).normalize();
    const up = c[0].clone().sub(c[3]).normalize();
    const tick = depth * 0.02;
    push(center.clone().addScaledVector(right, -tick), center.clone().addScaledVector(right, tick));
    push(center.clone().addScaledVector(up, -tick), center.clone().addScaledVector(up, tick));
    line.geometry.setPositions(seg);

    const far = frustumCornersAtDistance(pose, i, Math.min(40, Math.abs(d.set.backdropZ - o.z)));
    const fseg: number[] = [];
    for (const k of [0, 1, 2, 3]) fseg.push(c[k].x, c[k].y, c[k].z, far[k].x, far[k].y, far[k].z);
    faint.geometry.setPositions(fseg);

    // distance wire from the pinhole to the target anchor, and the framing-target post
    const t = s.camera.targetId === "both" ? null : d.characters[s.camera.targetId];
    const wseg: number[] = [o.x, o.y, o.z, anchor.x, anchor.y, anchor.z];
    if (t) wseg.push(t.anchor[0], 0.01, t.anchor[2], t.anchor[0], t.framingBox.top + 0.08, t.anchor[2]);
    else
      for (const w of [d.characters.primary, d.characters.secondary])
        wseg.push(w.anchor[0], 0.01, w.anchor[2], w.anchor[0], w.framingBox.top + 0.08, w.anchor[2]);
    wire.geometry.setPositions(wseg);

    const pos = facesGeo.getAttribute("position") as Float32BufferAttribute;
    for (let k = 0; k < 4; k++) {
      const a = c[k];
      const b = c[(k + 1) % 4];
      pos.setXYZ(k * 3, o.x, o.y, o.z);
      pos.setXYZ(k * 3 + 1, a.x, a.y, a.z);
      pos.setXYZ(k * 3 + 2, b.x, b.y, b.z);
    }
    pos.needsUpdate = true;
    facesGeo.computeBoundingSphere();
  }, ORDER.TECH);

  return (
    <TechLayer>
      <group visible={visible}>
        <primitive object={line} frustumCulled={false} />
        <primitive object={faint} frustumCulled={false} />
        <mesh geometry={facesGeo} frustumCulled={false}>
          <meshBasicMaterial color={tokens.focal} transparent opacity={0.06} depthWrite={false} side={2} />
        </mesh>
      </group>
      <primitive object={wire} frustumCulled={false} />
    </TechLayer>
  );
}
