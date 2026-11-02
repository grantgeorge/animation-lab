import {
  Camera,
  HalfFloatType,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import { GRADE_VEC4S, packGrade, type ResolvedGrade } from "../engine/grade";
import type { FinishParams, StylizeParams } from "../engine/look";
import { BLUR_FRAG, COMPOSITE_FRAG, DEVELOP_FRAG, GRADE_FRAG, PREFILTER_FRAG, STYLIZE_FRAG, VERT } from "./shaders";

/** A full-screen triangle pair with its own scene and a dummy camera (the vertex shader ignores matrices). */
class Quad {
  readonly scene = new Scene();
  readonly camera = new Camera();
  readonly mesh: Mesh;
  constructor() {
    this.mesh = new Mesh(new PlaneGeometry(2, 2));
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  draw(gl: WebGLRenderer, mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.mesh.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }
  dispose() {
    this.mesh.geometry.dispose();
  }
}

const mat = (frag: string, uniforms: Record<string, { value: unknown }>) =>
  new ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

/** One set of programs per canvas, shared by every monitor; uniforms are set right before each draw. */
export class Programs {
  readonly quad = new Quad();
  readonly develop = mat(DEVELOP_FRAG, { tScene: { value: null } });
  readonly grade = mat(GRADE_FRAG, { tInput: { value: null }, uGrades: { value: new Float32Array(4 * GRADE_VEC4S * 4) }, uLayers: { value: 0 } });
  readonly stylize = mat(STYLIZE_FRAG, {
    tInput: { value: null }, uRes: { value: new Vector2(1, 1) }, uMode: { value: 1 }, uAmount: { value: 1 }, uScale: { value: 5 }, uMis: { value: 0 }, uInk: { value: 0 }, uPaper: { value: 0 },
  });
  readonly prefilter = mat(PREFILTER_FRAG, { tInput: { value: null }, uThreshold: { value: 0.8 }, uMist: { value: 0 }, uMode: { value: 0 } });
  readonly blur = mat(BLUR_FRAG, { tInput: { value: null }, uStep: { value: new Vector2() } });
  readonly composite = mat(COMPOSITE_FRAG, {
    tBase: { value: null }, tBefore: { value: null }, tHal: { value: null }, tBloom: { value: null }, tStreak: { value: null },
    uRes: { value: new Vector2(1, 1) }, uFrame: { value: 0 }, uWeave: { value: 0 }, uDistort: { value: 0 }, uCA: { value: 0 }, uSharpen: { value: 0 },
    uHal: { value: 0 }, uHalThr: { value: 0.78 }, uBloom: { value: 0 }, uStreak: { value: 0 }, uVig: { value: 0 }, uVigSoft: { value: 0.5 },
    uGrain: { value: 0 }, uGrainSize: { value: 1.3 }, uGrainChroma: { value: 0 }, uWipe: { value: -1 }, uIsolate: { value: 0 }, uSource: { value: 0 },
  });
  dispose() {
    for (const m of [this.develop, this.grade, this.stylize, this.prefilter, this.blur, this.composite]) m.dispose();
    this.quad.dispose();
  }
}

export const makeTarget = (w: number, h: number, opts: { depth?: boolean; samples?: number; bytes?: boolean } = {}) =>
  new WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: opts.bytes ? UnsignedByteType : HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: opts.depth ?? false,
    samples: opts.samples ?? 0,
  });

/** What a monitor shows: its grade layers, optional stylization and the finishing amounts. */
export interface RunParams {
  layers: readonly ResolvedGrade[];
  stylize: StylizeParams | null;
  finish: FinishParams;
}

export interface CompositeOpts {
  frame: number;
  /** Before/after wipe position (0–1) or null. */
  wipe?: number | null;
  isolate?: 0 | 1 | 2;
  /** Which intermediate to finish: the untouched source, the graded image or the stylized image. */
  base?: "source" | "graded" | "styled";
  /** Finishing to use instead of the run's (thumbnails switch later nodes off). */
  finish?: FinishParams;
}

