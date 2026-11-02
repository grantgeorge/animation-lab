"use client";

import { useMemo } from "react";
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, Path, Shape, SphereGeometry } from "three";
import { alleyScene as a } from "@/labs/lens-and-framing/scenes/alley";
import { mats, satin } from "../materials";
import { Backdrop, Lantern, StagePlate } from "./Set";
import { hash01, mergedBoxes, mergedCylinders, type Box, type Cyl } from "./geometry";

/**
 * "The Long Alley": a 19 m deep miniature alley on the sound stage. Tall façades on the left, low
 * shopfronts on the right (they start behind the characters so the side view stays open), an
 * archway at z −9, string lights every few metres and a lit far wall at z −20. The string lights,
 * lamps and archway are the depth cues that make lens compression legible.
 */
const L_FACE = -2.1;
const R_FACE = 1.7;
const FAR_Z = a.set.backWall.z;

type Facade = { z0: number; z1: number; h: number; mat: "brick" | "plaster" | "dark" };
const LEFT: Facade[] = [
  { z0: -1.0, z1: -4.6, h: 4.2, mat: "brick" },
  { z0: -4.6, z1: -8.7, h: 5.4, mat: "plaster" },
  { z0: -9.3, z1: -13.4, h: 4.8, mat: "dark" },
  { z0: -13.4, z1: -17.0, h: 5.6, mat: "brick" },
  { z0: -17.0, z1: FAR_Z, h: 4.6, mat: "plaster" },
];
const RIGHT: Facade[] = [
  { z0: -6.4, z1: -8.7, h: 3.4, mat: "plaster" },
  { z0: -9.3, z1: -13.0, h: 3.8, mat: "brick" },
  { z0: -13.0, z1: -16.6, h: 3.2, mat: "dark" },
  { z0: -16.6, z1: FAR_Z, h: 3.6, mat: "plaster" },
];

function useFacades() {
  return useMemo(() => {
    const byMat: Record<Facade["mat"], Box[]> = { brick: [], plaster: [], dark: [] };
    const lit: Box[] = [];
    const glass: Box[] = [];
    const trim: Box[] = [];
    const doors: Box[] = [];
    let seed = 1;
    const add = (side: -1 | 1, f: Facade) => {
      const face = side < 0 ? L_FACE : R_FACE;
      const depth = 0.6;
      const len = f.z0 - f.z1;
      const zc = (f.z0 + f.z1) / 2;
      const xc = face + side * (depth / 2);
      byMat[f.mat].push({ p: [xc, f.h / 2, zc], s: [depth, f.h, len] });
      // cornice
      trim.push({ p: [face + side * 0.25, f.h + 0.06, zc], s: [0.62, 0.12, len + 0.04] });
      // window rows
      const rows = [2.3, 3.7, 5.0].filter((y) => y + 0.55 < f.h);
      const n = Math.max(1, Math.floor(len / 1.15));
      for (const y of rows) {
        for (let k = 0; k < n; k++) {
          const z = f.z0 - (len / n) * (k + 0.5);
          const box: Box = { p: [face - side * 0.012, y, z], s: [0.03, 0.85, 0.55] };
          if (hash01(seed++) < 0.38) lit.push(box);
          else glass.push(box);
          trim.push({ p: [face - side * 0.04, y - 0.47, z], s: [0.1, 0.05, 0.66] });
        }
      }
      // a door on the ground floor
      if (len > 3) doors.push({ p: [face - side * 0.015, 1.0, f.z0 - len * 0.3], s: [0.04, 2.0, 0.9] });
    };
    LEFT.forEach((f) => add(-1, f));
    RIGHT.forEach((f) => add(1, f));
    return {
      brick: mergedBoxes(byMat.brick),
      plaster: mergedBoxes(byMat.plaster),
      dark: mergedBoxes(byMat.dark),
      lit: mergedBoxes(lit),
      glass: mergedBoxes(glass),
      trim: mergedBoxes(trim),
      doors: mergedBoxes(doors),
    };
  }, []);
}

