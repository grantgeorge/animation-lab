"use client";

import { useMemo } from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  PlaneGeometry,
  Shape,
} from "three";
import { RoundedBox } from "@react-three/drei";
import { doorwayScene as d, sceneDescriptor as active } from "@/labs/lens-and-framing/config";
import { tokens } from "@/lib/tokens";
import { mats } from "../materials";
import { TechLayer } from "../TechLayer";

type V3 = readonly [number, number, number];

/** The sound-stage floor. Defaults to the doorway plate; other scenes pass their own extent. */
export function StagePlate({ plate = d.set.plate }: { plate?: { x: readonly [number, number]; z: readonly [number, number] } }) {
  const [PX0, PX1] = plate.x;
  const [PZ0, PZ1] = plate.z;
  const w = PX1 - PX0;
  const depth = PZ1 - PZ0;
  return (
    <group>
      <RoundedBox args={[w, 0.12, depth]} radius={0.03} smoothness={2} position={[(PX0 + PX1) / 2, -0.06, (PZ0 + PZ1) / 2]} receiveShadow>
        <primitive object={mats.floor()} attach="material" />
      </RoundedBox>
    </group>
  );
}

/** Arched opening path (straight jambs + semicircle head). */
function archPath(x0: number, x1: number, height: number, r: number, asHole: boolean) {
  const p = asHole ? new Path() : new Shape();
  const cx = (x0 + x1) / 2;
  p.moveTo(x0, 0);
  p.lineTo(x0, height - r);
  p.absarc(cx, height - r, r, Math.PI, 0, true);
  p.lineTo(x1, 0);
  p.lineTo(x0, 0);
  return p;
}

export function DoorwayFlat({ doorRef }: { doorRef?: React.Ref<import("three").Group> }) {
  const { z, openingX, heightM, archR } = d.set.doorway;
  const geo = useMemo(() => {
    const s = new Shape();
    s.moveTo(-1.6, 0);
    s.lineTo(2.6, 0);
    s.lineTo(2.6, 3.0);
    s.lineTo(-1.6, 3.0);
    s.lineTo(-1.6, 0);
    s.holes.push(archPath(openingX[0], openingX[1], heightM, archR, true) as Path);
    const g = new ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
    g.translate(0, 0, -0.09);
    return g;
  }, [openingX, heightM, archR]);
  const leafW = openingX[1] - openingX[0] - 0.02;
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geo} castShadow receiveShadow material={mats.plaster()} />
      {/* brick quoins at the flat's corners */}
      {[0.25, 0.75, 1.25, 1.75, 2.25, 2.75].map((y, k) => (
        <RoundedBox key={`ql${y}`} args={[k % 2 ? 0.34 : 0.46, 0.22, 0.2]} radius={0.015} position={[-1.6 + (k % 2 ? 0.17 : 0.23), y, 0]} castShadow material={mats.brick()} />
      ))}
      {[0.25, 0.75, 1.25, 1.75, 2.25, 2.75].map((y, k) => (
        <RoundedBox key={`qr${y}`} args={[k % 2 ? 0.34 : 0.46, 0.22, 0.2]} radius={0.015} position={[2.6 - (k % 2 ? 0.17 : 0.23), y, 0]} castShadow material={mats.brick()} />
      ))}
      {/* cornice */}
      <RoundedBox args={[4.4, 0.14, 0.3]} radius={0.02} position={[0.5, 3.04, 0.02]} castShadow material={mats.plasterShade()} />
      {/* step */}
      <RoundedBox args={[1.0, 0.08, 0.5]} radius={0.015} position={[(openingX[0] + openingX[1]) / 2, 0.04, 0.2]} receiveShadow castShadow material={mats.stone()} />
      {/* dark interior behind the opening */}
      <mesh position={[(openingX[0] + openingX[1]) / 2, heightM / 2, -0.6]}>
        <planeGeometry args={[1.4, 2.6]} />
        <meshStandardMaterial color="#0c0d10" roughness={1} />
      </mesh>
      {/* door leaf, hinged on the left jamb, swings inward into the dark interior */}
      <group ref={doorRef} position={[openingX[0] + 0.01, 0, -0.02]}>
        <RoundedBox args={[leafW, heightM - archR - 0.02, 0.05]} radius={0.012} position={[leafW / 2, (heightM - archR) / 2, 0]} castShadow material={mats.teal()} />
        <RoundedBox args={[leafW - 0.12, 0.5, 0.012]} radius={0.006} position={[leafW / 2, 1.15, 0.03]} material={mats.teal()} />
        <RoundedBox args={[leafW - 0.12, 0.6, 0.012]} radius={0.006} position={[leafW / 2, 0.45, 0.03]} material={mats.teal()} />
        <mesh position={[leafW - 0.08, 1.0, 0.045]} material={mats.brass()}>
          <sphereGeometry args={[0.025, 12, 8]} />
        </mesh>
      </group>
      {/* doorway lamp */}
      <group position={[d.set.doorway.lamp[0], d.set.doorway.lamp[1], 0.12]}>
        <mesh material={mats.brass()} position={[0, 0.12, -0.04]}>
          <boxGeometry args={[0.04, 0.24, 0.08]} />
        </mesh>
        <mesh material={mats.lampGlow()}>
          <sphereGeometry args={[0.09, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
}

export function BackWall() {
  const { z, window: win } = d.set.backWall;
  const geo = useMemo(() => {
    const s = new Shape();
    s.moveTo(-6, 0);
    s.lineTo(6, 0);
    s.lineTo(6, 4.2);
    s.lineTo(-6, 4.2);
    s.lineTo(-6, 0);
    const x0 = win.centre[0] - win.w / 2;
    const x1 = win.centre[0] + win.w / 2;
    const y0 = win.centre[1] - win.h / 2;
    const hole = archPath(x0, x1, win.h, win.w / 2, true) as Path;
    hole.getPoints().forEach(() => undefined);
    const shifted = new Path(hole.getPoints().map((p) => p.clone().setY(p.y + y0)));
    s.holes.push(shifted);
    const g = new ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
    g.translate(0, 0, -0.15);
    return g;
  }, [win]);
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geo} receiveShadow castShadow material={mats.brick()} />
      <mesh position={[win.centre[0], win.centre[1], -0.1]} material={mats.windowGlow()}>
        <planeGeometry args={[win.w, win.h]} />
      </mesh>
      {/* mullions */}
      <mesh position={[win.centre[0], win.centre[1], -0.05]} material={mats.iron()}>
        <boxGeometry args={[0.04, win.h, 0.04]} />
      </mesh>
      <mesh position={[win.centre[0], win.centre[1] + 0.1, -0.05]} material={mats.iron()}>
        <boxGeometry args={[win.w, 0.04, 0.04]} />
      </mesh>
      <RoundedBox args={[12.2, 0.2, 0.45]} radius={0.03} position={[0, 4.1, 0.05]} material={mats.plasterShade()} castShadow />
      <RoundedBox args={[win.w + 0.3, 0.1, 0.3]} radius={0.02} position={[win.centre[0], win.centre[1] - win.h / 2 - 0.02, 0.12]} material={mats.plaster()} />
    </group>
  );
}

