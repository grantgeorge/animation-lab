'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { Box3, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PCFShadowMap, PerspectiveCamera, WebGLRenderTarget, type Object3D } from 'three';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { designConfig as config } from '@/labs/lens-and-framing/config';
import { designKey, preset, type Design } from './design';
import { Figure } from './Figure';
import { maskFromRGBA, readSilhouette, type Mask, type SilhouetteReading } from './silhouette';
import { sheetLayout, type SheetBounds } from './sheet';

/** Canvas layout, as fractions of the stage (top-left origin). The DOM labels use the same numbers. */
export const LAYOUT = {
  main: { x: 0, y: 0, w: 0.54, h: 1 },
  sil: { x: 0.54, y: 0, w: 0.46, h: 0.7 },
  lineup: { x: 0.54, y: 0.7, w: 0.46, h: 0.3 },
  /** Lineup figures are drawn this many CSS pixels tall: the "reads at a glance" size. */
  thumbPx: 48,
  /** Lineup slots as fractions of the lineup panel width. */
  slots: [1 / 6, 3 / 6, 5 / 6],
  /** Vertical centre of the lineup strip, as a fraction of the lineup panel from its top. */
  lineupCentre: 0.46,
} as const;
export const TURNAROUND = [{ label: 'Front', yaw: 0 }, { label: '3/4', yaw: -40 }, { label: 'Profile', yaw: -90 }] as const;

const PAPER = '#E9E3D6', DARK = '#121619';
const DEG = Math.PI / 180;

export interface DesignStageProps { design: Design; turntable: boolean; onSilhouette: (r: SilhouetteReading) => void }

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true }; } render() { return this.state.error ? <div className="cd-fallback">The 3D stage could not load. Check WebGL and reload.</div> : this.props.children; } }

/** Renders the model sheet: owns the cameras, the mask target and the cached reference mask. */
class SheetRenderer {
  persp = new PerspectiveCamera(config.camera.fovDeg, 1, 0.1, 40);
  ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  target = new WebGLRenderTarget(config.mask.w, config.mask.h);
  black = new MeshBasicMaterial({ color: '#000000' });
  box = new Box3();
  pixels = new Uint8Array(config.mask.w * config.mask.h * 4);
  key = ''; refKey = ''; ref: Mask | null = null; spin = 0;
  /** Turnaround bounds of the current design and pose (union over the three views), recomputed on change. */
  bounds: SheetBounds & { key: string } = { key: '', minY: 0, maxY: 1, views: [] };
  tilesKey = '';
  constructor() { this.persp.position.set(...config.camera.position); this.persp.lookAt(...config.camera.target); }
  dispose() { this.target.dispose(); this.black.dispose(); }

  /** Fixed frame (mask and lineup): every figure at the same scale, so heights compare. */
  private frameOrtho(aspect: number) {
    const H = config.heightM, o = this.ortho, bottom = config.frame.bottom * H;
    const halfH = ((config.frame.top - config.frame.bottom) * H) / 2;
    o.left = -halfH * aspect; o.right = halfH * aspect; o.top = bottom + 2 * halfH; o.bottom = bottom;
    o.position.set(0, 0, 10); o.lookAt(0, 0, 0); o.updateProjectionMatrix();
  }

