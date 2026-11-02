import {
  DataTexture,
  DepthTexture,
  Group,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  type Scene,
  type ShaderMaterial,
  type WebGLRenderer,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ASPECT, FAR, GATE, NEAR } from "../engine/world";
import { tanHalf, type Shot } from "../engine/camera";
import { cardSize, type LayerRange } from "../engine/layers";
import { decodeDepthBuffer, MASK, type DepthView } from "../engine/reveal";
import { L } from "./live";
import { cardMaterial, depthMaterial, postMaterial } from "./shaders";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Plates are painted wider than the frame so small moves never run off their edge. */
export const OVERSCAN = 1.5;
export const METRIC = { w: 240, h: 135 } as const;
export const MAX_CARDS = 6;

/**
 * Everything the orchestrator renders with: pooled targets, the frame-0 plate captures, the depth
 * pass behind the revealed-area metric, the 2D/2.5D cards, and the post pass to the screen.
 */
export class Pipeline {
  gl!: WebGLRenderer;
  scene!: Scene;
  low = false;
  dpr = 1;
  private canvasRect = { left: 0, top: 0, width: 0, height: 0 };
  private rts = new Map<string, WebGLRenderTarget>();
  readonly cam = new PerspectiveCamera(40, ASPECT, NEAR, FAR);
  readonly capCam = new PerspectiveCamera(40, ASPECT, NEAR, FAR);
  readonly fsq = new FullScreenQuad();
  readonly post = postMaterial();
  readonly depthMat = depthMaterial();
  readonly cards = new Group();
  readonly flatCard: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly layerCards: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  private pixels = new Uint8Array(METRIC.w * METRIC.h * 4);
  readonly revealTex: DataTexture;
  private revealData = new Uint8Array(METRIC.w * METRIC.h * 4);
  readonly clear = 0x07090c;

  constructor() {
    this.cam.filmGauge = GATE.widthMm;
    this.capCam.filmGauge = GATE.widthMm;
    const plane = new PlaneGeometry(1, 1);
    this.flatCard = new Mesh(plane, cardMaterial());
    this.flatCard.material.uniforms.uFlat.value = 1;
    this.flatCard.frustumCulled = false;
    this.flatCard.layers.set(L.CARDS);
    this.cards.add(this.flatCard);
    for (let i = 0; i < MAX_CARDS; i++) {
      const m = new Mesh(plane, cardMaterial());
      m.frustumCulled = false;
      m.layers.set(L.CARDS);
      m.renderOrder = MAX_CARDS - i;
      this.layerCards.push(m);
      this.cards.add(m);
    }
    this.revealTex = new DataTexture(this.revealData, METRIC.w, METRIC.h, RGBAFormat, UnsignedByteType);
    this.revealTex.magFilter = LinearFilter;
    this.revealTex.minFilter = LinearFilter;
    this.revealTex.needsUpdate = true;
  }

