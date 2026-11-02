"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  CustomBlending,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OneFactor,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { LAYER_WORLD } from "@/scene/layers";
import { getCamera } from "../engine/cameras";
import { cocMm, FORMATS, shotGate, type Gate } from "../engine/formats";
import { curveUniforms, LOOKS, type Look } from "../engine/looks";
import { blurDiscMm } from "../engine/optics";
import { MARKS, moveYawDeg, SHOT, shotQuaternion } from "../engine/shot";
import { frameTime, ILLUSTRATIVE_READOUT_S, rowOffsetS, sampleCount, sampleTimes } from "../engine/shutter";
import { cfClock, cfStore } from "../store";
import { ACCUM_FRAG, DOF_FRAG, LOOK_FRAG, QUAD_VERT } from "./shaders";
import { live, slots, type SlotId } from "./live";

/** Width × height (mm) of the canvas the gate diagram represents; every outline is drawn to this scale. */
export const DIAGRAM_MM = { w: 76, h: 56 } as const;

const halton = (i: number, b: number) => {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
};

function applyLens(cam: PerspectiveCamera, gate: Gate, focalMm: number) {
  cam.filmGauge = gate.widthMm;
  cam.filmOffset = 0;
  cam.aspect = gate.widthMm / gate.heightMm;
  cam.setFocalLength(focalMm);
}

function makeResources() {
  const rt = (depthTexture: boolean) =>
    new WebGLRenderTarget(4, 4, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      ...(depthTexture ? { depthTexture: Object.assign(new DepthTexture(4, 4, UnsignedIntType), { minFilter: NearestFilter, magFilter: NearestFilter }) } : {}),
    });
  const center = rt(true);
  const sample = rt(false);
  const accum = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false });
  const dof = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const accumMat = new ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: ACCUM_FRAG,
    uniforms: { tColor: { value: null }, weight: { value: 1 } },
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
  });
  const dofMat = new ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: DOF_FRAG,
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      texel: { value: new Vector2() },
      cameraNear: { value: SHOT.near },
      cameraFar: { value: SHOT.far },
      focalMm: { value: 35 },
      stop: { value: 2.8 },
      focusMm: { value: 3000 },
      sensorWidthMm: { value: 36 },
      widthPx: { value: 1 },
      cocMm: { value: 0.03 },
      maxRadius: { value: 1 },
      radScale: { value: 0.5 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const lookMat = new ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: LOOK_FRAG,
    uniforms: {
      tColor: { value: null },
      texel: { value: new Vector2() },
      res: { value: new Vector2() },
      exposure: { value: 1 },
      wb: { value: new Vector3(1, 1, 1) },
      crosstalk: { value: 0 },
      saturation: { value: 1 },
      shadowTint: { value: new Vector3() },
      highlightTint: { value: new Vector3() },
      rawSlope: { value: 0.145 },
      shoulderNorm: { value: 1 },
      clipStops: { value: 7 },
      shoulder: { value: 2 },
      toe: { value: 2 },
      midGrey: { value: 0.44 },
      black: { value: 0 },
      grain: { value: 0 },
      grainSize: { value: 1 },
      chroma: { value: 0 },
      seed: { value: 0 },
      halation: { value: 0 },
      bloom: { value: 0 },
      sharpen: { value: 0 },
      vignette: { value: 0 },
      weave: { value: new Vector2() },
      bandOverlay: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), accumMat);
  quad.frustumCulled = false;
  const quadScene = new Scene();
  quadScene.add(quad);
  const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const shotCam = new PerspectiveCamera(40, 16 / 9, SHOT.near, SHOT.far);
  shotCam.layers.set(LAYER_WORLD);
  shotCam.position.set(...SHOT.position);
  const gateCam = new PerspectiveCamera(60, DIAGRAM_MM.w / DIAGRAM_MM.h, SHOT.near, SHOT.far);
  gateCam.layers.set(LAYER_WORLD);
  gateCam.position.set(...SHOT.position);
  return {
    center,
    sample,
    accum,
    dof,
    accumMat,
    dofMat,
    lookMat,
    quad,
    quadScene,
    quadCam,
    shotCam,
    gateCam,
    dispose() {
      [center, sample, accum, dof].forEach((r) => r.dispose());
      center.depthTexture?.dispose();
      [accumMat, dofMat, lookMat].forEach((m) => m.dispose());
      quad.geometry.dispose();
    },
  };
}

