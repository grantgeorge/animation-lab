"use client";

import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { tokens } from "@/lib/tokens";
import { satin } from "../materials";
import { doorwayWave } from "../animation/performances/doorwayWave";
import { Part, Puppet } from "./Puppet";
import { Ball, Block, Capsule, Lathe } from "./shapes";

const clip = doorwayWave.clips.find((c) => c.character === "bram")!;

/**
 * Bram, the lamplighter. 1.78 m, egg head deeper than wide, a nose that protrudes 0.13 m from the face
 * (the biggest facial mass, so near-camera distortion is obvious), heavy brow, mustache, cap and scarf.
 * Faces +Z (toward the default camera); his left is +X.
 */
export function BramPuppet() {
  const c = d.characters.primary;
  const coat = satin(tokens.bramCoat, 0.85);
  const coatDark = satin("#A9452A", 0.85);
  const scarf = satin(tokens.bramScarf, 0.9);
  const skin = satin(tokens.bramSkin, 0.55);
  const nose = satin(tokens.bramNose, 0.5);
  const trousers = satin(tokens.bramTrousers, 0.85);
  const shoes = satin(tokens.bramShoes, 0.4);
  const cap = satin(tokens.bramCap, 0.7);
  const hair = satin("#3B2F2A", 0.8);
  const white = satin("#FBFBF6", 0.3);
  const pupil = satin("#17120F", 0.2);
  const brass = satin(tokens.brass, 0.3, 0.85);

  const leg = (side: 1 | -1, footName: string) => (
    <Part name={side > 0 ? "hipL" : "hipR"} position={[0.105 * side, 0, 0]}>
      <Capsule r={0.078} len={0.24} material={trousers} position={[0, -0.19, 0]} />
      <Part name={side > 0 ? "kneeL" : "kneeR"} position={[0, -0.39, 0]}>
        <Capsule r={0.066} len={0.24} material={trousers} position={[0, -0.18, 0]} />
        <Part name={footName} position={[0, -0.37, 0.02]} rotation={[0, side > 0 ? 0 : -0.15, 0]}>
          <Block size={[0.105, 0.075, 0.25]} radius={0.03} material={shoes} position={[0, -0.052, 0.05]} />
        </Part>
      </Part>
    </Part>
  );

  const arm = (side: 1 | -1) => (
    <Part name={side > 0 ? "upperArmL" : "upperArmR"} position={[0.215 * side, 0.37, 0]}>
      <Ball r={0.07} material={coat} />
      <Capsule r={0.058} len={0.17} material={coat} position={[0, -0.13, 0]} />
      <Part name={side > 0 ? "forearmL" : "forearmR"} position={[0, -0.235, 0]} rotation={[-0.12, 0, 0]}>
        <Capsule r={0.05} len={0.16} material={coat} position={[0, -0.11, 0]} />
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={scarf}>
          <torusGeometry args={[0.052, 0.012, 8, 20]} />
        </mesh>
        <Part name={side > 0 ? "handL" : "handR"} position={[0, -0.215, 0.01]}>
          <Block size={[0.08, 0.1, 0.045]} radius={0.022} material={skin} position={[0, -0.05, 0]} />
          <Capsule r={0.018} len={0.035} material={skin} position={[-0.04 * side, -0.035, 0.015]} rotation={[0, 0, 0.5 * side]} />
        </Part>
      </Part>
    </Part>
  );

  return (
    <Puppet clip={clip} root={c.root} restYawDeg={-8} breath={{ part: "torso", amount: 0.012, periodS: 3 }}>
      <Part name="pelvis" position={[0, 0.85, 0]}>
        <Ball r={0.19} material={trousers} scale={[1, 0.62, 0.8]} />
        {/* coat skirt flaring from the waist */}
        <Lathe profile={[[0.2, 0.08], [0.24, -0.06], [0.27, -0.2], [0.28, -0.26]]} material={coatDark} scale={[1, 1, 0.82]} />
        {leg(1, "footL")}
        {leg(-1, "footR")}
        <Part name="torso" position={[0, 0.08, 0]}>
          <Lathe profile={[[0.16, -0.02], [0.24, 0.12], [0.285, 0.26], [0.27, 0.36], [0.2, 0.44], [0.1, 0.48]]} material={coat} scale={[1, 1, 0.78]} />
          {[0.12, 0.22, 0.32].map((y) => (
            <Ball key={y} r={0.016} material={brass} position={[0, y, 0.215 - (y - 0.12) * 0.12]} segments={12} />
          ))}
          <mesh position={[0, 0.44, 0.0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.85, 0.6]} material={scarf} castShadow>
            <torusGeometry args={[0.15, 0.045, 12, 28]} />
          </mesh>
          <Block size={[0.08, 0.24, 0.03]} radius={0.014} material={scarf} position={[0.07, 0.32, 0.205]} rotation={[0.15, 0, 0.12]} />
          {arm(1)}
          {arm(-1)}
          <Part name="neck" position={[0, 0.44, 0]}>
            <Capsule r={0.07} len={0.04} material={skin} position={[0, 0.03, 0]} />
            <Part name="head" position={[0, 0.03, 0]}>
              {/* egg head: deeper than wide, so the ears sit well behind the nose */}
              <Lathe profile={[[0.0, 0.0], [0.11, 0.025], [0.15, 0.14], [0.147, 0.26], [0.105, 0.345], [0.0, 0.372]]} material={skin} scale={[1, 1, 1.08]} />
              <Part name="eyes" position={[0, 0.149, 0.118]}>
                {[1, -1].map((s) => (
                  <group key={s} position={[0.066 * s, 0, 0]}>
                    <Ball r={0.04} material={white} segments={20} />
                    <Ball r={0.018} material={pupil} position={[0, 0, 0.032]} segments={12} />
                  </group>
                ))}
              </Part>
              <Part name="brow" position={[0, 0.195, 0.125]}>
                <Block size={[0.25, 0.045, 0.06]} radius={0.02} material={hair} rotation={[-0.2, 0, 0]} />
                <Capsule r={0.017} len={0.04} material={hair} position={[0.085, 0.03, 0.01]} rotation={[0, 0, 1.2]} />
              </Part>
              <Part name="nose" position={[0, 0.113, 0.13]}>
                <Capsule r={0.04} len={0.06} material={nose} position={[0, 0.005, 0.055]} rotation={[Math.PI / 2 - 0.25, 0, 0]} />
                <Ball r={0.046} material={nose} position={[0, -0.005, 0.118]} />
              </Part>
              {[1, -1].map((s) => (
                <Ball key={`ch${s}`} r={0.06} material={nose} position={[0.09 * s, 0.09, 0.09]} scale={[1, 0.75, 0.6]} />
              ))}
              {[1, -1].map((s) => (
                <Capsule key={`mu${s}`} r={0.026} len={0.08} material={hair} position={[0.055 * s, 0.072, 0.175]} rotation={[0, 0, (Math.PI / 2 - 0.45) * s]} />
              ))}
              {[1, -1].map((s) => (
                <Ball key={`ear${s}`} r={0.042} material={skin} position={[0.148 * s, 0.131, -0.027]} scale={[0.5, 1, 0.85]} />
              ))}
              <Part name="cap" position={[0, 0.29, -0.01]}>
                <Lathe profile={[[0.0, 0.0], [0.18, 0.012], [0.205, 0.06], [0.186, 0.098], [0.0, 0.117]]} material={cap} rotation={[0, 0, -0.06]} />
                <Block size={[0.25, 0.022, 0.13]} radius={0.01} material={cap} position={[0, 0.012, 0.17]} rotation={[0.14, 0, 0]} />
              </Part>
            </Part>
          </Part>
        </Part>
      </Part>
    </Puppet>
  );
}

/** The rigged Meshy character (the procedural puppet above is its loading fallback). */
export { Bram } from "./Characters";
