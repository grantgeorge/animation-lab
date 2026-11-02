'use client';
import { forwardRef, useMemo } from 'react';
import { MeshStandardMaterial, type Group } from 'three';
import { Ball, Block, Capsule, Lathe } from '@/scene/characters/shapes';
import { WAIST, buildFigure, radiusAt, youthCues, type Design } from './design';

const DEG = Math.PI / 180;

/** Lab-local materials: the shared satin() cache is never touched. */
let palette: Record<'skin' | 'shirt' | 'trousers' | 'shoes' | 'hair' | 'white' | 'pupil' | 'blush' | 'shine', MeshStandardMaterial> | null = null;
function materials() {
  palette ??= {
    skin: new MeshStandardMaterial({ color: '#F1C6A4', roughness: 0.6 }),
    shirt: new MeshStandardMaterial({ color: '#D9714A', roughness: 0.72 }),
    trousers: new MeshStandardMaterial({ color: '#33415A', roughness: 0.85 }),
    shoes: new MeshStandardMaterial({ color: '#3B2A20', roughness: 0.5 }),
    hair: new MeshStandardMaterial({ color: '#4A2E22', roughness: 0.8 }),
    white: new MeshStandardMaterial({ color: '#FBFBF6', roughness: 0.3 }),
    pupil: new MeshStandardMaterial({ color: '#17120F', roughness: 0.2 }),
    blush: new MeshStandardMaterial({ color: '#F2A28F', roughness: 0.7 }),
    shine: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1 }),
  };
  return palette;
}

/** A tapered limb segment hanging from its joint, with a ball at the joint so bends stay round. */
function Segment({ length, r0, r1, material }: { length: number; r0: number; r1: number; material: MeshStandardMaterial }) {
  return <>
    <Ball r={r0} material={material} segments={18} />
    <mesh position={[0, -length / 2, 0]} material={material} castShadow receiveShadow><cylinderGeometry args={[r0, r1, length, 20, 1, true]} /></mesh>
  </>;
}

