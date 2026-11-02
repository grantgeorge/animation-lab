"use client";

import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, Euler, Group, Mesh, MeshStandardMaterial, Quaternion, type Bone, type Object3D, type Scene } from "three";
import { addFaceMorphs, faceInfluences, type FaceData, type FaceTarget } from "./faceRig";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { DEG } from "@/engine/math";
import { type Clip, type PoseDelta } from "../animation/dsl";
import { sampleClipSmoothed } from "../animation/smooth";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";

/**
 * Which skeleton bone a puppet part drives.
 * - offsetDeg: a fixed rest offset (degrees, world axes) applied first, e.g. A-pose arm → arm down.
 * - frameDeg: the accumulated rest offset of the bone's ancestors. Deltas are conjugated by it, so a
 *   forearm's rx is an elbow hinge in the arms-down pose, not in the A-pose the rig was bound in.
 * - order: Euler order of the delta. Shoulders "XZY" (twist about the hanging arm first, then
 *   raise sideways, then swing forward); head and spine "YXZ" (yaw outermost, so a turned head that
 *   nods doesn't roll). Default "XYZ".
 */
export interface BoneMapping {
  bone: string;
  offsetDeg?: [number, number, number];
  frameDeg?: [number, number, number];
  order?: "XYZ" | "XZY" | "YXZ";
}

interface Driven {
  bone: Bone;
  /** Parent rest world rotation, and its inverse. */
  p0: Quaternion;
  p0inv: Quaternion;
  /** Bone rest local rotation. */
  l0: Quaternion;
  offset: Quaternion;
  frame: Quaternion | null;
  frameInv: Quaternion | null;
  order: "XYZ" | "XZY" | "YXZ";
}

/** Write face influences onto the mesh (outside the component so the memoized rig isn't "mutated" in render scope). */
function applyFace(mesh: Mesh, index: Partial<Record<FaceTarget, number>>, inf: Record<FaceTarget, number>) {
  const out = mesh.morphTargetInfluences;
  if (!out) return;
  for (const [k, i] of Object.entries(index)) out[i as number] = inf[k as FaceTarget];
}

function refreshPreviews(scene: Scene, invalidate: () => void) {
  scene.userData.thumbnailContentRevision = (scene.userData.thumbnailContentRevision ?? 0) + 1;
  invalidate();
}

const tmpE = new Euler();
const tmpQ = new Quaternion();
const tmpD = new Quaternion();

/**
 * Plays a puppet clip on a rigged GLB. Clip rotations are deltas in rest-aligned axes (as on the
 * procedural puppets), so for each mapped bone: L = (P0⁻¹ · Δ · P0) · L0, where P0 is the parent's
 * rest world rotation and L0 the bone's rest local rotation. Hierarchy composes the deltas.
 */
