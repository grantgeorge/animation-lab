"use client";

import { useLayoutEffect, useRef } from "react";
import type { Group } from "three";
import { E1 } from "../engine/projection";
import { AC_LAYER } from "../runtime/live";

const CYAN = "#5fe3ff";
const AMBER = "#ffb547";

/**
 * Experiment 1's measuring kit, on its own layer so only the experiment cameras see it: floor rulers
 * running into depth with metre ticks, and three identical 1.78 m poles at different depths.
 */
export function Guides() {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      o.layers.set(AC_LAYER.GUIDES);
      o.castShadow = false;
      o.receiveShadow = false;
    });
  });
  const { xs, z0, z1 } = E1.rulers;
  const len = z0 - z1;
  const ticks = Array.from({ length: Math.floor(len) + 1 }, (_, i) => z0 - i);
  const span = xs[xs.length - 1] - xs[0];
  return (
    <group ref={ref}>
      {xs.map((x) => (
        <mesh key={`r${x}`} position={[x, 0.006, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[0.035, len]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {ticks.map((z) => (
        <mesh key={`t${z}`} position={[(xs[0] + xs[xs.length - 1]) / 2, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[span, 0.018]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {E1.poles.map((p) => (
        <group key={p.id} position={p.base}>
          <mesh position={[0, E1.poleHeightM / 2, 0]}>
            <cylinderGeometry args={[0.028, 0.028, E1.poleHeightM, 10]} />
            <meshBasicMaterial color={AMBER} toneMapped={false} />
          </mesh>
          {[0, E1.poleHeightM].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[0.22, 0.03, 0.03]} />
              <meshBasicMaterial color={AMBER} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
