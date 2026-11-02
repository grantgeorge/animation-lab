"use client";

import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Color, Euler, Group, MeshPhysicalMaterial, Quaternion, type Bone, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { sampleClip, type PoseDelta } from "@/scene/animation/dsl";
import { DEG } from "../engine/spherical";
import { studio } from "../config";
import { lookAround } from "./lookAround";
import { applyGrade } from "./grade";
import { ORDER, useStudioFrame } from "./bus";

/**
 * Clip part → skeleton bone on the Meshy rig (A-pose). The arm offsets bring the upper arms down
 * to the sides before the clip's deltas apply. Same rig convention as the Lens lab's Bram.
 */
const BONES: Record<string, { bone: string; offsetDeg?: [number, number, number] }> = {
  pelvis: { bone: "Hips" },
  torso: { bone: "Spine01" },
  head: { bone: "Head" },
  upperArmL: { bone: "LeftArm", offsetDeg: [0, 0, -29] },
  forearmL: { bone: "LeftForeArm" },
  upperArmR: { bone: "RightArm", offsetDeg: [0, 0, 32] },
  forearmR: { bone: "RightForeArm" },
};

interface Driven {
  bone: Bone;
  p0: Quaternion;
  p0inv: Quaternion;
  l0: Quaternion;
  offset: Quaternion;
}

const clip = lookAround.clips[0];
const tmpE = new Euler();
const tmpQ = new Quaternion();
const tmpD = new Quaternion();

useGLTF.preload(studio.subject.url);

/**
 * Bram, played by a lab-local driver: L = (P0⁻¹ · Δ · P0) · L0 per mapped bone (rest-aligned deltas).
 * Materials are new per instance (built from the baked texture), so the shared GLTF cache is never mutated.
 */
export function StudioCharacter() {
  const gltf = useGLTF(studio.subject.url);
  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as Group;
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const s = studio.subject.heightM / Math.max(1e-6, box.max.y - box.min.y);
    scene.scale.setScalar(s);
    scene.position.y = -box.min.y * s;
    const materials: Material[] = [];
    scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      // Per-instance physical material keeps the asset's surface detail and adds a little sheen.
      // Shared GLTF textures stay read-only; lighting and grade properties belong to this clone.
      const src = m.material as MeshStandardMaterial;
      const mat = new MeshPhysicalMaterial({
        map: src.map,
        // the HD cast carries a normal map (cloth weave, skin detail): keep it, a touch softened
        normalMap: src.normalMap ?? null,
        normalMapType: src.normalMapType,
        normalScale: src.normalScale?.clone().multiplyScalar(0.8),
        roughnessMap: src.roughnessMap,
        color: src.color,
        side: src.side,
        roughness: src.roughnessMap ? src.roughness : 0.66,
        metalness: 0,
        sheen: 0.55,
        sheenRoughness: 0.38,
        sheenColor: new Color("#ffffff"),
        specularIntensity: 0.6,
      });
      mat.name = "bram-studio";
      applyGrade(mat);
      m.material = mat;
      materials.push(mat);
    });
    scene.name = "Bram";
    scene.updateMatrixWorld(true);
    const driven = new Map<string, Driven>();
    for (const [part, map] of Object.entries(BONES)) {
      const bone = scene.getObjectByName(map.bone) as Bone | undefined;
      if (!bone || !bone.parent) continue;
      const p0 = bone.parent.getWorldQuaternion(new Quaternion());
      const o = map.offsetDeg ?? [0, 0, 0];
      driven.set(part, {
        bone,
        p0,
        p0inv: p0.clone().invert(),
        l0: bone.quaternion.clone(),
        offset: new Quaternion().setFromEuler(new Euler(o[0] * DEG, o[1] * DEG, o[2] * DEG, "XYZ")),
      });
    }
    return { model: scene, driven, materials };
  }, [gltf]);

  useEffect(() => () => rig.materials.forEach((m) => m.dispose()), [rig]);

  const [pose] = useState<{ d: PoseDelta }>(() => ({ d: new Map() }));
  useStudioFrame(({ t }) => {
    sampleClip(clip, t, pose.d);
    for (const [part, dr] of rig.driven) {
      const dl = pose.d.get(part);
      tmpE.set((dl?.rx ?? 0) * DEG, (dl?.ry ?? 0) * DEG, (dl?.rz ?? 0) * DEG, "XYZ");
      tmpD.setFromEuler(tmpE).multiply(dr.offset);
      tmpQ.copy(dr.p0inv).multiply(tmpD).multiply(dr.p0).multiply(dr.l0);
      dr.bone.quaternion.copy(tmpQ);
    }
  }, ORDER.POSE);

  return <primitive object={rig.model} />;
}
