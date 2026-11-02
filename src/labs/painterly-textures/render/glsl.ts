/**
 * GLSL injected into cloned MeshStandard/Physical materials (onBeforeCompile). One material does
 * both looks: ptPaint = 0 is the untouched PBR path, 1 the painted path, so the clean and painted
 * passes of one frame share every program. Mirrors engine/ramp.ts (ptRamp) and engine/noise.ts.
 */

export const VERT_PARS = /* glsl */ `
uniform float ptRestScale;
varying vec3 vPtRest;
varying vec3 vPtRestN;
#ifdef PT_ENV
varying vec3 vPtWorld;
#endif
`;

/** After <skinning_vertex>: the rest-pose (bind) position is the surface coordinate. */
export const VERT_MAIN = /* glsl */ `
vPtRest = position * ptRestScale;
vPtRestN = normal;
#ifdef PT_ENV
vPtWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`;

/** Shared by the surface materials and the screen-space filter (which feeds it pixel coordinates). */
export const DABS = /* glsl */ `
vec3 ptH3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
/**
 * Painted dabs in rest space (engine/dabs.ts mirrors this). One jittered dab per cell: an ellipsoid
 * two cells long, laid along the surface tangent that wraps around the form (rotated by ptAngle).
 * The top-most covering dab wins, like overlapping paint. Its bristles come from the brush tile.
 * Returns (value, hue id, break mask, coverage).
 */
vec4 ptDabs(vec3 p, vec3 n) {
  n = normalize(n);
  vec3 ref = abs(n.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t0 = normalize(cross(ref, n));
  vec3 b0 = cross(n, t0);
  vec3 tt = t0 * cos(ptAngle) + b0 * sin(ptAngle);
  vec3 bb = cross(n, tt);
  vec3 q = p * ptTiles + ptSeed * 7.0;
  vec3 i = floor(q);
  float bestZ = -1.0;
  vec4 res = vec4(0.5, 0.5, 0.5, 0.0);
  vec2 bestUv = vec2(0.0);
  vec3 bestH = vec3(0.0);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 c = i + vec3(float(x), float(y), float(z));
    vec3 h = ptH3(c);
    vec3 d = q - (c + h);
    float len = 0.88 + 0.12 * h.x;
    float wid = 0.21 + 0.08 * h.y;
    vec3 e = vec3(dot(d, tt) / len, dot(d, bb) / wid, dot(d, n) / 1.0);
    // blunt start, tapered tail
    e.y *= 1.0 + 0.45 * smoothstep(-0.2, 1.0, e.x);
    float r = length(e);
    if (r < 1.0 && h.z > bestZ) {
      bestZ = h.z;
      vec3 h2 = ptH3(c + 17.31);
      res = vec4(0.2 + 0.6 * h2.x, h2.y, h2.z, 1.0 - smoothstep(0.82, 1.0, r));
      bestUv = e.xy;
      bestH = h2;
    }
  }
  if (res.a > 0.0) {
    // bristles: a strip of the brush tile, read along the dab
    float br = texture2D(ptBrush, vec2(bestUv.x * 0.16, bestUv.y * 0.035) + bestH.xy * 7.0).r;
    res.r = clamp(res.r + (br - 0.5) * 0.75, 0.0, 1.0);
    res.r = mix(0.5, res.r, res.a);
  }
  return res;
}
`;

