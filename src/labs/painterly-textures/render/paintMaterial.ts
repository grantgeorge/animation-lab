import { Color, Matrix4, Texture, Vector3, type Material, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";
import { FRAG_ALBEDO, FRAG_NORMAL, FRAG_PARS, FRAG_SHADE, VERT_MAIN, VERT_PARS } from "./glsl";

/**
 * Shared uniform objects, one group for the characters and one for the environment, so the
 * Orchestrator flips a whole group between the clean and painted passes with a single write.
 * Every patched material references these {value} objects (never copies).
 */
export type Uniform<T> = { value: T };

export interface PaintGroup {
  ptPaint: Uniform<number>;
  ptTex: Uniform<number>;
  ptShade: Uniform<number>;
  ptDebug: Uniform<number>;
  ptTiles: Uniform<number>;
  ptAngle: Uniform<number>;
  ptPatchFreq: Uniform<number>;
  ptBands: Uniform<number>;
  ptBreak: Uniform<number>;
  ptMid: Uniform<number>;
  ptRim: Uniform<number>;
  ptShadowTint: Uniform<Color>;
  ptLightTint: Uniform<Color>;
  ptRimColor: Uniform<Color>;
  ptRimDir: Uniform<Vector3>;
  ptSeed: Uniform<Vector3>;
  ptBrush: Uniform<Texture | null>;
}

export interface EnvExtras {
  ptProj: Uniform<number>;
  ptMatte: Uniform<Texture | null>;
  ptAcesInv: Uniform<Texture | null>;
  ptProjVP: Uniform<Matrix4>;
  ptMatteReady: Uniform<number>;
}

const u = <T>(value: T): Uniform<T> => ({ value });

function group(): PaintGroup {
  return {
    ptPaint: u(0),
    ptTex: u(0),
    ptShade: u(0),
    ptDebug: u(0),
    ptTiles: u(3),
    ptAngle: u(0.3),
    ptPatchFreq: u(8),
    ptBands: u(3),
    ptBreak: u(0.1),
    ptMid: u(0.32),
    ptRim: u(0.8),
    ptShadowTint: u(new Color(0.8, 0.9, 1.3)),
    ptLightTint: u(new Color(1.15, 1, 0.82)),
    ptRimColor: u(new Color(0.75, 0.85, 1.1)),
    ptRimDir: u(new Vector3(0.6, 0.4, -0.7).normalize()),
    ptSeed: u(new Vector3()),
    ptBrush: u(null),
  };
}

export const charUniforms = group();
export const envUniforms = group();
export const envExtras: EnvExtras = { ptProj: u(0), ptMatte: u(null), ptAcesInv: u(null), ptProjVP: u(new Matrix4()), ptMatteReady: u(0) };

export type PaintKind = "char" | "env";

export interface PatchedInfo {
  kind: PaintKind;
  restScale: Uniform<number>;
  projAllow: Uniform<number>;
}

const isStandard = (m: Material | null | undefined): m is MeshStandardMaterial => !!m && (m as MeshStandardMaterial).isMeshStandardMaterial === true;

/** A clone of `src` that can render both clean (ptPaint 0) and painted. `src` is never touched. */
export function makePainted(src: Material, kind: PaintKind, restScale: number): { material: Material; info: PatchedInfo } | null {
  if (!isStandard(src)) return null;
  const mat = src.clone();
  const info: PatchedInfo = { kind, restScale: u(restScale), projAllow: u(1) };
  const shared = kind === "char" ? charUniforms : envUniforms;
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, shared, { ptRestScale: info.restScale });
    if (kind === "env") Object.assign(shader.uniforms, envExtras, { ptProjAllow: info.projAllow });
    const def = kind === "char" ? "#define PT_CHAR\n" : "#define PT_ENV\n";
    shader.vertexShader = def + shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_PARS}`)
      .replace("#include <skinning_vertex>", `#include <skinning_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = def + shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_PARS}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAG_ALBEDO}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
      .replace("vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;", FRAG_SHADE);
  };
  mat.customProgramCacheKey = () => `painterly-${kind}`;
  mat.userData.painterly = info;
  mat.name = `${src.name || "mat"}+painterly`;
  return { material: mat, info };
}
