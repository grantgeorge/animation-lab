'use client';

import { Component, Suspense, createRef, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, PCFShadowMap, PerspectiveCamera } from 'three';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { runUpdaters } from '@/renderer/runtime/frameBus';
import { RiggedCharacter, type BoneMapping } from '@/scene/characters/RiggedCharacter';
import { PIP_BONES, PIP_URL } from '@/scene/characters/Characters';
import { doorwayScene, proceduralConfig as cfg } from '@/labs/lens-and-framing/config';
import type { Clip } from '@/scene/animation/dsl';
import type { MethodId } from './director';

/** Pip's shared bone map plus the feet, which this lab keeps flat in a crouch. */
const MAPPING: Record<string, BoneMapping> = { ...PIP_BONES, footL: { bone: 'LeftFoot' }, footR: { bone: 'RightFoot' } };
const HEIGHT = doorwayScene.characters.secondary.landmarks.capTop;
const YAW = (cfg.yawDeg * Math.PI) / 180;
export const STAGED: readonly MethodId[] = ['key', 'phys', 'proc'];

export interface StageProps {
  clips: Record<'key' | 'phys' | 'proc', Clip>;
  crateM: number;
  t: number;
  playing: boolean;
  /** The DOM cells each method renders into; the canvas sits under all of them. */
  cells: Record<'key' | 'phys' | 'proc', RefObject<HTMLElement | null>>;
}

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <p className="pk-fallback">The 3D stage could not load. Check WebGL and reload.</p> : this.props.children; }
}

function Crate({ heightM }: { heightM: number }) {
  const c = cfg.crate;
  const h = Math.max(0.01, heightM);
  const zc = c.edgeZ - c.depthM / 2;
  const post = 0.045;
  return <group position={[0, 0, zc]}>
    <mesh position={[0, h / 2, 0]} scale={[c.widthM - 0.02, h - 0.02, c.depthM - 0.02]} castShadow receiveShadow>
      <boxGeometry /><meshStandardMaterial color="#9a7550" roughness={0.85} />
    </mesh>
    {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
      <mesh key={`${sx}${sz}`} position={[sx * (c.widthM / 2 - post / 2), h / 2, sz * (c.depthM / 2 - post / 2)]} scale={[post, h, post]} castShadow>
        <boxGeometry /><meshStandardMaterial color="#6f5136" roughness={0.9} />
      </mesh>
    )))}
    {/* the top rim and a mid slat read the height at a glance */}
    <mesh position={[0, h - 0.012, 0]} scale={[c.widthM + 0.01, 0.024, c.depthM + 0.01]} castShadow receiveShadow>
      <boxGeometry /><meshStandardMaterial color="#7a5a3c" roughness={0.85} />
    </mesh>
    <mesh position={[0, h / 2, c.depthM / 2 + 0.002]} scale={[c.widthM - 0.04, Math.min(0.05, h * 0.18), 0.01]}>
      <boxGeometry /><meshStandardMaterial color="#6f5136" roughness={0.9} />
    </mesh>
  </group>;
}

function World({ clips, crateM, t, playing, cells }: StageProps) {
  const [camera] = useState(() => { const c = new PerspectiveCamera(30, 1.6, 0.05, 60); c.filmGauge = 36; c.setFocalLength(cfg.camera.focal); c.position.set(...cfg.camera.pos); c.lookAt(...cfg.camera.target); return c; });
  const wraps = useMemo(() => STAGED.map(() => createRef<Group>()), []);
  const [frame] = useState(() => ({ n: 0 }));
  return <>
    <FrameOrchestrator renderFrame={(state, delta) => {
      const { gl, scene, size } = state;
      const box = gl.domElement.getBoundingClientRect();
      runUpdaters({ t, dt: Math.min(delta, 1 / 30), frameId: ++frame.n, playing, reducedMotion: false });
      gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height); gl.setClearColor('#0f1214'); gl.clear();
      gl.setScissorTest(true);
      STAGED.forEach((id, i) => {
        const el = cells[id as 'key'].current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const w = r.width, h = r.height, x = r.left - box.left, y = size.height - (r.top - box.top) - h;
        if (w < 2 || h < 2) return;
        wraps.forEach((ref, j) => { if (ref.current) ref.current.visible = j === i; });
        gl.setViewport(x, y, w, h); gl.setScissor(x, y, w, h);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, camera);
      });
      gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height);
    }} />
    <color attach="background" args={['#1a2027']} />
    <fog attach="fog" args={['#1a2027', 6, 12]} />
    <hemisphereLight args={['#e3ebf5', '#3b3128', 1.05]} />
    <directionalLight position={[1.6, 4.8, 2.6]} intensity={2.5} color="#fff1df" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0006} shadow-normalBias={0.025}
      shadow-camera-left={-1.6} shadow-camera-right={1.8} shadow-camera-top={2} shadow-camera-bottom={-1.2} shadow-camera-near={1} shadow-camera-far={12} />
    <directionalLight position={[-2.5, 2.2, -2.5]} intensity={1.1} color="#bcd4ff" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[7, 72]} /><meshStandardMaterial color="#2c343d" roughness={0.95} /></mesh>
    <group rotation={[0, YAW, 0]}>
      <Crate heightM={crateM} />
      {/* A chalk mark where the keyframed hop was animated to land. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.65]}><ringGeometry args={[0.07, 0.085, 40]} /><meshBasicMaterial color="#c9c2b0" transparent opacity={0.35} /></mesh>
      {STAGED.map((id, i) => <group key={id} ref={wraps[i] as RefObject<Group>}>
        <Suspense fallback={i === 0 ? <Html center><span className="pk-loading">Loading Pip…</span></Html> : null}>
          <RiggedCharacter name={`Pip-${id}`} url={PIP_URL} clip={clips[id as 'key']} root={[0, 0, 0]} restYawDeg={0} heightM={HEIGHT} mapping={MAPPING} />
        </Suspense>
      </group>)}
    </group>
  </>;
}

export function Stage(props: StageProps) {
  return <div className="pk-canvas" data-testid="pk-canvas">
    <Boundary>
      <Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 1.75]} gl={{ antialias: true }} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} fallback={<p className="pk-fallback">WebGL is required for the 3D panes.</p>}>
        <World {...props} />
      </Canvas>
    </Boundary>
  </div>;
}
