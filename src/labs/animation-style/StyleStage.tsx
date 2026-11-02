'use client';
import { Component, Suspense, createRef, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { DataTexture, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, PCFShadowMap, PerspectiveCamera, RedFormat, type Material, type MeshStandardMaterial, type Scene } from 'three';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { runUpdaters } from '@/renderer/runtime/frameBus';
import { Pip } from '@/scene/characters/Characters';
import { StagePlate, DoorwayFlat, BackWall, ClockTower, Backdrop } from '@/scene/set/Set';
import { StageLighting } from '@/scene/StageLighting';
import { setActiveScene, styleConfig as config } from '@/labs/lens-and-framing/config';
import { doorAngle, startleClip } from './performance';
import { FPS, heldFrame, squashScale, styleTime, wobble, type LookId, type Recipe } from './styles';

export interface StageStyle { id: string; recipe: Recipe }
export interface StyleStageProps { styles: StageStyle[]; look: LookId; t: number; playing: boolean }

const DEG = Math.PI / 180;
const clipKey = (r: Recipe) => [r.exaggeration, r.anticipation, r.followThrough].map(v => v.toFixed(2)).join(':');

/** Derived look materials, made from (never written back to) the scene's own materials, which other routes share. */
class LookCache {
  private cache = new Map<string, Material>();
  private toonRamp: DataTexture;
  constructor() {
    this.toonRamp = new DataTexture(new Uint8Array([120, 255]), 2, 1, RedFormat);
    this.toonRamp.minFilter = this.toonRamp.magFilter = NearestFilter; this.toonRamp.needsUpdate = true;
  }
  get(src: Material, look: LookId): Material {
    if (look === 'modelled') return src;
    const key = `${look}:${src.uuid}`;
    let out = this.cache.get(key);
    if (!out) {
      const s = src as MeshStandardMaterial;
      const shared = { color: s.color?.clone(), map: s.map ?? null, transparent: s.transparent, opacity: s.opacity, side: s.side };
      out = look === 'toon'
        ? new MeshToonMaterial({ ...shared, gradientMap: this.toonRamp, emissive: s.emissive?.clone(), emissiveIntensity: s.emissiveIntensity ?? 1, emissiveMap: s.emissiveMap ?? null })
        : new MeshBasicMaterial(shared);
      this.cache.set(key, out);
    }
    return out;
  }
  dispose() { for (const m of this.cache.values()) m.dispose(); this.cache.clear(); this.toonRamp.dispose(); }
}

/** Remembers each mesh's own material so looks can be swapped and restored. */
class Restyler {
  private originals = new Map<Mesh, Material | Material[]>();
  constructor(private looks: LookCache) {}
  apply(scene: Scene, look: LookId) {
    scene.traverse(o => {
      const mesh = o as Mesh; if (!mesh.isMesh) return;
      if (!this.originals.has(mesh)) this.originals.set(mesh, mesh.material);
      const src = this.originals.get(mesh)!;
      mesh.material = Array.isArray(src) ? src.map(m => this.looks.get(m, look)) : this.looks.get(src, look);
    });
  }
  restore() { for (const [mesh, m] of this.originals) mesh.material = m; this.originals.clear(); this.looks.dispose(); }
}

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true }; } render() { return this.state.error ? <div className="as-fallback">The 3D stage could not load. Check WebGL and reload.</div> : this.props.children; } }

function World({ styles, look, t, playing }: StyleStageProps) {
  const [camera] = useState(() => { const c = new PerspectiveCamera(30, 16 / 9, .05, 80); c.position.set(...config.camera); c.lookAt(...config.target); c.filmGauge = 36; c.setFocalLength(config.focal); return c; });
  const door = useRef<Group>(null);
  const wraps = useMemo(() => styles.map(() => createRef<Group>()), [styles]);
  const clips = styles.map(s => clipFor(s.recipe));
  const [restyler] = useState(() => new Restyler(new LookCache()));
  const count = useRef(0);
  useEffect(() => () => restyler.restore(), [restyler]);
  return <>
    <FrameOrchestrator renderFrame={(state, delta) => {
      const { gl, scene, size } = state;
      restyler.apply(scene, look);
      const grid = styles.length > 1;
      const cols = grid ? 2 : 1, gap = grid ? 2 : 0;
      const w = (size.width - gap * (cols - 1)) / cols, h = (size.height - gap * (cols - 1)) / cols;
      gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height); gl.setClearColor('#0b0e12'); gl.clear();
      gl.setScissorTest(true);
      styles.forEach((s, i) => {
        const r = s.recipe;
        wraps.forEach((ref, j) => { if (ref.current) ref.current.visible = j === i; });
        const wrap = wraps[i].current;
        if (wrap) {
          const sq = squashScale(t, r), wb = wobble(t, r);
          wrap.scale.set(sq.xz, sq.y, sq.xz);
          wrap.position.set(config.mark[0] + wb.x, config.mark[1], config.mark[2] + wb.z);
          wrap.rotation.y = wb.yaw * DEG;
        }
        if (door.current) door.current.rotation.y = doorAngle(heldFrame(t, r.cadence) / FPS) * DEG;
        runUpdaters({ t: styleTime(t, r), dt: Math.min(delta, 1 / 30), frameId: ++count.current, playing, reducedMotion: false });
        const x = (i % cols) * (w + gap), y = (grid ? (i < 2 ? h + gap : 0) : 0);
        gl.setViewport(x, y, w, h); gl.setScissor(x, y, w, h);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, camera);
      });
      gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height);
    }} />
    <StageLighting shadowMap={2048} /><StagePlate /><Backdrop /><ClockTower /><BackWall /><DoorwayFlat doorRef={door} />
    {styles.map((s, i) => <group key={s.id} ref={wraps[i] as RefObject<Group>} position={[...config.mark]}><Pip root={[0, 0, 0]} clip={clips[i]} restYawDeg={0} /></group>)}
  </>;
}

const clipCache = new Map<string, ReturnType<typeof startleClip>>();
function clipFor(r: Recipe) {
  const key = clipKey(r);
  let c = clipCache.get(key);
  if (!c) { c = startleClip(r); clipCache.set(key, c); if (clipCache.size > 64) clipCache.delete(clipCache.keys().next().value!); }
  return c;
}

export function StyleStage(props: StyleStageProps) {
  useState(() => { setActiveScene('doorway'); return true; });
  return <div className="as-stage" data-testid="style-stage" data-look={props.look} data-styles={props.styles.map(s => s.id).join(',')}>
    <Boundary><Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} gl={{ antialias: true }} fallback={<div className="as-fallback">WebGL is required for the 3D stage.</div>}>
      <Suspense fallback={<Html center><span className="as-loading">Loading Pip…</span></Html>}><World {...props} /></Suspense>
    </Canvas></Boundary>
  </div>;
}
