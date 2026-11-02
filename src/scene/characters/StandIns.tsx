"use client";

import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { tokens } from "@/lib/tokens";
import { satin } from "../materials";

/**
 * M1 placeholders at the authored marks: a body capsule, a head and a nose at the descriptor's
 * landmark heights, so framing and perspective already read correctly before the puppets exist.
 */
function StandIn({ which }: { which: "primary" | "secondary" }) {
  const c = d.characters[which];
  const isBram = which === "primary";
  const headR = isBram ? 0.17 : 0.15;
  const headY = isBram ? c.landmarks.eyes + 0.02 : c.landmarks.eyes;
  const bodyTop = headY - headR - 0.04;
  const bodyR = isBram ? 0.22 : 0.17;
  const coat = satin(isBram ? tokens.bramCoat : tokens.pipCoat, 0.8);
  const skin = satin(isBram ? tokens.bramSkin : tokens.pipSkin, 0.6);
  const nose = satin(isBram ? tokens.bramNose : tokens.pipSkin, 0.6);
  return (
    <group position={[c.root[0], 0, c.root[2]]} rotation={[0, isBram ? (-8 * Math.PI) / 180 : -0.5, 0]}>
      <mesh position={[0, bodyTop / 2, 0]} castShadow receiveShadow material={coat}>
        <capsuleGeometry args={[bodyR, Math.max(0.01, bodyTop - bodyR * 2), 8, 16]} />
      </mesh>
      <mesh position={[0, headY, 0]} castShadow material={skin}>
        <sphereGeometry args={[headR, 24, 16]} />
      </mesh>
      <mesh position={[0, c.landmarks.noseTip.y, c.landmarks.noseTip.forward - 0.04]} castShadow material={nose}>
        <sphereGeometry args={[isBram ? 0.05 : 0.03, 16, 12]} />
      </mesh>
    </group>
  );
}

export function StandIns() {
  return (
    <>
      <StandIn which="primary" />
      <StandIn which="secondary" />
    </>
  );
}
