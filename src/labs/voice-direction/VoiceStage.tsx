'use client';
import { Component, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PCFShadowMap, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { runUpdaters } from '@/renderer/runtime/frameBus';
import { BRAM_BONES, BRAM_URL, PIP_BONES, PIP_URL } from '@/scene/characters/Characters';
import { RiggedCharacter } from '@/scene/characters/RiggedCharacter';
import type { FaceData } from '@/scene/characters/faceRig';
import bramFace from '@/scene/characters/faces/bram.json';
import pipFace from '@/scene/characters/faces/pip.json';
import { StagePlate, DoorwayFlat, BackWall, ClockTower, Backdrop } from '@/scene/set/Set';
import { StageLighting } from '@/scene/StageLighting';
import { doorwayScene, setActiveScene, voiceConfig as config } from '@/labs/lens-and-framing/config';
import type { Clip } from '@/scene/animation/dsl';
import type { Distance } from './direction';

export interface VoiceStageProps {
  bram: Clip; pip: Clip; distance: Distance; step: number; bramYaw: number; t: number; playing: boolean;
  /** Test and styling hooks. */
  data: Record<string, string>;
}

const H = { bram: doorwayScene.characters.primary.landmarks.capTop, pip: doorwayScene.characters.secondary.landmarks.capTop };
const DEG = Math.PI / 180;

/** Viewports as fractions of the canvas, origin bottom-left (WebGL). Two-shot left, close-ups stacked right. */
export const VIEWPORTS = {
  two: { x: 0, y: 0, w: 0.655, h: 1 },
  bram: { x: 0.661, y: 0.503, w: 0.339, h: 0.497 },
  pip: { x: 0.661, y: 0, w: 0.339, h: 0.497 },
} as const;
type ViewId = keyof typeof VIEWPORTS;

const cam = (focal: number) => { const c = new PerspectiveCamera(40, 1, 0.05, 80); c.filmGauge = 36; c.setFocalLength(focal); return c; };
const tv = new Vector3(), tv2 = new Vector3(), tv3 = new Vector3();

/** Place a close-up camera in front of a head, turned part of the way toward the two-shot camera. */
function aimCloseUp(c: PerspectiveCamera, head: Object3D, facingYaw: number, from: Vector3, o: { distance: number; cheat: number; lift: number }, height: number) {
  head.getWorldPosition(tv);
  tv.y += height * 0.05 + o.lift; // eye line sits above the Head joint
  const facing = tv2.set(Math.sin(facingYaw * DEG), 0, Math.cos(facingYaw * DEG));
  const toCam = tv3.copy(from).sub(tv).setY(0).normalize();
  facing.lerp(toCam, o.cheat).normalize();
  c.position.copy(tv).addScaledVector(facing, o.distance);
  c.position.y += 0.03;
  c.lookAt(tv);
}

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true }; } render() { return this.state.error ? <div className="vd-fallback">The 3D stage could not load. Check WebGL and reload.</div> : this.props.children; } }

function World({ bram, pip, distance, step, bramYaw, t, playing }: Omit<VoiceStageProps, 'data'>) {
  const [cams] = useState(() => ({ two: cam(config.twoShot.focal), bram: cam(config.closeUp.bram.focal), pip: cam(config.closeUp.pip.focal) }));
  const [frame] = useState(() => ({ id: 0, heads: { bram: null as Object3D | null, pip: null as Object3D | null } }));
  const [px, , pz] = config.pip.mark;
  const bramX = px - config.distance[distance] + step;
  const bramRoot = useMemo(() => [bramX, 0, config.bram.z] as const, [bramX]);
  const pipRoot = useMemo(() => [px, 0, pz] as const, [px, pz]);
  return <>
    <FrameOrchestrator renderFrame={(state, delta) => {
      const { gl, scene, size } = state;
      runUpdaters({ t, dt: Math.min(delta, 1 / 30), frameId: ++frame.id, playing, reducedMotion: false });
      const shot = config.twoShot[distance];
      cams.two.position.set(...shot.position); cams.two.lookAt(...shot.target);
      for (const id of ['bram', 'pip'] as const) {
        const head = frame.heads[id]?.parent ? frame.heads[id] : (frame.heads[id] = scene.getObjectByName(id === 'bram' ? 'Bram' : 'Pip')?.getObjectByName('Head') ?? null);
        if (head) aimCloseUp(cams[id], head, id === 'bram' ? bramYaw : config.pip.yawDeg, cams.two.position, config.closeUp[id], H[id]);
      }
      gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height); gl.setClearColor('#0a0d10'); gl.clear();
      gl.setScissorTest(true);
      gl.shadowMap.needsUpdate = true;
      for (const id of Object.keys(VIEWPORTS) as ViewId[]) {
        const v = VIEWPORTS[id];
        const x = Math.round(v.x * size.width), y = Math.round(v.y * size.height), w = Math.round(v.w * size.width), h = Math.round(v.h * size.height);
        gl.setViewport(x, y, w, h); gl.setScissor(x, y, w, h);
        cams[id].aspect = w / Math.max(1, h); cams[id].updateProjectionMatrix();
        gl.render(scene, cams[id]);
        gl.shadowMap.needsUpdate = false;
      }
      gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height);
    }} />
    <StageLighting shadowMap={2048} /><StagePlate /><Backdrop /><ClockTower /><BackWall /><DoorwayFlat />
    <RiggedCharacter name="Bram" url={BRAM_URL} clip={bram} root={bramRoot} restYawDeg={bramYaw} heightM={H.bram} mapping={BRAM_BONES} face={bramFace as FaceData} />
    <RiggedCharacter name="Pip" url={PIP_URL} clip={pip} root={pipRoot} restYawDeg={config.pip.yawDeg} heightM={H.pip} mapping={PIP_BONES} face={pipFace as FaceData} />
  </>;
}

export function VoiceStage({ data, ...props }: VoiceStageProps) {
  useState(() => { setActiveScene('doorway'); return true; });
  return <div className="vd-stage" data-testid="voice-stage" {...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v]))}>
    <Boundary><Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} gl={{ antialias: true }} fallback={<div className="vd-fallback">WebGL is required for the 3D stage.</div>}>
      <Suspense fallback={<Html center><span className="vd-loading">Loading the cast…</span></Html>}><World {...props} /></Suspense>
    </Canvas></Boundary>
    <div className="vd-views" aria-hidden>
      <span className="vd-view vd-view-two">Two-shot</span>
      <span className="vd-view vd-view-bram">Bram · close-up</span>
      <span className="vd-view vd-view-pip">Pip · close-up</span>
    </div>
  </div>;
}
