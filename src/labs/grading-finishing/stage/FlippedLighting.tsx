"use client";

import { useEffect, useRef } from "react";
import type { DirectionalLight } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";

/**
 * Capture-only rig for the "what grading can't fix" plate: the active scene's lighting with the key
 * and rim mirrored to the other side of the set (x → −x). Used with ?capture=flipped; never in the lab.
 */
export function FlippedLighting({ shadowMap }: { shadowMap: number }) {
  const key = useRef<DirectionalLight>(null);
  const look = d.look;
  const flip = (p: readonly [number, number, number]): [number, number, number] => [-p[0], p[1], p[2]];
  useEffect(() => {
    const l = key.current;
    if (!l) return;
    l.shadow.mapSize.set(shadowMap, shadowMap);
    l.target.position.set(...flip(look.key.target));
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
        position={flip(look.key.position)}
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
      <spotLight position={flip(look.rim.position)} angle={0.6} penumbra={0.7} intensity={look.rim.intensity} color={look.rim.color} distance={16} decay={2} />
      {look.practicals.map((p, i) => (
        <pointLight key={i} position={p.position} intensity={p.intensity} distance={p.distance} decay={2} color={p.color} />
      ))}
    </>
  );
}
