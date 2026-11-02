import { LIMITS, type LightParams } from "./types";

export type Vec3 = readonly [number, number, number];

export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Wrap an angle to (−180, 180]. */
export function wrapDeg(a: number): number {
  const w = ((((a + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
}

/** Interpolate angles the short way round. */
export function lerpAngleDeg(a: number, b: number, u: number): number {
  return wrapDeg(a + wrapDeg(b - a) * u);
}

/**
 * Light position on a sphere around the subject target. The camera looks down −Z from +Z,
 * so azimuth 0 sits on +Z (camera side) and +90 on +X (screen right).
 */
export function lightPosition(azimuthDeg: number, elevationDeg: number, distanceM: number, target: Vec3): Vec3 {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  const h = Math.cos(el) * distanceM;
  return [target[0] + h * Math.sin(az), target[1] + Math.sin(el) * distanceM, target[2] + h * Math.cos(az)];
}

/** Inverse of lightPosition. */
export function anglesFromPosition(p: Vec3, target: Vec3): { azimuthDeg: number; elevationDeg: number; distanceM: number } {
  const dx = p[0] - target[0];
  const dy = p[1] - target[1];
  const dz = p[2] - target[2];
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-9) return { azimuthDeg: 0, elevationDeg: 0, distanceM: 0 };
  return {
    azimuthDeg: wrapDeg(Math.atan2(dx, dz) / DEG),
    elevationDeg: Math.asin(clamp(dy / d, -1, 1)) / DEG,
    distanceM: d,
  };
}

/**
 * Intersect a ray with the sphere (centre, radius) and return the hit nearest to `prefer`
 * (keeps a dragged light on its side of the subject). If the ray misses, return the point on the
 * sphere closest to the ray.
 */
export function raySphereNearest(origin: Vec3, dir: Vec3, centre: Vec3, radius: number, prefer: Vec3): Vec3 {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  const oc: Vec3 = [origin[0] - centre[0], origin[1] - centre[1], origin[2] - centre[2]];
  const b = oc[0] * d[0] + oc[1] * d[1] + oc[2] * d[2];
  const c = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - radius * radius;
  const disc = b * b - c;
  const at = (t: number): Vec3 => [origin[0] + d[0] * t, origin[1] + d[1] * t, origin[2] + d[2] * t];
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    const hits = [-b - s, -b + s].filter((t) => t > 0).map(at);
    if (hits.length > 0) {
      const dist = (p: Vec3) => (p[0] - prefer[0]) ** 2 + (p[1] - prefer[1]) ** 2 + (p[2] - prefer[2]) ** 2;
      return hits.reduce((best, p) => (dist(p) < dist(best) ? p : best));
    }
  }
  // Closest point on the ray to the centre, pushed out to the sphere.
  const t = Math.max(0, -b);
  const q = at(t);
  const v: Vec3 = [q[0] - centre[0], q[1] - centre[1], q[2] - centre[2]];
  const vl = Math.hypot(v[0], v[1], v[2]) || 1;
  return [centre[0] + (v[0] / vl) * radius, centre[1] + (v[1] / vl) * radius, centre[2] + (v[2] / vl) * radius];
}

/** Clamp a light's placement fields to the lab limits. */
export function clampPlacement<T extends Partial<LightParams>>(p: T): T {
  const out = { ...p };
  if (out.azimuthDeg !== undefined) out.azimuthDeg = wrapDeg(out.azimuthDeg);
  if (out.elevationDeg !== undefined) out.elevationDeg = clamp(out.elevationDeg, LIMITS.elevationDeg.min, LIMITS.elevationDeg.max);
  if (out.distanceM !== undefined) out.distanceM = clamp(out.distanceM, LIMITS.distanceM.min, LIMITS.distanceM.max);
  return out;
}

/** Plain-language side of the subject for an azimuth (camera-relative). */
export type Side = "front" | "three-quarter" | "side" | "three-quarter back" | "back";

export function describeAzimuth(azimuthDeg: number): { side: Side; screen: "left" | "right" | "centre"; abs: number } {
  const a = wrapDeg(azimuthDeg);
  const abs = Math.abs(a);
  const screen = abs < 8 || abs > 172 ? "centre" : a < 0 ? "left" : "right";
  const side: Side = abs < 22 ? "front" : abs < 68 ? "three-quarter" : abs < 112 ? "side" : abs < 160 ? "three-quarter back" : "back";
  return { side, screen, abs: Math.round(abs) };
}

export type Height = "underlight" | "eye level" | "raised" | "high" | "overhead";

export function describeElevation(elevationDeg: number): Height {
  if (elevationDeg < -8) return "underlight";
  if (elevationDeg < 10) return "eye level";
  if (elevationDeg < 25) return "raised";
  if (elevationDeg < 60) return "high";
  return "overhead";
}

/** Emitting-surface radius (m) that a softness value stands for: soft light = big source. */
export function sourceRadiusM(softness: number): number {
  return 0.04 + clamp(softness, 0, 1) * 0.56;
}
