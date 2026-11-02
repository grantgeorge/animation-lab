"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Matrix4, type Material, type Mesh, type Object3D } from "three";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { SceneSet } from "@/scene/set/SceneSet";
import { Bram, Pip } from "@/scene/characters/Characters";
import { StageLighting } from "@/scene/StageLighting";
import { makePainted, type PatchedInfo } from "../render/paintMaterial";
import { usePT } from "../store";
import { headTurn, holdStill } from "./clips";
import { Overlays } from "./Overlays";
import { ProjectorRig } from "./ProjectorRig";
import { scene3d } from "./scene3d";

/** Layer the crawl metric's surface-coordinate pass renders (Bram only). */
export const LAYER_COORDS = 2;

interface Tracked {
  mesh: Mesh;
  info: PatchedInfo;
  rest: Matrix4;
}

const CHAR_HEIGHT: Record<string, number> = { Bram: 1.78, Pip: 1.05 };

function characterOf(o: Object3D): string | null {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.name === "Bram" || p.name === "Pip") return p.name;
  return null;
}

/**
 * Swaps every standard material in the canvas for a painted CLONE as soon as it appears (the
 * characters stream in under Suspense). Originals, including the shared set materials other labs
 * reuse, are never modified. Moving props lose the projected matte (it only fits static geometry).
 */
interface PainterState {
  tracked: Tracked[];
  owned: Material[];
  tick: number;
}

/** One painter step: patch new meshes (cheap traversal, every frame), drop the matte from props that moved. */
function paintStep(scene: Object3D, state: PainterState) {
    state.tick++;
    {
      scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh || m.userData.ptSkip || m.userData.ptPatched) return;
        if (Array.isArray(m.material)) return;
        const who = characterOf(m);
        let restScale = 1;
        if (who) {
          m.geometry.computeBoundingBox();
          const b = m.geometry.boundingBox!;
          restScale = CHAR_HEIGHT[who] / Math.max(1e-6, b.max.y - b.min.y);
          if (who === "Bram") {
            m.layers.enable(LAYER_COORDS);
            scene3d.bramRestScale = restScale;
          }
        } else {
          m.updateWorldMatrix(true, false);
          restScale = m.matrixWorld.getMaxScaleOnAxis();
        }
        const made = makePainted(m.material, who ? "char" : "env", restScale);
        m.userData.ptPatched = true;
        if (!made) return;
        m.material = made.material;
        state.owned.push(made.material);
        state.tracked.push({ mesh: m, info: made.info, rest: m.matrixWorld.clone() });
      });
    }
    for (const tr of state.tracked) {
      if (tr.info.kind !== "env" || tr.info.projAllow.value === 0) continue;
      if (!tr.mesh.matrixWorld.equals(tr.rest)) tr.info.projAllow.value = 0;
    }
}

function releasePainter(state: PainterState) {
  for (const m of state.owned) m.dispose();
  state.owned.length = 0;
  state.tracked.length = 0;
}

function Painter() {
  const scene = useThree((s) => s.scene);
  const [state] = useState<PainterState>(() => ({ tracked: [], owned: [], tick: 0 }));
  useFrameUpdater(() => paintStep(scene, state), ORDER.PRESENTATION);
  useEffect(() => () => releasePainter(state), [state]);
  return null;
}

/** The Workshop set, its lighting and the cast; Bram plays the head turn during the test. */
export function World({ shadowMap }: { shadowMap: number }) {
  const section = usePT((s) => s.section);
  const motion = usePT((s) => s.testMotion);
  const clip = section === "test" ? (motion === "orbit" ? holdStill : headTurn) : undefined;
  return (
    <>
      <StageLighting shadowMap={shadowMap} />
      <SceneSet />
      <Bram clip={clip} />
      {section === "look" && <Pip />}
      <Overlays />
      <ProjectorRig />
      <Painter />
    </>
  );
}
