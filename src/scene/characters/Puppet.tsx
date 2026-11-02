"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Euler, type Group, Vector3 } from "three";
import { DEG } from "@/engine/math";
import { sampleClip, type Clip, type PoseDelta } from "../animation/dsl";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";

interface Rest {
  obj: Group;
  pos: Vector3;
  rot: Euler;
  scaleY: number;
}

const PartsCtx = createContext<Map<string, Rest> | null>(null);

/** A named pivot. Keyframe channels are applied as deltas from this group's rest transform. */
export function Part({
  name,
  position,
  rotation,
  children,
}: {
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  children?: ReactNode;
}) {
  const parts = useContext(PartsCtx);
  const ref = useCallback(
    (g: Group | null) => {
      if (!parts || !name) return;
      if (g) parts.set(name, { obj: g, pos: g.position.clone(), rot: g.rotation.clone(), scaleY: g.scale.y });
      else parts.delete(name);
    },
    [parts, name],
  );
  return (
    <group ref={ref} name={name} position={position} rotation={rotation}>
      {children}
    </group>
  );
}

/** Parts register through ref callbacks; `apply` writes the clip's pose at time t onto them. */
function createPuppetRegistry(clip: Clip, breath?: { part: string; amount: number; periodS: number }) {
  const parts = new Map<string, Rest>();
  const pose: PoseDelta = new Map();
  return {
    parts,
    apply(t: number) {
      sampleClip(clip, t, pose);
      for (const [name, rest] of parts) {
        const dlt = pose.get(name);
        const o = rest.obj;
        o.position.set(rest.pos.x + (dlt?.px ?? 0), rest.pos.y + (dlt?.py ?? 0), rest.pos.z + (dlt?.pz ?? 0));
        o.rotation.set(rest.rot.x + (dlt?.rx ?? 0) * DEG, rest.rot.y + (dlt?.ry ?? 0) * DEG, rest.rot.z + (dlt?.rz ?? 0) * DEG);
        let sy = rest.scaleY * (1 + (dlt?.sy ?? 0));
        if (breath && name === breath.part) sy *= 1 + breath.amount * Math.sin((2 * Math.PI * t) / breath.periodS);
        o.scale.setY(sy);
      }
    },
  };
}

/**
 * A puppet: a root at the character's mark plus named parts, driven every frame by its clip,
 * sampled at the shared timeline time so the stage, the shot and thumbnails show the same pose.
 */
export function Puppet({
  clip,
  root,
  restYawDeg = 0,
  breath,
  children,
}: {
  clip: Clip;
  root: readonly [number, number, number];
  restYawDeg?: number;
  breath?: { part: string; amount: number; periodS: number };
  children: ReactNode;
}) {
  const [registry] = useState(() => createPuppetRegistry(clip, breath));
  useFrameUpdater(({ t }) => registry.apply(t), ORDER.POSE);
  return (
    <PartsCtx.Provider value={registry.parts}>
      <group position={[root[0], root[1], root[2]]} rotation={[0, restYawDeg * DEG, 0]}>
        <Part name="root">{children}</Part>
      </group>
    </PartsCtx.Provider>
  );
}
