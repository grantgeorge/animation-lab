"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color, MeshStandardMaterial, type Group, type Material, type Mesh, type Object3D } from "three";
import { Segmented } from "@/ui/primitives";
import { tokens } from "@/lib/tokens";
import { doorwayScene as d } from "@/labs/lens-and-framing/config";
import { Bram, Pip } from "@/scene/characters/Characters";
import { clipFor } from "@/scene/animation/performances";
import { satin } from "@/scene/materials";
import { ORDER, registerUpdater, runUpdaters } from "@/renderer/runtime/frameBus";
import { SCENE } from "../content/scene";
import { DemoControls, Transport, type DemoProps } from "./controls";
import { useDemoClock } from "./useDemoClock";

type Mode = "shape" | "controls" | "shaded";
const CONTROL_PARTS = ["head", "neck", "torso", "pelvis", "upperArmL", "upperArmR", "forearmL", "forearmR", "cap", "hat"];
const DEG = Math.PI / 180;

/** Pivot lookup that works for the procedural Part names and Mixamo-style bone names. */
const ALIASES: Record<string, string[]> = {
  head: ["head", "Head", "mixamorigHead"],
  neck: ["neck", "Neck", "mixamorigNeck"],
  torso: ["torso", "Spine01", "Spine1", "mixamorigSpine1"],
  pelvis: ["pelvis", "Hips", "mixamorigHips"],
  upperArmL: ["upperArmL", "LeftArm", "mixamorigLeftArm"],
  upperArmR: ["upperArmR", "RightArm", "mixamorigRightArm"],
  forearmL: ["forearmL", "LeftForeArm", "mixamorigLeftForeArm"],
  forearmR: ["forearmR", "RightForeArm", "mixamorigRightForeArm"],
  cap: ["cap"],
  hat: ["hat"],
};
function findPart(root: Object3D | null | undefined, name: string) {
  if (!root) return undefined;
  for (const n of ALIASES[name] ?? [name]) {
    const o = root.getObjectByName(n);
    if (o) return o;
  }
  return undefined;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function RigDemo({ reducedMotion, note }: DemoProps) {
  const clock = useDemoClock({ autoplay: false, startFrame: 50 });
  const [mode, setMode] = useState<Mode>("controls");
  const [head, setHead] = useState(0);
  const [arm, setArm] = useState(0);
  const [gl] = useState(() => (typeof document === "undefined" ? true : hasWebGL()));
  const [scarfFound, setScarfFound] = useState<boolean | null>(null);
  if (!gl) {
    return (
      <div className="relative aspect-video w-full bg-black" data-testid="rig-fallback">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/history/refs/lab-master.webp" alt="The lab's 3D puppets in the set (still: WebGL is unavailable)" className="absolute inset-0 h-full w-full object-cover" />
        <p className="absolute inset-x-0 bottom-0 bg-black/70 p-3 text-[12px] text-ink-1">WebGL isn&apos;t available here, so this is a still of the lab&apos;s 3D model. The explanation still applies.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="relative aspect-video w-full bg-[#0c111b]" data-testid="rig-stage" data-mode={mode}>
        <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 40, position: [-0.45, 1.45, 0.4], near: 0.05, far: 60 }} frameloop="always">
          <Suspense fallback={null}>
            <RigScene t={clock.t} mode={mode} head={head} arm={arm} note={note} onScarf={setScarfFound} />
          </Suspense>
        </Canvas>
        <span className="mono pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[10.5px] text-ink-1">Simplified demonstration model · the Lens &amp; Framing lab puppets</span>
        {mode === "controls" && (
          <span className="mono pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-[10.5px] text-ink-1">
            <span className="text-distance">●</span> driven by your sliders <span className="ml-2 text-focal">●</span> other controls
          </span>
        )}
      </div>
      <DemoControls>
        <Transport {...clock} />
        <div className="grid gap-3 pt-1 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
          <div className="w-64">
            <Segmented label="Display" value={mode} onChange={setMode} options={[{ value: "shape", label: "Shape", testId: "rig-shape" }, { value: "controls", label: "Controls", testId: "rig-controls" }, { value: "shaded", label: "Shaded", testId: "rig-shaded" }]} />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-ink-1">
            {SCENE.lead.name}&apos;s head turn
            <input type="range" min={-60} max={60} step={1} value={head} onChange={(e) => setHead(Number(e.target.value))} aria-valuetext={`${head} degrees`} className="flex-1 accent-[var(--color-distance)]" data-testid="rig-head" />
            <span className="mono w-10 text-right text-[11px]">{head}°</span>
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ink-1">
            Right arm raise
            <input type="range" min={0} max={150} step={1} value={arm} onChange={(e) => setArm(Number(e.target.value))} aria-valuetext={`${arm} degrees`} className="flex-1 accent-[var(--color-distance)]" data-testid="rig-arm" />
            <span className="mono w-10 text-right text-[11px]">{arm}°</span>
          </label>
        </div>
        {note && scarfFound === false && (
          <p className="rounded-md border border-[rgb(47_111_208/0.5)] bg-[rgb(47_111_208/0.1)] p-2 text-[11.5px] text-ink-1" data-testid="rig-baked-note">
            This model&apos;s scarf is painted into one baked texture, not a separate material, so the note can&apos;t be a one-click material swap here: an artist would repaint the
            texture or split out a scarf material first. The animation and camera still don&apos;t change. How an asset was built decides how a note gets made.
          </p>
        )}
        <p className="text-[11.5px] text-ink-2">
          Your sliders add to the authored animation at this moment; drag the view to orbit the virtual camera.{reducedMotion ? "" : " Press Play to see the performance carry your adjustment."}
        </p>
      </DemoControls>
    </div>
  );
}

