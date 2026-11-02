import { lerpKelvin, mixHex } from "./color";
import { lerp, lerpAngleDeg } from "./spherical";
import { LIGHT_IDS, type Environment, type LightParams, type Rig } from "./types";

/** Smooth ease for preset transitions (cubic in-out). */
export function easeInOut(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * Interpolate one light. Azimuth goes the short way round, colour temperature in mireds, and a light
 * that switches on or off fades its intensity through zero instead of popping.
 */
export function lerpLight(a: LightParams, b: LightParams, u: number): LightParams {
  if (u <= 0) return { ...a };
  if (u >= 1) return { ...b };
  const ia = a.on ? a.intensity : 0;
  const ib = b.on ? b.intensity : 0;
  return {
    on: a.on || b.on,
    azimuthDeg: lerpAngleDeg(a.azimuthDeg, b.azimuthDeg, u),
    elevationDeg: lerp(a.elevationDeg, b.elevationDeg, u),
    distanceM: lerp(a.distanceM, b.distanceM, u),
    intensity: lerp(ia, ib, u),
    kelvin: lerpKelvin(a.kelvin, b.kelvin, u),
    softness: lerp(a.softness, b.softness, u),
    spreadDeg: lerp(a.spreadDeg, b.spreadDeg, u),
    shadows: u < 0.5 ? a.shadows : b.shadows,
    gobo: lerp(a.gobo, b.gobo, u),
  };
}

export function lerpEnv(a: Environment, b: Environment, u: number): Environment {
  if (u <= 0) return { ...a };
  if (u >= 1) return { ...b };
  return {
    ambient: lerp(a.ambient, b.ambient, u),
    skyColor: mixHex(a.skyColor, b.skyColor, u),
    groundColor: mixHex(a.groundColor, b.groundColor, u),
    cycColor: mixHex(a.cycColor, b.cycColor, u),
    glowColor: mixHex(a.glowColor, b.glowColor, u),
    glowTopColor: mixHex(a.glowTopColor, b.glowTopColor, u),
    glowStrength: lerp(a.glowStrength, b.glowStrength, u),
    voidColor: mixHex(a.voidColor, b.voidColor, u),
    saturation: lerp(a.saturation, b.saturation, u),
    exposure: lerp(a.exposure, b.exposure, u),
  };
}

export function lerpRig(a: Rig, b: Rig, u: number): Rig {
  const lights = {} as Rig["lights"];
  for (const id of LIGHT_IDS) lights[id] = lerpLight(a.lights[id], b.lights[id], u);
  return { lights, env: lerpEnv(a.env, b.env, u) };
}

/** Preset transition length; reduced motion makes it instant. */
export const TRANSITION_S = 1.4;
