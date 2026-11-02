"use client";

import { useMemo, useRef } from "react";
import type { Group } from "three";
import { workshopScene as w } from "@/labs/lens-and-framing/scenes/workshop";
import { DEG } from "@/engine/math";
import { sampleClip } from "../animation/dsl";
import { clipFor } from "../animation/performances";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { mats, satin } from "../materials";
import { Backdrop, StagePlate } from "./Set";
import { hash01, mergedBoxes, mergedCylinders, type Box, type Cyl } from "./geometry";

/**
 * "The Workshop": a cramped attic workshop. A workbench in front of Bram, a trapdoor behind him
 * (Pip's entrance), rafters overhead, a round moonlit window, shelves of jars, a pegboard and a
 * grandfather clock. Pip's trapdoor is in a loft riser behind the bench. Close quarters, so the set dressing sits near the lens at wide angles.
 */
const WALL_Z = w.set.backWall.z;
const LX = -2.4;
const RX = 2.1;
const RISER_H = w.characters.secondary.root[1];
const HATCH = { x: w.characters.secondary.root[0], z: w.characters.secondary.root[2], y: RISER_H, size: 0.8 };
const RISER = { x0: -0.08, x1: 1.3, z0: -4.55, z1: -3.3 };
const hatchClip = clipFor("workshop", "door");

function Floor() {
  const g = useMemo(() => {
    const a: Box[] = [];
    const b: Box[] = [];
    const n = Math.round((RX - LX) / 0.3);
    for (let i = 0; i < n; i++) {
      const x = LX + 0.15 + i * 0.3;
      (i % 2 ? a : b).push({ p: [x, 0.012, (WALL_Z - 0.4) / 2], s: [0.29, 0.024, -WALL_Z + 0.4] });
    }
    return { a: mergedBoxes(a), b: mergedBoxes(b) };
  }, []);
  return (
    <group>
      <mesh geometry={g.a} receiveShadow material={satin("#5A3E28", 0.8)} />
      <mesh geometry={g.b} receiveShadow material={satin("#4C3422", 0.8)} />
    </group>
  );
}

/** The loft riser behind the bench, with Pip's trapdoor in its top and two steps on its right. */
function Riser() {
  const g = useMemo(() => {
    const { x0, x1, z0, z1 } = RISER;
    const h = RISER_H;
    const body: Box[] = [
      { p: [(x0 + x1) / 2, h / 2, (z0 + z1) / 2], s: [x1 - x0, h, z1 - z0] },
      { p: [x1 + 0.2, h / 3, (z0 + z1) / 2], s: [0.4, (h * 2) / 3, 0.8] },
      { p: [x1 + 0.6, h / 6, (z0 + z1) / 2], s: [0.4, h / 3, 0.8] },
    ];
    const trim: Box[] = [
      { p: [(x0 + x1) / 2, h + 0.01, z1 - 0.03], s: [x1 - x0 + 0.04, 0.03, 0.08] },
      { p: [(x0 + x1) / 2, 0.04, z1 + 0.01], s: [x1 - x0, 0.08, 0.04] },
    ];
    return { body: mergedBoxes(body), trim: mergedBoxes(trim) };
  }, []);
  return (
    <group>
      <mesh geometry={g.body} castShadow receiveShadow material={satin("#5E4129", 0.8)} />
      <mesh geometry={g.trim} castShadow material={satin("#3E2A1A", 0.8)} />
      {/* the open trapdoor: a black square in the riser top */}
      <mesh position={[HATCH.x, HATCH.y + 0.003, HATCH.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HATCH.size, HATCH.size]} />
        <meshBasicMaterial color="#030303" />
      </mesh>
    </group>
  );
}

