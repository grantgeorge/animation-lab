'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PCFShadowMap, type Material, type WebGLRenderer, type Scene } from 'three';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { runUpdaters } from '@/renderer/runtime/frameBus';
import { Bram, Pip } from '@/scene/characters/Characters';
import { StagePlate, DoorwayFlat, BackWall, ClockTower, Backdrop } from '@/scene/set/Set';
import { StageLighting } from '@/scene/StageLighting';
import { blockingConfig as config, setActiveScene } from '@/labs/lens-and-framing/config';
import { clipFor } from '@/scene/animation/performances';
import type { Clip } from '@/scene/animation/dsl';
import { configureBlockingCamera, type Facing } from './blockingMath';
import type { Mark } from './engine';

export type StageView = 'Camera' | 'Set';
export interface BlockingStageProps { bram: Mark; pip: Mark; yaw: { bram: number; pip: number }; facing: Facing; angle: number; focal: number; t: number; playing: boolean; silhouette: boolean; view: StageView }

/**
 * The doorway greeting, pinned to the user's marks (root motion removed). The authored clip turns Bram
 * and Pip from a camera-facing rest toward each other, with Pip on Bram's right, and Bram waves with the
 * hand nearest Pip. Here:
 * - when the bodies already face each other, those body turns are dropped;
 * - when Pip stands on the other side, the turns are mirrored;
 * - Bram's wave moves to whichever arm keeps the hand clear of his head in the film camera: the one
 *   nearest Pip when he faces the lens, and the downstage arm when he plays to Pip in profile. Pip's
 *   authored wave already satisfies both when he is on the right, so his arms swap only when he isn't.
 */
const clips = new Map<string, Clip>();
const TURN = /^(head|torso|pelvis|foot[LR])$/;
const ARM = /^(upperArm|forearm|hand|shoulder)([LR])$/;
const flip = (t: Clip['tracks'][number]) => ({ ...t, keys: t.keys.map(([time, v, ease]) => [time, -v, ease] as const) });
function greeting(id: 'bram' | 'pip', facing: Facing, pipLeft: boolean): Clip {
  const key = `${id}:${facing}:${pipLeft}`;
  const hit = clips.get(key);
  if (hit) return hit;
  const clip = clipFor('doorway', id);
  const yawish = (ch: string) => ch === 'ry' || ch === 'rz';
  const swapArms = id === 'bram' ? (facing === 'front' ? pipLeft : !pipLeft) : pipLeft;
  const tracks = clip.tracks
    .filter(t => t.part !== 'root' && !(facing !== 'front' && TURN.test(t.part) && yawish(t.ch)))
    .map(t => (pipLeft && TURN.test(t.part) && yawish(t.ch) ? flip(t) : t))
    .map(t => {
      const arm = swapArms && ARM.exec(t.part);
      if (!arm) return t;
      const moved = { ...t, part: arm[1] + (arm[2] === 'L' ? 'R' : 'L') };
      return yawish(t.ch) ? flip(moved) : moved;
    });
  const next = { ...clip, tracks };
  clips.set(key, next);
  return next;
}

class StageBoundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true }; } render() { return this.state.error ? <div className="bk-fallback"><h2>The 3D stage could not load.</h2><p>Check WebGL and reload to retry. The floor plan and its readings still work.</p></div> : this.props.children; } }
function renderCamera(gl: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, aspect: number) { camera.aspect = aspect; camera.updateProjectionMatrix(); gl.render(scene, camera); }

/** Field-of-view lines for the filming-camera prop: four rays and the frame rectangle, `depth` metres out. */
function frustum(focal: number, depth = 1.6) {
  const w = depth * 18 / focal, h = w * 9 / 16;
  const c = [[-w, -h], [w, -h], [w, h], [-w, h]];
  const pts: number[] = [];
  c.forEach(([x, y], i) => { const [nx, ny] = c[(i + 1) % 4]; pts.push(0, 0, 0, x, y, -depth, x, y, -depth, nx, ny, -depth); });
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pts, 3)); return g;
}

