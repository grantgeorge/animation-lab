"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Color, HemisphereLight, SRGBColorSpace, SpotLight, type Scene, type WebGLRenderer } from "three";
import { kelvinToRgb } from "../engine/color";
import { DEG, lightPosition } from "../engine/spherical";
import { LIGHT_IDS, type LightId } from "../engine/types";
import { studio } from "../config";
import { studioStore } from "../store";
import { ORDER, live, useStudioFrame } from "./bus";
import { BlindsCookie } from "./gobo";
import { cycMaterial } from "./StudioSet";
import { glow, grade } from "./grade";

const T = studio.subject.target;

/** Shadow blur in shadow-map texels for a softness value (a bigger source blurs more). */
export const shadowRadius = (softness: number) => 1 + softness * 14;

/** Exposure that puts a ~3 lx key about a stop over middle grey; presets scale it with env.exposure. */
export const EXPOSURE_BASE = 0.62;

interface LightRig {
  spots: Record<LightId, SpotLight>;
  cookies: Record<LightId, BlindsCookie>;
  hemi: HemisphereLight;
}

/** Push the current rig (and eased masks) into the three.js lights, set and grade. */
function applyRig(rig: LightRig, gl: WebGLRenderer, scene: Scene) {
  const { rig: r } = studioStore.getState();
  for (const id of LIGHT_IDS) {
    const l = r.lights[id];
    const s = rig.spots[id];
    const p = lightPosition(l.azimuthDeg, l.elevationDeg, l.distanceM, T);
    s.position.set(p[0], p[1], p[2]);
    s.target.position.set(T[0], T[1], T[2]);
    s.target.updateMatrixWorld();
    const c = kelvinToRgb(l.kelvin);
    s.color.setRGB(c.r, c.g, c.b, SRGBColorSpace);
    s.intensity = (l.on ? l.intensity : 0) * live.mask[id];
    s.angle = Math.min(80, l.spreadDeg) * 0.5 * DEG;
    s.penumbra = 0.18 + 0.78 * l.softness;
    s.shadow.radius = shadowRadius(l.softness);
    s.shadow.intensity = live.shadow[id];
    rig.cookies[id].update(l.gobo);
  }
  const env = r.env;
  rig.hemi.color.set(env.skyColor);
  rig.hemi.groundColor.set(env.groundColor);
  rig.hemi.intensity = env.ambient * live.mask.ambient;
  cycMaterial.color.set(env.cycColor);
  glow.uGlowColor.value.set(env.glowColor);
  glow.uGlowTop.value.set(env.glowTopColor);
  glow.uGlowStrength.value = env.glowStrength * live.mask.ambient;
  grade.uSaturation.value = env.saturation;
  gl.toneMappingExposure = env.exposure * EXPOSURE_BASE;
  if (!(scene.background instanceof Color)) scene.background = new Color();
  (scene.background as Color).set(env.voidColor);
}

/**
 * Key, fill and rim are spot lights aimed at the subject; ambient is a hemisphere light.
 * All three spots always cast shadows and always carry a cookie, so toggling shadows or blinds only
 * changes uniforms (shadow.intensity, the cookie canvas) and never recompiles a shader mid-transition.
 */
export function StudioLights({ shadowMapSize }: { shadowMapSize: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const rig = useMemo((): LightRig => {
    const spots = {} as Record<LightId, SpotLight>;
    const cookies = {} as Record<LightId, BlindsCookie>;
    for (const id of LIGHT_IDS) {
      const l = new SpotLight("#ffffff", 0, 0, 0.5, 0.5, 2);
      l.name = `light-${id}`;
      l.castShadow = true;
      l.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.025;
      l.shadow.camera.near = 0.3;
      l.shadow.camera.far = 16;
      cookies[id] = new BlindsCookie();
      l.map = cookies[id].texture;
      spots[id] = l;
    }
    const hemi = new HemisphereLight("#ffffff", "#000000", 0);
    return { spots, cookies, hemi };
  }, [shadowMapSize]);

  useEffect(
    () => () => {
      for (const id of LIGHT_IDS) {
        rig.cookies[id].dispose();
        rig.spots[id].shadow.map?.dispose();
        rig.spots[id].dispose();
      }
    },
    [rig],
  );

  useStudioFrame(() => applyRig(rig, gl, scene), ORDER.LIGHTS);

  return (
    <>
      {LIGHT_IDS.map((id) => (
        <group key={id}>
          <primitive object={rig.spots[id]} />
          <primitive object={rig.spots[id].target} />
        </group>
      ))}
      <primitive object={rig.hemi} />
    </>
  );
}
