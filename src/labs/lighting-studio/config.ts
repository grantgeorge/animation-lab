import type { Vec3 } from "./engine/spherical";

/** Numbers for the Lighting Studio set, subject and cameras. */
export const studio = {
  subject: {
    name: "Bram",
    url: "/models/bram.glb",
    heightM: 1.78,
    /** Lights aim at, and orbit around, his chest/face. */
    target: [0, 1.45, 0] as Vec3,
  },
  /** Film gate (S35-ish 16:9) for converting focal length to field of view. */
  gateHeightMm: 20.25,
  shots: {
    close: { label: "Close-up", short: "CU", focalMm: 50, position: [0, 1.6, 1.9] as Vec3, target: [0, 1.52, 0] as Vec3 },
    medium: { label: "Medium", short: "MS", focalMm: 50, position: [0, 1.45, 4.1] as Vec3, target: [0, 1.22, 0] as Vec3 },
    wide: { label: "Full", short: "FS", focalMm: 35, position: [0, 1.35, 6.4] as Vec3, target: [0, 0.98, 0] as Vec3 },
  },
  /** Seamless sweep: floor runs to the cove, curves up and becomes the back wall. */
  cyc: { halfWidth: 8, frontZ: 9, coveZ: -2.4, coveRadius: 1.6, topY: 7, color: "#3C424D" },
  inspect: {
    position: [8.6, 6.0, 7.2] as Vec3,
    target: [0, 1.1, -0.4] as Vec3,
    minDistance: 2.2,
    maxDistance: 18,
  },
  shadowMap: { high: 2048, low: 1024 },
  /** UI identity colour of each channel (not the light's own colour). */
  ui: { key: "#FFB547", fill: "#5FE3FF", rim: "#D7A6FF", ambient: "#8EF0C3" },
} as const;

export type ShotSize = keyof typeof studio.shots;

/** Vertical field of view (degrees) for a focal length on the studio gate. */
export const vfovDeg = (focalMm: number) => (2 * Math.atan(studio.gateHeightMm / 2 / focalMm) * 180) / Math.PI;
