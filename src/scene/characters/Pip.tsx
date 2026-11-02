"use client";

import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { tokens } from "@/lib/tokens";
import { satin } from "../materials";
import { doorwayWave } from "../animation/performances/doorwayWave";
import { Part, Puppet } from "./Puppet";
import { Ball, Block, Capsule, Lathe } from "./shapes";

const clip = doorwayWave.clips.find((c) => c.character === "pip")!;

/** Pip, the kid in the yellow sou'wester. 1.05 m (1.12 with the hat), big round head, big eyes, the only smile in the cast. */
export function PipPuppet() {
  const c = d.characters.secondary;
  const coat = satin(tokens.pipCoat, 0.45);
  const band = satin("#E0B040", 0.5);
  const skin = satin(tokens.pipSkin, 0.55);
  const blush = satin("#F2A99A", 0.6);
  const boots = satin(tokens.pipBoots, 0.35);
  const trousers = satin(tokens.bramTrousers, 0.85);
  const hair = satin(tokens.pipHair, 0.8);
  const white = satin("#FBFBF6", 0.3);
  const pupil = satin("#17120F", 0.2);
  const shine = satin("#ffffff", 0.2, 0, { color: "#ffffff", intensity: 1.2 });

  const leg = (side: 1 | -1) => (
    <Part name={side > 0 ? "thighL" : "thighR"} position={[0.062 * side, 0, 0]}>
      <Capsule r={0.046} len={0.08} material={trousers} position={[0, -0.09, 0]} />
      <Part position={[0, -0.17, 0]}>
        <Capsule r={0.041} len={0.08} material={trousers} position={[0, -0.09, 0]} />
        <Part position={[0, -0.18, 0.01]} rotation={[0, side > 0 ? 0.2 : 0, 0]}>
          <Block size={[0.078, 0.085, 0.135]} radius={0.025} material={boots} position={[0, -0.042, 0.025]} />
        </Part>
      </Part>
    </Part>
  );

  const arm = (side: 1 | -1) => (
    <Part name={side > 0 ? "upperArmL" : "upperArmR"} position={[0.115 * side, 0.27, 0]}>
      <Capsule r={0.037} len={0.09} material={coat} position={[0, -0.075, 0]} />
      <Part name={side > 0 ? "forearmL" : "forearmR"} position={[0, -0.15, 0]}>
        <Capsule r={0.033} len={0.08} material={coat} position={[0, -0.065, 0]} />
        <Ball r={0.042} material={skin} position={[0, -0.15, 0.005]} />
      </Part>
    </Part>
  );

  return (
    <Puppet clip={clip} root={c.root} breath={{ part: "torso", amount: 0.018, periodS: 2 }}>
      <Part name="pelvis" position={[0, 0.43, 0]}>
        {leg(1)}
        {leg(-1)}
        <Part name="torso" position={[0, 0.03, 0]}>
          {/* A-line raincoat flaring to the hem */}
          <Lathe profile={[[0.205, -0.17], [0.19, -0.05], [0.16, 0.12], [0.13, 0.25], [0.08, 0.33]]} material={coat} />
          <mesh position={[0, -0.165, 0]} rotation={[Math.PI / 2, 0, 0]} material={band}>
            <torusGeometry args={[0.205, 0.012, 8, 32]} />
          </mesh>
          {[0.0, 0.1, 0.2].map((y) => (
            <Ball key={y} r={0.012} material={band} position={[0, y, 0.17 - y * 0.2]} segments={10} />
          ))}
          <mesh position={[0, 0.31, 0]} rotation={[Math.PI / 2, 0, 0]} material={band}>
            <torusGeometry args={[0.075, 0.022, 8, 24]} />
          </mesh>
          {arm(1)}
          {arm(-1)}
          <Part name="neck" position={[0, 0.32, 0]}>
            <Capsule r={0.045} len={0.02} material={skin} position={[0, 0.02, 0]} />
            <Part name="head" position={[0, 0.02, 0]}>
              <Ball r={0.142} material={skin} position={[0, 0.13, 0]} scale={[1, 1.05, 0.98]} segments={32} />
              <Part name="eyes" position={[0, 0.11, 0.112]}>
                {[1, -1].map((s) => (
                  <group key={s} position={[0.05 * s, 0, 0]}>
                    <Ball r={0.035} material={white} segments={20} />
                    <Ball r={0.019} material={pupil} position={[0, 0, 0.026]} segments={12} />
                    <Ball r={0.006} material={shine} position={[0.008, 0.009, 0.042]} segments={8} />
                  </group>
                ))}
              </Part>
              <Ball r={0.027} material={skin} position={[0, 0.085, 0.137]} />
              {[1, -1].map((s) => (
                <Ball key={s} r={0.04} material={blush} position={[0.078 * s, 0.07, 0.1]} scale={[1, 0.7, 0.55]} />
              ))}
              <mesh position={[0, 0.045, 0.128]} rotation={[0.25, 0, Math.PI]} material={pupil}>
                <torusGeometry args={[0.024, 0.005, 6, 16, Math.PI]} />
              </mesh>
              {[-0.05, 0, 0.05].map((x) => (
                <Capsule key={x} r={0.017} len={0.04} material={hair} position={[x, 0.235, 0.105]} rotation={[0.9, 0, x * 4]} />
              ))}
              <Part name="hat" position={[0, 0.2, 0]}>
                <Lathe profile={[[0.0, 0.0], [0.15, 0.0], [0.158, 0.05], [0.12, 0.1], [0.0, 0.12]]} material={coat} />
                <mesh position={[0, 0.005, -0.02]} rotation={[-0.18, 0, 0]} material={coat} castShadow>
                  <cylinderGeometry args={[0.25, 0.26, 0.016, 36]} />
                </mesh>
                <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={band}>
                  <torusGeometry args={[0.152, 0.01, 6, 28]} />
                </mesh>
              </Part>
            </Part>
          </Part>
        </Part>
      </Part>
    </Puppet>
  );
}

/** The rigged Meshy character (the procedural puppet above is its loading fallback). */
export { Pip } from "./Characters";
