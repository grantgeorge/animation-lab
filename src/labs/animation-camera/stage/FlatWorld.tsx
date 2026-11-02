"use client";

import { useLayoutEffect } from "react";
import { CustomBlending, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, type Mesh } from "three";
import { flatCards } from "../runtime/exps";
import { AC_LAYER, actors } from "../runtime/live";

const cards = flatCards();

/** One painted card (premultiplied alpha from the capture). Drawn in painter's order, no depth. */
function Card({ id, center, quaternion, width, height, order, layer, store }: { id: string; center: readonly [number, number, number]; quaternion: { x: number; y: number; z: number; w: number }; width: number; height: number; order: number; layer: number; store: Map<string, Mesh> }) {
  return (
    <mesh
      ref={(m) => {
        if (!m) {
          store.delete(id);
          return;
        }
        m.layers.set(layer);
        m.frustumCulled = false;
        m.visible = false;
        store.set(id, m);
      }}
      position={center as [number, number, number]}
      quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}
      renderOrder={order}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial transparent depthTest={false} depthWrite={false} blending={CustomBlending} blendSrc={OneFactor} blendDst={OneMinusSrcAlphaFactor} color="#ffffff" />
      <lineSegments
        ref={(l) => {
          l?.layers.set(AC_LAYER.OUTLINE);
        }}
        renderOrder={100}
      >
        <edgesGeometry args={[new PlaneGeometry(width, height)]} />
        <lineBasicMaterial color={layer === AC_LAYER.FLAT2D ? "#ffb547" : "#5fe3ff"} transparent opacity={0.55} toneMapped={false} />
      </lineSegments>
    </mesh>
  );
}

/** The 2.5D multiplane stack (seven cards) and the 2D single plane (one painting + two cels). */
export function FlatWorld() {
  useLayoutEffect(() => () => {
    actors.cards25.clear();
    actors.cards2d.clear();
  }, []);
  const f = cards.flat;
  return (
    <group>
      {cards.layers.map((l, i) => (
        <Card key={l.id} id={l.id} center={l.center} quaternion={l.quaternion} width={l.width} height={l.height} order={10 + i} layer={AC_LAYER.FLAT25} store={actors.cards25} />
      ))}
      {(["flat", "pip", "bram"] as const).map((id, i) => (
        <Card key={id} id={id} center={f.center} quaternion={f.quaternion} width={f.width} height={f.height} order={10 + i} layer={AC_LAYER.FLAT2D} store={actors.cards2d} />
      ))}
    </group>
  );
}
