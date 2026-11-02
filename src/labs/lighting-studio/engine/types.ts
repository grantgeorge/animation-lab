/**
 * Lighting Studio data model. Pure data: no renderer, framework or store imports.
 *
 * Conventions (camera-relative, around the subject):
 * - azimuth 0° = the camera side (front light), +90° = screen right, −90° = screen left, ±180° = behind.
 * - elevation 0° = subject eye level, +90° = straight overhead, negative = from below.
 * - intensity is a point-source intensity (candela); illuminance at the subject is I / d².
 */
export type LightId = "key" | "fill" | "rim";
export type ChannelId = LightId | "ambient";

export const LIGHT_IDS: readonly LightId[] = ["key", "fill", "rim"];
export const CHANNEL_IDS: readonly ChannelId[] = ["key", "fill", "rim", "ambient"];

export interface LightParams {
  /** Part of the look: a light that is switched off. (Solo / take-apart masks are separate.) */
  on: boolean;
  azimuthDeg: number;
  elevationDeg: number;
  distanceM: number;
  /** Point-source intensity, candela. */
  intensity: number;
  /** Colour temperature, Kelvin. */
  kelvin: number;
  /** 0 = hard (tiny source) … 1 = very soft (big source). */
  softness: number;
  /** Full beam angle in degrees. */
  spreadDeg: number;
  /** Whether this light casts shadows. */
  shadows: boolean;
  /** 0 … 1 strength of a venetian-blind gobo in front of the light. */
  gobo: number;
}

export interface Environment {
  /** Ambient (sky + ground bounce) intensity. */
  ambient: number;
  skyColor: string;
  groundColor: string;
  /** Albedo of the cyclorama sweep. */
  cycColor: string;
  /** Emissive glow painted on the back of the sweep: horizon colour, top colour, strength. */
  glowColor: string;
  glowTopColor: string;
  glowStrength: number;
  /** Colour beyond the set. */
  voidColor: string;
  /** Grade: 0 = monochrome, 1 = as shot. */
  saturation: number;
  /** Tone-mapping exposure multiplier. */
  exposure: number;
}

export interface Rig {
  lights: Record<LightId, LightParams>;
  env: Environment;
}

/** Per-channel visibility multipliers (0…1) used by solo and take-apart. */
export type ChannelMask = Record<ChannelId, number>;

export const FULL_MASK: ChannelMask = { key: 1, fill: 1, rim: 1, ambient: 1 };

export const LIMITS = {
  azimuthDeg: { min: -180, max: 180 },
  elevationDeg: { min: -30, max: 85 },
  distanceM: { min: 1.4, max: 5 },
  intensity: { min: 0, max: 120 },
  kelvin: { min: 1800, max: 12000 },
  softness: { min: 0, max: 1 },
  spreadDeg: { min: 14, max: 80 },
  gobo: { min: 0, max: 1 },
  ambient: { min: 0, max: 1.6 },
  glowStrength: { min: 0, max: 2.5 },
  saturation: { min: 0, max: 1.4 },
  exposure: { min: 0.4, max: 2 },
} as const;