export const FRAG_PARS = /* glsl */ `
uniform sampler2D ptBrush;
uniform float ptPaint;
uniform float ptTex;
uniform float ptShade;
uniform float ptDebug;
uniform float ptTiles;
uniform float ptAngle;
uniform float ptPatchFreq;
uniform float ptBands;
uniform float ptBreak;
uniform float ptMid;
uniform float ptRim;
uniform vec3 ptShadowTint;
uniform vec3 ptLightTint;
uniform vec3 ptRimColor;
uniform vec3 ptRimDir;
uniform vec3 ptSeed;
varying vec3 vPtRest;
varying vec3 vPtRestN;
#ifdef PT_ENV
uniform float ptProj;
uniform float ptProjAllow;
uniform float ptMatteReady;
uniform sampler2D ptMatte;
uniform sampler2D ptAcesInv;
uniform mat4 ptProjVP;
varying vec3 vPtWorld;
#endif

float ptHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ptNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ptHash(i), ptHash(i + vec3(1, 0, 0)), f.x), mix(ptHash(i + vec3(0, 1, 0)), ptHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(ptHash(i + vec3(0, 0, 1)), ptHash(i + vec3(1, 0, 1)), f.x), mix(ptHash(i + vec3(0, 1, 1)), ptHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
vec2 ptRot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
${DABS}
/** N painted value bands between 0.16 and 0.86 (engine/ramp.ts rampValue). */
float ptRamp(float x) {
  float n = clamp(ptBands, 2.0, 4.0);
  float lo = 0.12, hi = 0.88;
  float w = max(fwidth(x) * 0.75, 0.01);
  float acc = 0.0;
  for (int i = 1; i < 4; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float e = lo + (hi - lo) * fi / n;
    acc += smoothstep(e - w, e + w, x);
  }
  return mix(0.16, 0.86, acc / (n - 1.0));
}
float ptLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
#ifdef PT_CHAR
#define PT_PATCH_AMP 0.1
#define PT_DAB_AMP 0.6
#define PT_DAB_BREAK 1.0
#else
#define PT_PATCH_AMP 0.2
#define PT_DAB_AMP 0.24
#define PT_DAB_BREAK 0.0
#endif
`;

/** After <color_fragment>: (a) hand-painted albedo, (c) matte projection lookup. */
export const FRAG_ALBEDO = /* glsl */ `
float ptOn = step(0.5, ptPaint);
vec4 ptB = vec4(0.5);
if (ptOn > 0.5) {
  ptB = ptDabs(vPtRest, vPtRestN);
  if (ptTex > 0.0) {
    vec3 ptBase = diffuseColor.rgb;
    #if defined(PT_CHAR) && defined(USE_MAP)
      // simplified detail: a softer mip of the same texture
      vec3 ptSoft = texture2D(map, vMapUv, 1.25).rgb * diffuse;
      ptBase = mix(ptBase, ptSoft, 0.6);
    #endif
    float ptPatch = ptNoise(vPtRest * ptPatchFreq + ptSeed * 2.3);
    float ptPatchQ = floor(ptPatch * 4.0) / 3.0;
    float ptV = (ptB.r - 0.5) * PT_DAB_AMP + (ptPatchQ - 0.5) * PT_PATCH_AMP;
    vec3 ptTint = mix(vec3(0.9, 0.97, 1.1), vec3(1.1, 0.99, 0.88), ptB.g);
    vec3 ptPainted = ptBase * mix(vec3(1.0), ptTint, ptB.a) * (1.0 + ptV);
    float ptL = ptLuma(ptPainted);
    ptPainted = max(mix(vec3(ptL), ptPainted, 1.12), 0.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, ptPainted, ptTex);
  }
}
#ifdef PT_ENV
float ptPM = 0.0;
vec3 ptMatteCol = vec3(0.0);
if (ptOn > 0.5 && ptProj > 0.0 && ptProjAllow > 0.5 && ptMatteReady > 0.5) {
  vec4 ptPc = ptProjVP * vec4(vPtWorld, 1.0);
  if (ptPc.w > 0.0) {
    vec2 ptUv = ptPc.xy / ptPc.w * 0.5 + 0.5;
    vec2 ptE = smoothstep(vec2(0.0), vec2(0.012), ptUv) * smoothstep(vec2(0.0), vec2(0.012), 1.0 - ptUv);
    ptPM = ptE.x * ptE.y;
    vec3 ptM = texture2D(ptMatte, clamp(ptUv, 0.0, 1.0)).rgb;
    // undo the display tone curve so the composite's tone map returns the painted value
    ptMatteCol = vec3(texture2D(ptAcesInv, vec2(ptM.r, 0.5)).r, texture2D(ptAcesInv, vec2(ptM.g, 0.5)).r, texture2D(ptAcesInv, vec2(ptM.b, 0.5)).r);
  }
}
#endif
`;

