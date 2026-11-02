"use client";

import { Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import type { Clip } from "../animation/dsl";
import { clipFor } from "../animation/performances";
import { BramPuppet } from "./Bram";
import { PipPuppet } from "./Pip";
import { RiggedCharacter, type BoneMapping } from "./RiggedCharacter";
import type { FaceData } from "./faceRig";
import bramFace from "./faces/bram.json";
import pipFace from "./faces/pip.json";

/**
 * Clip part → skeleton bone. The Meshy rigs are in an A-pose; the arm offsets (world Z, degrees)
 * bring the upper arms down to the sides before the clip's deltas apply.
 */
// Current Bram bind arms are already 27° / 30° from vertical. Leave a little outward
// clearance for the broad coat; the older -38° / +41° correction folded his hands into his lap.
const BRAM_ARM_L: [number, number, number] = [0, 0, -18];
const BRAM_ARM_R: [number, number, number] = [0, 0, 20];
export const BRAM_BONES: Record<string, BoneMapping> = {
  pelvis: { bone: "Hips", order: "YXZ" },
  torso: { bone: "Spine01", order: "YXZ" },
  head: { bone: "Head", order: "YXZ" },
  shoulderL: { bone: "LeftShoulder", order: "XZY" },
  shoulderR: { bone: "RightShoulder", order: "XZY" },
  upperArmL: { bone: "LeftArm", offsetDeg: BRAM_ARM_L, order: "XZY" },
  forearmL: { bone: "LeftForeArm", frameDeg: BRAM_ARM_L, order: "XZY" },
  handL: { bone: "LeftHand", frameDeg: BRAM_ARM_L },
  upperArmR: { bone: "RightArm", offsetDeg: BRAM_ARM_R, order: "XZY" },
  forearmR: { bone: "RightForeArm", frameDeg: BRAM_ARM_R, order: "XZY" },
  handR: { bone: "RightHand", frameDeg: BRAM_ARM_R },
  footR: { bone: "RightFoot" },
  thighL: { bone: "LeftUpLeg" },
  thighR: { bone: "RightUpLeg" },
  shinL: { bone: "LeftLeg" },
  shinR: { bone: "RightLeg" },
};

// Pip's bind arms are ~35° from vertical. Bringing them fully vertical sinks them into the flared
// raincoat (only the hands poke out at the hem), so they rest ~12° out, clear of the coat.
const PIP_ARM_L: [number, number, number] = [0, 0, -23];
const PIP_ARM_R: [number, number, number] = [0, 0, 25];
export const PIP_BONES: Record<string, BoneMapping> = {
  pelvis: { bone: "Hips", order: "YXZ" },
  torso: { bone: "Spine01", order: "YXZ" },
  head: { bone: "Head", order: "YXZ" },
  shinL: { bone: "LeftLeg" },
  shinR: { bone: "RightLeg" },
  thighL: { bone: "LeftUpLeg" },
  thighR: { bone: "RightUpLeg" },
  shoulderL: { bone: "LeftShoulder", order: "XZY" },
  shoulderR: { bone: "RightShoulder", order: "XZY" },
  upperArmL: { bone: "LeftArm", offsetDeg: PIP_ARM_L, order: "XZY" },
  forearmL: { bone: "LeftForeArm", frameDeg: PIP_ARM_L, order: "XZY" },
  handL: { bone: "LeftHand", frameDeg: PIP_ARM_L },
  upperArmR: { bone: "RightArm", offsetDeg: PIP_ARM_R, order: "XZY" },
  forearmR: { bone: "RightForeArm", frameDeg: PIP_ARM_R, order: "XZY" },
  handR: { bone: "RightHand", frameDeg: PIP_ARM_R },
};

/**
 * UHD cast (~205k triangles each) by default. Headless tests (software WebGL) and ?quality=low load a
 * ~48k-triangle LOD with 1k textures instead; ?quality=high always gets UHD. Face landmarks are stored
 * in normalized bounding-box space, so they fit both.
 */
const useLite = (() => {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  return q.get("quality") === "low" || (q.get("e2e") === "1" && q.get("quality") !== "high");
})();
export const BRAM_URL = useLite ? "/models/bram.lite.glb" : "/models/bram.glb";
export const PIP_URL = useLite ? "/models/pip.lite.glb" : "/models/pip.glb";
useGLTF.preload(BRAM_URL);
useGLTF.preload(PIP_URL);

type Vec3 = readonly [number, number, number];

/**
 * Optional overrides: by default each character stands on the ACTIVE scene's mark and plays that
 * scene's performance. Pass `root`/`clip`/`restYawDeg` to pin them (e.g. /history pins the doorway marks).
 */
export interface CharacterProps {
  root?: Vec3;
  clip?: Clip;
  restYawDeg?: number;
}

/** Bram: Meshy 7.1 model from GPT Image 2.5 concept art, rigged, driven by the active scene's clip. */
export function Bram({ root, clip, restYawDeg }: CharacterProps = {}) {
  const c = d.characters.primary;
  return (
    <Suspense fallback={<BramPuppet />}>
      <RiggedCharacter
        name="Bram"
        url={BRAM_URL}
        clip={clip ?? clipFor(d.scene.id, "bram")}
        root={root ?? c.root}
        restYawDeg={restYawDeg ?? c.restYawDeg ?? 0}
        heightM={c.landmarks.capTop}
        mapping={BRAM_BONES}
        face={bramFace as FaceData}
        loopS={d.timeline.durationS}
      />
    </Suspense>
  );
}

export function Pip({ root, clip, restYawDeg }: CharacterProps = {}) {
  const c = d.characters.secondary;
  return (
    <Suspense fallback={<PipPuppet />}>
      <RiggedCharacter
        name="Pip"
        url={PIP_URL}
        clip={clip ?? clipFor(d.scene.id, "pip")}
        root={root ?? c.root}
        restYawDeg={restYawDeg ?? c.restYawDeg ?? 0}
        heightM={c.landmarks.capTop}
        mapping={PIP_BONES}
        face={pipFace as FaceData}
        loopS={d.timeline.durationS}
      />
    </Suspense>
  );
}
