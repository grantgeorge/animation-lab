import { MeshBasicMaterial, MeshLambertMaterial, MeshNormalMaterial, type Material, type Mesh, type Object3D, type Texture, type Color } from "three";

/**
 * Cel passes for the anime camera. The look separates colour from light, as a cel painter does:
 * - "albedo": every lit material becomes unlit flat colour (its texture read slightly blurred);
 * - "light": every lit material becomes plain white diffuse (smooth geometric normals, shadows kept).
 * The cel composite smooths the albedo, blurs and thresholds the light into one crisp two-tone mask,
 * and tints the shadow side cool, so normal-map and texture detail can't speckle the bands.
 */
export type CelPass = "albedo" | "light";
type Lit = Material & { color?: Color; map?: Texture | null; isMeshStandardMaterial?: boolean; isMeshPhysicalMaterial?: boolean; isMeshLambertMaterial?: boolean; isMeshPhongMaterial?: boolean; isMeshToonMaterial?: boolean };

const caches: Record<CelPass, WeakMap<Material, Material>> = { albedo: new WeakMap(), light: new WeakMap() };

function twinOf(src: Material, pass: CelPass): Material {
  const hit = caches[pass].get(src);
  if (hit) return hit;
  const s = src as Lit;
  const lit = s.isMeshStandardMaterial || s.isMeshPhysicalMaterial || s.isMeshLambertMaterial || s.isMeshPhongMaterial || s.isMeshToonMaterial;
  let m: Material = src;
  const common = { transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest, side: src.side };
  if (lit && pass === "albedo") {
    const b = new MeshBasicMaterial({ ...common, color: s.color?.clone(), map: s.map ?? null, vertexColors: src.vertexColors });
    b.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", "#ifdef USE_MAP\n  diffuseColor *= texture2D( map, vMapUv, 1.5 );\n#endif");
    };
    b.customProgramCacheKey = () => "ac-cel-albedo";
    m = b;
  } else if (lit) m = new MeshLambertMaterial({ ...common, color: 0xffffff });
  caches[pass].set(src, m);
  return m;
}

const saved = new Map<Mesh, Material | Material[]>();

/** Swap every mesh under the roots to its pass twin. Always pair with restoreCel(). */
export function applyCel(roots: (Object3D | null)[], pass: CelPass) {
  for (const r of roots)
    r?.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      if (!saved.has(mesh)) saved.set(mesh, mesh.material);
      const orig = saved.get(mesh)!;
      mesh.material = Array.isArray(orig) ? orig.map((x) => twinOf(x, pass)) : twinOf(orig, pass);
    });
}

export function restoreCel() {
  for (const [mesh, mat] of saved) mesh.material = mat;
  saved.clear();
}

/** View-space normals of smooth geometry (no normal maps): the ink pass reads creases from these. */
export const normalPass = new MeshNormalMaterial();