export function RiggedCharacter({
  url,
  clip,
  root,
  restYawDeg = 0,
  heightM,
  mapping,
  name,
  face,
  loopS,
}: {
  url: string;
  clip: Clip;
  root: readonly [number, number, number];
  restYawDeg?: number;
  heightM: number;
  mapping: Record<string, BoneMapping>;
  name: string;
  /** Painted-face landmarks: adds a procedural face rig (blink, brows, smile…) driven by the clip. */
  face?: FaceData;
  /** Loop length (s) so smoothing and overlap wrap across the seam. */
  loopS?: number;
}) {
  const gltf = useGLTF(url);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  // Clone the skinned scene so each instance has its own skeleton; normalize height, feet on the floor.
  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as Group;
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const s = heightM / Math.max(1e-6, box.max.y - box.min.y);
    scene.scale.setScalar(s);
    scene.position.y = -box.min.y * s;
    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        // SkeletonUtils.clone shares materials with the cached GLTF: clone before tuning so other
        // users of the same GLB (other labs, /history) never see these edits.
        const src = m.material as MeshStandardMaterial;
        if (src && "roughness" in src) {
          const mat = src.clone();
          mat.roughness = Math.max(src.roughness ?? 0.7, 0.62);
          mat.metalness = 0;
          mat.envMapIntensity = 0.6;
          m.material = mat;
        }
      }
    });
    scene.name = name;
    // Face rig: morph targets on a per-instance copy of the geometry (the GLTF cache stays untouched).
    let faceMesh: Mesh | null = null;
    let faceIndex: Partial<Record<FaceTarget, number>> = {};
    if (face) {
      scene.traverse((o: Object3D) => {
        const m = o as Mesh;
        if (!faceMesh && m.isMesh) {
          m.geometry = m.geometry.clone();
          faceIndex = addFaceMorphs(m.geometry, face);
          m.updateMorphTargets();
          faceMesh = m;
        }
      });
    }
    // Rest frames are captured once, on the detached clone in its bind pose.
    scene.updateMatrixWorld(true);
    const driven = new Map<string, Driven>();
    for (const [part, m] of Object.entries(mapping)) {
      const bone = scene.getObjectByName(m.bone) as Bone | undefined;
      if (!bone || !bone.parent) continue;
      const p0 = bone.parent.getWorldQuaternion(new Quaternion());
      const o = m.offsetDeg ?? [0, 0, 0];
      const f = m.frameDeg;
      const frame = f ? new Quaternion().setFromEuler(new Euler(f[0] * DEG, f[1] * DEG, f[2] * DEG, "XYZ")) : null;
      driven.set(part, {
        bone,
        p0,
        p0inv: p0.clone().invert(),
        l0: bone.quaternion.clone(),
        offset: new Quaternion().setFromEuler(new Euler(o[0] * DEG, o[1] * DEG, o[2] * DEG, "XYZ")),
        frame,
        frameInv: frame ? frame.clone().invert() : null,
        order: m.order ?? "XYZ",
      });
    }
    return { model: scene, driven, faceMesh: faceMesh as Mesh | null, faceIndex };
  }, [gltf, heightM, name, mapping, face]);

  const [rootGroup] = useState(() => new Group());
  const [pose] = useState<{ d: PoseDelta }>(() => ({ d: new Map() }));

  useFrameUpdater(({ t }) => {
    sampleClipSmoothed(clip, t, loopS, pose.d);
    const r = pose.d.get("root");
    rootGroup.position.set(r?.px ?? 0, r?.py ?? 0, r?.pz ?? 0);
    rootGroup.rotation.set(0, (r?.ry ?? 0) * DEG, 0);
    if (rig.faceMesh?.morphTargetInfluences) {
      const inf = faceInfluences(pose.d.get("eyes"), pose.d.get("brows"), pose.d.get("mouth"));
      // Dev/test hook: window.__faceOverride = { Pip: { smile: 1 } } forces face shapes for review.
      const ov = (globalThis as { __faceOverride?: Record<string, Partial<Record<FaceTarget, number>>> }).__faceOverride?.[name];
      if (ov) Object.assign(inf, ov);
      applyFace(rig.faceMesh, rig.faceIndex, inf);
    }
    for (const [part, dr] of rig.driven) {
      const dlt = pose.d.get(part);
      tmpE.set((dlt?.rx ?? 0) * DEG, (dlt?.ry ?? 0) * DEG, (dlt?.rz ?? 0) * DEG, dr.order);
      tmpD.setFromEuler(tmpE);
      // In the ancestors' corrected rest frame: Δ' = F⁻¹ · Δ · F
      if (dr.frame && dr.frameInv) tmpD.premultiply(dr.frameInv).multiply(dr.frame);
      tmpD.multiply(dr.offset); // clip delta after the rest offset
      tmpQ.copy(dr.p0inv).multiply(tmpD).multiply(dr.p0).multiply(dr.l0);
      dr.bone.quaternion.copy(tmpQ);
    }
  }, ORDER.POSE);

  useEffect(() => {
    // A frozen timeline can cache the Suspense puppet before its GLB arrives. Changing the
    // scene content must refresh every lens preview even when camera and time stay still.
    refreshPreviews(scene, invalidate);
    return () => refreshPreviews(scene, invalidate);
  }, [scene, invalidate, rig.model]);

  return (
    <group position={[root[0], root[1], root[2]]} rotation={[0, restYawDeg * DEG, 0]}>
      <primitive object={rootGroup}><primitive object={rig.model} /></primitive>
    </group>
  );
}
