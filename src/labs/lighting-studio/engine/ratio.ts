import { luminance } from "./color";
import { CHANNEL_IDS, FULL_MASK, LIGHT_IDS, type ChannelId, type ChannelMask, type Environment, type LightParams, type Rig } from "./types";

/** Illuminance a light delivers at the subject, facing the light (inverse-square law). */
export function illuminance(l: LightParams): number {
  if (!l.on || l.intensity <= 0) return 0;
  return l.intensity / (l.distanceM * l.distanceM);
}

/** Ambient illuminance on a vertical surface: half sky, half ground bounce. */
export function ambientIlluminance(env: Environment): number {
  return env.ambient * (luminance(env.skyColor) + luminance(env.groundColor)) * 0.5;
}

/** Apply solo / take-apart visibility to a rig (scales intensities; geometry untouched). */
export function effectiveRig(rig: Rig, mask: ChannelMask = FULL_MASK): Rig {
  const lights = { ...rig.lights };
  for (const id of LIGHT_IDS) {
    const m = mask[id];
    if (m < 1) lights[id] = { ...lights[id], intensity: lights[id].intensity * m, on: lights[id].on && m > 0 };
  }
  const env = mask.ambient < 1 ? { ...rig.env, ambient: rig.env.ambient * mask.ambient, glowStrength: rig.env.glowStrength * mask.ambient } : rig.env;
  return { lights, env };
}

export interface LightingAnalysis {
  /** Illuminance per channel at the subject. */
  e: Record<ChannelId, number>;
  /** Lit side (key + fill + ambient) and shadow side (fill + ambient). */
  lit: number;
  shadow: number;
  /** Lighting ratio lit:shadow; Infinity when the shadow side gets nothing. */
  ratio: number;
  /** Contrast in photographic stops, log2(ratio). */
  stops: number;
  /** Share of all light reaching the subject, per channel (0…1). */
  share: Record<ChannelId, number>;
  keyStyle: "high-key" | "mid-key" | "low-key";
}

/**
 * Classic key:fill lighting ratio, measured the way a gaffer does with an incident meter:
 * lit side = key + fill + ambient, shadow side = fill + ambient. 2:1 is one stop.
 */
export function analyze(rig: Rig): LightingAnalysis {
  const e: Record<ChannelId, number> = {
    key: illuminance(rig.lights.key),
    fill: illuminance(rig.lights.fill),
    rim: illuminance(rig.lights.rim),
    ambient: ambientIlluminance(rig.env),
  };
  const shadow = e.fill + e.ambient;
  const lit = e.key + shadow;
  const ratio = shadow > 1e-6 ? lit / shadow : lit > 1e-6 ? Infinity : 1;
  const stops = Number.isFinite(ratio) ? Math.log2(ratio) : Infinity;
  const total = CHANNEL_IDS.reduce((s, id) => s + e[id], 0);
  const share = Object.fromEntries(CHANNEL_IDS.map((id) => [id, total > 0 ? e[id] / total : 0])) as Record<ChannelId, number>;
  const keyStyle = e.key <= 0 ? (shadow < 0.5 ? "low-key" : "high-key") : ratio <= 2.5 ? "high-key" : ratio >= 6 ? "low-key" : "mid-key";
  return { e, lit, shadow, ratio, stops, share, keyStyle };
}

/** "3:1", "1.5:1", "8:1", "64:1+" for display and prompts. */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio >= 64) return "64:1+";
  if (ratio < 3) return `${(Math.round(ratio * 2) / 2).toFixed(1).replace(/\.0$/, "")}:1`;
  return `${Math.round(ratio)}:1`;
}

export function formatStops(stops: number): string {
  if (!Number.isFinite(stops) || stops >= 6) return "6+ stops";
  const v = Math.round(stops * 10) / 10;
  return `${v.toFixed(1)} ${v === 1 ? "stop" : "stops"}`;
}
