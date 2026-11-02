import {
  Color, DepthTexture, HalfFloatType, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, UnsignedByteType, Vector2,
  WebGLRenderTarget, type Texture,
} from 'three';

/**
 * Screen passes for the stage. The scene renders linear HDR into a target. The post pass tone-maps it
 * (ACES, as the other labs' canvases do) into display values, then applies the screen-space part of a
 * look: the painterly filter, the halftone screen, edge-detected lines. The present pass shows look A,
 * or dissolves or wipes it into look B. The formulas mirror shading.ts.
 */

const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

const POST = /* glsl */`
varying vec2 vUv;
uniform sampler2D tScene; uniform sampler2D tNormal; uniform sampler2D tDepth; uniform sampler2D tMask;
uniform vec2 uRes; uniform int uMode; uniform float uEdges; uniform float uEdgePx; uniform vec3 uLine;
uniform int uMaskMode; uniform float uBrush; uniform float uCell; uniform float uAngle; uniform float uCmyk;
uniform float uNear; uniform float uFar; uniform vec3 uPaper; uniform vec3 uInk;

vec3 RRTAndODTFit( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
vec3 aces( vec3 c ) {
  const mat3 IN = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 OUT = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  c *= 1.0 / 0.6; c = IN * c; c = RRTAndODTFit( c ); c = OUT * c; return clamp( c, 0.0, 1.0 );
}
vec3 srgb( vec3 c ) { return mix( pow( c, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), c * 12.92, vec3( lessThanEqual( c, vec3( 0.0031308 ) ) ) ); }
vec3 display( vec2 uv ) { return srgb( aces( texture2D( tScene, uv ).rgb ) ); }
float luma( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float vnoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y ); }

// Painterly-lite: a Kuwahara filter flattens each region to the calmest of four neighbourhoods,
// which keeps edges and turns texture into dabs of flat colour. Then a paper tooth.
#define MAXR 6
vec3 kuwahara( vec2 uv ) {
  vec2 px = 1.0 / uRes; float r = uBrush;
  vec3 m0 = vec3( 0 ), m1 = vec3( 0 ), m2 = vec3( 0 ), m3 = vec3( 0 ), s0 = vec3( 0 ), s1 = vec3( 0 ), s2 = vec3( 0 ), s3 = vec3( 0 );
  float n = 0.0;
  for ( int j = 0; j <= MAXR; j++ ) { for ( int i = 0; i <= MAXR; i++ ) {
    if ( float( i ) > r || float( j ) > r ) continue;
    vec2 o = vec2( float( i ), float( j ) ) * px;
    vec3 a = display( uv + vec2( -o.x, -o.y ) ), b = display( uv + vec2( o.x, -o.y ) ), c = display( uv + vec2( -o.x, o.y ) ), d = display( uv + o );
    m0 += a; s0 += a * a; m1 += b; s1 += b * b; m2 += c; s2 += c * c; m3 += d; s3 += d * d; n += 1.0;
  } }
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  vec3 v0 = s0 / n - m0 * m0, v1 = s1 / n - m1 * m1, v2 = s2 / n - m2 * m2, v3 = s3 / n - m3 * m3;
  float e0 = v0.r + v0.g + v0.b, e1 = v1.r + v1.g + v1.b, e2 = v2.r + v2.g + v2.b, e3 = v3.r + v3.g + v3.b;
  vec3 col = m0; float best = e0;
  if ( e1 < best ) { best = e1; col = m1; } if ( e2 < best ) { best = e2; col = m2; } if ( e3 < best ) { col = m3; }
  return col;
}
vec3 painterly( vec2 uv ) {
  vec3 c = kuwahara( uv );
  float l = luma( c ); c = clamp( mix( vec3( l ), c, 1.12 ), 0.0, 1.0 );
  vec2 p = uv * uRes;
  float tooth = vnoise( p / 2.2 ) * 0.55 + vnoise( p / 9.0 ) * 0.45;
  float weave = 0.5 + 0.5 * sin( p.x * 1.3 ) * sin( p.y * 1.3 );
  return c * ( 0.9 + 0.12 * tooth ) * ( 0.985 + 0.03 * weave );
}

// Halftone: rotate into the screen grid, size each cell's dot by the brightness at its centre.
mat2 rot( float deg ) { float a = radians( deg ); return mat2( cos( a ), -sin( a ), sin( a ), cos( a ) ); }
float dotInk( vec2 frag, float deg, float cover ) {
  mat2 R = rot( deg ); vec2 r = R * frag; vec2 cell = floor( r / uCell ); vec2 ctr = ( cell + 0.5 ) * uCell;
  float rad = min( uCell * 0.70711, uCell * sqrt( clamp( cover, 0.0, 1.0 ) / 3.14159265 ) );
  return 1.0 - smoothstep( rad - 0.75, rad + 0.75, length( r - ctr ) );
}
vec2 cellCentre( vec2 frag, float deg ) { mat2 R = rot( deg ); vec2 r = R * frag; vec2 ctr = ( floor( r / uCell ) + 0.5 ) * uCell; return transpose( R ) * ctr; }
vec3 halftone( vec2 uv ) {
  vec2 frag = uv * uRes;
  if ( uCmyk < 0.5 ) {
    float L = luma( display( cellCentre( frag, uAngle ) / uRes ) );
    return mix( uPaper, uInk, dotInk( frag, uAngle, 1.0 - L ) );
  }
  vec3 col = uPaper;
  float ang[4]; ang[0] = uAngle - 30.0; ang[1] = uAngle + 30.0; ang[2] = uAngle - 45.0; ang[3] = uAngle;
  vec3 inks[4]; inks[0] = vec3( 0.0, 0.62, 0.88 ); inks[1] = vec3( 0.9, 0.12, 0.52 ); inks[2] = vec3( 1.0, 0.9, 0.05 ); inks[3] = vec3( 0.12, 0.11, 0.13 );
  for ( int i = 0; i < 4; i++ ) {
    vec3 s = display( cellCentre( frag, ang[i] ) / uRes );
    float k = 1.0 - max( max( s.r, s.g ), s.b );
    float cover = i == 3 ? k : ( k > 0.999 ? 0.0 : ( 1.0 - s[i] - k ) / ( 1.0 - k ) );
    col *= mix( vec3( 1.0 ), inks[i], dotInk( frag, ang[i], cover * ( i == 3 ? 0.9 : 0.85 ) ) );
  }
  return col;
}

// Lines from the geometry: where depth jumps (silhouettes) or the normal turns (creases).
float linearDepth( vec2 uv ) { float z = texture2D( tDepth, uv ).x * 2.0 - 1.0; return 2.0 * uNear * uFar / ( uFar + uNear - z * ( uFar - uNear ) ); }
float edgeAt( vec2 uv, out float maskMax ) {
  vec2 o = uEdgePx / uRes;
  vec3 n0 = texture2D( tNormal, uv ).rgb * 2.0 - 1.0; float d0 = linearDepth( uv );
  float e = 0.0; maskMax = texture2D( tMask, uv ).r;
  for ( int k = 0; k < 8; k++ ) {
    float a = float( k ) * 0.785398;
    vec2 q = uv + vec2( cos( a ), sin( a ) ) * o;
    vec3 n = texture2D( tNormal, q ).rgb * 2.0 - 1.0; float d = linearDepth( q );
    e = max( e, smoothstep( 0.22, 0.45, 1.0 - dot( n0, n ) ) );
    e = max( e, smoothstep( 0.035, 0.07, ( d - d0 ) / d0 ) );
    maskMax = max( maskMax, texture2D( tMask, q ).r );
  }
  return e;
}

void main() {
  vec3 base = display( vUv );
  vec3 fx = base;
  if ( uMode == 1 ) fx = painterly( vUv );
  else if ( uMode == 2 ) fx = halftone( vUv );
  float m = texture2D( tMask, vUv ).r;
  float w = uMaskMode == 0 ? 1.0 : ( uMaskMode == 1 ? m : 1.0 - m );
  vec3 col = mix( base, fx, w );
  if ( uEdges > 0.5 ) {
    float mm; float e = edgeAt( vUv, mm );
    float ew = uMaskMode == 0 ? 1.0 : ( uMaskMode == 1 ? mm : 1.0 - m );
    col = mix( col, uLine, e * ew );
  }
  gl_FragColor = vec4( col, 1.0 );
}`;

