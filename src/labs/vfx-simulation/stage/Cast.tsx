"use client";

import { Suspense, useMemo } from "react";
import type { Group } from "three";
import { PIP_BONES, PIP_URL } from "@/scene/characters/Characters";
import { RiggedCharacter } from "@/scene/characters/RiggedCharacter";
import type { FaceData } from "@/scene/characters/faceRig";
import pipFace from "@/scene/characters/faces/pip.json";
import { SYNC_LAG, beatTimes, type Treatment } from "../engine/beat";
import { PIP_MARK, pipClip, pipTiming } from "../engine/pipClip";
import { LOOP_S } from "../engine/timing";
import { actors } from "../runtime/live";
import { useVX } from "../store";

/*
 * Three Pips, one per view, each driven directly with a clip generated from that view's beat, so his
 * flinch lands on that treatment's splash. The bone map is the shared one, so rig retunes in
 * Characters.tsx apply here too. Pip 2 is cel-shaded by the orchestrator for the hand-drawn view.
 */
const ROOT = [PIP_MARK.x, 0, PIP_MARK.z] as const;

export function Cast() {
  const phys = useVX((s) => s.phys);
  const timing = useVX((s) => s.timing);
  const exp = useVX((s) => s.exp);
  const offset = useVX((s) => s.offset);
  const clips = useMemo(() => {
    const clip = (tr: Treatment, off = SYNC_LAG) => pipClip(pipTiming(tr, beatTimes(tr, phys, timing[tr], off), phys.intensity));
    // in the sync experiment Pip 0 plays the offset take and Pip 1 the in-sync one (both cartoon)
    return exp === "sync" ? [clip("cartoon", offset), clip("cartoon"), clip("drawn")] : [clip("real"), clip("cartoon"), clip("drawn")];
  }, [phys, timing, exp, offset]);
  return (
    <>
      {clips.map((c, i) => (
        <group
          key={i}
          ref={(g: Group | null) => {
            actors.pips[i] = g;
          }}
        >
          <Suspense fallback={null}>
            <RiggedCharacter name={`Pip-${i}`} url={PIP_URL} clip={c} root={ROOT} restYawDeg={PIP_MARK.yawDeg} heightM={1.12} mapping={PIP_BONES} face={pipFace as FaceData} loopS={LOOP_S} />
          </Suspense>
        </group>
      ))}
    </>
  );
}
