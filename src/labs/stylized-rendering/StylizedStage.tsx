'use client';
import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, MeshNormalMaterial, PCFShadowMap, PerspectiveCamera, Vector2 } from 'three';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { runUpdaters } from '@/renderer/runtime/frameBus';
import { Bram, Pip } from '@/scene/characters/Characters';
import { StagePlate, DoorwayFlat, BackWall, ClockTower, Backdrop, Lantern } from '@/scene/set/Set';
import { StageLighting } from '@/scene/StageLighting';
import { setActiveScene, stylizedConfig as config, doorwayScene } from '@/labs/lens-and-framing/config';
import { FAMILY, LookMaterials, Restyler, type LookParams } from './looks';
import { Passes } from './passes';
import { hullOffsetPerDepth, type Blend, type LookId, type Mismatch, type OutlineMode } from './shading';

export interface StageSettings {
  look: LookId;
  /** Look B for a dissolve or wipe, or null for a single look. */
  b: LookId | null;
  mix: number;
  blend: Blend;
  mismatch: Mismatch;
  cel: { bands: number; edge: number; outline: OutlineMode; outlinePx: number; outlineColor: string };
  clay: { roughness: number };
  halftone: { cellPx: number; angleDeg: number; cmyk: boolean };
  painterly: { brushPx: number };
  playing: boolean;
}

const CAST = 'sr-cast';
const LITE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('quality') === 'low';
const BLACK = new Color('#000000');

/** Per-frame rendering lives in a class: it mutates materials and targets, which React state must never hold. */
class StageRenderer {
  readonly camera: PerspectiveCamera;
  readonly looks = new LookMaterials();
  readonly restyler = new Restyler(this.looks, CAST);
  readonly passes = new Passes(LITE ? 0 : 4);
  readonly normalMat = new MeshNormalMaterial();
  private t: number = config.holdS;
  private frameId = 0;
  private buf = new Vector2();

  constructor() {
    const c = new PerspectiveCamera(30, 16 / 9, doorwayScene.clip.near, doorwayScene.clip.far);
    c.position.set(...config.camera.position); c.lookAt(...config.camera.target);
    c.filmGauge = 36; c.setFocalLength(config.camera.focal);
    this.camera = c;
  }

  private params(s: StageSettings, look: LookId): LookParams {
    const o = s.cel.outline;
    return {
      bands: s.cel.bands, edge: s.cel.edge, floor: config.cel.floor,
      roughness: s.clay.roughness, sheen: config.clay.sheen, wrap: config.clay.wrap, blur: config.clay.blur,
      outlinePx: s.cel.outlinePx, outlineColor: s.cel.outlineColor,
      hull: look === 'cel' && (o === 'hull' || o === 'both'),
    };
  }