const PRESENT = /* glsl */`
varying vec2 vUv;
uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform int uBlend; uniform vec2 uRes;
void main() {
  vec3 a = texture2D( tA, vUv ).rgb;
  if ( uBlend == 0 ) { gl_FragColor = vec4( a, 1.0 ); return; }
  vec3 b = texture2D( tB, vUv ).rgb;
  vec3 col;
  if ( uBlend == 1 ) col = mix( a, b, clamp( uMix, 0.0, 1.0 ) );
  else {
    float soft = 1.0 / uRes.x; float div = 1.0 + soft - clamp( uMix, 0.0, 1.0 ) * ( 1.0 + 2.0 * soft );
    float u = clamp( ( vUv.x - ( div - soft ) ) / ( 2.0 * soft ), 0.0, 1.0 );
    col = mix( a, b, u * u * ( 3.0 - 2.0 * u ) );
    float line = 1.0 - smoothstep( 0.0, 1.5 / uRes.x, abs( vUv.x - div ) );
    col = mix( col, vec3( 0.96, 0.93, 0.86 ), line * 0.9 );
  }
  gl_FragColor = vec4( col, 1.0 );
}`;

export interface PostSettings {
  mode: 0 | 1 | 2; edges: boolean; edgePx: number; line: string; maskMode: 0 | 1 | 2;
  brush: number; cell: number; angle: number; cmyk: boolean; near: number; far: number;
}