/** The archway bridge across the alley. */
function Archway() {
  const { z, openingX, heightM, archR } = a.set.doorway;
  const geo = useMemo(() => {
    const s = new Shape();
    s.moveTo(L_FACE - 0.6, 0);
    s.lineTo(R_FACE + 0.6, 0);
    s.lineTo(R_FACE + 0.6, 4.5);
    s.lineTo(L_FACE - 0.6, 4.5);
    s.lineTo(L_FACE - 0.6, 0);
    const hole = new Path();
    const [x0, x1] = openingX;
    const cx = (x0 + x1) / 2;
    const r = Math.min(archR, (x1 - x0) / 2);
    hole.moveTo(x0, 0);
    hole.lineTo(x0, heightM - r);
    hole.absarc(cx, heightM - r, r, Math.PI, 0, true);
    hole.lineTo(x1, 0);
    hole.lineTo(x0, 0);
    s.holes.push(hole);
    const g = new ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 });
    g.translate(0, 0, -0.35);
    return g;
  }, [openingX, heightM, archR]);
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geo} castShadow receiveShadow material={satin("#7A4636", 0.9)} />
      <mesh position={[(R_FACE + L_FACE) / 2, 4.56, 0]} castShadow material={mats.plasterShade()}>
        <boxGeometry args={[R_FACE - L_FACE + 1.4, 0.14, 0.9]} />
      </mesh>
      {/* keystone */}
      <mesh position={[(openingX[0] + openingX[1]) / 2, heightM + 0.05, 0.37]} material={mats.stone()}>
        <boxGeometry args={[0.3, 0.42, 0.06]} />
      </mesh>
    </group>
  );
}

/** Catenary string lights: one instanced mesh of bulbs plus thin wires. */
function StringLights() {
  const spans: { z: number; y0: number; y1: number }[] = [
    { z: -7.6, y0: 3.7, y1: 3.2 },
    { z: -11.8, y0: 4.0, y1: 3.5 },
    { z: -15.8, y0: 4.2, y1: 3.0 },
    { z: -18.6, y0: 3.9, y1: 3.3 },
  ];
  const { inst, wire } = useMemo(() => {
    const pts: [number, number, number][] = [];
    const wirePts: number[] = [];
    for (const s of spans) {
      const n = 26;
      let prev: [number, number, number] | null = null;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = L_FACE + (R_FACE - L_FACE) * u;
        const y = s.y0 + (s.y1 - s.y0) * u - 0.42 * 4 * u * (1 - u);
        const p: [number, number, number] = [x, y, s.z];
        if (prev) wirePts.push(...prev, ...p);
        prev = p;
        if (i > 0 && i < n && i % 2 === 0) pts.push([x, y - 0.06, s.z]);
      }
    }
    const mesh = new InstancedMesh(new SphereGeometry(0.045, 10, 8), mats.lampGlow(), pts.length);
    const m = new Matrix4();
    pts.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
    mesh.instanceMatrix.needsUpdate = true;
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(wirePts, 3));
    return { inst: mesh, wire: g };
    // spans are static
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <primitive object={inst} />
      <lineSegments geometry={wire}>
        <lineBasicMaterial color="#1a1a1a" />
      </lineSegments>
    </group>
  );
}