/** The model-sheet figure, rebuilt from the design's proportions. Root is at the feet. */
export const Figure = forwardRef<Group, { design: Design; visible?: boolean }>(function Figure({ design, visible = true }, ref) {
  const f = useMemo(() => buildFigure(design), [design]);
  const m = materials();
  const torsoProfile = useMemo(() => f.torso.profile.map(([r, y]) => [r * f.torso.w, y * f.torso.h] as [number, number]), [f]);
  const headProfile = useMemo(() => f.head.profile.map(([r, y]) => [r * f.head.w, y * f.head.h] as [number, number]), [f]);
  // Trousers: the torso below the waist, a hair wider so the shirt tucks in.
  const hipProfile = useMemo(() => [...f.torso.profile.filter(([, y]) => y < WAIST), [radiusAt(f.torso.profile, WAIST), WAIST] as const].map(([r, y]) => [r * f.torso.w * 1.03, y * f.torso.h] as [number, number]), [f]);
  // Hair: the crown of the head scaled up about the head's centre (so it never touches the skin), tipped back.
  const hairFrom = Math.min(0.88, Math.max(0.6, design.eyeLine + 0.2));
  const hairProfile = useMemo(() => {
    const k = 1.07, cy = 0.5;
    const pts = f.head.profile.filter(([, y]) => y > hairFrom);
    return [[radiusAt(f.head.profile, hairFrom), hairFrom] as const, ...pts].map(([r, y]) => [r * f.head.w * k, (cy + (y - cy) * k) * f.head.h] as [number, number]);
  }, [f, hairFrom]);
  const youth = youthCues(design).youth;
  const face = (yRel: number, x = 0) => Math.sqrt(Math.max(0, (radiusAt(f.head.profile, yRel) * f.head.w) ** 2 - x * x));
  const tri = design.shape[2];
  const e = f.eyes;
  const eyeRel = (e.y - f.head.y) / f.head.h;
  // Nose and mouth sit between the eyes and the chin, near the adult thirds (mouth ~1/5, nose ~1/3 up the head).
  const below = eyeRel - (e.r * 1.05) / f.head.h;
  const mouthRel = Math.max(0.16, Math.min(0.24, below - 0.15));
  const noseRel = Math.max(mouthRel + 0.06, Math.min(below - 0.04, 0.34));
  const mouthR = Math.min(f.head.w * 0.085, (noseRel - mouthRel) * f.head.h * 0.9);
  const hip = f.torso.y;

  return <group ref={ref} visible={visible} position={[0, -f.drop, 0]}>
    {f.legs.map((l, i) => {
      const s = i === 0 ? 1 : -1;
      return <group key={`leg${i}`} position={[l.x * s, l.y, 0]} rotation={[-l.swing * DEG, 0, l.spread * s * DEG, 'ZXY']}>
        <Segment length={l.upper} r0={l.r[0]} r1={l.r[1]} material={m.trousers} />
        <group position={[0, -l.upper, 0]} rotation={[l.bend * DEG, 0, 0]}>
          <Segment length={l.lower} r0={l.r[1]} r1={l.r[2]} material={m.trousers} />
          <group position={[0, -l.lower, 0]} rotation={[(l.swing - l.bend) * DEG, 0, -l.spread * s * DEG * 0.8]}>
            <Block size={[f.foot[2], f.foot[1], f.foot[0]]} radius={Math.min(f.foot[1], f.foot[2]) * 0.45} material={m.shoes} position={[0, 0, f.foot[0] * 0.28]} />
          </group>
        </group>
      </group>;
    })}
    <group position={[0, hip, 0]} rotation={[f.torso.hunch * DEG, 0, f.torso.lean * DEG]}>
      <Lathe profile={torsoProfile} material={m.shirt} scale={[1, 1, 0.8]} segments={40} />
      <Lathe profile={hipProfile} material={m.trousers} scale={[1, 1, 0.8]} segments={40} />
      {f.arms.map((a, i) => {
        const s = i === 0 ? 1 : -1;
        return <group key={`arm${i}`} position={[a.x * s, a.y - hip, 0]} rotation={[-a.swing * DEG, 0, a.spread * s * DEG, 'ZXY']}>
          <Segment length={a.upper} r0={a.r[0]} r1={a.r[1]} material={m.shirt} />
          <group position={[0, -a.upper, 0]} rotation={[-a.bend * DEG, 0, 0]}>
            <Segment length={a.lower} r0={a.r[1]} r1={a.r[2]} material={m.shirt} />
            <Ball r={f.hand} material={m.skin} position={[0, -a.lower - f.hand * 0.6, 0]} scale={[0.92, 1.12, 0.72]} segments={20} />
          </group>
        </group>;
      })}
      <Capsule r={f.neck.r} len={f.neck.h} material={m.skin} position={[0, f.neck.y - hip + f.neck.h * 0.5, 0]} />
      <mesh position={[0, f.torso.h * 0.975, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]} material={m.shirt} castShadow><torusGeometry args={[f.neck.r * 1.12, f.neck.r * 0.42, 10, 28]} /></mesh>
      <group position={[0, f.head.y - hip, 0]} rotation={[f.head.nod * DEG, 0, f.head.tilt * DEG]}>
        <Lathe profile={headProfile} material={m.skin} scale={[1, 1, 0.94]} segments={44} />
        <group position={[0, f.head.h * 0.5, 0]} rotation={[-0.22, 0, 0]}>
          <Lathe profile={hairProfile} material={m.hair} position={[0, -f.head.h * 0.5, 0]} scale={[1, 1, 0.94]} segments={44} />
        </group>
        {[1, -1].map(s => <group key={s} position={[e.x * s, e.y - f.head.y, e.z * 0.94]} scale={[1, 1 - tri * 0.42, 0.72]}>
          <Ball r={e.r} material={m.white} segments={22} />
          <Ball r={e.r * 0.56} material={m.pupil} position={[0, -e.r * 0.05, e.r * 0.62]} segments={16} />
          <Ball r={e.r * 0.16} material={m.shine} position={[e.r * 0.2, e.r * 0.22, e.r * 0.98]} segments={8} />
        </group>)}
        {/* brows: level and friendly on circles; on triangles they thicken, drop and slant down to the nose */}
        {[1, -1].map(s => <Capsule key={`br${s}`} r={Math.max(0.004, e.r * (0.14 + tri * 0.1))} len={e.r * (1.3 + tri * 0.3)} material={m.hair}
          position={[e.x * s, e.y - f.head.y + e.r * (1.55 - tri * 0.75), e.z * 0.94 + e.r * 0.3]} rotation={[0, 0, Math.PI / 2 + s * (tri * 0.62 - 0.08)]} />)}
        <Ball r={Math.max(0.008, f.head.w * 0.055)} material={m.skin} position={[0, noseRel * f.head.h, face(noseRel) * 0.94 + f.head.w * 0.02]} segments={14} />
        {youth > 0.2 && [1, -1].map(s => <Ball key={`b${s}`} r={f.head.w * 0.09 * Math.min(1, youth * 1.4)} material={m.blush} position={[e.x * s * 1.15, (noseRel - 0.02) * f.head.h, face(noseRel, e.x * 1.15) * 0.9]} scale={[1, 0.6, 0.4]} segments={14} />)}
        <mesh position={[0, mouthRel * f.head.h + mouthR * 0.5, face(mouthRel) * 0.94 - 0.002]} rotation={[0.2, 0, Math.PI]} material={m.pupil}>
          <torusGeometry args={[mouthR, Math.max(0.003, mouthR * 0.2), 6, 16, Math.PI * (1 - tri * 0.55)]} />
        </mesh>
      </group>
    </group>
  </group>;
});