function RigScene({ t, mode, head, arm, note, onScarf }: { t: number; mode: Mode; head: number; arm: number; note: boolean; onScarf: (found: boolean) => void }) {
  const bram = useRef<Group>(null);
  const pip = useRef<Group>(null);
  const tRef = useRef(t);
  const ctl = useRef({ head, arm });
  useEffect(() => {
    tRef.current = t;
    ctl.current = { head, arm };
  }, [t, head, arm]);
  const frame = useRef(0);

  // Drive the lab's puppets from our clock (they register on the shared frame bus).
  useFrame((_, dt) => {
    runUpdaters({ t: tRef.current, dt, frameId: frame.current++, playing: false, reducedMotion: false });
  });
  // After the clip pose is applied, add the user's control offsets.
  useEffect(
    () =>
      registerUpdater(() => {
        const h = findPart(bram.current, "head");
        const a = findPart(bram.current, "upperArmR");
        if (h) h.rotation.y += ctl.current.head * DEG;
        if (a) a.rotation.z -= ctl.current.arm * DEG;
      }, ORDER.POSE + 1),
    [],
  );

  // Display modes swap materials on character meshes only, and always restore the shared originals.
  const clay = useMemo(() => new MeshStandardMaterial({ color: "#9aa3ad", roughness: 0.8 }), []);
  const wire = useMemo(() => new MeshStandardMaterial({ color: "#8febff", wireframe: true }), []);
  const blue = useMemo(() => new MeshStandardMaterial({ color: new Color(SCENE.target.to), roughness: 0.9 }), []);
  useEffect(() => {
    const scarfMat = satin(tokens.bramScarf, 0.9);
    const touched: [Mesh, Material | Material[]][] = [];
    const isUnder = (o: Object3D, names: string[]) => {
      const all = names.flatMap((n) => ALIASES[n] ?? [n]);
      for (let p: Object3D | null = o.parent; p; p = p.parent) if (all.includes(p.name)) return true;
      return false;
    };
    for (const root of [bram.current, pip.current]) {
      root?.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        // The director's note: the scarf meshes get their own new material. The coat cuffs share the
        // original scarf material in this model, so they are deliberately left alone.
        const isScarf = note && root === bram.current && m.material === scarfMat && !isUnder(m, ["forearmL", "forearmR"]);
        const next: Material | null = mode === "shape" ? wire : isScarf ? blue : mode === "controls" ? clay : null;
        if (next) {
          touched.push([m, m.material]);
          m.material = next;
        }
      });
    }
    if (note) onScarf(touched.some(([, mat]) => mat === scarfMat));
    return () => touched.forEach(([m, mat]) => (m.material = mat));
  }, [mode, note, clay, wire, blue, onScarf]);

  useEffect(() => () => [clay, wire, blue].forEach((m) => m.dispose()), [clay, wire, blue]);

  const target = d.anchors.both;
  return (
    <>
      <color attach="background" args={["#0c111b"]} />
      <hemisphereLight args={["#e6ecff", "#3a2c22", 1.4]} />
      <directionalLight position={[2.5, 4, 2]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -1]} intensity={0.8} color="#9fc4ff" />
      <pointLight position={d.set.doorway.lamp as unknown as [number, number, number]} intensity={6} color={tokens.lampWarm} distance={6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0, -3.8]} receiveShadow>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color={tokens.stageFloorEdge} roughness={0.95} />
      </mesh>
      <group ref={bram}>
        {/* Pinned to the doorway scene: the history page's media and demos are authored against it. */}
        <Bram root={d.characters.primary.root} clip={clipFor("doorway", "bram")} restYawDeg={-8} />
      </group>
      <group ref={pip}>
        <Pip root={d.characters.secondary.root} clip={clipFor("doorway", "pip")} />
      </group>
      {mode === "controls" && <ControlGizmos roots={[bram, pip]} driven={["head", "upperArmR"]} />}
      <OrbitControls
        makeDefault
        target={[target[0], target[1], target[2]]}
        minAzimuthAngle={-0.9}
        maxAzimuthAngle={0.6}
        minPolarAngle={0.9}
        maxPolarAngle={1.62}
        minDistance={1.6}
        maxDistance={7}
        enablePan={false}
      />
    </>
  );
}

/** Torus handles at each named pivot, tracking the animated parts every frame. */
function ControlGizmos({ roots, driven }: { roots: React.RefObject<Group | null>[]; driven: string[] }) {
  const group = useRef<Group>(null);
  const slots = useMemo(() => roots.flatMap((r, ri) => CONTROL_PARTS.map((name) => ({ ri, name }))), [roots]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    slots.forEach((s, i) => {
      const target = findPart(roots[s.ri].current, s.name);
      const handle = g.children[i];
      if (!handle) return;
      handle.visible = !!target;
      if (target) target.getWorldPosition(handle.position);
    });
  });
  return (
    <group ref={group}>
      {slots.map((s) => {
        const on = s.ri === 0 && driven.includes(s.name);
        return (
          <mesh key={`${s.ri}-${s.name}`} renderOrder={10}>
            <torusGeometry args={[s.ri === 0 ? 0.075 : 0.05, on ? 0.011 : 0.006, 8, 32]} />
            <meshBasicMaterial color={on ? "#ffb547" : "#5fe3ff"} depthTest={false} transparent opacity={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}
