import { Color, type Material, type MeshStandardMaterial } from "three";

/** Shared grade uniforms: saturation is applied after tone mapping on the character and the set. */
export const grade = {
  uSaturation: { value: 1 },
};

export const glow = {
  uGlowColor: { value: new Color("#000000") },
  uGlowTop: { value: new Color("#000000") },
  uGlowStrength: { value: 0 },
};

const SAT = /* glsl */ `
  gl_FragColor.rgb = clamp(mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, uLsSaturation), 0.0, 1.0);
`;

/** Patch a (cloned) material with the saturation grade. */
export function applyGrade(mat: Material) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLsSaturation = grade.uSaturation;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLsSaturation;")
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>\n${SAT}`);
  };
  mat.customProgramCacheKey = () => "ls-grade";
  mat.needsUpdate = true;
}

/**
 * The cyclorama: graded, plus an emissive "sky" painted on the cove and back wall
 * (horizon colour low, top colour high) for looks like sunset.
 */
export function applyCycShader(mat: MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLsSaturation = grade.uSaturation;
    shader.uniforms.uGlowColor = glow.uGlowColor;
    shader.uniforms.uGlowTop = glow.uGlowTop;
    shader.uniforms.uGlowStrength = glow.uGlowStrength;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLsWorld;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvLsWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLsSaturation;\nuniform vec3 uGlowColor;\nuniform vec3 uGlowTop;\nuniform float uGlowStrength;\nvarying vec3 vLsWorld;")
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        float lsBack = 1.0 - smoothstep(-3.0, -0.8, vLsWorld.z);
        float lsH = smoothstep(0.2, 5.0, vLsWorld.y);
        float lsSide = 1.0 - smoothstep(4.0, 8.0, abs(vLsWorld.x));
        totalEmissiveRadiance += uGlowStrength * lsBack * lsSide * mix(uGlowColor, uGlowTop, lsH);`,
      )
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>\n${SAT}`);
  };
  mat.customProgramCacheKey = () => "ls-cyc";
  mat.needsUpdate = true;
}