  render({ gl, scene, size }: RootState, delta: number, g: { main: Group; pip: Group; bram: Group; floor: Mesh | null }, p: { key: string; pose: string; turntable: boolean; onSilhouette: (r: SilhouetteReading) => void; onTiles: (starts: number[]) => void }) {
    const { main, pip, bram, floor } = g;
    const show = (...on: (Object3D | null)[]) => { for (const o of [main, pip, bram, floor]) if (o) o.visible = on.includes(o); };
    for (const f of [main, pip, bram]) { f.position.x = 0; f.rotation.y = 0; }
    // 1 · Silhouette metrics: a small offscreen mask, only when the design changes.
    if (this.key !== p.key || this.refKey !== p.pose || !this.ref) {
      scene.overrideMaterial = this.black;
      this.frameOrtho(config.mask.w / config.mask.h);
      gl.setRenderTarget(this.target); gl.setClearColor('#ffffff', 1);
      const read = (f: Group) => { show(f); gl.clear(); gl.render(scene, this.ortho); gl.readRenderTargetPixels(this.target, 0, 0, config.mask.w, config.mask.h, this.pixels); return maskFromRGBA(this.pixels, config.mask.w, config.mask.h); };
      if (this.refKey !== p.pose || !this.ref) { this.ref = read(pip); this.refKey = p.pose; }
      p.onSilhouette(readSilhouette(read(main), this.ref));
      this.key = p.key;
      gl.setRenderTarget(null); scene.overrideMaterial = null;
    }
    const W = size.width, Hh = size.height;
    const rect = (r: { x: number; y: number; w: number; h: number }) => ({ x: Math.round(r.x * W), y: Math.round((1 - r.y - r.h) * Hh), w: Math.round(r.w * W), h: Math.round(r.h * Hh) });
    const viewport = (r: { x: number; y: number; w: number; h: number }, color: string) => { gl.setViewport(r.x, r.y, r.w, r.h); gl.setScissor(r.x, r.y, r.w, r.h); gl.setClearColor(color, 1); gl.clear(); };
    gl.setScissorTest(true);
    // 2 · Shaded three-quarter view.
    if (p.turntable) this.spin = (this.spin + Math.min(delta, 0.1) * 24) % 360;
    const m = rect(LAYOUT.main);
    viewport(m, DARK);
    show(main, floor);
    main.rotation.y = (config.camera.turnDeg + this.spin) * DEG;
    this.persp.aspect = m.w / m.h; this.persp.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
    gl.render(scene, this.persp);
    // 3 · Turnaround in solid black: framed to this design's own bounds in this pose, one scale for all three views.
    scene.overrideMaterial = this.black;
    show(main);
    if (this.bounds.key !== p.key) {
      let minY = Infinity, maxY = -Infinity;
      const views = TURNAROUND.map(v => {
        main.rotation.y = v.yaw * DEG; main.updateMatrixWorld(true);
        this.box.setFromObject(main, true);
        minY = Math.min(minY, this.box.min.y); maxY = Math.max(maxY, this.box.max.y);
        return { minX: this.box.min.x, maxX: this.box.max.x };
      });
      this.bounds = { key: p.key, minY, maxY, views };
    }
    const sr = rect(LAYOUT.sil);
    viewport(sr, PAPER);
    const sheet = sheetLayout(this.bounds, sr.w, sr.h);
    const tilesKey = sheet.tiles.map(t => (t.x / W).toFixed(3)).join(',');
    if (tilesKey !== this.tilesKey) { this.tilesKey = tilesKey; p.onTiles(sheet.tiles.map(t => t.x / W)); }
    TURNAROUND.forEach((v, i) => {
      const t = sheet.tiles[i], x = Math.round(sr.x + t.x), w = Math.round(t.w);
      gl.setViewport(x, sr.y, w, sr.h); gl.setScissor(x, sr.y, w, sr.h);
      main.rotation.y = v.yaw * DEG;
      const o = this.ortho, half = w / 2 / sheet.scale;
      o.left = t.cx - half; o.right = t.cx + half; o.bottom = sheet.bottom; o.top = sheet.top;
      o.position.set(0, 0, 10); o.lookAt(0, 0, 0); o.updateProjectionMatrix();
      gl.render(scene, o);
    });
    // 4 · Lineup at thumbnail size: Pip, Bram and this design, all the same height.
    const lr = rect(LAYOUT.lineup);
    viewport(lr, PAPER);
    const stripH = Math.round(LAYOUT.thumbPx * (config.frame.top - config.frame.bottom));
    const sy = Math.round(lr.y + lr.h * (1 - LAYOUT.lineupCentre) - stripH / 2);
    gl.setViewport(lr.x, sy, lr.w, stripH); gl.setScissor(lr.x, Math.max(lr.y, sy), lr.w, Math.min(stripH, lr.h));
    this.frameOrtho(lr.w / stripH);
    const span = this.ortho.right - this.ortho.left;
    [pip, bram, main].forEach((f, i) => { f.position.x = this.ortho.left + LAYOUT.slots[i] * span; f.rotation.y = 0; });
    show(pip, bram, main);
    gl.render(scene, this.ortho);
    scene.overrideMaterial = null;
    main.position.x = 0;
    gl.setScissorTest(false); gl.setViewport(0, 0, W, Hh);
  }
}