/** The hatch lid, hinged on its far edge and driven by the performance's prop clip. */
function HatchLid() {
  const hinge = useRef<Group>(null);
  useFrameUpdater(({ t }) => {
    const rx = sampleClip(hatchClip, t).get("leaf")?.rx ?? 0;
    if (hinge.current) hinge.current.rotation.x = rx * DEG;
  }, ORDER.POSE);
  return (
    <group ref={hinge} position={[HATCH.x, HATCH.y + 0.005, HATCH.z - HATCH.size / 2]}>
      <mesh position={[0, 0.022, HATCH.size / 2]} castShadow receiveShadow material={satin("#6B4A2E", 0.75)}>
        <boxGeometry args={[HATCH.size, 0.044, HATCH.size]} />
      </mesh>
      <mesh position={[0, 0.05, HATCH.size * 0.8]} material={mats.brass()}>
        <torusGeometry args={[0.05, 0.01, 8, 20]} />
      </mesh>
    </group>
  );
}

function Walls() {
  const g = useMemo(() => {
    const plaster: Box[] = [
      { p: [(LX + RX) / 2, 1.5, WALL_Z - 0.1], s: [RX - LX + 0.4, 3.0, 0.2] },
      { p: [LX - 0.1, 1.3, (WALL_Z - 1.4) / 2], s: [0.2, 2.6, -WALL_Z + 1.4] },
      { p: [RX + 0.1, 1.3, WALL_Z + 0.6], s: [0.2, 2.6, 1.2] },
    ];
    const timber: Box[] = [
      // posts and the top plate of the back wall
      { p: [LX + 0.08, 1.5, WALL_Z + 0.02], s: [0.16, 3.0, 0.14] },
      { p: [RX - 0.08, 1.5, WALL_Z + 0.02], s: [0.16, 3.0, 0.14] },
      { p: [-0.95, 1.5, WALL_Z + 0.02], s: [0.14, 3.0, 0.12] },
      { p: [(LX + RX) / 2, 2.9, WALL_Z + 0.04], s: [RX - LX, 0.16, 0.16] },
      // rafters overhead (in front of the lens at wide angles)
      ...[-1.3, -2.6, -3.9, -5.0].map((z): Box => ({ p: [(LX + RX) / 2, 2.95, z], s: [RX - LX + 0.3, 0.16, 0.14] })),
      { p: [LX + 0.25, 2.6, -2.8], s: [0.14, 0.14, 4.8] },
      { p: [RX - 0.25, 2.6, -3.6], s: [0.14, 0.14, 3.6] },
      // skirting
      { p: [(LX + RX) / 2, 0.08, WALL_Z + 0.02], s: [RX - LX, 0.16, 0.06] },
    ];
    return { plaster: mergedBoxes(plaster), timber: mergedBoxes(timber) };
  }, []);
  const [cx, cy] = w.set.backWall.window.centre;
  const r = w.set.backWall.window.w / 2;
  return (
    <group>
      <mesh geometry={g.plaster} receiveShadow castShadow material={satin("#B9A88E", 0.95)} />
      <mesh geometry={g.timber} castShadow receiveShadow material={satin("#4A3220", 0.8)} />
      {/* round moonlit window with mullions */}
      <mesh position={[cx, cy, WALL_Z + 0.005]} material={satin("#BFD6FF", 0.5, 0, { color: "#9FC4FF", intensity: 1.5 })}>
        <circleGeometry args={[r, 40]} />
      </mesh>
      <mesh position={[cx, cy, WALL_Z + 0.03]} material={satin("#4A3220", 0.8)}>
        <torusGeometry args={[r, 0.05, 10, 40]} />
      </mesh>
      <mesh position={[cx, cy, WALL_Z + 0.03]} material={satin("#4A3220", 0.8)}>
        <boxGeometry args={[0.05, r * 2, 0.04]} />
      </mesh>
      <mesh position={[cx, cy, WALL_Z + 0.03]} material={satin("#4A3220", 0.8)}>
        <boxGeometry args={[r * 2, 0.05, 0.04]} />
      </mesh>
    </group>
  );
}