export function ClockTower() {
  const { base, clockFace, heightM } = d.set.tower;
  return (
    <group position={[base[0], 0, base[2]]}>
      <RoundedBox args={[1.6, heightM, 1.6]} radius={0.04} position={[0, heightM / 2, 0]} castShadow receiveShadow material={mats.stone()} />
      <mesh position={[0, heightM + 0.45, 0]} rotation={[0, Math.PI / 4, 0]} castShadow material={mats.roof()}>
        <coneGeometry args={[1.25, 0.9, 4]} />
      </mesh>
      <mesh position={[0, clockFace[1], 0.81]} material={mats.windowGlow()}>
        <circleGeometry args={[0.5, 40]} />
      </mesh>
      <mesh position={[0, clockFace[1], 0.82]} rotation={[0, 0, 0.6]} material={mats.iron()}>
        <boxGeometry args={[0.04, 0.38, 0.01]} />
      </mesh>
      <mesh position={[0.1, clockFace[1] + 0.06, 0.825]} rotation={[0, 0, -1.1]} material={mats.iron()}>
        <boxGeometry args={[0.04, 0.26, 0.01]} />
      </mesh>
    </group>
  );
}

export function Backdrop({
  z = d.set.backdropZ,
  width = 18,
  height = 8,
  colors: palette = [tokens.stageWall, tokens.backdropTop, tokens.stageVoid],
}: {
  z?: number;
  width?: number;
  height?: number;
  colors?: readonly [string, string, string];
}) {
  const geo = useMemo(() => {
    const g = new PlaneGeometry(width, height, 1, 16);
    const pos = g.getAttribute("position");
    const colors: number[] = [];
    const bottom = new Color(palette[0]);
    const mid = new Color(palette[1]);
    const top = new Color(palette[2]);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const y = (pos.getY(i) + height / 2) / height;
      if (y < 0.5) c.copy(bottom).lerp(mid, y / 0.5);
      else c.copy(mid).lerp(top, (y - 0.5) / 0.5);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return g;
  }, [width, height, palette]);
  return (
    <mesh geometry={geo} position={[0, height / 2, z]}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  );
}

