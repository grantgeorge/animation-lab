"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ANTENNA_REST, BODY_HALF_W, BODY_HEIGHT, type Pose, halfWidth } from "../engine";
import { useTiming } from "../store";

export const CRITTER = {
  body: "#FF8A5B",
  belly: "#FFC3A0",
  feet: "#6B2E40",
  dark: "#1A1218",
  brow: "#4A2030",
  cheek: "#FF5E7A",
  tip: "#FFB547",
} as const;

/** Yaw toward the direction of travel so the face reads in three-quarter. */
const YAW = 0.42;
const SEG = 0.1;

/** Bean silhouette: a slightly boxy superellipse, a touch wider at the bottom. */
function beanGeometry() {
  const pts: THREE.Vector2[] = [];
  const n = 40;
  const e = 2 / 2.4;
  for (let i = 0; i <= n; i++) {
    const th = -Math.PI / 2 + (i / n) * Math.PI;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const y = Math.sign(s) * Math.pow(Math.abs(s), e) * (BODY_HEIGHT / 2);
    const r = Math.pow(Math.max(0, c), e) * BODY_HALF_W * (1 - 0.07 * (y / (BODY_HEIGHT / 2)));
    pts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  g.computeVertexNormals();
  return g;
}

let shadowTex: THREE.Texture | null = null;
/** Soft radial contact-shadow texture, generated once. */
export function getShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.45, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();

/** Write a pose into the critter's object hierarchy. Pure function of the pose. */
function applyPose(
  pose: Pose,
  laneX: number,
  r: {
    root: THREE.Group;
    lidL: THREE.Mesh;
    lidR: THREE.Mesh;
    pupilL: THREE.Group;
    pupilR: THREE.Group;
    browL: THREE.Mesh;
    browR: THREE.Mesh;
    smile: THREE.Mesh;
    mouth: THREE.Mesh;
    ant: THREE.Group[];
    shadow: THREE.Mesh;
  },
) {
  const [a, b, c, e] = pose.deform.m;
  const g = pose.deform.girth;
  _m.set(a, b, 0, laneX + pose.cx, c, e, 0, pose.cy, 0, 0, g, 0, 0, 0, 0, 1);
  _r.makeRotationZ(-pose.lean);
  r.root.matrix.multiplyMatrices(_m, _r);
  r.root.matrixWorldNeedsUpdate = true;

  // Eyelids: a hemisphere that swings from tucked-back (open) to covering the eye (closed).
  const lid = -1.05 + pose.blink * 2.6;
  r.lidL.rotation.x = lid;
  r.lidR.rotation.x = lid;
  const px = pose.lookX * 0.04;
  const py = pose.lookY * 0.04;
  r.pupilL.position.set(px, py, 0);
  r.pupilR.position.set(px, py, 0);

  // Brows: raised when falling fast, knitted during the windup.
  const surprise = Math.max(0, pose.mouth);
  const knit = pose.phase === "antic" ? Math.min(1, pose.blink / 0.35) : 0;
  r.browL.position.y = 0.31 + surprise * 0.04 - knit * 0.02;
  r.browR.position.y = r.browL.position.y;
  r.browL.rotation.z = Math.PI / 2 - 0.12 - knit * 0.35 + surprise * 0.15;
  r.browR.rotation.z = Math.PI / 2 + 0.12 + knit * 0.35 - surprise * 0.15;

  const open = pose.mouth > 0.12;
  r.smile.visible = !open;
  r.mouth.visible = open;
  r.mouth.scale.set(0.8 + pose.mouth * 0.2, 0.35 + pose.mouth * 0.9, 0.5);

  const bend = (ANTENNA_REST + pose.antenna) / 3;
  for (const s of r.ant) s.rotation.z = -bend;

  // Contact shadow: tighter and darker on the floor, wider and fainter with height.
  const w = halfWidth(pose.deform) * 2.5 * (1 + pose.y * 0.22);
  r.shadow.position.set(laneX + pose.cx, 0.004, 0.05);
  r.shadow.scale.set(w, w * 0.62, 1);
  (r.shadow.material as THREE.MeshBasicMaterial).opacity = 0.62 / (1 + pose.y * 0.75);
}

export function Critter({ variant, laneX }: { variant: number; laneX: number }) {
  const bean = useMemo(() => beanGeometry(), []);
  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: CRITTER.body,
        roughness: 0.42,
        clearcoat: 0.55,
        clearcoatRoughness: 0.32,
        sheen: 0.5,
        sheenColor: new THREE.Color("#ffd2c2"),
      }),
    [],
  );
  const root = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Mesh>(null);
  const lidR = useRef<THREE.Mesh>(null);
  const pupilL = useRef<THREE.Group>(null);
  const pupilR = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const smile = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const a0 = useRef<THREE.Group>(null);
  const a1 = useRef<THREE.Group>(null);
  const a2 = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const s = useTiming.getState();
    const v = s.variants[variant];
    if (!v || !root.current) return;
    const pose = v.frames[Math.min(s.frame, v.frames.length - 1)];
    applyPose(pose, laneX, {
      root: root.current,
      lidL: lidL.current!,
      lidR: lidR.current!,
      pupilL: pupilL.current!,
      pupilR: pupilR.current!,
      browL: browL.current!,
      browR: browR.current!,
      smile: smile.current!,
      mouth: mouth.current!,
      ant: [a0.current!, a1.current!, a2.current!],
      shadow: shadow.current!,
    });
  });

  const eye = (side: -1 | 1, lid: React.RefObject<THREE.Mesh | null>, pupil: React.RefObject<THREE.Group | null>) => (
    <group position={[side * 0.128, 0.13, 0.33]} rotation={[0, side * 0.18, 0]}>
      <mesh>
        <sphereGeometry args={[0.13, 32, 24]} />
        <meshPhysicalMaterial color="#fbfbff" roughness={0.18} clearcoat={1} />
      </mesh>
      <group ref={pupil}>
        <mesh position={[0, 0, 0.084]}>
          <sphereGeometry args={[0.064, 24, 16]} />
          <meshStandardMaterial color={CRITTER.dark} roughness={0.25} />
        </mesh>
        <mesh position={[0.022, 0.028, 0.136]}>
          <sphereGeometry args={[0.017, 12, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      <mesh ref={lid} material={bodyMat}>
        <sphereGeometry args={[0.138, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );

  return (
    <>
      <group ref={root} matrixAutoUpdate={false}>
        <group rotation={[0, YAW, 0]}>
          <mesh geometry={bean} material={bodyMat} />
          <mesh position={[0, -0.27, 0.28]} scale={[0.23, 0.19, 0.15]}>
            <sphereGeometry args={[1, 32, 24]} />
            <meshPhysicalMaterial color={CRITTER.belly} roughness={0.5} sheen={0.4} />
          </mesh>
          {eye(-1, lidL, pupilL)}
          {eye(1, lidR, pupilR)}
          <mesh ref={browL} position={[-0.14, 0.3, 0.37]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.016, 0.07, 4, 8]} />
            <meshStandardMaterial color={CRITTER.brow} roughness={0.6} />
          </mesh>
          <mesh ref={browR} position={[0.14, 0.3, 0.37]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.016, 0.07, 4, 8]} />
            <meshStandardMaterial color={CRITTER.brow} roughness={0.6} />
          </mesh>
          <mesh ref={smile} position={[0, -0.06, 0.428]} rotation={[0.15, 0, Math.PI]}>
            <torusGeometry args={[0.05, 0.013, 8, 20, Math.PI]} />
            <meshStandardMaterial color={CRITTER.dark} roughness={0.5} />
          </mesh>
          <mesh ref={mouth} position={[0, -0.07, 0.418]} visible={false}>
            <sphereGeometry args={[0.06, 20, 14]} />
            <meshStandardMaterial color="#3a0f1c" roughness={0.6} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.25, 0.0, 0.33]} scale={[1, 0.6, 0.35]}>
              <sphereGeometry args={[0.055, 16, 12]} />
              <meshBasicMaterial color={CRITTER.cheek} transparent opacity={0.45} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.16, -0.475, 0.09]} scale={[1, 0.5, 1.45]}>
              <sphereGeometry args={[0.1, 20, 14]} />
              <meshStandardMaterial color={CRITTER.feet} roughness={0.55} />
            </mesh>
          ))}
          {/* Antenna: three hinged segments so the follow-through reads as a curve. */}
          <group position={[0, BODY_HEIGHT / 2 - 0.02, 0]}>
            <group ref={a0}>
              <mesh position={[0, SEG / 2, 0]}>
                <cylinderGeometry args={[0.014, 0.018, SEG, 8]} />
                <meshStandardMaterial color={CRITTER.brow} roughness={0.5} />
              </mesh>
              <group ref={a1} position={[0, SEG, 0]}>
                <mesh position={[0, SEG / 2, 0]}>
                  <cylinderGeometry args={[0.012, 0.014, SEG, 8]} />
                  <meshStandardMaterial color={CRITTER.brow} roughness={0.5} />
                </mesh>
                <group ref={a2} position={[0, SEG, 0]}>
                  <mesh position={[0, SEG / 2, 0]}>
                    <cylinderGeometry args={[0.01, 0.012, SEG, 8]} />
                    <meshStandardMaterial color={CRITTER.brow} roughness={0.5} />
                  </mesh>
                  <mesh position={[0, SEG + 0.03, 0]}>
                    <sphereGeometry args={[0.056, 20, 14]} />
                    <meshStandardMaterial color={CRITTER.tip} emissive={CRITTER.tip} emissiveIntensity={0.55} roughness={0.3} />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={getShadowTexture()} color="#000000" transparent depthWrite={false} opacity={0.6} />
      </mesh>
    </>
  );
}
