import { AdditiveBlending, AlwaysDepth, Color, DoubleSide, FrontSide, Matrix4, NormalBlending, ShaderMaterial, Vector2, Vector3, type Material, type Texture } from "three";
import { HAZE } from "../engine/haze";
import { PATH, FAR, NEAR } from "../engine/world";

/**
 * One shared uniform block for every forest material: sun, sky, haze (aerial perspective),
 * the parallax squash (relative to the frame-0 camera) and the occlusion x-ray.
 */
export const U = {
  uSunDir: { value: new Vector3(-0.55, 0.62, -0.56).normalize() },
  uSunColor: { value: new Color(1.0, 0.82, 0.58).multiplyScalar(1.55) },
  uSkyColor: { value: new Color(0.3, 0.42, 0.55) },
  uGroundColor: { value: new Color(0.14, 0.13, 0.08) },
  uHazeColor: { value: new Color(0.6, 0.7, 0.82) },
  uHazeAmount: { value: 1 },
  uRhoA: { value: HAZE.rhoA },
  uRhoH: { value: HAZE.rhoH },
  uHazeH: { value: HAZE.scaleH },
  uHazeMax: { value: HAZE.max },
  uSquashK: { value: 1 },
  uSquashD: { value: 10 },
  uRefView: { value: new Matrix4() },
  uRefViewInv: { value: new Matrix4() },
  uXray: { value: 0 },
  uTime: { value: 0 },
};