/** After <normal_fragment_maps>: painted surfaces drop most of the micro normal detail. */
export const FRAG_NORMAL = /* glsl */ `
#ifdef PT_CHAR
if (ptPaint > 0.5 && ptTex > 0.0) normal = normalize(mix(normal, nonPerturbedNormal, 0.8 * ptTex));
#endif
`;

/** Replaces the outgoingLight line: (b) painterly shading, then the projected matte on top. */
export const FRAG_SHADE = /* glsl */ `
vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
if (ptOn > 0.5 && ptShade > 0.0) {
  // metals keep their base colour as paint; irradiance is measured against the lit diffuse
  vec3 ptAlb = max(diffuseColor.rgb, vec3(0.012));
  vec3 ptIrr = totalDiffuse / max(material.diffuseColor, vec3(0.012));
  float ptLi = ptLuma(ptIrr);
  vec3 ptHue = ptIrr / max(ptLi, 1e-4);
  ptHue /= max(ptLuma(ptHue), 1e-3);
  float ptX = ptLi / (ptLi + ptMid);
  // the terminator is cut along brush strokes, in surface space
  float ptBrk = (ptB.b - 0.5) * ptBreak * ptB.a * PT_DAB_BREAK + (ptNoise(vPtRest * ptTiles * 0.35 + ptSeed * 4.1) - 0.5) * ptBreak * 0.8;
  float ptQ = ptRamp(ptX + ptBrk);
  float ptLq = ptMid * ptQ / max(1.0 - ptQ, 0.06);
  float ptWarm = smoothstep(0.3, 0.62, ptQ);
  // shadows: the cool shadow colour, but keeping some of the local colour so they don't go muddy
  vec3 ptLocal = ptAlb / max(ptLuma(ptAlb), 1e-3);
  vec3 ptShadowC = mix(ptShadowTint, ptShadowTint * ptLocal, 0.45);
  vec3 ptTintS = mix(ptShadowC, mix(ptHue, ptLightTint, 0.6), ptWarm);
  vec3 ptCol = ptAlb * ptTintS * ptLq;
  // specular as a painted dab, not a smooth hotspot
  // (direct light only, glossy surfaces only: ambient sheen on rough plaster must not speckle)
  float ptSpec = ptLuma(reflectedLight.directSpecular);
  float ptGloss = 1.0 - smoothstep(0.4, 0.75, roughnessFactor);
  ptCol += smoothstep(0.28, 0.4, ptSpec + (ptB.r - 0.5) * 0.08) * ptLightTint * 0.25 * ptGloss * ptB.a;
  // rim light as one painted stroke along the silhouette, on the side the rim lamp comes from
  vec3 ptNw = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  float ptFres = 1.0 - saturate(dot(normal, geometryViewDir));
  float ptRimN = ptNoise(vPtRest * ptTiles * 0.22 + ptSeed * 3.7);
  float ptRimM = smoothstep(0.6, 0.7, ptFres + (ptRimN - 0.5) * 0.22) * smoothstep(-0.1, 0.4, dot(ptNw, ptRimDir));
  ptCol = mix(ptCol, ptRimColor * (0.18 + 0.5 * ptLuma(ptAlb)), ptRimM * ptRim);
  // metals are painted from what they reflect: band the full light, keep its colour
  float ptLo = ptLuma(outgoingLight);
  float ptQm = ptRamp(ptLo / (ptLo + ptMid) + ptBrk);
  vec3 ptMetal = outgoingLight / max(ptLo, 1e-4) * (ptMid * ptQm / max(1.0 - ptQm, 0.06));
  ptCol = mix(ptCol, ptMetal, smoothstep(0.4, 0.7, metalnessFactor));
  outgoingLight = mix(outgoingLight, ptCol + totalEmissiveRadiance, ptShade);
}
#ifdef PT_ENV
outgoingLight = mix(outgoingLight, ptMatteCol, ptPM * ptProj);
#endif
if (ptDebug > 0.5) outgoingLight = diffuseColor.rgb * 0.75;
`;
