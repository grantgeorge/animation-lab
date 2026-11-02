/**
 * GLSL for the grading pipeline. Every colour operation here mirrors a function in `../engine`
 * (named in the comments); the e2e spec checks GPU output against the engine.
 * All programs are WebGL2 (three prepends `#version 300 es` and the gl_FragColor / texture2D shims).
 */

export const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
varying vec2 vUv;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
// engine/color.ts toLinear / toEncoded
float toLinear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
vec3 toLinear(vec3 c) { return vec3(toLinear1(c.r), toLinear1(c.g), toLinear1(c.b)); }
float toEncoded1(float l) { if (l <= 0.0) return 0.0; return l <= 0.0031308 ? l * 12.92 : 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
vec3 toEncoded(vec3 l) { return vec3(toEncoded1(l.r), toEncoded1(l.g), toEncoded1(l.b)); }
`;

/** Scene-linear HDR render → the clean plate: three's ACES filmic fit + sRGB encode (engine/color.ts acesFilmic). */
export const DEVELOP_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tScene;
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
void main() {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  vec3 c = texture2D(tScene, vUv).rgb / 0.6;
  c = clamp(ACESOutputMat * RRTAndODTFit(ACESInputMat * c), 0.0, 1.0);
  gl_FragColor = vec4(toEncoded(c), 1.0);
}`;

/** Up to four grade layers in sequence (engine/grade.ts applyResolved, packGrade layout). */
export const GRADE_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tInput;
uniform vec4 uGrades[40];
uniform int uLayers;
float rolloff(float x, float knee) {
  if (knee >= 0.999 || x <= knee) return x;
  float w = 1.0 - knee;
  return knee + w * (1.0 - exp(-(x - knee) / w));
}
float contrastCurve(float x, float c, float p) {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  return x < p ? p * pow(x / p, c) : 1.0 - (1.0 - p) * pow((1.0 - x) / (1.0 - p), c);
}
vec3 applyGrade(vec3 c, int o) {
  vec4 a0 = uGrades[o], a1 = uGrades[o + 1], a2 = uGrades[o + 2], a3 = uGrades[o + 3], a4 = uGrades[o + 4];
  vec4 a5 = uGrades[o + 5], a6 = uGrades[o + 6], a7 = uGrades[o + 7], a8 = uGrades[o + 8], a9 = uGrades[o + 9];
  vec3 l = toLinear(c) * a0.rgb;
  vec3 x = vec3(dot(a1.rgb, l), dot(a2.rgb, l), dot(a3.rgb, l));
  vec3 outc;
  for (int i = 0; i < 3; i++) {
    float v = toEncoded1(clamp(rolloff(max(0.0, x[i]), a0.a), 0.0, 1.0));
    v = pow(v, a9[i]);
    v = contrastCurve(v, a1.a, a2.a);
    v = max(0.0, a6[i] * (v + a4[i] * (1.0 - v)));
    outc[i] = pow(v, 1.0 / a5[i]);
  }
  float L = dot(outc, LUMA);
  float t = smoothstep(a4.a - 0.4, a4.a + 0.4, L);
  outc += (1.0 - t) * a7.rgb + t * a8.rgb;
  float L2 = dot(outc, LUMA);
  return clamp(vec3(L2) + (outc - vec3(L2)) * a3.a, 0.0, 1.0);
}
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  for (int k = 0; k < 4; k++) {
    if (k >= uLayers) break;
    c = applyGrade(c, k * 10);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const HASH = /* glsl */ `
// engine/grain.ts pcg3d (uint, bit-exact with Math.imul)
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
float lattice(vec2 i, int frame, int ch) {
  uvec3 h = pcg3d(uvec3(uint(int(i.x) + 8192), uint(int(i.y) + 8192), uint(frame * 4 + ch)));
  return float(h.x) / 4294967295.0 * 2.0 - 1.0;
}
float valueNoise(vec2 p, int frame, int ch) {
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  float a = lattice(i, frame, ch), b = lattice(i + vec2(1.0, 0.0), frame, ch);
  float c = lattice(i + vec2(0.0, 1.0), frame, ch), d = lattice(i + vec2(1.0, 1.0), frame, ch);
  return a + (b - a) * f.x + (c - a) * f.y + (a - b - c + d) * f.x * f.y;
}
float grainNoise(vec2 px, int frame, int ch, float size) {
  float s = max(0.5, size);
  float n1 = valueNoise(px / s, frame, ch);
  float n2 = valueNoise(px / (s * 2.0) + vec2(37.1, 11.7), frame, ch + 8);
  return (0.86 * n1 + 0.28 * n2) * 2.0;
}
float grainWeight(float l) {
  float m = max(0.0, 4.0 * l * (1.0 - l));
  return 0.06 + 0.94 * pow(m, 0.75);
}
`;

/** Stylization: comic print or painterly (screen-space; strokes are not attached to surfaces). */
export const STYLIZE_FRAG = /* glsl */ `
${COMMON}
${HASH}
uniform sampler2D tInput;
uniform vec2 uRes;
uniform int uMode;      // 1 comic, 2 painterly
uniform float uAmount;
uniform float uScale;   // px at a 540-line monitor
uniform float uMis;
uniform float uInk;
uniform float uPaper;
float lum(vec2 uv) { return dot(texture2D(tInput, uv).rgb, LUMA); }
float sobel(vec2 uv, vec2 px) {
  float tl = lum(uv + px * vec2(-1, 1)), t = lum(uv + px * vec2(0, 1)), tr = lum(uv + px * vec2(1, 1));
  float l = lum(uv + px * vec2(-1, 0)), r = lum(uv + px * vec2(1, 0));
  float bl = lum(uv + px * vec2(-1, -1)), b = lum(uv + px * vec2(0, -1)), br = lum(uv + px * vec2(1, -1));
  float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
  float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
  return length(vec2(gx, gy));
}
float paperTex(vec2 p) {
  float n = valueNoise(p * 0.35, 3, 1) * 0.5 + valueNoise(p * 0.09, 5, 2) * 0.35 + valueNoise(vec2(p.x * 0.03, p.y * 0.9), 7, 3) * 0.25;
  return n;
}
vec3 comic(vec2 uv) {
  float k = uRes.y / 540.0;
  vec2 px = 1.0 / uRes;
  vec2 mis = vec2(uMis * k, -uMis * 0.6 * k) * px;
  vec3 base = vec3(texture2D(tInput, uv + mis).r, texture2D(tInput, uv).g, texture2D(tInput, uv - mis).b);
  float L = dot(base, LUMA);
  // halftone dots for shading, 45° screen
  float cell = max(2.5, uScale * k);
  vec2 frag = vUv * uRes;
  mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
  vec2 g = rot * frag / cell;
  vec2 f = fract(g) - 0.5;
  float cover = 1.0 - smoothstep(0.08, 0.72, L);
  float r = sqrt(cover) * 0.62;
  float d = length(f);
  float aa = 0.9 / cell;
  float dotMask = 1.0 - smoothstep(r - aa, r + aa, d);
  vec3 ink = mix(base, base * 0.36, dotMask * 0.8);
  // Ben-Day colour dots in the lights: small offset dots of a lighter tint
  vec2 g2 = rot * (frag + vec2(cell * 0.5)) / (cell * 0.8);
  float d2 = length(fract(g2) - 0.5);
  float light = smoothstep(0.55, 0.9, L);
  ink = mix(ink, ink * vec3(1.0, 0.86, 0.9), (1.0 - smoothstep(0.18, 0.24, d2)) * light * 0.6);
  // inked outlines
  float e = smoothstep(0.2, 0.5, sobel(uv, px * max(1.0, k)));
  ink *= 1.0 - e * uInk * 0.9;
  // paper
  float p = paperTex(frag / max(1.0, k));
  ink *= 1.0 - uPaper * 0.07 * (p * 0.5 + 0.5);
  ink = mix(ink, ink * vec3(1.0, 0.97, 0.9) + vec3(0.02, 0.015, 0.0), uPaper * 0.6);
  return ink;
}
vec3 painterly(vec2 uv0) {
  float k = uRes.y / 540.0;
  vec2 px = 1.0 / uRes;
  // a low-frequency wobble so CG silhouettes read as brushed, not ruled
  vec2 fp = vUv * uRes / max(1.0, k);
  vec2 uv = uv0 + vec2(valueNoise(fp * 0.06, 17, 1), valueNoise(fp * 0.06, 19, 2)) * 1.6 * k * px;
  int R = int(clamp(floor(uScale * k + 0.5), 2.0, 8.0));
  vec3 m[4]; vec3 s[4];
  for (int q = 0; q < 4; q++) { m[q] = vec3(0.0); s[q] = vec3(0.0); }
  float n = float((R + 1) * (R + 1));
  for (int j = 0; j <= 8; j++) {
    if (j > R) break;
    for (int i = 0; i <= 8; i++) {
      if (i > R) break;
      vec3 a = texture2D(tInput, uv + vec2(-i, -j) * px).rgb;
      vec3 b = texture2D(tInput, uv + vec2(i, -j) * px).rgb;
      vec3 c = texture2D(tInput, uv + vec2(-i, j) * px).rgb;
      vec3 d = texture2D(tInput, uv + vec2(i, j) * px).rgb;
      m[0] += a; s[0] += a * a; m[1] += b; s[1] += b * b; m[2] += c; s[2] += c * c; m[3] += d; s[3] += d * d;
    }
  }
  vec3 best = vec3(0.0);
  float minVar = 1e9;
  for (int q = 0; q < 4; q++) {
    vec3 mean = m[q] / n;
    vec3 v = abs(s[q] / n - mean * mean);
    float sv = v.r + v.g + v.b;
    if (sv < minVar) { minVar = sv; best = mean; }
  }
  vec2 frag = vUv * uRes / max(1.0, k);
  // brush grain: directional streaks that vary by region
  float ang = valueNoise(frag * 0.02, 11, 1) * 3.14159;
  vec2 dir = vec2(cos(ang), sin(ang));
  float stroke = valueNoise(vec2(dot(frag, dir) * 0.08, dot(frag, vec2(-dir.y, dir.x)) * 0.9), 13, 2);
  best *= 1.0 + 0.085 * stroke;
  float e = smoothstep(0.1, 0.4, sobel(uv, px * max(1.0, k)));
  best *= 1.0 - e * uInk * 0.55;
  float p = paperTex(frag);
  best = mix(best, best * (0.93 + 0.07 * p) * vec3(1.0, 0.985, 0.95) + vec3(0.012, 0.01, 0.0), uPaper);
  return best;
}
void main() {
  vec3 src = texture2D(tInput, vUv).rgb;
  vec3 c = uMode == 1 ? comic(vUv) : painterly(vUv);
  gl_FragColor = vec4(clamp(mix(src, c, uAmount), 0.0, 1.0), 1.0);
}`;

/** Glow prefilter: highlights only (halation) or soft-threshold highlights plus mist (bloom / streaks). */
export const PREFILTER_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tInput;
uniform float uThreshold;
uniform float uMist;
uniform int uMode; // 0 halation, 1 bloom
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  float L = dot(c, LUMA);
  vec3 lin = toLinear(c);
  float w = uMode == 0 ? smoothstep(uThreshold, min(1.0, uThreshold + 0.18), L) : smoothstep(uThreshold - 0.25, uThreshold + 0.2, L);
  if (uMode == 1) w = max(w, uMist * 0.3);
  gl_FragColor = vec4(lin * w, 1.0);
}`;

/** Separable Gaussian (13 taps, sigma 4 texels × spread). */
export const BLUR_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tInput;
uniform vec2 uStep;
void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float x = float(i);
    float w = exp(-x * x / 32.0);
    acc += texture2D(tInput, vUv + uStep * x).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

/** Finishing composite: weave → lens → sharpen → glows → vignette → encode → grain → wipe. */
export const COMPOSITE_FRAG = /* glsl */ `
${COMMON}
${HASH}
uniform sampler2D tBase;
uniform sampler2D tBefore;
uniform sampler2D tHal;
uniform sampler2D tBloom;
uniform sampler2D tStreak;
uniform vec2 uRes;
uniform int uFrame;
uniform float uWeave;
uniform float uDistort;
uniform float uCA;
uniform float uSharpen;
uniform float uHal;
uniform float uHalThr;
uniform float uBloom;
uniform float uStreak;
uniform float uVig;
uniform float uVigSoft;
uniform float uGrain;
uniform float uGrainSize;
uniform float uGrainChroma;
uniform float uWipe;
uniform int uIsolate;   // 0 none, 1 halation only, 2 bloom only
uniform int uSource;    // 1: show the source plate only
void main() {
  if (uSource == 1) { gl_FragColor = vec4(texture2D(tBefore, vUv).rgb, 1.0); return; }
  if (uWipe >= 0.0 && vUv.x < uWipe) { gl_FragColor = vec4(texture2D(tBefore, vUv).rgb, 1.0); return; }
  vec2 px = 1.0 / uRes;
  vec2 uv = vUv;
  // gate weave: a small per-frame jitter of the whole picture
  if (uWeave > 0.0) {
    uvec3 h = pcg3d(uvec3(uint(uFrame) + 911u, 17u, 3u));
    vec2 j = (vec2(float(h.x), float(h.y)) / 4294967295.0 - 0.5) * vec2(1.6, 1.1) * (uRes.y / 540.0);
    uv += j * px * uWeave;
  }
  // barrel distortion, normalised so the corners stay the corners
  float aspect = uRes.x / uRes.y;
  vec2 d = uv - 0.5;
  vec2 p = d * vec2(aspect, 1.0);
  float r2 = dot(p, p);
  float rc = 0.25 * (aspect * aspect + 1.0);
  vec2 uvD = 0.5 + d * (1.0 + uDistort * r2) / (1.0 + uDistort * rc);
  float r2n = r2 / rc;
  vec2 dd = uvD - 0.5;
  vec2 uvR = 0.5 + dd * (1.0 + 0.014 * uCA * r2n);
  vec2 uvB = 0.5 + dd * (1.0 - 0.014 * uCA * r2n);
  vec3 c = vec3(texture2D(tBase, uvR).r, texture2D(tBase, uvD).g, texture2D(tBase, uvB).b);
  if (uSharpen > 0.0) {
    vec3 n4 = texture2D(tBase, uvD + vec2(px.x, 0.0)).rgb + texture2D(tBase, uvD - vec2(px.x, 0.0)).rgb + texture2D(tBase, uvD + vec2(0.0, px.y)).rgb + texture2D(tBase, uvD - vec2(0.0, px.y)).rgb;
    c = clamp(c + uSharpen * 1.3 * (c - n4 * 0.25), 0.0, 1.0);
  }
  vec3 lin = toLinear(c);
  vec3 hal = vec3(0.0), bloom = vec3(0.0), streak = vec3(0.0);
  if (uHal > 0.0) {
    float h = dot(texture2D(tHal, uvD).rgb, LUMA);
    // the glow rings the highlight: inside the bright core it is mostly hidden
    if (uIsolate != 1) h *= 1.0 - 0.5 * smoothstep(uHalThr, min(1.0, uHalThr + 0.12), dot(c, LUMA));
    // red-orange: halation is light bouncing off the film base back through the red-sensitive layer
    hal = uHal * 1.6 * h * vec3(1.0, 0.24, 0.05);
  }
  if (uBloom > 0.0) bloom = uBloom * 1.15 * texture2D(tBloom, uvD).rgb;
  if (uStreak > 0.0) streak = uStreak * 2.2 * dot(texture2D(tStreak, uvD).rgb, LUMA) * vec3(0.3, 0.55, 1.0);
  if (uIsolate == 1) lin = hal * 2.0;
  else if (uIsolate == 2) lin = bloom * 2.0;
  else lin += hal + bloom + streak;
  // vignette in linear light, like real lens falloff
  vec2 q = (uv - 0.5) * 2.0;
  float vr = length(q) * 0.7071;
  float inner = mix(0.75, 0.05, uVigSoft);
  lin *= 1.0 - uVig * 0.82 * smoothstep(inner, 1.08, vr);
  vec3 outc = toEncoded(clamp(lin, 0.0, 1.0));
  // grain last, on the encoded picture, strongest in the mids (engine/grain.ts grainAt)
  if (uGrain > 0.0 && uIsolate == 0) {
    vec2 gp = floor(vUv * uRes);
    float k = uGrain * 0.1 * grainWeight(dot(outc, LUMA));
    float mono = grainNoise(gp, uFrame, 0, uGrainSize);
    vec3 own = uGrainChroma > 0.0 ? vec3(grainNoise(gp, uFrame, 1, uGrainSize), grainNoise(gp, uFrame, 2, uGrainSize), grainNoise(gp, uFrame, 3, uGrainSize)) : vec3(mono);
    outc += k * (vec3(mono) + (own - vec3(mono)) * uGrainChroma);
  }
  gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}`;
