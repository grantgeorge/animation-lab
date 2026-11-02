import {
  BackSide, Color, DataTexture, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshToonMaterial, NearestFilter, RedFormat,
  ShaderChunk, SkinnedMesh, type Material, type MeshStandardMaterial, type Object3D, type Scene,
} from 'three';
import { rampData, type LookId } from './shading';

/**
 * Look materials. Every look is derived from (never written back to) the scene's own materials, which
 * other routes share through the GLTF cache and the satin cache. Uniform objects are shared, so a
 * slider changes every derived material at once without recompiling.
 */

export interface LookParams {
  bands: number; edge: number; floor: number;
  roughness: number; sheen: number; wrap: number; blur: number;
  outlinePx: number; outlineColor: string; hull: boolean;
}

type Family = 'standard' | 'clay' | 'cel';
/** Which material family each look draws with. Painterly and halftone filter the standard render. */
export const FAMILY: Record<LookId, Family> = { standard: 'standard', clay: 'clay', cel: 'cel', painterly: 'standard', halftone: 'standard' };

const isLit = (m: Material): m is MeshStandardMaterial => (m as MeshStandardMaterial).isMeshStandardMaterial === true;
/** Glows, the void and the painted backdrop keep their own materials in every look. */
const keepsOwn = (m: Material) => !isLit(m) || ((m as MeshStandardMaterial).emissiveIntensity > 0.5 && (m as MeshStandardMaterial).emissive.getHex() !== 0);

export class LookMaterials {
  private cache = new Map<string, Material>();
  readonly ramp: DataTexture;
  readonly u = {
    wrap: { value: 0.35 },
    blur: { value: 3 },
    outline: { value: 0.002 },
    outlineColor: { value: new Color('#2a1a12') },
  };
  private key = '';

  constructor() {
    this.ramp = new DataTexture(new Uint8Array(256), 256, 1, RedFormat);
    this.ramp.minFilter = this.ramp.magFilter = NearestFilter;
    this.ramp.generateMipmaps = false;
  }

  /** Push slider values into the shared ramp and uniforms (cheap; called every frame). */
  update(p: LookParams, outlinePerDepth: number) {
    const key = `${p.bands}:${p.edge}:${p.floor}`;
    if (key !== this.key) { this.ramp.image.data = rampData(p.bands, p.edge, p.floor); this.ramp.needsUpdate = true; this.key = key; }
    this.u.wrap.value = p.wrap;
    this.u.blur.value = p.blur;
    this.u.outline.value = outlinePerDepth;
    this.u.outlineColor.value.set(p.outlineColor);
    for (const [k, m] of this.cache) if (k.startsWith('clay:')) { const c = m as MeshPhysicalMaterial; c.roughness = p.roughness; c.sheen = p.sheen; }
  }

  get(src: Material, family: Family): Material {
    if (family === 'standard' || keepsOwn(src)) return src;
    const k = `${family}:${src.uuid}`;
    let out = this.cache.get(k);
    if (!out) { out = family === 'clay' ? this.clay(src as MeshStandardMaterial) : this.cel(src as MeshStandardMaterial); this.cache.set(k, out); }
    return out;
  }

  private shared(s: MeshStandardMaterial) {
    return { color: s.color.clone(), map: s.map, transparent: s.transparent, opacity: s.opacity, side: s.side, alphaTest: s.alphaTest, emissive: s.emissive.clone(), emissiveMap: s.emissiveMap, emissiveIntensity: s.emissiveIntensity };
  }

  /** Cel: three's toon shading reads its light response from the shared ramp. No normal map: bands stay clean. */
  private cel(s: MeshStandardMaterial) {
    return new MeshToonMaterial({ ...this.shared(s), gradientMap: this.ramp });
  }