export function Lantern({ base = d.set.lantern.base, headY = d.set.lantern.head[1] }: { base?: V3; headY?: number }) {
  const [x, , z] = base;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.08, 0]} castShadow material={mats.iron()}>
        <cylinderGeometry args={[0.1, 0.16, 0.16, 20]} />
      </mesh>
      <mesh position={[0, (headY - 0.2) / 2, 0]} castShadow material={mats.iron()}>
        <cylinderGeometry args={[0.035, 0.045, headY - 0.2, 14]} />
      </mesh>
      <mesh position={[0, headY - 0.2, 0]} material={mats.brass()}>
        <torusGeometry args={[0.06, 0.015, 8, 20]} />
      </mesh>
      <group position={[0, headY, 0]}>
        <mesh material={mats.lampGlow()}>
          <boxGeometry args={[0.2, 0.28, 0.2]} />
        </mesh>
        {[
          [0.11, 0.11],
          [-0.11, 0.11],
          [0.11, -0.11],
          [-0.11, -0.11],
        ].map(([px, pz]) => (
          <mesh key={`${px}${pz}`} position={[px, 0, pz]} material={mats.iron()} castShadow>
            <boxGeometry args={[0.025, 0.3, 0.025]} />
          </mesh>
        ))}
        <mesh position={[0, 0.22, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.iron()} castShadow>
          <coneGeometry args={[0.2, 0.16, 4]} />
        </mesh>
        <mesh position={[0, -0.16, 0]} material={mats.iron()}>
          <boxGeometry args={[0.26, 0.03, 0.26]} />
        </mesh>
      </group>
    </group>
  );
}

/** Ruler strip along the rail: zero at Bram's plane, so it reads the same number as the dolly slider. */
export function RailRuler() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const x = active.rail.x + 0.55;
    const zBram = active.characters.primary.anchor[2];
    for (let k = 0; k <= 87; k++) {
      const z = zBram + k * 0.1;
      const len = k % 10 === 0 ? 0.22 : k % 5 === 0 ? 0.13 : 0.07;
      pts.push(x, 0.012, z, x + len, 0.012, z);
    }
    pts.push(x, 0.012, zBram, x, 0.012, zBram + 8.7);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={tokens.ink2} transparent opacity={0.85} />
    </lineSegments>
  );
}

export function FloorGrid() {
  const geo = useMemo(() => {
    const [PX0, PX1] = active.set.plate.x;
    const [PZ0, PZ1] = active.set.plate.z;
    const pts: number[] = [];
    for (let x = Math.ceil(PX0); x <= PX1; x++) pts.push(x, 0.004, PZ0, x, 0.004, PZ1);
    for (let z = Math.ceil(PZ0); z <= PZ1; z++) pts.push(PX0, 0.004, z, PX1, 0.004, z);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={tokens.ink3} transparent opacity={0.35} />
    </lineSegments>
  );
}

/** Studio gear the film camera never sees (placed outside the 18 mm frustum at the default position). */
export function StudioDressing() {
  return (
    <group>
      {/* C-stand with flag */}
      <group position={[-2.6, 0, -1.3]}>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.25, 0.05, Math.sin(a) * 0.25]} rotation={[0, -a, Math.PI / 2 - 0.15]} material={mats.aluminum()}>
            <cylinderGeometry args={[0.012, 0.012, 0.55, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 1.0, 0]} material={mats.aluminum()}>
          <cylinderGeometry args={[0.016, 0.016, 2.0, 8]} />
        </mesh>
        <mesh position={[0.3, 1.9, 0.1]} rotation={[0, 0.4, 0]} material={mats.rubber()}>
          <boxGeometry args={[0.6, 0.9, 0.01]} />
        </mesh>
      </group>
      {/* apple boxes */}
      <RoundedBox args={[0.5, 0.2, 0.3]} radius={0.01} position={[3.2, 0.1, -2.4]} material={mats.wood()} />
      <RoundedBox args={[0.5, 0.1, 0.3]} radius={0.01} position={[3.2, 0.25, -2.4]} material={mats.wood()} />
      {/* key lamp on a stand */}
      <group position={[-3.2, 0, -0.8]}>
        <mesh position={[0, 1.5, 0]} material={mats.aluminum()}>
          <cylinderGeometry args={[0.018, 0.02, 3.0, 8]} />
        </mesh>
        <mesh position={[0, 3.05, 0.05]} rotation={[0.5, 0.6, 0]} material={mats.gunmetal()}>
          <cylinderGeometry args={[0.16, 0.13, 0.28, 16]} />
        </mesh>
      </group>
    </group>
  );
}

export function TechSet() {
  return (
    <TechLayer>
      <FloorGrid />
      <RailRuler />
      <StudioDressing />
    </TechLayer>
  );
}

export function WorldSet({ doorRef }: { doorRef?: React.Ref<import("three").Group> }) {
  return (
    <group>
      <StagePlate />
      <Backdrop />
      <ClockTower />
      <BackWall />
      <DoorwayFlat doorRef={doorRef} />
      <Lantern />
      <mesh position={[0, 0.001, -6.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 5]} />
        <meshStandardMaterial color="#2a2622" roughness={0.95} side={DoubleSide} />
      </mesh>
    </group>
  );
}