  frame(s: StageSettings, state: RootState, delta: number) {
    const { gl, scene, size } = state;
    const dpr = gl.getPixelRatio();
    gl.getDrawingBufferSize(this.buf);
    const W = Math.max(1, this.buf.x), H = Math.max(1, this.buf.y);
    this.passes.setSize(W, H);

    if (s.playing) this.t = (this.t + Math.min(delta, 0.1)) % doorwayScene.timeline.durationS;
    else this.t = config.holdS;
    runUpdaters({ t: this.t, dt: Math.min(delta, 1 / 30), frameId: ++this.frameId, playing: s.playing, reducedMotion: false });

    const cam = this.camera;
    cam.aspect = size.width / Math.max(1, size.height); cam.updateProjectionMatrix();
    this.looks.update(this.params(s, 'cel'), hullOffsetPerDepth(s.cel.outlinePx * dpr, cam.getEffectiveFOV(), H));
    gl.shadowMap.needsUpdate = true;

    const shown: LookId[] = s.b && s.b !== s.look ? [s.look, s.b] : [s.look];
    const bg = scene.background;

    // Consistency demo: a cast mask, so screen-space effects and lines can stop at the characters.
    let mask = null;
    if (s.mismatch !== 'none') {
      this.restyler.apply(scene, 'standard', 'standard', this.params(s, 'standard'), 'mask');
      scene.background = BLACK;
      gl.setRenderTarget(this.passes.mask); gl.setClearColor(BLACK, 1); gl.clear(); gl.render(scene, cam);
      scene.background = bg;
      mask = this.passes.mask.texture;
    }
    // Edge-detected lines read normals and depth from their own pass.
    const edges = (look: LookId) => look === 'cel' && (s.cel.outline === 'edges' || s.cel.outline === 'both');
    if (shown.some(edges)) {
      this.restyler.apply(scene, 'standard', 'standard', this.params(s, 'standard'), 'plain');
      scene.overrideMaterial = this.normalMat; scene.background = BLACK;
      gl.setRenderTarget(this.passes.normal); gl.setClearColor(BLACK, 1); gl.clear(); gl.render(scene, cam);
      scene.overrideMaterial = null; scene.background = bg;
    }

    shown.forEach((look, i) => {
      const fam = FAMILY[look];
      this.restyler.apply(scene, s.mismatch === 'set' ? 'standard' : fam, s.mismatch === 'characters' ? 'standard' : fam, this.params(s, look));
      gl.setRenderTarget(this.passes.scene); gl.clear(); gl.render(scene, cam);
      this.passes.configure({
        mode: look === 'painterly' ? 1 : look === 'halftone' ? 2 : 0,
        edges: edges(look), edgePx: Math.max(1, s.cel.outlinePx * dpr * 0.6), line: s.cel.outlineColor,
        maskMode: s.mismatch === 'characters' ? 1 : s.mismatch === 'set' ? 2 : 0,
        brush: Math.round(s.painterly.brushPx * Math.min(dpr, 1.5)), cell: s.halftone.cellPx * dpr, angle: s.halftone.angleDeg, cmyk: s.halftone.cmyk,
        near: cam.near, far: cam.far,
      }, mask);
      this.passes.usePost();
      gl.setRenderTarget(this.passes.finals[i]); gl.render(this.passes.quadScene, this.passes.quadCam);
    });

    this.passes.usePresent(s.mix, shown.length > 1 ? (s.blend === 'wipe' ? 2 : 1) : 0);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, size.width, size.height);
    gl.render(this.passes.quadScene, this.passes.quadCam);
  }

  dispose() { this.restyler.restore(); this.passes.dispose(); this.normalMat.dispose(); }
}

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true }; } render() { return this.state.error ? <div className="sr-fallback">The 3D stage could not load. Check WebGL and reload.</div> : this.props.children; } }

function World({ settings }: { settings: StageSettings }) {
  const [r] = useState(() => new StageRenderer());
  useEffect(() => () => r.dispose(), [r]);
  return <>
    <FrameOrchestrator renderFrame={(state, delta) => r.frame(settings, state, delta)} />
    <StageLighting shadowMap={LITE ? 1024 : 2048} />
    <StagePlate /><Backdrop /><ClockTower /><BackWall /><DoorwayFlat /><Lantern />
    <group name={CAST}><Bram /><Pip /></group>
  </>;
}

export function StylizedStage({ settings }: { settings: StageSettings }) {
  useState(() => { setActiveScene('doorway'); return true; });
  const s = settings;
  return <div className="sr-stage" data-testid="sr-stage" data-look={s.look} data-b={s.b ?? 'none'} data-mix={s.mix.toFixed(2)} data-blend={s.blend} data-mismatch={s.mismatch}
    data-bands={s.cel.bands} data-outline={s.cel.outline} data-cell={s.halftone.cellPx} data-ink={s.halftone.cmyk ? 'cmyk' : 'mono'}>
    <Boundary><Canvas shadows={{ type: PCFShadowMap }} dpr={LITE ? 1 : [1, 1.75]} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} gl={{ antialias: false }} fallback={<div className="sr-fallback">WebGL is required for the 3D stage.</div>}>
      <Suspense fallback={<Html center><span className="sr-loading">Building the set…</span></Html>}><World settings={settings} /></Suspense>
    </Canvas></Boundary>
  </div>;
}

