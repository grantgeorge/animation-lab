"use client";

import { useEffect, useRef } from "react";
import type { DirectionalLight } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";

/** Key, fill, rim and practicals from the active scene's look (remounted on a scene switch). */
export function StageLighting({ shadowMap }: { shadowMap: number }) {
  const key = useRef<DirectionalLight>(null);
  const look = d.look;
  useEffect(() => {
    const l = key.current;
    if (!l) return;
    l.shadow.mapSize.set(shadowMap, shadowMap);
    l.shadow.map?.dispose();
    l.shadow.map = null;
    l.target.position.set(...look.key.target);
    l.target.updateMatrixWorld();
  }, [shadowMap, look]);
  const sh = look.shadow ?? { left: -7, right: 7, top: 7, bottom: -5, far: 30 };
  return (
    <>
      <color attach="background" args={[look.voidColor]} />
      {look.fog && <fog attach="fog" args={[look.fog.color, look.fog.near, look.fog.far]} />}
      <hemisphereLight args={[look.hemi.sky, look.hemi.ground, look.hemi.intensity]} />
      <directionalLight
        ref={key}
        position={look.key.position}
        intensity={look.key.intensity}
        color={look.key.color}
        castShadow
        shadow-bias={-0.0012}
        shadow-normalBias={0.045}
        shadow-radius={3}
        shadow-camera-left={sh.left}
        shadow-camera-right={sh.right}
        shadow-camera-top={sh.top}
        shadow-camera-bottom={sh.bottom}
        shadow-camera-near={1}
        shadow-camera-far={sh.far}
      />
      <spotLight position={look.rim.position} angle={0.6} penumbra={0.7} intensity={look.rim.intensity} color={look.rim.color} distance={16} decay={2} />
      {look.practicals.map((p, i) => (
        <pointLight key={i} position={p.position} intensity={p.intensity} distance={p.distance} decay={2} color={p.color} />
      ))}
    </>
  );
}