/** The filming camera as a prop, seen only from the Set view (layer 1). */
function CameraProp({ rig, focal }: { rig: React.RefObject<Group | null>; focal: number }) {
  const lines = useMemo(() => frustum(focal), [focal]);
  useEffect(() => () => lines.dispose(), [lines]);
  useEffect(() => { rig.current?.traverse(o => o.layers.set(1)); });
  return <group ref={rig}>
    <mesh position={[0, 0, .2]}><boxGeometry args={[.26, .22, .4]} /><meshBasicMaterial color="#7fc4d6" /></mesh>
    <mesh position={[0, 0, -.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.07, .09, .14, 24]} /><meshBasicMaterial color="#2b4f59" /></mesh>
    <lineSegments geometry={lines}><lineBasicMaterial color="#7fc4d6" transparent opacity={.7} /></lineSegments>
  </group>;
}

function World(props: BlockingStageProps) {
  const { bram, pip, yaw, facing, view } = props;
  const actors = useRef<Group>(null); const rig = useRef<Group>(null); const count = useRef(0);
  const [cameras] = useState(() => { const shot = new PerspectiveCamera(40, 16 / 9, .05, 80); configureBlockingCamera(shot, props.angle, props.focal); const studio = new PerspectiveCamera(42, 16 / 9, .05, 80); studio.position.set(...config.studio); studio.lookAt(...config.studioTarget); studio.layers.enable(1); return { shot, studio }; });
  const [black] = useState(() => new MeshBasicMaterial({ color: '#06080b' }));
  const originals = useMemo(() => new Map<Mesh, Material | Material[]>(), []);
  const set = useThree(s => s.set);
  useEffect(() => { set({ camera: view === 'Camera' ? cameras.shot : cameras.studio }); }, [set, view, cameras]);
  useEffect(() => () => { for (const [mesh, material] of originals) mesh.material = material; black.dispose(); }, [black, originals]);
  // Authored turns assume Pip is to Bram's right (+x). Mirror them when he isn't.
  const pipLeft = pip.x < bram.x;
  return <>
    <FrameOrchestrator renderFrame={(state, delta) => {
      configureBlockingCamera(cameras.shot, props.angle, props.focal);
      rig.current?.position.copy(cameras.shot.position); rig.current?.quaternion.copy(cameras.shot.quaternion);
      runUpdaters({ t: props.t, dt: Math.min(delta, 1 / 30), frameId: ++count.current, playing: props.playing, reducedMotion: false });
      actors.current?.traverse(object => { const mesh = object as Mesh; if (!mesh.isMesh) return; if (!originals.has(mesh)) originals.set(mesh, mesh.material); mesh.material = props.silhouette ? black : originals.get(mesh)!; });
      const { gl, scene, size } = state; gl.shadowMap.needsUpdate = true; gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height); gl.setClearColor('#0d1116'); gl.clear();
      renderCamera(gl, scene, view === 'Camera' ? cameras.shot : cameras.studio, size.width / size.height);
    }} />
    <StageLighting shadowMap={2048} /><StagePlate /><Backdrop /><ClockTower /><BackWall /><DoorwayFlat />
    <group ref={actors}>
      <Bram root={[bram.x, 0, bram.z]} clip={greeting('bram', facing, pipLeft)} restYawDeg={yaw.bram} />
      <Pip root={[pip.x, 0, pip.z]} clip={greeting('pip', facing, pipLeft)} restYawDeg={yaw.pip} />
    </group>
    {[bram, pip].map((mark, i) => <mesh key={i} onUpdate={mesh => mesh.layers.set(1)} position={[mark.x, .015, mark.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[config.actorRadius, config.actorRadius + .035, 64]} /><meshBasicMaterial color={i ? '#e3c76d' : '#d08a70'} /></mesh>)}
    <CameraProp rig={rig} focal={props.focal} />
    <OrbitControls camera={cameras.studio} enabled={view === 'Set'} target={config.studioTarget} minDistance={3} maxDistance={16} maxPolarAngle={Math.PI / 2 - .05} enablePan={false} />
  </>;
}

export function BlockingStage(props: BlockingStageProps) {
  useState(() => { setActiveScene('doorway'); return true; });
  return <div className="bk-stage" data-testid="blocking-stage" data-view={props.view} data-angle={props.angle} data-facing={props.facing}>
    <StageBoundary><Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} gl={{ antialias: true }} camera={{ position: [0, 2, 4], fov: 40 }} fallback={<div className="bk-fallback">WebGL is required for the 3D stage.</div>}><Suspense fallback={<Html center><span className="bk-loading">Loading the cast…</span></Html>}><World {...props} /></Suspense></Canvas></StageBoundary>
  </div>;
}