/** GPU resources live at module level (one canvas per page) so the frame callback can mutate them freely. */
let resources: ReturnType<typeof makeResources> | null = null;

const LUMA = [0.2126, 0.7152, 0.0722];

/** Uniforms for one look, at exposure offset `stops`, for a frame `seed`. */
function setLook(mat: ShaderMaterial, look: Look, stops: number, seed: number, w: number, h: number, bandOverlay: boolean) {
  const u = mat.uniforms;
  const c = curveUniforms(look);
  u.rawSlope.value = c.rawSlope;
  u.shoulderNorm.value = c.shoulderNorm;
  u.clipStops.value = c.clipStops;
  u.shoulder.value = c.shoulder;
  u.toe.value = c.toe;
  u.midGrey.value = c.midGrey;
  u.black.value = c.black;
  u.exposure.value = Math.pow(2, stops);
  const g = [1 + look.warmth, 1 + look.tint * 0.5, 1 - look.warmth];
  const norm = g[0] * LUMA[0] + g[1] * LUMA[1] + g[2] * LUMA[2];
  (u.wb.value as Vector3).set(g[0] / norm, g[1] / norm, g[2] / norm);
  u.crosstalk.value = look.crosstalk;
  u.saturation.value = look.saturation;
  (u.shadowTint.value as Vector3).set(...look.shadowTint);
  (u.highlightTint.value as Vector3).set(...look.highlightTint);
  u.grain.value = look.grain;
  u.grainSize.value = look.grainSize;
  u.chroma.value = look.chromaNoise ? 1 : 0;
  u.seed.value = seed % 997;
  u.halation.value = look.halation;
  u.bloom.value = look.bloom;
  u.sharpen.value = look.sharpen;
  u.vignette.value = look.vignette;
  const hs = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453 % 1;
  (u.weave.value as Vector2).set(hs(1) * look.weave * (h / 1080), hs(2) * look.weave * 0.6 * (h / 1080));
  (u.texel.value as Vector2).set(1 / w, 1 / h);
  (u.res.value as Vector2).set(w, h);
  u.bandOverlay.value = bandOverlay ? 1 : 0;
}

const BLUR_CAP_PX = 24;
const tmpA = new Vector3();
const tmpB = new Vector3();

/**
 * The lab's one positive-priority frame callback. Per frame: tick the clock, hold it to the capture
 * frame, render N sub-frame samples across the open shutter (each band of rows offset in time for a
 * rolling shutter) and average them, apply thin-lens depth of field from the centre sample's depth,
 * then grade into each output window with its look. The gate diagram and the stage render after.
 */
