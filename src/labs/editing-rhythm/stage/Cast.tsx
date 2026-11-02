"use client";

import { Suspense } from "react";
import { BRAM_BONES, BRAM_URL, PIP_BONES, PIP_URL } from "@/scene/characters/Characters";
import { RiggedCharacter } from "@/scene/characters/RiggedCharacter";
import type { FaceData } from "@/scene/characters/faceRig";
import bramFace from "@/scene/characters/faces/bram.json";
import pipFace from "@/scene/characters/faces/pip.json";
import { SOURCE_END } from "../engine/source";
import { BRAM_CLIP, PIP_CLIP } from "../performance";

/*
 * This lab drives the rigs directly because its source reel is 114 s long and its root tracks carry the
 * marks; the bone maps are the shared ones, so a rig retune in Characters.tsx applies here too.
 */
const ORIGIN = [0, 0, 0] as const;

/** Bram and Pip, placed and posed entirely by the master source clips (root tracks carry the marks). */
export function Cast() {
  return (
    <>
      <Suspense fallback={null}>
        <RiggedCharacter name="Bram" url={BRAM_URL} clip={BRAM_CLIP} root={ORIGIN} restYawDeg={0} heightM={1.78} mapping={BRAM_BONES} face={bramFace as FaceData} loopS={SOURCE_END} />
      </Suspense>
      <Suspense fallback={null}>
        <RiggedCharacter name="Pip" url={PIP_URL} clip={PIP_CLIP} root={ORIGIN} restYawDeg={0} heightM={1.12} mapping={PIP_BONES} face={pipFace as FaceData} loopS={SOURCE_END} />
      </Suspense>
    </>
  );
}
