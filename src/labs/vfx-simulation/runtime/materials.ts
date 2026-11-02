import { BackSide, CanvasTexture, Color, DataTexture, Mesh, MeshBasicMaterial, MeshStandardMaterial, MeshToonMaterial, NearestFilter, RedFormat, RepeatWrapping, SRGBColorSpace, SkinnedMesh, type Material, type Object3D } from "three";
import { mulberry32 } from "../engine/rng";

/** A 3-band toon ramp (shadow, mid, lit). */
export function toonRamp(levels = [90, 170, 255]): DataTexture {
  const data = new Uint8Array(levels);
  const tex = new DataTexture(data, levels.length, 1, RedFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Inverted-hull outline material: back faces pushed out along the vertex normal by `width` (object
 * units). Works for skinned meshes (uses the skinned normal) and plain meshes.
 */
export function outlineMaterial(color: string, width: number, skinned = false): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color, side: BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutline = { value: width };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uOutline;")
      .replace("#include <skinning_vertex>", skinned ? "#include <skinning_vertex>\ntransformed += normalize(objectNormal) * uOutline;" : "#include <skinning_vertex>\ntransformed += normalize(normal) * uOutline;");
  };
  m.customProgramCacheKey = () => `vx-outline-${skinned ? "s" : "m"}-${width}`;
  return m;
}

/**
 * Turn a rigged character into a cel-shaded one with an ink outline (for the hand-drawn treatment).
 * Materials become toon (same colour map), each skinned mesh gets an outline twin sharing its skeleton.
 */
export function toonify(root: Object3D, ink: string, ramp: DataTexture, worldWidth = 0.007) {
  const meshes: SkinnedMesh[] = [];
  root.traverse((o) => {
    const m = o as SkinnedMesh;
    if (m.isSkinnedMesh && !m.userData.vxOutline && !m.userData.vxToon) meshes.push(m);
  });
  root.updateMatrixWorld(true);
  for (const m of meshes) {
    m.userData.vxToon = true;
    const swap = (src: Material) => {
      const s = src as MeshStandardMaterial;
      return new MeshToonMaterial({ map: s.map ?? null, color: s.color ? s.color.clone().multiplyScalar(1.08) : new Color("#ffffff"), gradientMap: ramp });
    };
    m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    const scale = m.getWorldScale(m.position.clone()).x || 1;
    const outline = new SkinnedMesh(m.geometry, outlineMaterial(ink, worldWidth / scale, true));
    outline.userData.vxOutline = true;
    outline.bind(m.skeleton, m.bindMatrix);
    outline.bindMode = m.bindMode;
    outline.position.copy(m.position);
    outline.quaternion.copy(m.quaternion);
    outline.scale.copy(m.scale);
    outline.frustumCulled = false;
    outline.castShadow = false;
    if (m.morphTargetInfluences) outline.morphTargetInfluences = m.morphTargetInfluences;
    if (m.morphTargetDictionary) outline.morphTargetDictionary = m.morphTargetDictionary;
    m.parent?.add(outline);
  }
}

/** Painted deck planks (running along X). */
export function deckTexture(paper = false): CanvasTexture {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(paper ? 9 : 3);
  const rows = 8;
  const rh = H / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300;
    while (x < W) {
      const len = 260 + rnd() * 360;
      if (paper) {
        g.fillStyle = `hsl(40, 45%, ${88 + rnd() * 3}%)`;
        g.fillRect(x, r * rh, len, rh);
        g.strokeStyle = "rgba(90,70,40,0.35)";
        g.lineWidth = 2;
        g.strokeRect(x + 1, r * rh + 1, len - 2, rh - 2);
      } else {
        const l = 52 + rnd() * 12;
        g.fillStyle = `hsl(${26 + rnd() * 8}, ${38 + rnd() * 12}%, ${l}%)`;
        g.fillRect(x, r * rh, len, rh);
        // grain
        for (let k = 0; k < 9; k++) {
          g.strokeStyle = `rgba(70,40,20,${0.06 + rnd() * 0.08})`;
          g.lineWidth = 1 + rnd() * 1.5;
          const y = r * rh + rnd() * rh;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 8, x + len * 0.7, y + (rnd() - 0.5) * 8, x + len, y + (rnd() - 0.5) * 6);
          g.stroke();
        }
        g.fillStyle = "rgba(40,22,10,0.55)";
        g.fillRect(x, r * rh, 3, rh);
      }
      x += len;
    }
    g.fillStyle = paper ? "rgba(90,70,40,0.3)" : "rgba(35,20,8,0.7)";
    g.fillRect(0, r * rh, W, paper ? 2 : 4);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** The back wall: plaster above, painted wainscot below, a skirting board. */
export function wallTexture(paper = false): CanvasTexture {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(paper ? 21 : 11);
  const split = H * 0.6;
  g.fillStyle = paper ? "#efe6d2" : "#e9dfcf";
  g.fillRect(0, 0, W, split);
  if (!paper)
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${rnd() > 0.5 ? "255,255,255" : "120,100,80"},${0.03 + rnd() * 0.04})`;
      g.fillRect(rnd() * W, rnd() * split, 2 + rnd() * 6, 2 + rnd() * 6);
    }
  g.fillStyle = paper ? "#bcd0b6" : "#8fa98c";
  g.fillRect(0, split, W, H - split);
  // vertical boards on the wainscot
  for (let x = 0; x < W; x += 64) {
    g.fillStyle = paper ? "rgba(40,60,40,0.25)" : "rgba(30,45,30,0.25)";
    g.fillRect(x, split, paper ? 2 : 3, H - split);
  }
  g.fillStyle = paper ? "#f6f1e6" : "#f1ece2";
  g.fillRect(0, split - 10, W, 12);
  g.fillRect(0, H - 30, W, 30);
  if (paper) {
    g.strokeStyle = "#0f2a44";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, split - 10);
    g.lineTo(W, split - 10);
    g.moveTo(0, H - 30);
    g.lineTo(W, H - 30);
    g.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  return tex;
}

export function disposeTree(root: Object3D) {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) if (v && typeof v === "object" && "isTexture" in v) (v as unknown as { dispose: () => void }).dispose();
      mat.dispose();
    }
  });
}