/**
 * One monitor's chain of render targets: grade → stylize → glow pyramids. `run` renders the
 * intermediates once per frame; `composite` finishes them into any viewport or target, so the
 * Inspect thumbnails and the scope readback reuse the same intermediates for one extra pass each.
 */
export class Pipeline {
  private w = 0;
  private h = 0;
  private graded = makeTarget(1, 1);
  private styled = makeTarget(1, 1);
  private halA = makeTarget(1, 1);
  private halB = makeTarget(1, 1);
  private bloomA = makeTarget(1, 1);
  private bloomB = makeTarget(1, 1);
  private streakA = makeTarget(1, 1);
  private streakB = makeTarget(1, 1);
  private input: Texture | null = null;
  private params: RunParams | null = null;
  private hasStyled = false;

  constructor(private readonly p: Programs) {}

  get size() {
    return { width: this.w, height: this.h };
  }

  private ensure(w: number, h: number) {
    w = Math.max(16, Math.round(w));
    h = Math.max(9, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.graded.setSize(w, h);
    this.styled.setSize(w, h);
    this.halA.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    this.halB.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    for (const t of [this.bloomA, this.bloomB, this.streakA, this.streakB]) t.setSize(Math.ceil(w / 4), Math.ceil(h / 4));
  }

  private blur(gl: WebGLRenderer, src: WebGLRenderTarget, tmp: WebGLRenderTarget, spread: number, axis: "both" | "x" = "both") {
    const b = this.p.blur;
    const sw = 1 / src.width, sh = 1 / src.height;
    b.uniforms.tInput.value = src.texture;
    (b.uniforms.uStep.value as Vector2).set(sw * spread, 0);
    this.p.quad.draw(gl, b, tmp);
    if (axis === "x") {
      // copy back with a second horizontal pass at a wider spread
      b.uniforms.tInput.value = tmp.texture;
      (b.uniforms.uStep.value as Vector2).set(sw * spread * 3.2, 0);
      this.p.quad.draw(gl, b, src);
      return;
    }
    b.uniforms.tInput.value = tmp.texture;
    (b.uniforms.uStep.value as Vector2).set(0, sh * spread);
    this.p.quad.draw(gl, b, src);
  }

  /** Render the grade, stylize and glow intermediates for this frame. */
  run(gl: WebGLRenderer, input: Texture, w: number, h: number, params: RunParams) {
    this.ensure(w, h);
    this.input = input;
    this.params = params;
    const g = this.p.grade;
    const arr = g.uniforms.uGrades.value as Float32Array;
    const n = Math.min(4, params.layers.length);
    for (let i = 0; i < n; i++) packGrade(params.layers[i], arr, i * GRADE_VEC4S * 4);
    g.uniforms.uLayers.value = n;
    g.uniforms.tInput.value = input;
    this.p.quad.draw(gl, g, this.graded);

    const st = params.stylize;
    this.hasStyled = !!st && st.mode !== "none" && st.amount > 0;
    if (this.hasStyled && st) {
      const s = this.p.stylize;
      s.uniforms.tInput.value = this.graded.texture;
      (s.uniforms.uRes.value as Vector2).set(this.w, this.h);
      s.uniforms.uMode.value = st.mode === "comic" ? 1 : 2;
      s.uniforms.uAmount.value = st.amount;
      s.uniforms.uScale.value = st.scale;
      s.uniforms.uMis.value = st.misregister;
      s.uniforms.uInk.value = st.ink;
      s.uniforms.uPaper.value = st.paper;
      this.p.quad.draw(gl, s, this.styled);
    }
    const base = this.hasStyled ? this.styled : this.graded;
    const f = params.finish;
    const pf = this.p.prefilter;
    if (f.halation.amount > 0) {
      pf.uniforms.tInput.value = base.texture;
      pf.uniforms.uMode.value = 0;
      pf.uniforms.uThreshold.value = f.halation.threshold;
      pf.uniforms.uMist.value = 0;
      this.p.quad.draw(gl, pf, this.halA);
      this.blur(gl, this.halA, this.halB, 0.75);
    }
    if (f.bloom.amount > 0 || f.lens.streaks > 0) {
      pf.uniforms.tInput.value = base.texture;
      pf.uniforms.uMode.value = 1;
      pf.uniforms.uThreshold.value = f.bloom.threshold;
      pf.uniforms.uMist.value = f.bloom.amount > 0 ? f.bloom.mist : 0;
      this.p.quad.draw(gl, pf, this.bloomA);
      if (f.lens.streaks > 0) {
        // streaks: highlights only, smeared horizontally over a third of the frame
        pf.uniforms.uThreshold.value = 0.86;
        pf.uniforms.uMist.value = 0;
        pf.uniforms.uMode.value = 0;
        this.p.quad.draw(gl, pf, this.streakA);
        this.blur(gl, this.streakA, this.streakB, 1, "x");
        this.blur(gl, this.streakA, this.streakB, 6, "x");
      }
      if (f.bloom.amount > 0) {
        this.blur(gl, this.bloomA, this.bloomB, 1);
        this.blur(gl, this.bloomA, this.bloomB, 2.2);
      }
    }
  }

  /** Finish the intermediates into the current viewport (target null) or into a render target. */
  composite(gl: WebGLRenderer, target: WebGLRenderTarget | null, outW: number, outH: number, o: CompositeOpts) {
    if (!this.params || !this.input) return;
    const f = o.finish ?? this.params.finish;
    const c = this.p.composite;
    const u = c.uniforms;
    const base = o.base ?? (this.hasStyled ? "styled" : "graded");
    u.tBase.value = base === "styled" && this.hasStyled ? this.styled.texture : this.graded.texture;
    u.tBefore.value = this.input;
    u.tHal.value = this.halA.texture;
    u.tBloom.value = this.bloomA.texture;
    u.tStreak.value = this.streakA.texture;
    (u.uRes.value as Vector2).set(outW, outH);
    u.uFrame.value = o.frame;
    u.uWeave.value = f.weave;
    u.uDistort.value = f.lens.distortion;
    u.uCA.value = f.lens.aberration;
    u.uSharpen.value = f.sharpen;
    u.uHal.value = this.params.finish.halation.amount > 0 ? f.halation.amount : 0;
    u.uHalThr.value = f.halation.threshold;
    u.uBloom.value = this.params.finish.bloom.amount > 0 ? f.bloom.amount : 0;
    u.uStreak.value = this.params.finish.lens.streaks > 0 ? f.lens.streaks : 0;
    u.uVig.value = f.vignette.amount;
    u.uVigSoft.value = f.vignette.softness;
    u.uGrain.value = f.grain.amount;
    u.uGrainSize.value = f.grain.size;
    u.uGrainChroma.value = f.grain.chroma;
    u.uWipe.value = o.wipe ?? -1;
    u.uIsolate.value = o.isolate ?? 0;
    u.uSource.value = base === "source" ? 1 : 0;
    this.p.quad.draw(gl, c, target);
  }

  dispose() {
    for (const t of [this.graded, this.styled, this.halA, this.halB, this.bloomA, this.bloomB, this.streakA, this.streakB]) t.dispose();
  }
}

/** Scene-linear render → clean plate (the "generation" stage's output). */
export function develop(gl: WebGLRenderer, p: Programs, scene: WebGLRenderTarget, out: WebGLRenderTarget) {
  p.develop.uniforms.tScene.value = scene.texture;
  p.quad.draw(gl, p.develop, out);
}

/** Read a byte render target back as top-row-first RGBA. */
export function readTarget(gl: WebGLRenderer, rt: WebGLRenderTarget): Uint8Array {
  const w = rt.width, h = rt.height;
  const buf = new Uint8Array(w * h * 4);
  gl.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  return out;
}
