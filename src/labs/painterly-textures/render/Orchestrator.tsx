"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { Color, DepthTexture, HalfFloatType, Mesh, MeshStandardMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, UnsignedByteType, Vector3, WebGLRenderTarget, type Material, type WebGLRenderer } from "three";
import { wrap } from "@/engine/math";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { LAYER_TECH, LAYER_WORLD } from "@/scene/layers";
import { painterly } from "../config";
import { crawlBetween, diffMap, ema } from "../engine/crawl";
import { meanStretch, offsetPose, viewProjection, type CamPose } from "../engine/projection";
import { frameIndex, seedOffset, TEST_VERSIONS, type TestVersion } from "../engine/seeds";
import { emitLive, live, type SlotId } from "../live";
import { ptClock, ptStore, type PTState } from "../store";
import { LAYER_COORDS } from "../stage/World";
import { scene3d } from "../stage/scene3d";
import { charUniforms, envExtras, envUniforms, makePainted, type PaintGroup } from "./paintMaterial";
import { compositeMaterial, coordsMaterial, displayMaterial, filterMaterial, makeQuad } from "./post";
import { resources } from "./resources";

/** A viewport in canvas CSS pixels, GL convention (y up from the bottom). */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function slotRect(id: SlotId, canvas: DOMRect): Rect | null {
  const el = live.slots.get(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return { x: r.left - canvas.left, y: canvas.height - (r.bottom - canvas.top), w: r.width, h: r.height };
}

/** Largest rect of the given aspect centred in `r`. */
function fit(r: Rect, aspect: number): Rect {
  const w = Math.min(r.w, r.h * aspect);
  const h = w / aspect;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

function applyPose(cam: PerspectiveCamera, p: CamPose, aspect = p.aspect) {
  cam.fov = p.fovDeg;
  cam.aspect = aspect;
  cam.near = p.near ?? 0.05;
  cam.far = p.far ?? 40;
  cam.position.set(...p.position);
  cam.up.set(0, 1, 0);
  cam.lookAt(p.target[0], p.target[1], p.target[2]);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

/** Linear RGB tint with luminance 1 from a hue (degrees). */
function hueTint(hueDeg: number, out: Color, sat = 0.55, light = 0.62) {
  out.setHSL((((hueDeg % 360) + 360) % 360) / 360, sat, light, SRGBColorSpace);
  const l = 0.2126 * out.r + 0.7152 * out.g + 0.0722 * out.b;
  return out.multiplyScalar(1 / Math.max(1e-3, l));
}

const LIGHT_TINT = (() => {
  const c = new Color(painterly.paint.lightTint);
  return c.multiplyScalar(1 / (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b));
})();
const RIM_COLOR = new Color(painterly.paint.rimColor);
const RIM_DIR = new Vector3(...painterly.paint.rimFrom).sub(new Vector3(...painterly.test.head)).normalize();

/** Shot camera pose for the look: the projector itself, or swung off it in Experiment/Inspect. */
export function shotPose(s: Pick<PTState, "mode" | "projYaw">): CamPose {
  if (s.mode === "watch" || Math.abs(s.projYaw) < 1e-3) return painterly.shot;
  return offsetPose(painterly.shot, painterly.projectorPivot, s.projYaw, Math.abs(s.projYaw) * painterly.projRisePerDeg);
}

/** Test camera at loop time t: static, or orbiting the head. */
export function testPose(motion: PTState["testMotion"], t: number): CamPose {
  const c = painterly.test.camera;
  if (motion !== "orbit") return c;
  const yaw = painterly.test.orbitDeg * Math.sin((2 * Math.PI * t) / painterly.durationS);
  return offsetPose(c, painterly.test.head, yaw);
}

interface Pass {
  char: boolean;
  env: boolean;
  tex: boolean;
  shade: boolean;
  proj: boolean;
  seed?: readonly [number, number, number];
  debug?: boolean;
}

function syncParams(s: PTState) {
  const p = s.params;
  const angle = (p.strokeAngle * Math.PI) / 180;
  const set = (g: PaintGroup, k: { tilesPerM: number; patchFreq: number; break: number; rim: number }) => {
    g.ptTiles.value = k.tilesPerM / Math.max(0.3, p.strokeSize);
    g.ptPatchFreq.value = k.patchFreq / Math.max(0.3, p.strokeSize);
    g.ptAngle.value = angle;
    g.ptBands.value = p.bands;
    g.ptBreak.value = k.break;
    g.ptRim.value = k.rim;
    g.ptMid.value = painterly.paint.mid;
    hueTint(p.shadowHue, g.ptShadowTint.value);
    g.ptLightTint.value.copy(LIGHT_TINT);
    g.ptRimColor.value.copy(RIM_COLOR);
    g.ptRimDir.value.copy(RIM_DIR);
  };
  set(charUniforms, painterly.paint.char);
  set(envUniforms, painterly.paint.env);
}

function setPass(p: Pass) {
  for (const [g, on] of [[charUniforms, p.char], [envUniforms, p.env]] as const) {
    g.ptPaint.value = on ? 1 : 0;
    g.ptTex.value = p.tex ? 1 : 0;
    g.ptShade.value = p.shade ? 1 : 0;
    g.ptDebug.value = p.debug ? 1 : 0;
    if (p.seed) g.ptSeed.value.set(p.seed[0], p.seed[1], p.seed[2]);
    else g.ptSeed.value.set(0, 0, 0);
  }
  envExtras.ptProj.value = p.proj ? 1 : 0;
}

const CLEAN: Pass = { char: false, env: false, tex: false, shade: false, proj: false };
const lookPass = (s: PTState, debug = false): Pass => ({ char: s.paintChar, env: s.paintEnv, tex: s.layers.texture, shade: s.layers.shading, proj: s.layers.projection, debug });
const testPass = (v: TestVersion, t: number, hold: number): Pass => ({ char: true, env: true, tex: true, shade: true, proj: false, seed: seedOffset(v, t, { hold }) });

type TargetOpts = { depth?: boolean; samples?: number; hdr?: boolean };

/** Render targets by name, resized on demand. */
class Targets {
  private map = new Map<string, WebGLRenderTarget>();
  get(name: string, w: number, h: number, o: TargetOpts = {}) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    let rt = this.map.get(name);
    if (rt && (rt.width !== w || rt.height !== h)) {
      rt.setSize(w, h);
      if (rt.depthTexture) {
        rt.depthTexture.dispose();
        rt.depthTexture = new DepthTexture(w, h);
      }
    }
    if (!rt) {
      rt = new WebGLRenderTarget(w, h, { type: o.hdr === false ? UnsignedByteType : HalfFloatType, samples: o.samples ?? 0, depthBuffer: true });
      if (o.depth) rt.depthTexture = new DepthTexture(w, h);
      this.map.set(name, rt);
    }
    return rt;
  }
  dispose() {
    for (const rt of this.map.values()) {
      rt.depthTexture?.dispose();
      rt.dispose();
    }
    this.map.clear();
  }
}

const HISTORY = 48;

/**
 * Inspect swatches: a 30 cm patch of Bram's coat and a 1.2 m patch of plaster, flattened and unlit,
 * painted by exactly the same materials as the shot (the "texture map" view).
 */
function makeSwatches() {
  const scene = new Scene();
  const owned: Material[] = [];
  const add = (color: string, kind: "char" | "env", size: number, x: number) => {
    const made = makePainted(new MeshStandardMaterial({ color }), kind, size);
    if (!made) return;
    made.info.projAllow.value = 0;
    owned.push(made.material);
    const m = new Mesh(new PlaneGeometry(1, 1), made.material);
    m.position.x = x;
    scene.add(m);
  };
  add("#a63a2c", "char", 0.3, -0.52);
  add("#d8b88c", "env", 1.2, 0.52);
  const camera = new OrthographicCamera(-1.04, 1.04, 0.5, -0.5, 0.1, 10);
  camera.position.z = 2;
  return { scene, camera, owned };
}

function useResources(e2e: boolean) {
  return useMemo(() => {
    const r = resources();
    return {
      r,
      e2e,
      targets: new Targets(),
      quad: makeQuad(),
      composite: compositeMaterial(r.paper),
      filter: filterMaterial(r.brush),
      display: displayMaterial(),
      coords: coordsMaterial(),
      shotCam: new PerspectiveCamera(),
      testCam: new PerspectiveCamera(),
      swatches: makeSwatches(),
      lastStretchKey: "",
      film: { k: -1, key: "", frame: null as MeasuredFrame | null },
      bufs: new Map<string, Uint8Array>(),
    };
  }, [e2e]);
}
type Res = ReturnType<typeof useResources>;

function quadPass(gl: WebGLRenderer, R: Res, material: Res["composite"]) {
  R.quad.mesh.material = material;
  gl.render(R.quad.scene, R.quad.camera);
}

function toScreen(gl: WebGLRenderer, rect: Rect) {
  gl.setRenderTarget(null);
  gl.setViewport(rect.x, rect.y, rect.w, rect.h);
  gl.setScissor(rect.x, rect.y, rect.w, rect.h);
  gl.setScissorTest(true);
}

function setOverlays(on: boolean) {
  if (scene3d.overlays) scene3d.overlays.visible = on;
}

/** The finished look into `rect`: painted pass (+ clean pass for the wipe), then the composite. */
function renderShot(gl: WebGLRenderer, scene: Scene, R: Res, s: PTState, rect: Rect, cam: PerspectiveCamera, opts: { wipe: number }) {
  const dpr = gl.getPixelRatio();
  const W = rect.w * dpr, H = rect.h * dpr;
  const samples = R.e2e ? 0 : 4;
  const paint = R.targets.get("paint", W, H, { depth: true, samples });
  setPass(lookPass(s));
  setOverlays(s.layers.overlays);
  gl.setRenderTarget(paint);
  gl.clear();
  gl.render(scene, cam);
  const hasClean = opts.wipe > 0.001;
  if (hasClean) {
    const clean = R.targets.get("clean", W, H, { samples });
    setPass(CLEAN);
    setOverlays(false);
    gl.setRenderTarget(clean);
    gl.clear();
    gl.render(scene, cam);
    R.composite.uniforms.tClean.value = clean.texture;
  }
  const u = R.composite.uniforms;
  u.tPaint.value = paint.texture;
  u.tDepth.value = paint.depthTexture;
  u.uRes.value.set(W, H);
  u.uWipe.value = opts.wipe;
  u.uHasClean.value = hasClean ? 1 : 0;
  u.uComposite.value = s.layers.composite ? 1 : 0;
  u.uPaper.value = s.params.paper;
  u.uNear.value = cam.near;
  u.uFar.value = cam.far;
  hueTint(s.params.shadowHue, u.uShadowTint.value);
  toScreen(gl, rect);
  quadPass(gl, R, R.composite);
}

function renderLook(state: RootState, R: Res, s: PTState) {
  const { gl, scene } = state;
  const cr = gl.domElement.getBoundingClientRect();
  const pic = slotRect("picture", cr);
  if (!pic) return;
  const pose = shotPose(s);
  applyPose(R.shotCam, pose, painterly.shot.aspect);
  R.shotCam.layers.set(LAYER_WORLD);
  const key = `${pose.position.join(",")}`;
  if (key !== R.lastStretchKey) {
    R.lastStretchKey = key;
    live.stretch = meanStretch(painterly.shot, { ...pose, aspect: painterly.shot.aspect }, painterly.stretchSamples).stretch;
    emitLive();
  }
  if (s.mode === "inspect") {
    const obs = state.camera as PerspectiveCamera;
    scene3d.observer = obs;
    obs.layers.enable(LAYER_TECH);
    obs.aspect = pic.w / pic.h;
    obs.updateProjectionMatrix();
    setPass(lookPass(s, s.focus === "texture"));
    setOverlays((s.layers.overlays && s.focus !== "texture") || s.focus === "overlays");
    toScreen(gl, pic);
    gl.setClearColor("#0b0c0f", 1);
    gl.clear();
    gl.render(scene, obs);
    const pip = slotRect("pip", cr);
    if (pip) renderShot(gl, scene, R, s, fit(pip, painterly.shot.aspect), R.shotCam, { wipe: 0 });
    const sw = s.focus === "texture" ? slotRect("swatch", cr) : null;
    if (sw) {
      setPass({ char: true, env: true, tex: true, shade: false, proj: false, debug: true });
      toScreen(gl, sw);
      gl.setClearColor("#0b0c0f", 1);
      gl.clear();
      gl.render(R.swatches.scene, R.swatches.camera);
    }
    return;
  }
  renderShot(gl, scene, R, s, fit(pic, painterly.shot.aspect), R.shotCam, { wipe: s.wipe });
}

/** Read an 8-bit target into a reusable buffer. */
function read(gl: WebGLRenderer, R: Res, rt: WebGLRenderTarget, key: string) {
  const n = rt.width * rt.height * 4;
  let buf = R.bufs.get(key);
  if (!buf || buf.length !== n) {
    buf = new Uint8Array(n);
    R.bufs.set(key, buf);
  }
  gl.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
  return buf.slice();
}

interface MeasuredFrame {
  coords: Uint8Array;
  clean: Uint8Array;
  images: Record<TestVersion, Uint8Array>;
}

/** Render one moment of the test off-screen: coordinates, clean, and the four versions. */
function captureAt(state: RootState, R: Res, s: PTState, t: number): MeasuredFrame {
  const { gl, scene } = state;
  const { width: mw, height: mh } = painterly.test.measure;
  runUpdaters({ t: wrap(t, painterly.durationS), dt: 0, frameId: live.frames, playing: false, reducedMotion: true });
  applyPose(R.testCam, testPose(s.testMotion, wrap(t, painterly.durationS)), mw / mh);
  R.testCam.layers.set(LAYER_WORLD);
  gl.setScissorTest(false);
  gl.shadowMap.needsUpdate = true;
  setOverlays(false);
  // surface-coordinate pass (Bram only)
  const coordsRT = R.targets.get("m-coords", mw, mh, { hdr: false });
  const bg = scene.background;
  scene.background = null;
  scene.overrideMaterial = R.coords;
  R.coords.uniforms.uRestScale.value = scene3d.bramRestScale;
  R.testCam.layers.set(LAYER_COORDS);
  gl.setRenderTarget(coordsRT);
  gl.setClearColor(0x000000, 0);
  gl.clear();
  gl.render(scene, R.testCam);
  scene.overrideMaterial = null;
  scene.background = bg;
  R.testCam.layers.set(LAYER_WORLD);
  const coords = read(gl, R, coordsRT, "coords");
  const hdr = R.targets.get("m-hdr", mw, mh);
  const ldr = R.targets.get("m-ldr", mw, mh, { hdr: false });
  const shoot = (pass: Pass) => {
    setPass(pass);
    gl.setRenderTarget(hdr);
    gl.clear();
    gl.render(scene, R.testCam);
  };
  const toLdr = (material: Res["display"] | Res["filter"]) => {
    gl.setRenderTarget(ldr);
    quadPass(gl, R, material);
    return read(gl, R, ldr, "ldr");
  };
  shoot(CLEAN);
  R.display.uniforms.tSrc.value = hdr.texture;
  const clean = toLdr(R.display);
  const images = {} as Record<TestVersion, Uint8Array>;
  R.filter.uniforms.tSrc.value = hdr.texture;
  for (const v of SCREEN_SPACE) {
    configureFilter(R, s, mw, mh, v, t);
    images[v] = toLdr(R.filter);
  }
  // measured on the painted TEXTURE layer (shading off): banded light legitimately moves over the
  // surface as the head turns; the question here is only whether the strokes move with it
  for (const v of ["surface", "boil"] as const) {
    shoot({ ...testPass(v, t, s.boilHold), shade: false });
    images[v] = toLdr(R.display);
  }
  return { coords, clean, images };
}

/** Screen-space versions: the filter's dabs live on the screen; "random" re-lays them every frame. */
const SCREEN_SPACE: readonly TestVersion[] = ["screen", "random"];

function configureFilter(R: Res, s: PTState, w: number, h: number, v: TestVersion = "screen", t = 0) {
  const u = R.filter.uniforms;
  u.uRes.value.set(w, h);
  // dab cells sized like the surface dabs on Bram's face in the portrait (~1/22 of frame height)
  u.ptTiles.value = 22 / h / Math.max(0.3, s.params.strokeSize);
  u.ptAngle.value = (s.params.strokeAngle * Math.PI) / 180;
  const seed = seedOffset(v, t, { hold: s.boilHold });
  u.ptSeed.value.set(seed[0], seed[1], seed[2]);
}

/** Measure crawl over `pairs` consecutive 24 fps frame pairs ending at t; updates the readouts. */
/** Score consecutive captured frames; returns the mean crawl per version (and fills diagnostics). */
function scoreFrames(frames: MeasuredFrame[]): Record<TestVersion, number> {
  const pairs = frames.length - 1;
  const sum: Record<TestVersion, number> = { surface: 0, screen: 0, random: 0, boil: 0 };
  const diag = {} as NonNullable<typeof live.lastMeasure>;
  const width = painterly.test.measure.width;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    for (const v of TEST_VERSIONS) {
      const r = crawlBetween({ coords: a.coords, image: a.images[v] }, { coords: b.coords, image: b.images[v] }, { a: a.clean, b: b.clean }, { width, minMove: painterly.test.minMovePx });
      sum[v] += r.crawl / pairs;
      diag[v] = r;
    }
  }
  live.lastMeasure = diag;
  return sum;
}

/** Push a measurement into the readouts (smoothed value, history, Inspect diff maps). */
function publish(sum: Record<TestVersion, number>, prev: MeasuredFrame, last: MeasuredFrame) {
  live.diff.width = painterly.test.measure.width;
  live.diff.height = painterly.test.measure.height;
  live.diff.coords = last.coords;
  for (const v of TEST_VERSIONS) {
    const c = live.crawl[v];
    c.last = sum[v];
    c.value = ema(live.crawlCount ? c.value : null, sum[v], 0.15);
    c.history.push(sum[v]);
    if (c.history.length > HISTORY) c.history.shift();
    live.diff.maps[v] = diffMap(prev.images[v], last.images[v], 6, { a: prev.clean, b: last.clean });
  }
  live.crawlCount++;
  emitLive();
}

const restore = (t: number) => runUpdaters({ t, dt: 0, frameId: live.frames, playing: ptClock.isPlaying, reducedMotion: false });

/** On demand (test hook): `pairs` consecutive 24 fps frame pairs ending at t. */
function measure(state: RootState, R: Res, s: PTState, t: number, pairs: number): Record<TestVersion, number> {
  const frames: MeasuredFrame[] = [];
  for (let i = pairs; i >= 0; i--) frames.push(captureAt(state, R, s, t - i / 24));
  const sum = scoreFrames(frames);
  publish(sum, frames[frames.length - 2], frames[frames.length - 1]);
  restore(t);
  return sum;
}

/**
 * While playing: capture each new 24 fps film frame once (at its exact time) and score it against
 * the previous film frame, so the history is per film frame and boil on twos shows its beat.
 */
function measureLive(state: RootState, R: Res, s: PTState, t: number) {
  const k = frameIndex(t);
  const key = `${s.testMotion}|${s.boilHold}|${s.params.strokeSize}|${s.params.strokeAngle}|${s.params.bands}`;
  if (R.film.k === k && R.film.key === key) return;
  const cur = captureAt(state, R, s, k / 24);
  const prev = R.film.frame;
  if (prev && R.film.key === key && R.film.k === k - 1) publish(scoreFrames([prev, cur]), prev, cur);
  R.film = { k, key, frame: cur };
  restore(t);
}

/** The matte painter's plate: clean set, cast hidden, from the projector (= shot camera). */
function renderPlate(state: RootState, R: Res): string {
  const { gl, scene } = state;
  const { width: w, height: h } = painterly.matte;
  applyPose(R.shotCam, painterly.shot, w / h);
  R.shotCam.layers.set(LAYER_WORLD);
  const hidden: { visible: boolean }[] = [];
  scene.traverse((o) => {
    if ((o.name === "Bram" || o.name === "Pip") && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  });
  setPass(CLEAN);
  setOverlays(false);
  gl.setScissorTest(false);
  gl.shadowMap.needsUpdate = true;
  const hdr = R.targets.get("plate-hdr", w, h, { samples: 4 });
  const ldr = R.targets.get("plate-ldr", w, h, { hdr: false });
  gl.setRenderTarget(hdr);
  gl.clear();
  gl.render(scene, R.shotCam);
  R.display.uniforms.tSrc.value = hdr.texture;
  gl.setRenderTarget(ldr);
  quadPass(gl, R, R.display);
  const px = new Uint8Array(w * h * 4);
  gl.readRenderTargetPixels(ldr, 0, 0, w, h, px);
  for (const o of hidden) o.visible = true;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

function renderTest(state: RootState, R: Res, s: PTState, t: number) {
  const { gl, scene } = state;
  const pending = live.pendingMeasure.splice(0);
  if (pending.length) {
    const r = measure(state, R, s, t, 3);
    for (const p of pending) p(r);
  } else if (ptClock.isPlaying) {
    measureLive(state, R, s, t);
  }
  const cr = gl.domElement.getBoundingClientRect();
  const dpr = gl.getPixelRatio();
  setOverlays(false);
  gl.shadowMap.needsUpdate = true;
  for (const v of TEST_VERSIONS) {
    const rect = slotRect(`panel-${v}`, cr);
    if (!rect) continue;
    applyPose(R.testCam, testPose(s.testMotion, t), rect.w / rect.h);
    R.testCam.layers.set(LAYER_WORLD);
    if (SCREEN_SPACE.includes(v)) {
      const hdr = R.targets.get(`panel-hdr-${v}`, rect.w * dpr, rect.h * dpr);
      setPass(CLEAN);
      gl.setScissorTest(false);
      gl.setRenderTarget(hdr);
      gl.clear();
      gl.render(scene, R.testCam);
      configureFilter(R, s, hdr.width, hdr.height, v, t);
      R.filter.uniforms.tSrc.value = hdr.texture;
      toScreen(gl, rect);
      quadPass(gl, R, R.filter);
    } else {
      setPass(testPass(v, t, s.boilHold));
      toScreen(gl, rect);
      gl.render(scene, R.testCam);
    }
  }
}

/**
 * The lab's single positive-priority frame callback: tick the clock, run the scene updaters,
 * then render whichever section is on screen into its DOM slots (one canvas, scissored).
 */
export function Orchestrator({ e2e }: { e2e: boolean }) {
  const R = useResources(e2e);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => () => {
    R.targets.dispose();
    R.composite.dispose();
    R.filter.dispose();
    R.display.dispose();
    R.coords.dispose();
    R.quad.mesh.geometry.dispose();
    R.swatches.owned.forEach((m) => m.dispose());
  }, [R]);
  useEffect(() => {
    const unsub = ptStore.subscribe(() => invalidate());
    void R.r.matteReady.then(() => invalidate());
    return unsub;
  }, [R, invalidate]);

  useFrame((state, delta) => {
    const { gl, size } = state;
    const t = ptClock.tick();
    live.t = t;
    live.frames++;
    const s = ptStore.getState();
    runUpdaters({ t, dt: Math.min(Math.max(delta, 0), 1 / 20), frameId: live.frames, playing: ptClock.isPlaying, reducedMotion: false });
    syncParams(s);
    envExtras.ptProjVP.value.copy(viewProjection(painterly.shot));
    gl.shadowMap.needsUpdate = true;
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#0d0e11", 1);
    gl.clear();
    const plates = live.pendingPlate.splice(0);
    if (plates.length) {
      const url = renderPlate(state, R);
      for (const p of plates) p(url);
    }
    if (s.section === "look") renderLook(state, R, s);
    else renderTest(state, R, s, t);
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    if (ptClock.isPlaying || live.pendingMeasure.length || (s.mode === "inspect" && s.section === "look")) invalidate();
  }, 1);
  return null;
}
