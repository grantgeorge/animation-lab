import { DABS } from "./glsl";
import { Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, type Texture } from "three";

/** Fullscreen-quad passes. All outputs are display-referred (tone mapped + sRGB encoded here). */

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DISPLAY = /* glsl */ `
vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c = I * (c / 0.6);
  c = rrtOdt(c);
  return clamp(O * c, 0.0, 1.0);
}
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 display(vec3 hdr) { return toSrgb(aces(hdr)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

/**
 * The look composite: clean | painted split at the wipe, and on the painted side the
 * (e) compositing layer: unifying grade, halation, painted edges from depth, paper, rough vignette.
 */
const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tPaint;
uniform sampler2D tClean;
uniform sampler2D tDepth;
uniform sampler2D tPaper;
uniform vec2 uRes;
uniform float uWipe;
uniform float uHasClean;
uniform float uComposite;
uniform float uPaper;
uniform vec3 uShadowTint;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;
${DISPLAY}
float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
vec3 finish(vec3 hdr, vec2 uv) {
  vec2 px = 1.0 / uRes;
  float paper = texture2D(tPaper, gl_FragCoord.xy / 512.0).r;
  float paper2 = texture2D(tPaper, gl_FragCoord.xy / 1400.0 + 0.37).r;
  // halation: warm glow around the brightest paint
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996;
    float r = 2.0 + float(i) * 0.9;
    vec3 s = texture2D(tPaint, uv + vec2(cos(a), sin(a)) * r * px).rgb;
    glow += min(max(s - 1.4, 0.0), vec3(2.0));
  }
  hdr += glow / 16.0 * vec3(1.0, 0.78, 0.55) * 0.35;
  vec3 col = display(hdr);
  // unify: cool the darks toward the shadow tint, warm the lights, a touch more saturation
  float l = luma(col);
  vec3 tintS = uShadowTint / max(luma(uShadowTint), 1e-3);
  col = mix(col, col * mix(tintS, vec3(1.0), 0.55), (1.0 - smoothstep(0.08, 0.5, l)) * 0.55);
  col = mix(col, col * vec3(1.05, 1.0, 0.92), smoothstep(0.5, 0.95, l) * 0.6);
  col = mix(vec3(luma(col)), col, 1.08);
  // painted edges: silhouettes from depth, with a wobbling line weight
  float d0 = linDepth(uv);
  float w = 1.2 + paper2 * 1.4;
  float dmax = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = (i == 0 ? vec2(1, 0) : i == 1 ? vec2(-1, 0) : i == 2 ? vec2(0, 1) : vec2(0, -1)) * w * px;
    dmax = max(dmax, linDepth(uv + o) - d0);
  }
  float edge = smoothstep(0.06, 0.2, dmax / max(d0, 0.3)) * (0.55 + 0.45 * paper);
  col = mix(col, col * vec3(0.32, 0.26, 0.28), edge * 0.6);
  // no dead digital black: lift the darkest paint toward indigo
  col = col * 0.955 + tintS * vec3(0.022, 0.026, 0.05) * (1.0 - smoothstep(0.0, 0.25, l));
  // paper: tooth in the paint, pigment pooling in the darks, paper showing in the lights
  float p = paper - 0.5;
  col *= 1.0 + p * 0.34 * uPaper;
  col -= p * 0.07 * (1.0 - l) * uPaper;
  col = mix(col, col * vec3(1.03, 1.0, 0.93) + vec3(0.02, 0.015, 0.0), uPaper * 0.5);
  // a rough, brushed vignette
  vec2 c = uv - 0.5;
  float v = length(c * vec2(1.0, 0.8)) + (paper2 - 0.5) * 0.12;
  col *= mix(1.0, 0.68, smoothstep(0.42, 0.78, v));
  return col;
}
void main() {
  vec3 painted = texture2D(tPaint, vUv).rgb;
  vec3 outc = uComposite > 0.5 ? finish(painted, vUv) : display(painted);
  if (uHasClean > 0.5 && vUv.x < uWipe) outc = display(texture2D(tClean, vUv).rgb);
  outc += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(outc, 1.0);
}
`;

/**
 * A screen-space painterly FILTER (the shower-door version of the test): Kuwahara smoothing of
 * the clean frame, then the same brush tile sampled in screen pixels instead of on the surface.
 */
