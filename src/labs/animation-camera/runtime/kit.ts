import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Light,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { ASPECT, GATE, type OrthoFrame, type Shot } from "../engine/common";
import { AC_LAYER, actors, slots } from "./live";
import { makeAccum, makeBilateral, makeCel, makeDof, makeLook, makePaint } from "./post";
import { applyCel, normalPass, restoreCel, type CelPass } from "./toon";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LookOptions {
  cel?: number;
  outline?: number;
  speed?: number;
  speedDir?: [number, number];
  seed?: number;
  fisheye?: number;
}

export interface StyledOptions {
  t: number;
  /** Camera at a (sub-frame) time. */
  shotAt: (t: number) => Shot;
  /** The clock the characters are posed with at a (sub-frame) time (stepped for anime). */
  charTime: (t: number) => number;
  /** Sub-frame offsets (seconds) to accumulate; [0] = no motion blur. */
  offsets: number[];
  dof: null | { fStop: number; focusM: number };
  look: LookOptions;
  x0?: number;
  x1?: number;
  /** Extra overscan of the render (for the fisheye, so the bulge never shows the frame edge). */
  fovScale?: number;
  layers?: number[];
}

const holdout = new MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8 });

export function setLayerDeep(o: Object3D | null, layer: number) {
  o?.traverse((c) => c.layers.set(layer));
}

/**
 * Render helpers shared by every experiment: one canvas, DOM slots as scissored viewports,
 * pooled cameras and render targets, and a small post chain (depth of field, shutter, look).
 */
export class Kit {
  gl!: WebGLRenderer;
  scene!: Scene;
  dpr = 1;
  low = false;
  private canvas = { left: 0, top: 0, width: 0, height: 0 };
  private cams = new Map<string, Camera>();
  private rts = new Map<string, WebGLRenderTarget>();
  readonly fsq = new FullScreenQuad();
  readonly paint = makePaint();
  readonly bilateral = makeBilateral();
  readonly cel = makeCel();
  readonly dofMat = makeDof();
  readonly accum = makeAccum();
  readonly look = makeLook();
  clearColor = "#101114";