  /**
   * Clay: plasticine is one smooth, slightly waxy surface. Texture detail is blurred away (a mip bias),
   * light wraps past the terminator so shadows soften, and a sheen lobe gives the soft rim.
   */
  private clay(s: MeshStandardMaterial) {
    const m = new MeshPhysicalMaterial({ ...this.shared(s), metalness: 0, roughness: 0.6, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new Color('#fff2e6') });
    const u = this.u;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWrap = u.wrap;
      sh.uniforms.uBlur = u.blur;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uWrap;\nuniform float uBlur;')
        .replace('#include <map_fragment>', '#ifdef USE_MAP\n  vec4 sampledDiffuseColor = texture2D( map, vMapUv, uBlur );\n  float lum = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );\n  sampledDiffuseColor.rgb = max( vec3( 0.0 ), mix( vec3( lum ), sampledDiffuseColor.rgb, 1.12 ) );\n  diffuseColor *= sampledDiffuseColor;\n#endif')
        .replace('#include <lights_physical_pars_fragment>', ShaderChunk.lights_physical_pars_fragment.replace(
          'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\n\tvec3 irradiance = dotNL * directLight.color;',
          'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\n\tvec3 irradiance = saturate( ( dot( geometryNormal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) ) * directLight.color;'));
    };
    m.customProgramCacheKey = () => 'sr-clay';
    return m;
  }

  /** The inverted-hull material: back faces pushed out along their normals, a fixed number of pixels wide. */
  hullMaterial(): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ side: BackSide, fog: false });
    const u = this.u;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uOutline = u.outline;
      sh.uniforms.uOutlineColor = u.outlineColor;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uOutline;')
        .replace('#include <project_vertex>', `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
#ifdef USE_SKINNING
  vec3 hullNormal = objectNormal;
#else
  vec3 hullNormal = normal;
#endif
vec3 viewN = normalize( normalMatrix * hullNormal );
mvPosition.xyz += viewN * uOutline * -mvPosition.z;
gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uOutlineColor;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( uOutlineColor, 1.0 );');
    };
    m.customProgramCacheKey = () => 'sr-hull';
    return m;
  }

  dispose() { for (const m of this.cache.values()) m.dispose(); this.cache.clear(); this.ramp.dispose(); }
}

/** Remembers each mesh's own material and whether it belongs to the cast; owns the outline hulls. */
export class Restyler {
  private originals = new Map<Mesh, Material | Material[]>();
  private cast = new Map<Mesh, boolean>();
  private hulls = new Map<Mesh, Mesh>();
  private hullMat: MeshBasicMaterial;
  private maskWhite = new MeshBasicMaterial({ color: '#ffffff', fog: false });
  private maskBlack = new MeshBasicMaterial({ color: '#000000', fog: false });

  constructor(private looks: LookMaterials, private castName: string) { this.hullMat = looks.hullMaterial(); }

  private isCast(mesh: Mesh) {
    let v = this.cast.get(mesh);
    if (v === undefined) {
      v = false;
      for (let o: Object3D | null = mesh; o; o = o.parent) if (o.name === this.castName) { v = true; break; }
      this.cast.set(mesh, v);
    }
    return v;
  }

  private hullFor(mesh: Mesh): Mesh {
    let h = this.hulls.get(mesh);
    if (!h) {
      if ((mesh as SkinnedMesh).isSkinnedMesh) {
        const sm = mesh as SkinnedMesh;
        const hs = new SkinnedMesh(sm.geometry, this.hullMat);
        hs.bind(sm.skeleton, sm.bindMatrix);
        h = hs;
      } else h = new Mesh(mesh.geometry, this.hullMat);
      if (mesh.morphTargetInfluences) { h.morphTargetDictionary = mesh.morphTargetDictionary; h.morphTargetInfluences = mesh.morphTargetInfluences; }
      h.userData.srHull = true;
      h.frustumCulled = false;
      h.castShadow = h.receiveShadow = false;
      h.renderOrder = -1;
      mesh.add(h);
      this.hulls.set(mesh, h);
    }
    return h;
  }

  /**
   * Dress every mesh for a pass. `cast` and `set` are the families for the characters and for the
   * set (they differ only in the consistency demo). `mode` 'mask' paints the cast white, the set black.
   */
  apply(scene: Scene, cast: Family, set: Family, p: LookParams, mode: 'look' | 'mask' | 'plain' = 'look') {
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || mesh.userData.srHull) return;
      if (!this.originals.has(mesh)) this.originals.set(mesh, mesh.material);
      const src = this.originals.get(mesh)!;
      const fam = this.isCast(mesh) ? cast : set;
      if (mode === 'mask') mesh.material = this.isCast(mesh) ? this.maskWhite : this.maskBlack;
      else mesh.material = Array.isArray(src) ? src.map((m) => this.looks.get(m, fam)) : this.looks.get(src, fam);
      const lit = !Array.isArray(src) && isLit(src) && !keepsOwn(src) && mesh.visible;
      const wantHull = mode === 'look' && fam === 'cel' && p.hull && lit;
      if (wantHull || this.hulls.has(mesh)) this.hullFor(mesh).visible = wantHull;
    });
  }

  restore() {
    for (const [mesh, m] of this.originals) mesh.material = m;
    for (const [mesh, h] of this.hulls) mesh.remove(h);
    this.originals.clear(); this.hulls.clear(); this.cast.clear();
    this.hullMat.dispose(); this.maskWhite.dispose(); this.maskBlack.dispose();
    this.looks.dispose();
  }
}