  begin(gl: WebGLRenderer, scene: Scene, low: boolean) {
    this.gl = gl;
    this.scene = scene;
    this.low = low;
    this.dpr = gl.getPixelRatio();
    const r = gl.domElement.getBoundingClientRect();
    this.canvasRect = { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  rect(el: HTMLElement | null | undefined): Rect | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const c = this.canvasRect;
    return { x: r.left - c.left, y: c.height - (r.top - c.top) - r.height, w: r.width, h: r.height };
  }

  rt(name: string, w: number, h: number, opts: { depth?: boolean; samples?: number; float?: boolean; nearest?: boolean } = {}) {
    let t = this.rts.get(name);
    const W = Math.max(2, Math.round(w));
    const H = Math.max(2, Math.round(h));
    if (!t) {
      t = new WebGLRenderTarget(W, H, {
        type: opts.float && !this.low ? HalfFloatType : UnsignedByteType,
        samples: opts.samples ?? 0,
        depthTexture: opts.depth ? new DepthTexture(W, H) : null,
        minFilter: opts.nearest ? NearestFilter : LinearFilter,
        magFilter: opts.nearest ? NearestFilter : LinearFilter,
        generateMipmaps: false,
      });
      this.rts.set(name, t);
    } else if (t.width !== W || t.height !== H) t.setSize(W, H);
    return t;
  }

  peek(name: string) {
    return this.rts.get(name) ?? null;
  }

  applyShot(cam: PerspectiveCamera, s: Shot, layers: number[], overscan = 1, near = NEAR, far = FAR) {
    cam.position.copy(s.position);
    cam.quaternion.copy(s.quaternion);
    cam.aspect = ASPECT;
    cam.near = near;
    cam.far = far;
    cam.setFocalLength(s.focalMm / overscan);
    cam.updateMatrixWorld();
    cam.layers.disableAll();
    for (const l of layers) cam.layers.enable(l);
    return cam;
  }

  /**
   * The frame-0 plate: one render (colour + depth) from the reference camera, overscanned. 2D shows it
   * on one card; 2.5D cuts it into depth slices. With clean plates, each slice is re-rendered with
   * the camera's near/far planes at the slice edges, so what hides behind nearer layers gets painted.
   */
  capture(c0: Shot, ranges: readonly LayerRange[], clean: boolean) {
    const gl = this.gl;
    const size = this.low ? { w: 1600, h: 900 } : { w: 2880, h: 1620 };
    const plate = this.rt("plate", size.w, size.h, { depth: true, float: true, samples: 0 });
    const cam = this.applyShot(this.capCam, c0, [L.WORLD, L.FX, L.CANOPY], OVERSCAN);
    gl.setRenderTarget(plate);
    gl.setClearColor(this.clear, 1);
    gl.clear();
    gl.render(this.scene, cam);
    if (clean) {
      ranges.forEach((r, i) => {
        const t = this.rt(`slice-${i}`, size.w * 0.75, size.h * 0.75, { float: true });
        const last = i === ranges.length - 1;
        // Air effects (shafts, fireflies) are additive with no depth: paint them on the backdrop only.
        this.applyShot(this.capCam, c0, last ? [L.WORLD, L.FX, L.CANOPY] : [L.WORLD, L.CANOPY], OVERSCAN, Math.max(NEAR, r.a), last ? FAR : Math.min(FAR, r.b));
        gl.setRenderTarget(t);
        gl.setClearColor(0x000000, 0);
        gl.clear();
        gl.render(this.scene, this.capCam);
      });
    }
    gl.setRenderTarget(null);
    gl.setClearColor(this.clear, 1);
  }

  /** Hang the cards in front of the frame-0 camera. depthsNow are the squashed card depths. */
  layoutCards(c0: Shot, flatDepth: number, ranges: readonly LayerRange[], depthsNow: readonly number[], clean: boolean, construct: "2d" | "25d" | "3d") {
    const fwd = new Vector3(0, 0, -1).applyQuaternion(c0.quaternion);
    const place = (m: Mesh, d: number) => {
      const s = cardSize(d, c0.focalMm, OVERSCAN);
      m.position.copy(c0.position).addScaledVector(fwd, d);
      m.quaternion.copy(c0.quaternion);
      m.scale.set(s.width, s.height, 1);
      m.updateMatrixWorld();
    };
    const plate = this.peek("plate");
    this.flatCard.visible = construct === "2d" && !!plate;
    if (plate) {
      const u = this.flatCard.material.uniforms;
      u.tColor.value = plate.texture;
      place(this.flatCard, flatDepth);
    }
    this.layerCards.forEach((m, i) => {
      const r = ranges[i];
      m.visible = construct === "25d" && !!plate && !!r;
      if (!m.visible || !plate) return;
      const u = m.material.uniforms;
      const slice = this.peek(`slice-${i}`);
      const useClean = clean && !!slice;
      u.uMode.value = useClean ? 1 : 0;
      u.tColor.value = useClean ? slice!.texture : plate.texture;
      u.tDepth.value = plate.depthTexture;
      u.uA.value = r.a;
      u.uB.value = Number.isFinite(r.b) ? r.b : 1e9;
      u.uBack.value = i === ranges.length - 1 ? 1 : 0;
      m.renderOrder = ranges.length - i;
      place(m, depthsNow[i]);
    });
  }

  /** Render the true world's depth from a shot into the metric target and read it back (metres). */
  depthView(s: Shot, out?: Float32Array): DepthView {
    const gl = this.gl;
    const t = this.rt("metric", METRIC.w, METRIC.h, { nearest: true });
    const cam = this.applyShot(this.cam, s, [L.WORLD, L.CANOPY]);
    const ov = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.depthMat;
    gl.setRenderTarget(t);
    gl.setClearColor(0xffffff, 1);
    gl.clear();
    gl.render(this.scene, cam);
    this.scene.overrideMaterial = ov;
    gl.readRenderTargetPixels(t, 0, 0, METRIC.w, METRIC.h, this.pixels);
    gl.setRenderTarget(null);
    gl.setClearColor(this.clear, 1);
    const th = tanHalf(s.focalMm);
    const camToWorld = cam.matrixWorld.clone();
    return { width: METRIC.w, height: METRIC.h, depth: decodeDepthBuffer(this.pixels, out), camToWorld, worldToCam: camToWorld.clone().invert(), tanX: th.x, tanY: th.y };
  }

  /** 2D / 2.5D: classify the current frame into painted content, never-painted holes and void. */
  constructionMask(s: Shot) {
    const gl = this.gl;
    const t = this.rt("mask", METRIC.w, METRIC.h, { nearest: true });
    const cam = this.applyShot(this.cam, s, [L.CARDS]);
    const all = [this.flatCard, ...this.layerCards];
    for (const m of all) m.material.uniforms.uMask.value = 1;
    gl.setRenderTarget(t);
    gl.setClearColor(0x000000, 1);
    gl.clear();
    gl.render(this.scene, cam);
    for (const m of all) m.material.uniforms.uMask.value = 0;
    gl.readRenderTargetPixels(t, 0, 0, METRIC.w, METRIC.h, this.pixels);
    gl.setRenderTarget(null);
    gl.setClearColor(this.clear, 1);
    const n = METRIC.w * METRIC.h;
    let content = 0;
    let hole = 0;
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = this.pixels[i * 4];
      const g = this.pixels[i * 4 + 1];
      if (r > 127) content++;
      else if (g > 127) {
        hole++;
        mask[i] = MASK.DISOCCLUDED;
      } else mask[i] = 3;
    }
    // A few hole pixels well inside a hole (all 8 neighbours too), normalised x / y-down, for tests.
    const samples: [number, number][] = [];
    const W = METRIC.w;
    const H = METRIC.h;
    const step = Math.max(1, Math.floor(hole / 24));
    let seen = 0;
    for (let j = 2; j < H - 2 && samples.length < 24; j++)
      for (let i = 2; i < W - 2 && samples.length < 24; i++) {
        const k = j * W + i;
        if (mask[k] !== MASK.DISOCCLUDED) continue;
        let inner = true;
        for (let dj = -2; dj <= 2 && inner; dj++) for (let di = -2; di <= 2 && inner; di++) if (mask[k + dj * W + di] !== MASK.DISOCCLUDED) inner = false;
        if (!inner || seen++ % step) continue;
        samples.push([(i + 0.5) / W, 1 - (j + 0.5) / H]);
      }
    return { content: content / n, hole: hole / n, void: (n - content - hole) / n, mask, samples };
  }