export const SHARED_GLSL = /* glsl */ `
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyColor; uniform vec3 uGroundColor; uniform vec3 uHazeColor;
uniform float uHazeAmount; uniform float uRhoA; uniform float uRhoH; uniform float uHazeH; uniform float uHazeMax;
uniform float uSquashK; uniform float uSquashD; uniform mat4 uRefView; uniform mat4 uRefViewInv;
uniform float uXray; uniform float uTime;
vec3 squashWorld(vec3 p) {
  if (uSquashK > 0.9999) return p;
  vec4 r = uRefView * vec4(p, 1.0);
  float z = -r.z;
  if (z < 0.05) return p;
  float z2 = uSquashD + (z - uSquashD) * uSquashK;
  r.xy *= z2 / z; r.z = -z2;
  return (uRefViewInv * r).xyz;
}
float hazeF(vec3 wp, vec3 cam) {
  float L = length(wp - cam);
  float H = uHazeH; float dy = wp.y - cam.y;
  float mist = abs(dy) < 1e-3 ? L * exp(-cam.y / H) : (L * H / dy) * (exp(-cam.y / H) - exp(-wp.y / H));
  float tau = uHazeAmount * (uRhoA * L + uRhoH * mist);
  return (1.0 - exp(-tau)) * uHazeMax;
}
vec3 hazeColorFor(vec3 dir) {
  float s = pow(max(dot(dir, uSunDir), 0.0), 5.0);
  return uHazeColor + uSunColor * 0.22 * s;
}
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

const FOREST_VERT = /* glsl */ `
#include <common>
${SHARED_GLSL}
varying vec3 vColor; varying vec3 vWorld; varying vec3 vNormalW; varying vec3 vObj;
void main() {
  vec4 wp = vec4(position, 1.0);
  mat3 nm = mat3(modelMatrix);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    nm = nm * mat3(instanceMatrix);
  #endif
  wp = modelMatrix * wp;
  vec3 w = squashWorld(wp.xyz);
  vWorld = w; vObj = position;
  vNormalW = normalize(nm * normal);
  vColor = vec3(1.0);
  #ifdef USE_COLOR
    vColor = color;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor;
  #endif
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const FOREST_FRAG = /* glsl */ `
#include <common>
${SHARED_GLSL}
uniform float uOpacity; uniform vec3 uFlatColor;
varying vec3 vColor; varying vec3 vWorld; varying vec3 vNormalW; varying vec3 vObj;
float pathX(float z) { return z > ${PATH.straightToZ.toFixed(2)} ? 0.0 : -${PATH.curve} * (z - (${PATH.straightToZ.toFixed(2)})) * (z - (${PATH.straightToZ.toFixed(2)})); }
void main() {
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = vColor;
  float nz = vnoise(vWorld * 0.31) * 0.6 + vnoise(vWorld * 1.9) * 0.4;
  alb *= 0.8 + 0.4 * nz;
  float under = 1.0;
  #ifdef GROUND
    float px = abs(vWorld.x - pathX(vWorld.z));
    float edge = ${PATH.halfWidthM.toFixed(2)} + (vnoise(vWorld * 0.9) - 0.5) * 0.5;
    float path = 1.0 - smoothstep(edge - 0.12, edge + 0.22, px);
    float litter = smoothstep(0.55, 0.75, vnoise(vWorld * 0.45 + 3.0));
    vec3 moss = mix(vec3(0.075, 0.12, 0.035), vec3(0.17, 0.2, 0.06), vnoise(vWorld * 0.2));
    moss = mix(moss, vec3(0.22, 0.1, 0.04), litter * 0.6);
    vec3 earth = mix(vec3(0.26, 0.16, 0.08), vec3(0.4, 0.27, 0.14), (1.0 - smoothstep(0.0, 0.9, px)) * 0.7 + 0.3 * vnoise(vWorld * 2.3));
    alb = mix(moss * 1.25, earth, path * vColor.r) * (0.8 + 0.4 * nz);
    // Far ground (valley, hills): read as dense forest canopy from above.
    float far = smoothstep(125.0, 230.0, -vWorld.z);
    alb = mix(alb, vec3(0.05, 0.085, 0.045) * (0.7 + 0.6 * vnoise(vWorld * 0.08)), far);
  #endif
  #ifdef CANOPY
    under = 0.0;
  #endif
  #ifdef BARK
    float streak = vnoise(vec3(vWorld.x * 2.6, vWorld.y * 0.09, vWorld.z * 2.6)) * 0.65 + vnoise(vec3(vWorld.x * 7.0, vWorld.y * 0.35, vWorld.z * 7.0)) * 0.35;
    alb *= 0.55 + 0.9 * smoothstep(0.2, 0.8, streak);
  #endif
  float ndl = dot(n, uSunDir);
  float wrapL = clamp(ndl * 0.6 + 0.4, 0.0, 1.0);
  float band = smoothstep(0.3, 0.72, wrapL);
  // Sun patches through the canopy (dapple) for everything under it.
  float dap = smoothstep(0.5, 0.68, vnoise(vec3(vWorld.xz * 0.085 + vWorld.y * vec2(0.06, 0.05), 1.7)));
  float low = 1.0 - smoothstep(24.0, 36.0, vWorld.y);
  float sun = band * mix(1.0, dap, under * low * 0.9);
  vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
  vec3 col = alb * (hemi + uSunColor * sun);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * (0.35 + 0.65 * max(dot(-V, uSunDir), 0.0));
  col += uSunColor * alb * rim * 0.9 * mix(1.0, dap, under * low * 0.7);
  #ifdef FERN
    // Backlit fronds glow a little (light through the leaf).
    col += uSunColor * alb * 0.55 * pow(max(dot(-V, uSunDir), 0.0), 2.0) * mix(1.0, dap, low * 0.8);
  #endif
  #ifdef XRAY
    // Occlusion off: every solid becomes one flat, unlit value, so overlapping shapes merge.
    col = mix(col, uFlatColor, uXray);
  #endif
  float f = hazeF(vWorld, cameraPosition);
  col = mix(col, hazeColorFor(-V), f);
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export type ForestKind = "bark" | "leaf" | "ground" | "rock" | "fern" | "prop" | "far";

export function forestMaterial(kind: ForestKind) {
  const defines: Record<string, string> = {};
  if (kind === "ground") defines.GROUND = "";
  if (kind === "leaf") defines.CANOPY = "";
  if (kind === "bark") defines.BARK = "";
  if (kind === "fern") defines.FERN = "";
  const xray = kind !== "ground" && kind !== "far";
  if (xray) defines.XRAY = "";
  const flat = kind === "fern" || kind === "leaf" ? new Color(0.045, 0.07, 0.03) : new Color(0.085, 0.052, 0.034);
  const m = new ShaderMaterial({
    uniforms: { ...U, uOpacity: { value: 1 }, uFlatColor: { value: flat } },
    vertexShader: FOREST_VERT,
    fragmentShader: FOREST_FRAG,
    defines,
    vertexColors: true,
    side: kind === "fern" || kind === "leaf" || kind === "far" ? DoubleSide : FrontSide,
  });
  return m;
}

/** Occlusion off: solids render as one flat silhouette value, so overlap stops telling you what is nearer. */
export function setXray(on: boolean) {
  U.uXray.value = on ? 1 : 0;
}

export function skyMaterial() {
  return new ShaderMaterial({
    uniforms: { ...U },
    vertexShader: /* glsl */ `
      #include <common>
      ${SHARED_GLSL}
      varying vec3 vWorld;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = squashWorld(wp.xyz); gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
    fragmentShader: /* glsl */ `
      #include <common>
      ${SHARED_GLSL}
      varying vec3 vWorld;
      void main() {
        vec3 d = normalize(vWorld - cameraPosition);
        float e = clamp(d.y, -0.2, 1.0);
        vec3 zen = vec3(0.16, 0.3, 0.55);
        vec3 hor = vec3(0.86, 0.8, 0.66);
        vec3 col = mix(hor, zen, pow(smoothstep(-0.02, 0.6, e), 0.7));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 3.0);
        float cl = smoothstep(0.55, 0.85, vnoise(vec3(d.xz / max(0.08, d.y + 0.1) * 2.2, 0.3)) * 0.7 + vnoise(vec3(d.xz / max(0.08, d.y + 0.1) * 6.0, 1.1)) * 0.3);
        col = mix(col, vec3(1.0, 0.95, 0.88), cl * 0.35 * smoothstep(0.02, 0.25, e));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: 1,
    depthWrite: true,
  });
}

/** Light shafts: visible only because the air scatters light, so they scale with the haze. */
export function shaftMaterial() {
  return new ShaderMaterial({
    uniforms: { ...U, uStrength: { value: 0.16 } },
    vertexShader: /* glsl */ `
      #include <common>
      ${SHARED_GLSL}
      varying vec2 vUv; varying vec3 vWorld;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = squashWorld(wp.xyz); gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
    fragmentShader: /* glsl */ `
      #include <common>
      ${SHARED_GLSL}
      uniform float uStrength; varying vec2 vUv; varying vec3 vWorld;
      void main() {
        float across = 1.0 - abs(clamp(vUv.x, 0.0, 1.0) * 2.0 - 1.0);
        float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float streak = 0.6 + 0.4 * vnoise(vec3(vUv.x * 9.0, vUv.y * 0.6, 0.0));
        float a = pow(clamp(across, 0.0, 1.0), 1.6) * clamp(along, 0.0, 1.0) * streak * uStrength * min(1.0, uHazeAmount * 1.3);
        gl_FragColor = vec4(uSunColor * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/** Additive ground glow / soft blob shadow decals. */
export function decalMaterial(kind: "glow" | "shadow") {
  return new ShaderMaterial({
    uniforms: { ...U },
    vertexShader: /* glsl */ `
      #include <common>
      ${SHARED_GLSL}
      varying vec2 vUv;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * vec4(squashWorld(wp.xyz), 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      ${SHARED_GLSL}
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.0, 1.0, r);
        ${kind === "glow" ? "gl_FragColor = vec4(uSunColor * a * a * 0.22, 1.0);" : "gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * 0.55);"}
      }`,
    transparent: true,
    depthWrite: false,
    blending: kind === "glow" ? AdditiveBlending : NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function fireflyMaterial() {
  return new ShaderMaterial({
    uniforms: { ...U, uPx: { value: 900 } },
    vertexShader: /* glsl */ `
      #include <common>
      ${SHARED_GLSL}
      uniform float uPx; attribute float phase; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.6 + phase * 6.28) * 0.35, sin(uTime * 0.9 + phase * 11.0) * 0.18, cos(uTime * 0.5 + phase * 4.0) * 0.35);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vec4 mv = viewMatrix * vec4(squashWorld(wp.xyz), 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPx * 0.09 / -mv.z, 1.5, 22.0);
        vA = 0.55 + 0.45 * sin(uTime * 2.3 + phase * 40.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.0, 1.0, r);
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.45) * (a * a * 1.6 + (1.0 - smoothstep(0.0, 0.35, r)) * 2.0) * vA, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/**
 * Depth pass for the revealed-area metric: log-encoded linear depth packed into RGBA8 (works on
 * software WebGL). Handles instancing and skinning (Pip) through three's chunks; applies the squash.
 */
