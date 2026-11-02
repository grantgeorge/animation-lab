import { CustomBlending, OneFactor, AddEquation, ShaderMaterial, Vector2, type Texture } from "three";

/** Full-screen passes for the lab: painterly layers, depth of field, shutter accumulation, final look. */

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Generalised Kuwahara (4 quadrants): flattens rendered detail into brush-like patches. Premultiplied RGBA in/out. */
export function makePaint() {
  return new ShaderMaterial({
    uniforms: { tSrc: { value: null as Texture | null }, texel: { value: new Vector2() } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
      void quad(vec2 dir, inout vec4 mean, inout float vari) {
        vec4 m = vec4(0.0); vec3 s = vec3(0.0);
        for (int j = 0; j <= 3; j++) for (int i = 0; i <= 3; i++) {
          vec4 c = texture2D(tSrc, vUv + vec2(float(i) * dir.x, float(j) * dir.y) * texel * 1.25);
          m += c; s += c.rgb * c.rgb;
        }
        m /= 16.0; s = s / 16.0 - m.rgb * m.rgb;
        float v = s.r + s.g + s.b;
        if (v < vari) { vari = v; mean = m; }
      }
      void main() {
        vec4 mean = texture2D(tSrc, vUv); float vari = 1e9;
        quad(vec2(-1.0, -1.0), mean, vari); quad(vec2(1.0, -1.0), mean, vari);
        quad(vec2(-1.0, 1.0), mean, vari); quad(vec2(1.0, 1.0), mean, vari);
        float l = dot(mean.rgb, vec3(0.2126, 0.7152, 0.0722));
        mean.rgb = mix(vec3(l), mean.rgb, 1.12);
        gl_FragColor = max(mean, 0.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

/** Single-pass gather depth of field (scatter-as-gather on a golden-angle spiral), thin-lens CoC. */
export function makeDof() {
  return new ShaderMaterial({
    uniforms: {
      tColor: { value: null as Texture | null },
      tDepth: { value: null as Texture | null },
      texel: { value: new Vector2() },
      cameraNear: { value: 0.05 },
      cameraFar: { value: 80 },
      focusM: { value: 3 },
      focalMm: { value: 50 },
      fStop: { value: 2 },
      sensorH: { value: 20.25 },
      imageH: { value: 1000 },
      maxRadius: { value: 12 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel;
      uniform float cameraNear, cameraFar, focusM, focalMm, fStop, sensorH, imageH, maxRadius;
      varying vec2 vUv;
      float zAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
      float cocR(float z) {
        float f = focalMm * 0.001; float A = f / fStop;
        float c = A * f * abs(z - focusM) / (z * max(1e-4, focusM - f));
        return clamp(c * 1000.0 / sensorH * imageH * 0.5, 0.0, maxRadius);
      }
      void main() {
        float z0 = zAt(vUv); float r0 = cocR(z0);
        vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.0;
        float radius = 0.6; float ang = 0.0;
        for (int i = 0; i < 180; i++) {
          if (radius >= maxRadius) break;
          vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
          vec3 sc = texture2D(tColor, tc).rgb; float sz = zAt(tc); float sr = cocR(sz);
          if (sz > z0) sr = clamp(sr, 0.0, r0 * 2.0);
          float m = smoothstep(radius - 0.5, radius + 0.5, sr);
          col += mix(col / tot, sc, m); tot += 1.0;
          radius += 1.1 / radius; ang += 2.39996323;
        }
        gl_FragColor = vec4(col / tot, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

/** Adds weight × source into the accumulation target (one sub-frame of the shutter). */
export function makeAccum() {
  return new ShaderMaterial({
    uniforms: { tSrc: { value: null as Texture | null }, weight: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `uniform sampler2D tSrc; uniform float weight; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * weight, 1.0); }`,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendEquation: AddEquation,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * The final pass to the screen: optional fisheye bulge, stepped smear, then tone mapping and output
 * colour space (three's chunks), then cel bands, ink outlines from depth and speed lines.
 */
export function makeLook() {
  return new ShaderMaterial({
    uniforms: {
      tColor: { value: null as Texture | null },
      tDepth: { value: null as Texture | null },
      texel: { value: new Vector2() },
      cameraNear: { value: 0.05 },
      cameraFar: { value: 80 },
      aspect: { value: 16 / 9 },
      fisheye: { value: 0 },
      cel: { value: 0 },
      outline: { value: 0 },
      tNormal: { value: null as Texture | null },
      inkPx: { value: 1.5 },
      speed: { value: 0 },
      speedDir: { value: new Vector2(1, 0) },
      fill: { value: new Vector2(0, 0) },
      seed: { value: 0 },
      hasDepth: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tNormal; uniform vec2 texel;
      uniform float cameraNear, cameraFar, aspect, fisheye, cel, outline, speed, seed, hasDepth, inkPx;
      uniform vec2 speedDir; uniform vec2 fill;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n * 12.9898 + seed * 78.233) * 43758.5453); }
      vec2 distort(vec2 uv) {
        if (fisheye <= 0.0) return uv;
        vec2 k = vec2(aspect, 1.0) / length(vec2(aspect, 1.0));
        vec2 p = (uv - 0.5) * 2.0 * k;
        float r2 = dot(p, p);
        vec2 q = p * (1.0 + fisheye * (r2 - 1.0));
        return 0.5 + q / (2.0 * k);
      }
      float zAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
      void main() {
        vec2 uv = distort(vUv);
        vec3 c = texture2D(tColor, uv).rgb;
        if (dot(fill, fill) > 0.0) {
          // Shutter samples are discrete; a short directional blur along the camera's motion fills the gaps.
          vec3 acc = vec3(0.0);
          for (int k = 0; k < 6; k++) acc += texture2D(tColor, uv + fill * (float(k) / 5.0 - 0.5)).rgb;
          c = acc / 6.0;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 col = gl_FragColor.rgb;
        if (cel > 0.0) {
          // Banding already happened in the cel materials; here only a gentle saturation lift.
          col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.0 + 0.12 * cel);
        }
        if (outline > 0.0 && hasDepth > 0.5) {
          // Ink: silhouettes from the second derivative of 1/z (zero on any plane, so floors stay clean)
          // and creases from the smooth-normal buffer. Fixed pixel width, sampled on a cross.
          vec2 o = texel * inkPx;
          float iz = 1.0 / zAt(uv);
          float l = 1.0 / zAt(uv - vec2(o.x, 0.0)), r = 1.0 / zAt(uv + vec2(o.x, 0.0));
          float d = 1.0 / zAt(uv - vec2(0.0, o.y)), u = 1.0 / zAt(uv + vec2(0.0, o.y));
          float sil = max(abs(l + r - 2.0 * iz), abs(d + u - 2.0 * iz)) / iz;
          vec3 n0 = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
          float crease = 0.0;
          crease = max(crease, 1.0 - dot(n0, texture2D(tNormal, uv + vec2(o.x, 0.0)).xyz * 2.0 - 1.0));
          crease = max(crease, 1.0 - dot(n0, texture2D(tNormal, uv - vec2(o.x, 0.0)).xyz * 2.0 - 1.0));
          crease = max(crease, 1.0 - dot(n0, texture2D(tNormal, uv + vec2(0.0, o.y)).xyz * 2.0 - 1.0));
          crease = max(crease, 1.0 - dot(n0, texture2D(tNormal, uv - vec2(0.0, o.y)).xyz * 2.0 - 1.0));
          float ink = max(smoothstep(0.14, 0.3, sil), smoothstep(1.45, 1.8, crease));
          col = mix(col, vec3(0.09, 0.07, 0.1), outline * ink);
        }
        if (speed > 0.0) {
          vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
          vec2 d = normalize(speedDir * vec2(aspect, 1.0));
          float across = dot(p, vec2(-d.y, d.x));
          float along = dot(p, d);
          float id = floor(across * 48.0);
          float h = hash(id);
          float len = 0.18 + 0.42 * hash(id + 7.0);
          float start = hash(id + 3.0) * 1.7 - 0.85;
          float u = clamp((along - start) / len, 0.0, 1.0);
          // Tapered strokes: thickest in the middle, pointed at both ends.
          float taper = sin(3.14159 * u) * step(start, along) * step(along, start + len);
          float band = 1.0 - smoothstep(0.03, 0.03 + 0.1 * taper, abs(fract(across * 48.0) - 0.5));
          float clearCentre = smoothstep(0.12, 0.42, length(p));
          float m = step(0.72, h) * band * taper * clearCentre * speed;
          col = mix(col, vec3(0.97, 0.98, 1.0), clamp(m, 0.0, 0.9));
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Edge-preserving bilateral smooth for the cel look: averages away texture detail and noisy band
 * edges where colours are similar, but stops at real colour edges (no Kuwahara blocks).
 */
export function makeBilateral() {
  return new ShaderMaterial({
    uniforms: { tSrc: { value: null as Texture | null }, texel: { value: new Vector2() }, spread: { value: 1.5 }, sigmaColor: { value: 0.12 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 texel; uniform float spread, sigmaColor; varying vec2 vUv;
      vec3 tm(vec3 c) { return c / (1.0 + c); }
      void main() {
        vec4 c0 = texture2D(tSrc, vUv);
        vec3 k0 = tm(c0.rgb);
        vec4 acc = vec4(0.0); float wsum = 0.0;
        for (int j = -4; j <= 4; j++) for (int i = -4; i <= 4; i++) {
          vec2 d = vec2(float(i), float(j));
          vec4 c = texture2D(tSrc, vUv + d * texel * spread);
          vec3 dc = tm(c.rgb) - k0;
          float w = exp(-dot(d, d) / 18.0) * exp(-dot(dc, dc) / (2.0 * sigmaColor * sigmaColor));
          acc += c * w; wsum += w;
        }
        gl_FragColor = acc / wsum;
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Cel composite: smoothed flat colour × a two-tone light mask. The light pass is blurred first, then
 * thresholded with a narrow ramp, so band edges are crisp but follow smooth contours. Shadow side is
 * tinted cool, lit side a touch warm.
 */
export function makeCel() {
  return new ShaderMaterial({
    uniforms: { tAlbedo: { value: null as Texture | null }, tKey: { value: null as Texture | null }, tFill: { value: null as Texture | null }, threshold: { value: 0.2 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tAlbedo; uniform sampler2D tKey; uniform sampler2D tFill; uniform float threshold; varying vec2 vUv;
      float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main() {
        vec3 a = texture2D(tAlbedo, vUv).rgb;
        // Band: key light only (with its cast shadows), blurred then thresholded on a narrow ramp.
        float lit = smoothstep(threshold * 0.85, threshold * 1.15, luma(texture2D(tKey, vUv).rgb));
        // Fill: every light, heavily blurred: soft hue and brightness, never banded.
        vec3 fill = texture2D(tFill, vUv).rgb;
        float e = luma(fill);
        vec3 hue = clamp(fill / max(e, 1e-3), 0.0, 2.0);
        vec3 base = a * mix(vec3(1.0), hue, 0.55) * (0.85 + 0.45 * smoothstep(0.1, 1.5, e));
        vec3 shadow = base * vec3(0.5, 0.55, 0.74);
        vec3 light = base * vec3(1.22, 1.16, 1.06);
        float glow = smoothstep(2.5, 7.0, e);
        gl_FragColor = vec4(mix(shadow, light, lit) + a * glow * 0.5, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
}
