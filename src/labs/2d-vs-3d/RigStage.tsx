'use client';

import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CanvasTexture, Group, PCFShadowMap, PerspectiveCamera, SkeletonHelper, type Mesh, type MeshBasicMaterial, type Object3D } from 'three';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { runUpdaters } from '@/renderer/runtime/frameBus';
import { RiggedCharacter } from '@/scene/characters/RiggedCharacter';
import { PIP_BONES, PIP_URL } from '@/scene/characters/Characters';
import type { FaceData } from '@/scene/characters/faceRig';
import pipFace from '@/scene/characters/faces/pip.json';
import { twoDThreeDConfig as cfg } from '@/labs/lens-and-framing/config';
import { DURATION, hopClip, samplePose, shownTime, squashScale, type Cadence } from './move';

const CLIP = hopClip();
const CENTER_Y = cfg.frameM / 2 - cfg.floorM;
const ROOT = [0, 0, 0] as const;

export interface RigStageProps { t: number; turn: number; cadence: Cadence; playing: boolean; rig: boolean }

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <p className="td-fallback">The 3D pane could not load. Check WebGL and reload.</p> : this.props.children; }
}

function World({ t, turn, cadence, playing, rig }: RigStageProps) {
  const cam = useRef<PerspectiveCamera | null>(null);
  const wrap = useRef<Group>(null);
  const blob = useRef<Mesh>(null);
  /** A soft contact shadow straight under Pip, so the hop height reads like the 2D panes' floor shadow. */
  const blobMap = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!, grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }, []);
  const helper = useRef<SkeletonHelper | null>(null);
  const frame = useRef(0);
  return <>
    <FrameOrchestrator renderFrame={(state, delta) => {
      const { gl, scene, size } = state;
      const camera = (cam.current ??= new PerspectiveCamera((2 * Math.atan(cfg.frameM / 2 / cfg.cameraDistM) * 180) / Math.PI, 1, 0.1, 40));
      const a = (turn * Math.PI) / 180;
      camera.position.set(Math.sin(a) * cfg.cameraDistM, CENTER_Y, Math.cos(a) * cfg.cameraDistM);
      camera.lookAt(0, CENTER_Y, 0);
      camera.aspect = size.width / Math.max(1, size.height);
      camera.updateProjectionMatrix();
      const shown = shownTime(t, cadence);
      const pose = samplePose(shown), sq = squashScale(pose.squash);
      // Scale about the feet, as the drawn pane does.
      if (wrap.current) { wrap.current.scale.set(sq.xz, sq.y, sq.xz); wrap.current.position.y = pose.y * (1 - sq.y); }
      if (blob.current) { const k = Math.max(0.45, 1 - pose.y * 1.6); blob.current.scale.setScalar(k); (blob.current.material as MeshBasicMaterial).opacity = 0.6 * k; }
      runUpdaters({ t: shown, dt: Math.min(delta, 1 / 30), frameId: ++frame.current, playing, reducedMotion: false });
      if (rig && !helper.current) {
        const model = scene.getObjectByName('Pip') as Object3D | undefined;
        if (model) {
          const h = new SkeletonHelper(model);
          const m = h.material as { depthTest: boolean; color?: { set: (c: string) => void }; vertexColors?: boolean; transparent: boolean; opacity: number };
          m.depthTest = false; m.vertexColors = false; m.color?.set('#ff6b5e'); m.transparent = true; m.opacity = 0.95;
          h.renderOrder = 10;
          scene.add(h);
          helper.current = h;
        }
      }
      if (helper.current) helper.current.visible = rig;
      gl.setViewport(0, 0, size.width, size.height);
      gl.shadowMap.needsUpdate = true;
      gl.render(scene, camera);
    }} />
    <color attach="background" args={['#161d28']} />
    <hemisphereLight args={['#dfe8ff', '#3a3228', 1.1]} />
    <directionalLight position={[0.9, 5.2, 1.8]} intensity={2.6} color="#fff1dc" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0008} shadow-normalBias={0.03}
      shadow-camera-left={-1.5} shadow-camera-right={1.5} shadow-camera-top={2} shadow-camera-bottom={-1} shadow-camera-near={1} shadow-camera-far={12} />
    <spotLight position={[-2.5, 2.6, -2.8]} angle={0.7} penumbra={0.8} intensity={14} color="#bcd4ff" distance={10} decay={2} />
    {/* A round stage, not an endless floor: its far edge sits below the boots, so a hop reads as leaving it. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.2, 64]} /><meshStandardMaterial color="#334055" roughness={0.95} /></mesh>
    <mesh ref={blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={1}><circleGeometry args={[0.3, 40]} /><meshBasicMaterial map={blobMap} transparent depthWrite={false} opacity={0.6} color="#000" /></mesh>
    <group ref={wrap}>
      <Suspense fallback={<Html center><span className="td-loading">Loading Pip…</span></Html>}>
        <RiggedCharacter name="Pip" url={PIP_URL} clip={CLIP} root={ROOT} restYawDeg={0} heightM={1.12} mapping={PIP_BONES} face={pipFace as FaceData} loopS={DURATION} />
      </Suspense>
    </group>
  </>;
}

/** The 3D pane: Pip's real rig plays the same move; the camera orbits for free. */
export function RigStage(props: RigStageProps) {
  return <div className="td-canvas" data-testid="rig-canvas">
    <Boundary>
      <Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 1.75]} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} gl={{ antialias: true }} fallback={<p className="td-fallback">WebGL is required for the 3D pane.</p>}>
        <World {...props} />
      </Canvas>
    </Boundary>
  </div>;
}