  /** Upload the reveal mask (R = new at the edge, G = disoccluded) for the overlay, de-speckled by a 3×3 majority vote. */
  uploadReveal(mask: Uint8Array) {
    const d = this.revealData;
    const W = METRIC.w;
    const H = METRIC.h;
    const vote = (i: number, v: number) => {
      const x = i % W;
      const y = (i / W) | 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          const yy = Math.min(H - 1, Math.max(0, y + dy));
          if (mask[yy * W + xx] === v) n++;
        }
      return n >= 5;
    };
    for (let i = 0; i < mask.length; i++) {
      d[i * 4] = vote(i, MASK.EDGE) ? 255 : 0;
      d[i * 4 + 1] = vote(i, MASK.DISOCCLUDED) ? 255 : 0;
      d[i * 4 + 2] = 0;
      d[i * 4 + 3] = 255;
    }
    this.revealTex.needsUpdate = true;
  }

  /** Main camera → HDR target (with depth) → post (DoF, overlays, tone map) → the slot on screen. */
  renderMain(r: Rect, s: Shot, layers: number[], post: { dof: boolean; fStop: number; focusM: number; overlay: number; flat: boolean; t: number }) {
    const gl = this.gl;
    const w = r.w * this.dpr;
    const h = r.h * this.dpr;
    const target = this.rt("main", w, h, { depth: true, float: true, samples: this.low ? 0 : 4 });
    const cam = this.applyShot(this.cam, s, layers);
    gl.setRenderTarget(target);
    gl.setClearColor(this.clear, 1);
    gl.clear();
    gl.render(this.scene, cam);
    const u = this.post.uniforms;
    u.tColor.value = target.texture;
    u.tDepth.value = target.depthTexture;
    u.tReveal.value = this.revealTex;
    u.texel.value.set(1 / w, 1 / h);
    u.uDof.value = post.dof ? 1 : 0;
    u.focusM.value = post.focusM;
    u.focalMm.value = s.focalMm;
    u.fStop.value = post.fStop;
    u.imageH.value = h;
    u.maxRadius.value = Math.max(3, (this.low ? 0.012 : 0.026) * h);
    u.uOverlay.value = post.overlay;
    u.uFlat.value = post.flat ? 1 : 0;
    u.uTime.value = post.t;
    gl.setRenderTarget(null);
    gl.setViewport(r.x, r.y, r.w, r.h);
    gl.setScissor(r.x, r.y, r.w, r.h);
    gl.setScissorTest(true);
    this.fsq.material = this.post;
    this.fsq.render(gl);
    gl.setScissorTest(false);
  }

  dispose() {
    for (const t of this.rts.values()) t.dispose();
    this.post.dispose();
    this.depthMat.dispose();
    this.fsq.dispose();
    this.revealTex.dispose();
  }
}