  begin(gl: WebGLRenderer, scene: Scene, low: boolean) {
    this.gl = gl;
    this.scene = scene;
    this.low = low;
    this.dpr = gl.getPixelRatio();
    const r = gl.domElement.getBoundingClientRect();
    this.canvas = { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  rect(id: string): Rect | null {
    const el = slots.get(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const c = this.canvas;
    return { x: r.left - c.left, y: c.height - (r.top - c.top) - r.height, w: r.width, h: r.height };
  }

  rectOfElement(el: HTMLElement | null): Rect | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const c = this.canvas;
    return { x: r.left - c.left, y: c.height - (r.top - c.top) - r.height, w: r.width, h: r.height };
  }

  /** Point the GL at a slot: full-slot viewport, scissor limited to [x0, x1] of its width. */
  toSlot(r: Rect, x0 = 0, x1 = 1) {
    const gl = this.gl;
    gl.setRenderTarget(null);
    gl.setViewport(r.x, r.y, r.w, r.h);
    gl.setScissor(r.x + r.w * x0, r.y, r.w * (x1 - x0), r.h);
    gl.setScissorTest(true);
  }

  persp(name: string): PerspectiveCamera {
    let c = this.cams.get(name) as PerspectiveCamera | undefined;
    if (!c) {
      c = new PerspectiveCamera(40, ASPECT, 0.05, 80);
      c.filmGauge = GATE.widthMm;
      this.cams.set(name, c);
    }
    return c;
  }

  ortho(name: string): OrthographicCamera {
    let c = this.cams.get(name) as OrthographicCamera | undefined;
    if (!c) {
      c = new OrthographicCamera(-1, 1, 1, -1, 0.05, 120);
      this.cams.set(name, c);
    }
    return c;
  }

  applyShot(cam: PerspectiveCamera, s: Shot, layers: number[] = [0], fovScale = 1) {
    cam.position.copy(s.position);
    cam.quaternion.copy(s.quaternion);
    cam.aspect = ASPECT;
    cam.setFocalLength(s.focalMm / fovScale);
    cam.updateMatrixWorld();
    cam.layers.disableAll();
    for (const l of layers) cam.layers.enable(l);
    return cam;
  }

  /** Orthographic twin of a shot: same orientation, frustum from `f`, pulled back so nothing clips. */
  applyOrtho(cam: OrthographicCamera, s: Shot, f: OrthoFrame, layers: number[] = [0], back = 40) {
    const fwd = new Vector3(0, 0, -1).applyQuaternion(s.quaternion);
    cam.position.copy(s.position).addScaledVector(fwd, -back);
    cam.quaternion.copy(s.quaternion);
    cam.left = f.cx - f.halfH * ASPECT;
    cam.right = f.cx + f.halfH * ASPECT;
    cam.top = f.cy + f.halfH;
    cam.bottom = f.cy - f.halfH;
    cam.near = back + 0.05;
    cam.far = back + 80;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    cam.layers.disableAll();
    for (const l of layers) cam.layers.enable(l);
    return cam;
  }

  render(cam: Camera, r: Rect, x0 = 0, x1 = 1) {
    this.toSlot(r, x0, x1);
    this.gl.render(this.scene, cam);
  }

  rt(name: string, w: number, h: number, opts: { depth?: boolean; samples?: number; mip?: boolean } = {}) {
    let t = this.rts.get(name);
    const W = Math.max(2, Math.round(w));
    const H = Math.max(2, Math.round(h));
    if (!t) {
      t = new WebGLRenderTarget(W, H, {
        type: this.low ? UnsignedByteType : HalfFloatType,
        samples: opts.samples ?? 0,
        depthTexture: opts.depth ? new DepthTexture(W, H) : null,
        generateMipmaps: !!opts.mip,
        minFilter: opts.mip ? LinearMipmapLinearFilter : LinearFilter,
        magFilter: LinearFilter,
      });
      this.rts.set(name, t);
    } else if (t.width !== W || t.height !== H) t.setSize(W, H);
    return t;
  }

  peekRt(name: string) {
    return this.rts.get(name) ?? null;
  }

  quad(mat: import("three").Material) {
    this.fsq.material = mat;
    this.fsq.render(this.gl);
  }

  /** Visibility helpers for compositing passes. Always call restoreActors() afterwards. */
  hide(...objs: (Object3D | null)[]) {
    for (const o of objs) if (o) o.visible = false;
  }
  restoreActors() {
    for (const o of [actors.set, actors.bram, actors.pip]) if (o) o.visible = true;
    setLayerDeep(actors.bram, 0);
    setLayerDeep(actors.pip, 0);
    this.scene.overrideMaterial = null;
    this.gl.autoClear = true;
  }

  /**
   * Render a character (or the whole set) from a camera into a transparent target, with the rest of
   * the set as a holdout matte so walls still hide them. Used for the 2.5D cels.
   */
  captureCel(target: WebGLRenderTarget, cam: PerspectiveCamera, who: "bram" | "pip") {
    const gl = this.gl;
    const bg = this.scene.background;
    this.scene.background = null;
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    // Holdout: the set writes depth only; both characters cast shadows but draw nothing.
    setLayerDeep(actors.bram, AC_LAYER.CAST);
    setLayerDeep(actors.pip, AC_LAYER.CAST);
    this.scene.overrideMaterial = holdout;
    gl.autoClear = false;
    gl.render(this.scene, cam);
    this.scene.overrideMaterial = null;
    if (actors.set) actors.set.visible = false;
    setLayerDeep(who === "bram" ? actors.bram : actors.pip, 0);
    gl.render(this.scene, cam);
    this.restoreActors();
    this.scene.background = bg;
    gl.setClearColor(this.clearColor, 1);
  }

  /** Paint a raw capture into a layer texture (Kuwahara pass). */
  paintInto(src: WebGLRenderTarget, dst: WebGLRenderTarget) {
    const gl = this.gl;
    this.paint.uniforms.tSrc.value = src.texture;
    this.paint.uniforms.texel.value.set(1 / src.width, 1 / src.height);
    gl.setRenderTarget(dst);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    this.quad(this.paint);
    gl.setClearColor(this.clearColor, 1);
  }

  /**
   * Render one camera through the post chain into a slot: accumulate sub-frame samples (motion blur),
   * optional depth of field, then the final look (tone mapping, cel, outlines, speed lines, fisheye).
   */
  styled(r: Rect, key: string, o: StyledOptions, prepare?: (t: number) => void) {
    const gl = this.gl;
    const w = r.w * this.dpr;
    const h = r.h * this.dpr;
    const cam = this.persp(`styled-${key}`);
    const sceneRt = this.rt(`scene-${key}`, w, h, { depth: true, samples: this.low ? 0 : 4 });
    const multi = o.offsets.length > 1;
    const accumRt = multi ? this.rt(`accum-${key}`, w, h) : null;
    if (accumRt) {
      gl.setRenderTarget(accumRt);
      gl.setClearColor(0x000000, 1);
      gl.clear();
    }
    let lastShot: Shot | null = null;
    for (const off of o.offsets) {
      const tk = o.t + off;
      runUpdaters({ t: o.charTime(tk), dt: 0, frameId: -1, playing: false, reducedMotion: false });
      prepare?.(tk);
      lastShot = o.shotAt(tk);
      this.applyShot(cam, lastShot, o.layers ?? [0], o.fovScale ?? 1);
      gl.setRenderTarget(sceneRt);
      gl.setClearColor(this.clearColor, 1);
      gl.clear();
      gl.render(this.scene, cam);
      if (accumRt) {
        this.accum.uniforms.tSrc.value = sceneRt.texture;
        this.accum.uniforms.weight.value = 1 / o.offsets.length;
        gl.setRenderTarget(accumRt);
        gl.autoClear = false;
        this.quad(this.accum);
        gl.autoClear = true;
      }
    }
    let normalRt: WebGLRenderTarget | null = null;
    if (o.look.outline) {
      // Smooth view-space normals for the ink pass (no normal maps, so cloth weave can't speckle).
      normalRt = this.rt(`normal-${key}`, w, h, { samples: this.low ? 0 : 4 });
      const bg = this.scene.background;
      this.scene.background = null;
      this.scene.overrideMaterial = normalPass;
      gl.setRenderTarget(normalRt);
      gl.setClearColor(0x8080ff, 1);
      gl.clear();
      gl.render(this.scene, cam);
      this.scene.overrideMaterial = null;
      this.scene.background = bg;
      gl.setClearColor(this.clearColor, 1);
    }
    let src = accumRt ? accumRt.texture : sceneRt.texture;
    if (o.look.cel && !accumRt) {
      // Cel: flat colour and light rendered separately, then smoothed and recombined in two tones.
      const roots = [actors.set, actors.bram, actors.pip];
      const albedoRt = this.rt(`cel-albedo-${key}`, w, h, { samples: this.low ? 0 : 4 });
      const keyRt = this.rt(`cel-key-${key}`, w, h, { samples: this.low ? 0 : 4 });
      const fillRt = this.rt(`cel-fill-${key}`, w, h);
      const others: Light[] = [];
      this.scene.traverse((o) => {
        if ((o as Light).isLight && o !== actors.light && o.visible) others.push(o as Light);
      });
      // Key-only light decides the band; the fill (every other light, key hidden) only tints and grades.
      const passes: [CelPass, WebGLRenderTarget, "key" | "fill" | null][] = [
        ["albedo", albedoRt, null],
        ["light", keyRt, "key"],
        ["light", fillRt, "fill"],
      ];
      for (const [pass, target, only] of passes) {
        applyCel(roots, pass);
        if (only === "key") for (const l of others) l.visible = false;
        if (only === "fill" && actors.light) actors.light.visible = false;
        gl.setRenderTarget(target);
        gl.setClearColor(0x000000, 1);
        gl.clear();
        gl.render(this.scene, cam);
        if (only === "key") for (const l of others) l.visible = true;
        if (only === "fill" && actors.light) actors.light.visible = true;
        restoreCel();
      }
      const smooth = (from: WebGLRenderTarget, to: WebGLRenderTarget, spread: number, sigma: number) => {
        const u = this.bilateral.uniforms;
        u.tSrc.value = from.texture;
        u.texel.value.set(1 / from.width, 1 / from.height);
        u.spread.value = spread * Math.max(1, this.dpr * 0.75);
        u.sigmaColor.value = sigma;
        gl.setRenderTarget(to);
        this.quad(this.bilateral);
      };
      const a = this.rt(`cel-a-${key}`, w, h);
      const b = this.rt(`cel-b-${key}`, w, h);
      const c = this.rt(`cel-c-${key}`, w, h);
      smooth(albedoRt, a, 1.5, 0.1);
      smooth(a, albedoRt, 0.8, 0.08);
      smooth(keyRt, b, 1.0, 4);
      smooth(fillRt, c, 4.0, 8);
      const out = this.rt(`cel-out-${key}`, w, h);
      this.cel.uniforms.tAlbedo.value = albedoRt.texture;
      this.cel.uniforms.tKey.value = b.texture;
      this.cel.uniforms.tFill.value = c.texture;
      gl.setRenderTarget(out);
      this.quad(this.cel);
      src = out.texture;
    }
    if (o.dof && lastShot) {
      const dofRt = this.rt(`dof-${key}`, w, h);
      const u = this.dofMat.uniforms;
      u.tColor.value = src;
      u.tDepth.value = sceneRt.depthTexture;
      u.texel.value.set(1 / w, 1 / h);
      u.cameraNear.value = cam.near;
      u.cameraFar.value = cam.far;
      u.focusM.value = o.dof.focusM;
      u.focalMm.value = lastShot.focalMm;
      u.fStop.value = o.dof.fStop;
      u.sensorH.value = GATE.heightMm;
      u.imageH.value = h;
      u.maxRadius.value = Math.max(3, (this.low ? 0.012 : 0.02) * h);
      gl.setRenderTarget(dofRt);
      this.quad(this.dofMat);
      src = dofRt.texture;
    }
    const L = this.look.uniforms;
    L.tColor.value = src;
    L.tDepth.value = sceneRt.depthTexture;
    L.hasDepth.value = 1;
    L.texel.value.set(1 / w, 1 / h);
    L.cameraNear.value = cam.near;
    L.cameraFar.value = cam.far;
    L.fisheye.value = o.look.fisheye ?? 0;
    L.cel.value = o.look.cel ?? 0;
    L.outline.value = normalRt ? (o.look.outline ?? 0) : 0;
    L.tNormal.value = normalRt?.texture ?? null;
    L.inkPx.value = Math.max(1, 1.1 * this.dpr * Math.min(1.6, r.w / 700));
    L.speed.value = o.look.speed ?? 0;
    L.speedDir.value.set(...(o.look.speedDir ?? [1, 0]));
    L.fill.value.set(0, 0);
    if (o.offsets.length > 1) {
      const a = o.shotAt(o.t + o.offsets[0]);
      const b = o.shotAt(o.t + o.offsets[o.offsets.length - 1]);
      const mid = o.shotAt(o.t);
      const probe = mid.position.clone().add(new Vector3(0, 0, -5).applyQuaternion(mid.quaternion));
      const P = (s: Shot) => {
        const v = probe.clone().sub(s.position).applyQuaternion(s.quaternion.clone().invert());
        const th = GATE.heightMm / (2 * s.focalMm);
        return [v.x / -v.z / (th * ASPECT), v.y / -v.z / th];
      };
      const pa = P(a);
      const pb = P(b);
      const k = 1 / (2 * (o.offsets.length - 1));
      L.fill.value.set((pb[0] - pa[0]) * k, (pb[1] - pa[1]) * k);
    }
    L.seed.value = o.look.seed ?? 0;
    this.toSlot(r, o.x0 ?? 0, o.x1 ?? 1);
    this.quad(this.look);
    return { cam, shot: lastShot };
  }
}