function Workbench() {
  const g = useMemo(() => {
    const top: Box[] = [{ p: [-0.35, 0.9, -2.45], s: [1.6, 0.07, 0.62] }];
    const frame: Box[] = [
      ...[
        [-1.08, -2.2],
        [0.38, -2.2],
        [-1.08, -2.7],
        [0.38, -2.7],
      ].map(([x, z]): Box => ({ p: [x, 0.44, z], s: [0.07, 0.88, 0.07] })),
      { p: [-0.35, 0.22, -2.45], s: [1.5, 0.04, 0.5] },
      { p: [-0.35, 0.97, -2.74], s: [1.6, 0.08, 0.04] },
    ];
    const boxes: Box[] = [
      { p: [-0.8, 0.33, -2.45], s: [0.4, 0.18, 0.34] },
      { p: [0.05, 0.31, -2.42], s: [0.3, 0.14, 0.3], ry: 0.3 },
    ];
    // tools and gadgets on the bench
    const metal: Cyl[] = [
      { p: [-0.35, 1.02, -2.5], r: 0.09, h: 0.03, seg: 18, rx: Math.PI / 2 },
      { p: [-0.22, 1.0, -2.48], r: 0.06, h: 0.03, seg: 14, rx: Math.PI / 2 },
      { p: [-0.9, 0.98, -2.35], r: 0.035, h: 0.12, seg: 10 },
      { p: [-1.0, 0.99, -2.55], r: 0.05, h: 0.15, seg: 12 },
    ];
    return { top: mergedBoxes(top), frame: mergedBoxes(frame), boxes: mergedBoxes(boxes), metal: mergedCylinders(metal) };
  }, []);
  return (
    <group>
      <mesh geometry={g.top} castShadow receiveShadow material={satin("#7A5536", 0.7)} />
      <mesh geometry={g.frame} castShadow receiveShadow material={satin("#4A3220", 0.8)} />
      <mesh geometry={g.boxes} castShadow material={mats.wood()} />
      <mesh geometry={g.metal} castShadow material={mats.brass()} />
      {/* vise */}
      <mesh position={[0.3, 1.0, -2.2]} castShadow material={mats.gunmetal()}>
        <boxGeometry args={[0.16, 0.14, 0.2]} />
      </mesh>
      {/* desk lamp: base, arm, glowing shade */}
      <group position={[0.25, 0.94, -2.55]}>
        <mesh material={mats.iron()}>
          <cylinderGeometry args={[0.07, 0.08, 0.03, 16]} />
        </mesh>
        <mesh position={[0, 0.19, 0.04]} rotation={[0.25, 0, 0]} material={mats.iron()}>
          <cylinderGeometry args={[0.012, 0.012, 0.38, 8]} />
        </mesh>
        <mesh position={[0, 0.38, 0.17]} rotation={[0.9, 0, 0]} material={mats.teal()}>
          <coneGeometry args={[0.1, 0.13, 16, 1, true]} />
        </mesh>
        <mesh position={[0, 0.35, 0.2]} material={mats.lampGlow()}>
          <sphereGeometry args={[0.035, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}

function Shelves() {
  const g = useMemo(() => {
    const boards: Box[] = [1.0, 1.5, 2.0].map((y): Box => ({ p: [1.55, y, WALL_Z + 0.18], s: [0.95, 0.04, 0.3] }));
    const jars: Cyl[] = [];
    let seed = 7;
    for (const y of [1.0, 1.5, 2.0])
      for (let i = 0; i < 5; i++) {
        const h = 0.1 + hash01(seed++) * 0.14;
        jars.push({ p: [1.16 + i * 0.19, y + 0.02 + h / 2, WALL_Z + 0.18], r: 0.045 + hash01(seed++) * 0.03, h, seg: 12 });
      }
    const peg: Box[] = [{ p: [-0.45, 1.6, WALL_Z + 0.02], s: [0.9, 0.7, 0.02] }];
    const tools: Box[] = [
      { p: [-0.7, 1.62, WALL_Z + 0.05], s: [0.04, 0.4, 0.02] },
      { p: [-0.55, 1.58, WALL_Z + 0.05], s: [0.05, 0.32, 0.02] },
      { p: [-0.35, 1.66, WALL_Z + 0.05], s: [0.16, 0.05, 0.02] },
      { p: [-0.2, 1.55, WALL_Z + 0.05], s: [0.03, 0.36, 0.02] },
    ];
    return { boards: mergedBoxes(boards), jars: mergedCylinders(jars), peg: mergedBoxes(peg), tools: mergedBoxes(tools) };
  }, []);
  return (
    <group>
      <mesh geometry={g.boards} castShadow receiveShadow material={satin("#6A4A2E", 0.8)} />
      <mesh geometry={g.jars} castShadow material={satin("#8FB8A8", 0.25, 0.1)} />
      <mesh geometry={g.peg} receiveShadow material={satin("#A0845E", 0.9)} />
      <mesh geometry={g.tools} castShadow material={mats.gunmetal()} />
    </group>
  );
}

function GrandfatherClock() {
  const { base, clockFace, heightM } = w.set.tower;
  return (
    <group position={[base[0], 0, base[2]]}>
      <mesh position={[0, heightM / 2, 0]} castShadow receiveShadow material={satin("#4A2C1A", 0.6)}>
        <boxGeometry args={[0.5, heightM, 0.34]} />
      </mesh>
      <mesh position={[0, heightM + 0.06, 0]} castShadow material={satin("#3A2214", 0.6)}>
        <boxGeometry args={[0.58, 0.12, 0.4]} />
      </mesh>
      <mesh position={[0, clockFace[1], 0.175]} material={satin("#F0E2C0", 0.5, 0, { color: "#FFE2B0", intensity: 0.35 })}>
        <circleGeometry args={[0.17, 32]} />
      </mesh>
      <mesh position={[0, 0.95, 0.172]} material={satin("#1a1008", 0.4)}>
        <planeGeometry args={[0.24, 0.8]} />
      </mesh>
      <mesh position={[0, 0.85, 0.18]} material={mats.brass()}>
        <circleGeometry args={[0.06, 20]} />
      </mesh>
    </group>
  );
}

/** Foreground: the hanging bulb on its cord, a stool with a teapot near the lens. */
function Foreground() {
  const [x, y, z] = w.set.lantern.head;
  return (
    <group>
      <mesh position={[x, (y + 2.95) / 2 + 0.05, z]} material={mats.iron()}>
        <cylinderGeometry args={[0.006, 0.006, 2.95 - y, 6]} />
      </mesh>
      <mesh position={[x, y + 0.08, z]} material={mats.iron()}>
        <cylinderGeometry args={[0.025, 0.03, 0.06, 10]} />
      </mesh>
      <mesh position={[x, y, z]} material={mats.lampGlow()}>
        <sphereGeometry args={[0.06, 16, 12]} />
      </mesh>
      <group position={[-1.35, 0, -1.7]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow material={mats.wood()}>
          <cylinderGeometry args={[0.2, 0.2, 0.05, 20]} />
        </mesh>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.13, 0.14, Math.sin(a) * 0.13]} castShadow material={mats.wood()}>
            <cylinderGeometry args={[0.02, 0.025, 0.28, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 0.42, 0]} castShadow material={satin("#C8552F", 0.45)}>
          <sphereGeometry args={[0.1, 20, 14]} />
        </mesh>
      </group>
    </group>
  );
}

export function WorkshopSet() {
  return (
    <group>
      <StagePlate plate={w.set.plate} />
      <Backdrop z={w.set.backdropZ} width={14} height={8} colors={["#140f0b", "#1d1610", "#0A0806"]} />
      <Floor />
      <Riser />
      <HatchLid />
      <Walls />
      <Workbench />
      <Shelves />
      <GrandfatherClock />
      <Foreground />
    </group>
  );
}