export function depthMaterial() {
  return new ShaderMaterial({
    uniforms: { ...U },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      ${SHARED_GLSL}
      varying float vDepth;
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        vec4 mv = viewMatrix * vec4(squashWorld(wp.xyz), 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vDepth;
      void main() {
        float v = clamp(log(max(vDepth, ${NEAR.toFixed(3)}) / ${NEAR.toFixed(3)}) / ${Math.log(FAR / NEAR).toFixed(6)}, 0.0, 0.999999);
        vec3 e = fract(v * vec3(1.0, 255.0, 65025.0));
        e -= e.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
        gl_FragColor = vec4(e, 1.0);
      }`,
    side: DoubleSide,
  });
}

/**
 * A 2.5D / 2D card. Mode 0 cuts its slice out of the single frame-0 picture by depth (what an AI
 * depth split gives you: nothing behind the foreground). Mode 1 shows a clean plate painted behind
 * the nearer layers. The backdrop card is opaque and paints never-painted pixels as holes.
 */
export function cardMaterial() {
  return new ShaderMaterial({
    uniforms: {
      tColor: { value: null as Texture | null },
      tDepth: { value: null as Texture | null },
      uNear: { value: NEAR },
      uFar: { value: FAR },
      uA: { value: 0 },
      uB: { value: 1e9 },
      uMode: { value: 0 },
      uBack: { value: 0 },
      uMask: { value: 0 },
      uFlat: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D tColor; uniform sampler2D tDepth;
      uniform float uNear; uniform float uFar; uniform float uA; uniform float uB;
      uniform int uMode; uniform float uBack; uniform float uMask; uniform float uFlat;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tColor, vUv);
        bool hole = false;
        if (uFlat < 0.5) {
          if (uMode == 0) {
            float z = -perspectiveDepthToViewZ(texture2D(tDepth, vUv).x, uNear, uFar);
            if (!(z >= uA && z < uB)) { if (uBack > 0.5 && z < uA) hole = true; else discard; }
          } else if (c.a < 0.5) { if (uBack > 0.5) hole = true; else discard; }
        }
        if (uMask > 0.5) { gl_FragColor = hole ? vec4(0.0, 1.0, 0.0, 1.0) : vec4(1.0, 0.0, 0.0, 1.0); return; }
        if (hole) {
          vec2 g = gl_FragCoord.xy / 9.0;
          float s = step(0.5, fract((g.x + g.y) * 0.5));
          gl_FragColor = vec4(mix(vec3(0.035, 0.018, 0.045), vec3(0.11, 0.035, 0.12), s), 1.0);
          return;
        }
        gl_FragColor = vec4(c.rgb, 1.0);
      }`,
    depthTest: true,
    depthWrite: true,
    depthFunc: AlwaysDepth,
  });
}

const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * Final pass to the screen: thin-lens depth of field (gather on a golden-angle spiral), the
 * overlays (revealed pixels, FG/MG/BG bands, off-the-painting void), vignette, tone mapping.
 */
export function postMaterial() {
  return new ShaderMaterial({
    uniforms: {
      tColor: { value: null as Texture | null },
      tDepth: { value: null as Texture | null },
      tReveal: { value: null as Texture | null },
      texel: { value: new Vector2() },
      cameraNear: { value: NEAR },
      cameraFar: { value: FAR },
      uDof: { value: 0 },
      focusM: { value: 10 },
      focalMm: { value: 24 },
      fStop: { value: 2 },
      sensorH: { value: 20.25 },
      imageH: { value: 900 },
      maxRadius: { value: 14 },
      uOverlay: { value: 0 },
      uFlat: { value: 0 },
      uFg: { value: 5 },
      uMg: { value: 45 },
      uTime: { value: 0 },
    },
    vertexShader: QUAD_VERT,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <packing>
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tReveal; uniform vec2 texel;
      uniform float cameraNear; uniform float cameraFar; uniform float uDof; uniform float focusM; uniform float focalMm;
      uniform float fStop; uniform float sensorH; uniform float imageH; uniform float maxRadius;
      uniform int uOverlay; uniform float uFlat; uniform float uFg; uniform float uMg; uniform float uTime;
      varying vec2 vUv;
      float zAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
      float cocR(float z) {
        float f = focalMm * 0.001; float A = f / fStop;
        float c = A * f * abs(z - focusM) / (z * max(1e-4, focusM - f));
        return clamp(c * 1000.0 / sensorH * imageH * 0.5, 0.0, maxRadius);
      }
      void main() {
        float d0 = texture2D(tDepth, vUv).x;
        float z0 = zAt(vUv);
        vec3 col = texture2D(tColor, vUv).rgb;
        if (uDof > 0.5) {
          float r0 = cocR(z0); float tot = 1.0; float radius = 0.7; float ang = 0.0;
          for (int i = 0; i < 96; i++) {
            if (radius >= maxRadius) break;
            vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
            vec3 sc = texture2D(tColor, tc).rgb; float sz = zAt(tc); float sr = cocR(sz);
            if (sz > z0) sr = clamp(sr, 0.0, r0 * 2.0);
            float m = smoothstep(radius - 0.5, radius + 0.5, sr);
            col += mix(col / tot, sc, m); tot += 1.0;
            radius += 1.6 / radius; ang += 2.39996323;
          }
          col /= tot;
        }
        if (uFlat > 0.5 && d0 > 0.99999) {
          vec2 g = gl_FragCoord.xy / 7.0;
          col = mix(vec3(0.012, 0.014, 0.018), vec3(0.03, 0.034, 0.042), step(0.5, fract((g.x - g.y) * 0.5)));
        }
        if (uOverlay == 1) {
          vec2 rt = vec2(1.0 / 240.0, 1.0 / 135.0);
          vec4 rv = texture2D(tReveal, vUv) * 0.4 + (texture2D(tReveal, vUv + vec2(rt.x, 0.0)) + texture2D(tReveal, vUv - vec2(rt.x, 0.0)) + texture2D(tReveal, vUv + vec2(0.0, rt.y)) + texture2D(tReveal, vUv - vec2(0.0, rt.y))) * 0.15;
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float edgeG = smoothstep(0.2, 0.5, rv.g) * (1.0 - smoothstep(0.5, 0.8, rv.g));
          float edgeR = smoothstep(0.2, 0.5, rv.r) * (1.0 - smoothstep(0.5, 0.8, rv.r));
          col = mix(col, col * 0.55 + vec3(0.05, 0.55, 0.7) * (0.3 + l), smoothstep(0.3, 0.7, rv.r) * 0.6);
          col = mix(col, col * 0.6 + vec3(1.0, 0.1, 0.6) * (0.25 + l), smoothstep(0.3, 0.7, rv.g) * 0.5);
          col = mix(col, vec3(0.35, 1.1, 1.3), edgeR * 0.8);
          col = mix(col, vec3(1.4, 0.3, 0.95), edgeG * 0.85);
        } else if (uOverlay == 2) {
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          vec3 band = z0 < uFg ? vec3(1.0, 0.45, 0.22) : z0 < uMg ? vec3(0.35, 0.95, 0.6) : vec3(0.3, 0.55, 1.0);
          col = mix(col, band * (0.25 + 1.4 * l), 0.55);
        }
        vec2 q = vUv - 0.5;
        col *= 1.0 - 0.32 * smoothstep(0.25, 0.75, dot(q, q) * 2.2);
        float gr = fract(sin(dot(gl_FragCoord.xy + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
        col += (gr - 0.5) * 0.008;
        col = max(col, 0.0);
        if (any(isnan(col))) col = vec3(0.0);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

/** Patch a (cloned) character material so it gets the same aerial perspective as the forest. */
export function patchHaze(m: Material) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHzW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvHzW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${SHARED_GLSL}\nvarying vec3 vHzW;`)
      .replace("#include <fog_fragment>", "gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColorFor(normalize(vHzW - cameraPosition)), hazeF(vHzW, cameraPosition));");
  };
  m.customProgramCacheKey = () => "ed-haze";
  m.needsUpdate = true;
}

