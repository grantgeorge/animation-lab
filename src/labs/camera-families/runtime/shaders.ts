/**
 * Full-screen passes for the shot: accumulate (motion blur), depth of field and the look.
 * The DoF blur and the look curve evaluate the same formulas as engine/optics.ts and
 * engine/looks.ts, so the diagrams and the picture always agree.
 */
export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const ACCUM_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform float weight;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tColor, vUv).rgb * weight, weight);
}`;

/**
 * Scatter-as-gather bokeh (after Gustafsson's single-pass DoF). Blur radius per pixel is the
 * thin-lens blur disc b = f²|z − s| / (N z (s − f)), converted from sensor mm to pixels.
 * Alpha carries "inside the depth of field" (b ≤ CoC) for the focus overlay.
 */
export const DOF_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float cameraNear;
uniform float cameraFar;
uniform float focalMm;
uniform float stop;
uniform float focusMm;
uniform float sensorWidthMm;
uniform float widthPx;
uniform float cocMm;
uniform float maxRadius;
uniform float radScale;
varying vec2 vUv;
const float GOLDEN = 2.39996323;

float viewZ(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}
float blurMm(float zM) {
  float z = max(zM * 1000.0, focalMm * 1.001);
  float s = max(focusMm, focalMm * 1.001);
  return focalMm * focalMm * abs(z - s) / (stop * z * (s - focalMm));
}
float radiusPx(float zM) { return min(0.5 * blurMm(zM) / sensorWidthMm * widthPx, maxRadius); }

void main() {
  float cz = viewZ(texture2D(tDepth, vUv).r);
  float cr = radiusPx(cz);
  vec3 col = texture2D(tColor, vUv).rgb;
  float tot = 1.0;
  float r = radScale;
  float ang = 0.0;
  for (int i = 0; i < 160; i++) {
    if (r >= maxRadius) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * r;
    vec3 sc = texture2D(tColor, tc).rgb;
    float sz = viewZ(texture2D(tDepth, tc).r);
    float sr = radiusPx(sz);
    if (sz > cz) sr = clamp(sr, 0.0, cr * 2.0);
    float m = smoothstep(r - 0.5 * radScale, r + 0.5 * radScale, sr);
    col += mix(col / tot, sc, m);
    tot += 1.0;
    ang += GOLDEN;
    r += radScale / r;
  }
  gl_FragColor = vec4(col / tot, blurMm(cz) <= cocMm ? 1.0 : 0.0);
}`;

export const LOOK_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 texel;
uniform vec2 res;
uniform float exposure;
uniform vec3 wb;
uniform float crosstalk;
uniform float saturation;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float rawSlope;
uniform float shoulderNorm;
uniform float clipStops;
uniform float shoulder;
uniform float toe;
uniform float midGrey;
uniform float black;
uniform float grain;
uniform float grainSize;
uniform float chroma;
uniform float seed;
uniform float halation;
uniform float bloom;
uniform float sharpen;
uniform float vignette;
uniform vec2 weave;
uniform float bandOverlay;
varying vec2 vUv;

float softClip(float a, float p) { return a / pow(1.0 + pow(a, p), 1.0 / p); }
float curve(float x) {
  float s = min(log2(max(x, 1e-6) / 0.18), clipStops);
  if (s >= 0.0) {
    float head = 1.0 - midGrey;
    return midGrey + head * softClip(rawSlope * s / head, shoulder) / shoulderNorm;
  }
  float foot = midGrey - black;
  return midGrey - foot * softClip(rawSlope * (-s) / shoulderNorm / foot, toe);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y) * 2.0 - 1.0;
}

void main() {
  vec2 uv = vUv + weave * texel;
  vec4 c4 = texture2D(tColor, uv);
  vec3 c = c4.rgb;
  if (sharpen != 0.0) {
    vec3 n = texture2D(tColor, uv + vec2(texel.x, 0.0)).rgb + texture2D(tColor, uv - vec2(texel.x, 0.0)).rgb
           + texture2D(tColor, uv + vec2(0.0, texel.y)).rgb + texture2D(tColor, uv - vec2(0.0, texel.y)).rgb;
    c = max(c + sharpen * (c - n * 0.25), 0.0);
  }
  if (halation > 0.0 || bloom > 0.0) {
    vec3 hal = vec3(0.0);
    vec3 blo = vec3(0.0);
    float scale = res.y / 1080.0;
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      float a = fi * 2.39996323;
      float rr = (3.0 + fi * 1.6) * scale;
      vec3 s = texture2D(tColor, uv + vec2(cos(a), sin(a)) * texel * rr).rgb;
      vec3 hot = max(s - 1.0, 0.0);
      hal += hot * (1.0 - fi / 24.0);
      blo += hot;
    }
    c += hal / 12.0 * halation * vec3(1.0, 0.32, 0.12) + blo / 24.0 * bloom;
  }
  c *= exposure * wb;
  float avg = (c.r + c.g + c.b) / 3.0;
  c = mix(c, (vec3(avg) * 3.0 - c) * 0.5, crosstalk);
  vec3 v = vec3(curve(c.r), curve(c.g), curve(c.b));
  float luma = dot(v, vec3(0.2126, 0.7152, 0.0722));
  v = mix(vec3(luma), v, saturation);
  v += shadowTint * (1.0 - smoothstep(0.0, 0.5, luma)) + highlightTint * smoothstep(0.45, 1.0, luma);
  if (grain > 0.0) {
    vec2 gp = gl_FragCoord.xy / max(grainSize * res.y / 1080.0, 0.5) + seed * vec2(17.0, 31.0);
    float w = 4.0 * luma * (1.0 - luma) * 0.8 + 0.2;
    vec3 g = chroma > 0.5 ? vec3(vnoise(gp), vnoise(gp + 41.0), vnoise(gp + 83.0)) : vec3(vnoise(gp));
    v += g * grain * w;
  }
  vec2 q = vUv - 0.5;
  v *= 1.0 - vignette * pow(dot(q, q) * 2.0, 1.4);
  if (bandOverlay > 0.0 && c4.a > 0.5) v = mix(v, vec3(0.35, 1.0, 0.62), 0.32 * bandOverlay);
  gl_FragColor = vec4(clamp(v, 0.0, 1.0), 1.0);
}`;