/** Wall lamps on brackets at the scene's practical light positions (skipping the street lamp). */
function WallLamps() {
  const lamps = a.look.practicals.slice(1);
  return (
    <group>
      {lamps.map((l, i) => {
        const [x, y, z] = l.position;
        const onFar = Math.abs(z - FAR_Z) < 1;
        const wallX = x < 0 ? L_FACE : R_FACE;
        return (
          <group key={i} position={[x, y, z]}>
            <mesh material={mats.lampGlow()}>
              <boxGeometry args={[0.16, 0.22, 0.16]} />
            </mesh>
            <mesh position={[0, 0.16, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.iron()}>
              <coneGeometry args={[0.16, 0.12, 4]} />
            </mesh>
            {onFar ? (
              <mesh position={[0, 0.05, -0.25]} material={mats.iron()}>
                <boxGeometry args={[0.03, 0.03, 0.5]} />
              </mesh>
            ) : (
              <mesh position={[(wallX - x) / 2, 0.12, 0]} material={mats.iron()}>
                <boxGeometry args={[Math.abs(wallX - x), 0.03, 0.03]} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Dressing() {
  const g = useMemo(() => {
    const wood: Box[] = [
      { p: [-1.72, 0.3, -5.3], s: [0.6, 0.6, 0.6], ry: 0.2 },
      { p: [-1.75, 0.82, -5.25], s: [0.44, 0.44, 0.44], ry: -0.3 },
      { p: [1.32, 0.25, -13.9], s: [0.5, 0.5, 0.5], ry: 0.4 },
      { p: [-1.78, 0.26, -16.2], s: [0.52, 0.52, 0.52] },
    ];
    const iron: Box[] = [
      // fire escape landings on the left wall
      { p: [L_FACE + 0.45, 2.2, -14.6], s: [0.9, 0.06, 2.6] },
      { p: [L_FACE + 0.45, 3.65, -14.6], s: [0.9, 0.06, 2.6] },
      { p: [L_FACE + 0.88, 2.65, -14.6], s: [0.03, 0.9, 2.6] },
      { p: [L_FACE + 0.88, 4.1, -14.6], s: [0.03, 0.9, 2.6] },
      { p: [L_FACE + 0.45, 2.92, -15.4], s: [0.7, 0.04, 1.7], ry: 0 },
      // gutter strip
      { p: [-0.1, 0.012, (FAR_Z - 1) / 2], s: [0.16, 0.012, -FAR_Z - 1] },
    ];
    const pipes: Cyl[] = [
      { p: [L_FACE + 0.06, 2.4, -4.6], r: 0.05, h: 4.8 },
      { p: [L_FACE + 0.06, 2.6, -13.4], r: 0.05, h: 5.2 },
      { p: [R_FACE - 0.06, 1.7, -9.25], r: 0.05, h: 3.4 },
      { p: [R_FACE - 0.06, 1.7, -16.6], r: 0.05, h: 3.4 },
    ];
    const bins: Cyl[] = [
      { p: [1.36, 0.45, -7.4], r: 0.3, h: 0.9, seg: 18 },
      { p: [-1.78, 0.38, -12.6], r: 0.26, h: 0.76, seg: 18 },
      { p: [1.38, 0.38, -15.4], r: 0.26, h: 0.76, seg: 18 },
    ];
    return { wood: mergedBoxes(wood), iron: mergedBoxes(iron), pipes: mergedCylinders(pipes), bins: mergedCylinders(bins) };
  }, []);
  return (
    <group>
      <mesh geometry={g.wood} castShadow receiveShadow material={mats.wood()} />
      <mesh geometry={g.iron} castShadow receiveShadow material={mats.iron()} />
      <mesh geometry={g.pipes} castShadow material={mats.gunmetal()} />
      <mesh geometry={g.bins} castShadow receiveShadow material={satin("#3D4A44", 0.6, 0.4)} />
      {[
        [0.95, -6.2, 0.55],
        [-0.85, -11.0, 0.7],
        [0.45, -16.4, 0.5],
      ].map(([x, z, r]) => (
        <mesh key={`${x}${z}`} position={[x, 0.024, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={satin("#14171c", 0.12, 0.2)}>
          <circleGeometry args={[r, 28]} />
        </mesh>
      ))}
    </group>
  );
}

function FarWall() {
  const { centre, w, h } = a.set.backWall.window;
  return (
    <group>
      <mesh position={[(L_FACE + R_FACE) / 2, 2.6, FAR_Z - 0.25]} castShadow receiveShadow material={mats.brick()}>
        <boxGeometry args={[R_FACE - L_FACE + 1.4, 5.2, 0.5]} />
      </mesh>
      <mesh position={[centre[0], centre[1], FAR_Z + 0.01]} material={mats.windowGlow()}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[centre[0], centre[1], FAR_Z + 0.02]} material={mats.iron()}>
        <boxGeometry args={[0.05, h, 0.02]} />
      </mesh>
      <mesh position={[centre[0], centre[1] + 0.2, FAR_Z + 0.02]} material={mats.iron()}>
        <boxGeometry args={[w, 0.05, 0.02]} />
      </mesh>
      <mesh position={[-1.2, 1.0, FAR_Z + 0.02]} material={mats.teal()}>
        <boxGeometry args={[0.9, 2.0, 0.04]} />
      </mesh>
    </group>
  );
}

function Skyline() {
  const { base, heightM } = a.set.tower;
  const g = useMemo(() => {
    const roofs: Box[] = [
      { p: [-2.6, 3.4, -21.8], s: [3.2, 6.8, 2.4] },
      { p: [3.0, 3.0, -22.4], s: [3.4, 6.0, 2.2] },
      { p: [0.4, 2.8, -21.2], s: [3.0, 5.6, 1.6] },
    ];
    const legs: Cyl[] = [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ].map(([dx, dz]) => ({ p: [base[0] + dx, 3.25, base[2] + dz] as const, r: 0.06, h: 6.5, seg: 8 }));
    return { roofs: mergedBoxes(roofs), legs: mergedCylinders(legs) };
  }, [base]);
  return (
    <group>
      <mesh geometry={g.roofs} material={satin("#151b26", 0.95)} />
      <mesh geometry={g.legs} material={mats.iron()} />
      <mesh position={[base[0], 6.5 + 0.75, base[2]]} material={satin("#5a3f2c", 0.85)}>
        <cylinderGeometry args={[1.0, 1.0, 1.5, 24]} />
      </mesh>
      <mesh position={[base[0], heightM + 0.3, base[2]]} material={mats.roof()}>
        <coneGeometry args={[1.1, 0.6, 24]} />
      </mesh>
      {/* the moon */}
      <mesh position={[-3.0, 9.6, a.set.backdropZ + 0.1]}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="#E8EEF8" toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}

export function AlleySet() {
  const f = useFacades();
  return (
    <group>
      <StagePlate plate={a.set.plate} />
      <Backdrop z={a.set.backdropZ} width={26} height={16} colors={["#101a2c", "#18263f", "#05070C"]} />
      <mesh position={[(L_FACE + R_FACE) / 2, 0.01, (FAR_Z - 1) / 2]} receiveShadow material={satin("#2A2D33", 0.55)}>
        <boxGeometry args={[R_FACE - L_FACE, 0.02, -FAR_Z - 1]} />
      </mesh>
      <mesh geometry={f.brick} castShadow receiveShadow material={mats.brick()} />
      <mesh geometry={f.plaster} castShadow receiveShadow material={satin("#9C8B74", 0.95)} />
      <mesh geometry={f.dark} castShadow receiveShadow material={satin("#5B3A30", 0.92)} />
      <mesh geometry={f.lit} material={mats.windowGlow()} />
      <mesh geometry={f.glass} material={satin("#10141b", 0.3, 0.2)} />
      <mesh geometry={f.trim} castShadow material={mats.stone()} />
      <mesh geometry={f.doors} material={mats.teal()} />
      <Archway />
      <FarWall />
      <Skyline />
      <StringLights />
      <WallLamps />
      <Dressing />
      <Lantern base={a.set.lantern.base} headY={a.set.lantern.head[1]} />
    </group>
  );
}
