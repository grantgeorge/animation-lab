import { Color, MeshStandardMaterial } from "three";
import { tokens } from "@/lib/tokens";

const cache = new Map<string, MeshStandardMaterial>();

/** Shared satin materials keyed by color + finish, so the scene stays under ~30 materials. */
export function satin(color: string, roughness = 0.75, metalness = 0, emissive?: { color: string; intensity: number }) {
  const key = `${color}|${roughness}|${metalness}|${emissive?.color ?? ""}|${emissive?.intensity ?? 0}`;
  let m = cache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
    if (emissive) {
      m.emissive = new Color(emissive.color);
      m.emissiveIntensity = emissive.intensity;
    }
    cache.set(key, m);
  }
  return m;
}

export const mats = {
  floor: () => satin(tokens.stageFloor, 0.92),
  plaster: () => satin(tokens.plaster, 0.95),
  plasterShade: () => satin(tokens.plasterShade, 0.95),
  brick: () => satin(tokens.brick, 0.9),
  wood: () => satin(tokens.wood, 0.7),
  teal: () => satin(tokens.teal, 0.6),
  stone: () => satin(tokens.stone, 0.9),
  roof: () => satin(tokens.roof, 0.8),
  iron: () => satin("#1E2228", 0.55, 0.6),
  brass: () => satin(tokens.brass, 0.35, 0.85),
  gunmetal: () => satin(tokens.gunmetal, 0.45, 0.8),
  rubber: () => satin(tokens.rubber, 0.95),
  aluminum: () => satin(tokens.aluminum, 0.35, 0.9),
  lampGlow: () => satin(tokens.lampWarm, 0.4, 0, { color: tokens.lampWarm, intensity: 3 }),
  windowGlow: () => satin(tokens.windowGlow, 0.5, 0, { color: tokens.windowGlow, intensity: 1.6 }),
};