const FILTER_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D ptBrush;
uniform vec2 uRes;
uniform float ptTiles;
uniform float ptAngle;
uniform vec3 ptSeed;
varying vec2 vUv;
${DISPLAY}
${DABS}
void main() {
  vec2 px = 1.0 / uRes;
  vec3 m[4];
  vec3 s2[4];
  for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s2[k] = vec3(0.0); }
  for (int j = 0; j <= 3; j++) {
    for (int i = 0; i <= 3; i++) {
      vec3 a = display(texture2D(tSrc, vUv + vec2(-i, -j) * px).rgb);
      vec3 b = display(texture2D(tSrc, vUv + vec2(i, -j) * px).rgb);
      vec3 c = display(texture2D(tSrc, vUv + vec2(-i, j) * px).rgb);
      vec3 d = display(texture2D(tSrc, vUv + vec2(i, j) * px).rgb);
      m[0] += a; s2[0] += a * a; m[1] += b; s2[1] += b * b; m[2] += c; s2[2] += c * c; m[3] += d; s2[3] += d * d;
    }
  }
  float best = 1e9;
  vec3 col = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    vec3 mu = m[k] / 16.0;
    vec3 var = abs(s2[k] / 16.0 - mu * mu);
    float v = var.r + var.g + var.b;
    if (v < best) { best = v; col = mu; }
  }
  // screen-fixed strokes: the very same dabs as the surface version, laid out in pixels
  vec4 br = ptDabs(vec3(gl_FragCoord.xy, 0.0), vec3(0.0, 0.0, 1.0));
  float val = (br.r - 0.5) * 0.5;
  vec3 tint = mix(vec3(0.9, 0.97, 1.1), vec3(1.1, 0.99, 0.88), br.g);
  col = col * mix(vec3(1.0), tint, br.a) * (1.0 + val);
  float l = luma(col);
  col = mix(col, col * (floor(l * 4.0 + 0.5) / 4.0) / max(l, 1e-3), 0.35);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/** Plain tone map + encode, for passes rendered to a target and shown as-is. */
const DISPLAY_FRAG = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
${DISPLAY}
void main() { gl_FragColor = vec4(display(texture2D(tSrc, vUv).rgb), 1.0); }
`;

export function compositeMaterial(paper: Texture) {
  return new ShaderMaterial({
    name: "painterly-composite",
    vertexShader: QUAD_VERT,
    fragmentShader: COMPOSITE_FRAG,
    uniforms: {
      tPaint: { value: null },
      tClean: { value: null },
      tDepth: { value: null },
      tPaper: { value: paper },
      uRes: { value: new Vector2(1, 1) },
      uWipe: { value: 0 },
      uHasClean: { value: 0 },
      uComposite: { value: 0 },
      uPaper: { value: 0.5 },
      uShadowTint: { value: new Color(0.8, 0.9, 1.2) },
      uNear: { value: 0.05 },
      uFar: { value: 40 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

export function filterMaterial(brush: Texture) {
  return new ShaderMaterial({
    name: "painterly-screen-filter",
    vertexShader: QUAD_VERT,
    fragmentShader: FILTER_FRAG,
    uniforms: {
      tSrc: { value: null },
      ptBrush: { value: brush },
      uRes: { value: new Vector2(1, 1) },
      ptTiles: { value: 1 / 12 },
      ptAngle: { value: 0.3 },
      ptSeed: { value: new Vector3() },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

export function displayMaterial() {
  return new ShaderMaterial({ name: "painterly-display", vertexShader: QUAD_VERT, fragmentShader: DISPLAY_FRAG, uniforms: { tSrc: { value: null } }, depthTest: false, depthWrite: false, toneMapped: false });
}

/**
 * Surface-coordinate pass for the crawl metric: each pixel stores the rest-pose surface cell it
 * shows (RGB = cell index, 1.2 cm cells), A = 1 on the character.
 */
export function coordsMaterial() {
  return new ShaderMaterial({
    name: "painterly-coords",
    uniforms: { uRestScale: { value: 1 }, uCell: { value: 0.012 } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <morphtarget_pars_vertex>
      #include <skinning_pars_vertex>
      uniform float uRestScale;
      varying vec3 vRest;
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <morphinstance_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vRest = position * uRestScale;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uCell;
      varying vec3 vRest;
      void main() {
        vec3 c = clamp(floor(vRest / uCell) + 128.0, 0.0, 255.0);
        gl_FragColor = vec4(c / 255.0, 1.0);
      }
    `,
    toneMapped: false,
  });
}

/** One quad + camera for every fullscreen pass. */
export function makeQuad() {
  const scene = new Scene();
  const mesh = new Mesh(new PlaneGeometry(2, 2));
  mesh.frustumCulled = false;
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { scene, mesh, camera };
}