export class Passes {
  readonly scene = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  readonly normal: WebGLRenderTarget;
  readonly mask = new WebGLRenderTarget(1, 1, { type: UnsignedByteType });
  readonly finals = [new WebGLRenderTarget(1, 1, { type: UnsignedByteType }), new WebGLRenderTarget(1, 1, { type: UnsignedByteType })];
  readonly quadScene = new Scene();
  readonly quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  readonly post: ShaderMaterial;
  readonly present: ShaderMaterial;
  private w = 0;
  private h = 0;

  constructor(samples: number) {
    this.scene.samples = samples;
    this.normal = new WebGLRenderTarget(1, 1, { type: UnsignedByteType });
    this.normal.depthTexture = new DepthTexture(1, 1);
    const blank = this.mask.texture;
    this.post = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: POST, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: {
        tScene: { value: this.scene.texture }, tNormal: { value: this.normal.texture }, tDepth: { value: this.normal.depthTexture }, tMask: { value: blank },
        uRes: { value: new Vector2(1, 1) }, uMode: { value: 0 }, uEdges: { value: 0 }, uEdgePx: { value: 1 }, uLine: { value: new Color('#2a1a12') },
        uMaskMode: { value: 0 }, uBrush: { value: 4 }, uCell: { value: 7 }, uAngle: { value: 45 }, uCmyk: { value: 0 },
        uNear: { value: 0.05 }, uFar: { value: 60 }, uPaper: { value: new Color('#f3ead8') }, uInk: { value: new Color('#1d1a24') },
      },
    });
    this.present = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: PRESENT, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { tA: { value: this.finals[0].texture }, tB: { value: this.finals[1].texture }, uMix: { value: 0 }, uBlend: { value: 0 }, uRes: { value: new Vector2(1, 1) } },
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.post);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const t of [this.scene, this.normal, this.mask, ...this.finals]) t.setSize(w, h);
    (this.post.uniforms.uRes.value as Vector2).set(w, h);
    (this.present.uniforms.uRes.value as Vector2).set(w, h);
  }

  configure(s: PostSettings, mask: Texture | null) {
    const u = this.post.uniforms;
    u.uMode.value = s.mode; u.uEdges.value = s.edges ? 1 : 0; u.uEdgePx.value = s.edgePx; (u.uLine.value as Color).set(s.line);
    u.uMaskMode.value = mask ? s.maskMode : 0; u.tMask.value = mask ?? this.mask.texture;
    u.uBrush.value = s.brush; u.uCell.value = s.cell; u.uAngle.value = s.angle; u.uCmyk.value = s.cmyk ? 1 : 0;
    u.uNear.value = s.near; u.uFar.value = s.far;
  }

  usePost() { this.quad.material = this.post; }
  usePresent(mix: number, blend: 0 | 1 | 2) { this.quad.material = this.present; this.present.uniforms.uMix.value = mix; this.present.uniforms.uBlend.value = blend; }

  dispose() {
    for (const t of [this.scene, this.normal, this.mask, ...this.finals]) t.dispose();
    this.normal.depthTexture?.dispose();
    this.post.dispose(); this.present.dispose(); this.quad.geometry.dispose();
  }
}