export function Orchestrator({ reducedMotion, budget }: { reducedMotion: boolean; budget: number }) {
  useEffect(() => () => {
    resources?.dispose();
    resources = null;
  }, []);

  useFrame((state, delta) => {
    const { gl, scene } = state;
    const res = (resources ??= makeResources());
    const t = cfClock.tick();
    const s = cfStore.getState();
    const camSpec = getCamera(s.cameraId);
    const format = FORMATS[camSpec.format];
    const gate = shotGate(format, s.openGate);
    const tq = frameTime(t, s.fps);
    live.t = t;
    live.frameT = tq;
    live.frameId++;
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    const ctx = { dt, frameId: live.frameId, playing: cfClock.isPlaying, reducedMotion };

    // Which windows show the graded shot.
    const blind = s.mode === "experiment" && s.step === "blind";
    const outs: { id: SlotId; look: Look; el: HTMLElement }[] = [];
    if (blind) {
      s.blind.looks.forEach((l, i) => {
        const el = slots.get(`b${i}` as SlotId);
        if (el) outs.push({ id: `b${i}` as SlotId, look: LOOKS[l], el });
      });
    } else {
      const el = slots.get("main");
      if (el) outs.push({ id: "main", look: LOOKS[s.lookId], el });
    }
    live.lookIds = outs.map((o) => o.look.id);
    const pr = gl.getPixelRatio();
    const c = gl.domElement.getBoundingClientRect();
    const rect0 = outs[0]?.el.getBoundingClientRect();
    const cam = res.shotCam;
    applyLens(cam, gate, s.focalMm);
    live.focalMm = s.focalMm;
    live.hfov = (2 * Math.atan(gate.widthMm / (2 * s.focalMm)) * 180) / Math.PI;
    live.vfov = cam.fov;

    gl.autoClear = false;
    gl.setScissorTest(false);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, state.size.width, state.size.height);
    gl.setClearColor("#0d0f13", 1);
    gl.clear();

    // Pose the world at the displayed frame and draw the views that show it directly: the gate
    // diagram and the stage. They go first so the graded shot (the stage PIP) lands on top.
    runUpdaters({ ...ctx, t: tq });
    const yaw = moveYawDeg(s.move, tq);
    live.yawDeg = yaw;
    cam.position.set(...SHOT.position);
    shotQuaternion(yaw, cam.quaternion);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const [bx, by, bz] = MARKS.bram.point;
    const pa = tmpA.set(bx, by - 0.5, bz).project(cam);
    const pb = tmpB.set(bx, by + 0.5, bz).project(cam);
    live.subjectFraction = Math.abs(pb.y - pa.y) / 2 / cam.aspect;

    gl.setRenderTarget(null);
    const renderDirect = (id: SlotId, camera: PerspectiveCamera) => {
      const el = slots.get(id);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > c.height) return;
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      const x = r.left - c.left;
      const y = c.height - (r.top - c.top) - r.height;
      gl.setViewport(x, y, r.width, r.height);
      gl.setScissor(x, y, r.width, r.height);
      gl.setScissorTest(true);
      gl.autoClear = true;
      gl.render(scene, camera);
      gl.autoClear = false;
    };
    // The gate diagram: what this lens projects over a 76 × 56 mm area; the SVG draws the gates on top.
    const gc = res.gateCam;
    gc.filmGauge = DIAGRAM_MM.w;
    gc.position.set(...SHOT.position);
    gc.quaternion.copy(cam.quaternion);
    gc.aspect = DIAGRAM_MM.w / DIAGRAM_MM.h;
    gc.setFocalLength(s.focalMm);
    gc.updateMatrixWorld();
    renderDirect("gate", gc);
    if (s.mode === "inspect") {
      const obs = state.camera as PerspectiveCamera;
      renderDirect("stage", obs);
    }
    if (rect0 && rect0.width > 2 && rect0.height > 2) {
      const w = Math.max(16, Math.round(rect0.width * pr));
      const h = Math.max(16, Math.round(rect0.height * pr));
      if (res.center.width !== w || res.center.height !== h) {
        [res.center, res.sample, res.accum, res.dof].forEach((r) => r.setSize(w, h));
      }
      live.renderW = w;
      live.renderH = h;

      const rolling = s.rollingTest && !/global|rotary/i.test(camSpec.shutter);
      // Rolling shutter: thin row bands, each exposed later than the one above. A narrow shutter
      // shows the skew crisply (one sample per band); a wide one trades bands for blur samples.
      const narrow = s.shutterDeg <= 90;
      const bands = rolling ? (budget >= 12 ? (narrow ? 28 : 16) : narrow ? 10 : 6) : 1;
      const n = rolling ? (narrow ? 1 : 2) : sampleCount(budget, s.move === "pan", s.shutterDeg);
      const times = sampleTimes(tq, s.shutterDeg, s.fps, n);
      const centre = Math.floor(n / 2);
      const order = [centre, ...times.map((_, k) => k).filter((k) => k !== centre)];
      live.samples = n;
      live.bands = bands;
      live.renders = n * bands;
      live.sampleTimes = times;
      live.sampleSpan = times[n - 1] - times[0];
      live.rolling = rolling;

      gl.setRenderTarget(res.accum);
      gl.setClearColor(0x000000, 0);
      gl.clear();
      res.accumMat.uniforms.weight.value = 1 / n;
      let first = true;
      for (let b = 0; b < bands; b++) {
        const y1 = Math.round(h * (1 - b / bands));
        const y0 = Math.round(h * (1 - (b + 1) / bands));
        for (const r of [res.center, res.sample, res.accum]) {
          r.scissor.set(0, y0, w, y1 - y0);
          r.scissorTest = bands > 1;
        }
        const offset = rolling ? rowOffsetS(b, bands, ILLUSTRATIVE_READOUT_S) : 0;
        for (const k of order) {
          const tk = times[k] + offset;
          runUpdaters({ ...ctx, t: tk });
          cam.position.set(...SHOT.position);
          shotQuaternion(moveYawDeg(s.move, tk), cam.quaternion);
          if (k === centre) cam.clearViewOffset();
          else cam.setViewOffset(w, h, halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5, w, h);
          cam.updateMatrixWorld();
          const target = k === centre ? res.center : res.sample;
          if (first) gl.shadowMap.needsUpdate = true;
          first = false;
          gl.setRenderTarget(target);
          gl.autoClear = true;
          gl.render(scene, cam);
          gl.autoClear = false;
          res.quad.material = res.accumMat;
          res.accumMat.uniforms.tColor.value = target.texture;
          gl.setRenderTarget(res.accum);
          gl.render(res.quadScene, res.quadCam);
        }
      }
      for (const r of [res.center, res.sample, res.accum]) r.scissorTest = false;
      cam.clearViewOffset();

      // Depth of field from the centre sample's depth.
      const du = res.dofMat.uniforms;
      const focusM = s.focusM;
      const radiusAt = (zM: number) => (0.5 * blurDiscMm(s.focalMm, s.tStop, focusM, zM)) / gate.widthMm * w;
      const maxR = Math.min(BLUR_CAP_PX * pr, Math.max(radiusAt(1.2), radiusAt(SHOT.far)));
      live.maxBlurPx = maxR;
      du.tColor.value = res.accum.texture;
      du.tDepth.value = res.center.depthTexture;
      (du.texel.value as Vector2).set(1 / w, 1 / h);
      du.focalMm.value = s.focalMm;
      du.stop.value = s.tStop;
      du.focusMm.value = focusM * 1000;
      du.sensorWidthMm.value = gate.widthMm;
      du.widthPx.value = w;
      du.cocMm.value = cocMm(gate);
      du.maxRadius.value = Math.max(maxR, 0.5);
      du.radScale.value = Math.max(0.5, maxR / 12);
      res.quad.material = res.dofMat;
      gl.setRenderTarget(res.dof);
      gl.render(res.quadScene, res.quadCam);

      // Grade into each window.
      res.quad.material = res.lookMat;
      res.lookMat.uniforms.tColor.value = res.dof.texture;
      const seed = Math.floor(tq * s.fps + 0.5);
      gl.setRenderTarget(null);
      for (const o of outs) {
        const r = o.el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        setLook(res.lookMat, o.look, s.exposureStops, seed, w, h, s.showBand && !blind);
        const x = r.left - c.left;
        const y = c.height - (r.top - c.top) - r.height;
        gl.setViewport(x, y, r.width, r.height);
        gl.setScissor(x, y, r.width, r.height);
        gl.setScissorTest(true);
        gl.render(res.quadScene, res.quadCam);
      }
      gl.setScissorTest(false);
    }

    gl.setScissorTest(false);
    gl.setViewport(0, 0, state.size.width, state.size.height);
    gl.autoClear = true;
  }, 1);
  return null;
}