function World({ design, turntable, onSilhouette, onTiles }: DesignStageProps & { onTiles: (starts: number[]) => void }) {
  const [sheet] = useState(() => new SheetRenderer());
  const main = useRef<Group>(null), pip = useRef<Group>(null), bram = useRef<Group>(null), floor = useRef<Mesh>(null);
  const pipDesign = useMemo(() => ({ ...preset('pip').design, pose: design.pose }), [design.pose]);
  const bramDesign = useMemo(() => ({ ...preset('bram').design, pose: design.pose }), [design.pose]);
  const key = designKey(design);
  useEffect(() => () => sheet.dispose(), [sheet]);

  return <>
    <FrameOrchestrator renderFrame={(st, delta) => {
      if (main.current && pip.current && bram.current) sheet.render(st, delta, { main: main.current, pip: pip.current, bram: bram.current, floor: floor.current }, { key, pose: design.pose, turntable, onSilhouette, onTiles });
    }} />
    <hemisphereLight args={['#E6EEF5', '#2A2420', 1.05]} />
    <directionalLight position={[-2.6, 4.2, 3.6]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-1.4} shadow-camera-right={1.4} shadow-camera-top={2} shadow-camera-bottom={-0.4} shadow-bias={-0.0004} />
    <directionalLight position={[3, 2.6, -3]} intensity={1.6} color="#FFD8B0" />
    <directionalLight position={[2.5, 1.2, 3]} intensity={0.45} color="#BFD4FF" />
    <mesh ref={floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.25, 64]} /><meshStandardMaterial color="#1D2328" roughness={0.95} /></mesh>
    <Figure ref={main} design={design} />
    <Figure ref={pip} design={pipDesign} visible={false} />
    <Figure ref={bram} design={bramDesign} visible={false} />
  </>;
}

export function DesignStage(props: DesignStageProps & { reading: SilhouetteReading | null }) {
  const { reading, ...rest } = props;
  // Where each turnaround tile starts, as a share of the stage width (from the renderer, which sizes them).
  const [tiles, setTiles] = useState<number[]>([0, LAYOUT.sil.w / 3, (2 * LAYOUT.sil.w) / 3]);
  return <div className="cd-stage" data-testid="design-stage" data-pose={props.design.pose}
    data-negative={reading?.negative.toFixed(3) ?? ''} data-solidity={reading?.solidity.toFixed(3) ?? ''} data-distinct={reading?.distinct.toFixed(3) ?? ''}>
    <Boundary><Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 2]} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} gl={{ antialias: true, preserveDrawingBuffer: false }} fallback={<div className="cd-fallback">WebGL is required for the 3D stage.</div>}>
      <Suspense fallback={null}><World {...rest} onTiles={setTiles} /></Suspense>
    </Canvas></Boundary>
    <div className="cd-labels" aria-hidden>
      <span className="cd-tag" style={{ left: '1.2%', top: '2.2%' }}>Shaded · 3/4 view</span>
      {TURNAROUND.map((v, i) => <span key={v.label} className="cd-tag cd-tag-paper" style={{ left: `calc(${(LAYOUT.sil.x + tiles[i]) * 100}% + 6px)`, top: '2.2%' }}>{v.label}</span>)}
      <span className="cd-tag cd-tag-paper cd-tag-lineup" style={{ left: `calc(${LAYOUT.lineup.x * 100}% + 6px)`, top: `calc(${LAYOUT.lineup.y * 100}% + 6px)` }}>Lineup at {LAYOUT.thumbPx} px</span>
      {['Pip', 'Bram', 'Yours'].map((n, i) => <span key={n} className="cd-slot" style={{ left: `${(LAYOUT.lineup.x + LAYOUT.slots[i] * LAYOUT.lineup.w) * 100}%`, top: `calc(${(LAYOUT.lineup.y + LAYOUT.lineup.h * LAYOUT.lineupCentre) * 100}% + ${Math.round(LAYOUT.thumbPx * 0.7)}px)` }}>{n}</span>)}
    </div>
  </div>;
}
