import type { CamPose, SurfacePoint } from "./engine/projection";

/**
 * Every number of the Painterly Textures lab. The set and the cast are the shared Workshop scene
 * (src/labs/lens-and-framing/scenes/workshop.ts); only cameras, paint scales and cards live here.
 */
export const painterly = {
  sceneId: "workshop" as const,
  durationS: 6,

  /** The shot: a 35 mm medium-wide on Bram at his bench, Pip on the riser behind. */
  shot: { position: [-0.08, 1.56, 1.15], target: [0.08, 1.18, -3.6], fovDeg: 32.3, aspect: 16 / 9, near: 0.05, far: 40 } satisfies CamPose,
  /** The matte painting was painted over a render from exactly the shot camera. */
  projectorPivot: [0.1, 1.2, -3.6] as const,
  /** Experiment slider range: swing the camera this far off the projector. */
  projYawMaxDeg: 40,
  projRisePerDeg: 0.012,

  /** Consistency test: a static portrait camera on Bram's head (3:4). */
  test: {
    camera: { position: [-0.34, 1.6, -1.72], target: [-0.35, 1.53, -3.0], fovDeg: 25, aspect: 3 / 4, near: 0.05, far: 30 } satisfies CamPose,
    /** Camera-orbit variant: swing around the head by ± this many degrees. */
    orbitDeg: 38,
    head: [-0.35, 1.55, -3.0] as const,
    /** Off-screen measurement size (portrait). */
    measure: { width: 150, height: 200 },
    /** Cells must move this far between frames to be scored (0: every cell; boiling needs no motion). */
    minMovePx: 0,
  },

  /** Inspect observer presets. */
  inspect: {
    overview: { position: [3.4, 2.9, 2.6], target: [-0.1, 1.2, -3.2] },
    texture: { position: [0.55, 1.72, -1.55], target: [-0.35, 1.45, -3.0] },
    overlays: { position: [4.6, 2.4, -0.4], target: [0.0, 1.4, -3.0] },
  },

  /** Paint scales: dab cells per metre (a stroke is ~2 cells long), patch frequency per metre. */
  paint: {
    char: { tilesPerM: 27, patchFreq: 7, break: 0.09, rim: 0.85 },
    env: { tilesPerM: 8, patchFreq: 1.6, break: 0.06, rim: 0 },
    /** Irradiance that maps to light amount 0.5 (see engine/ramp lightToAmount). */
    mid: 0.32,
    lightTint: "#FFD9AE",
    rimColor: "#B9D4FF",
    rimFrom: [2.4, 3.2, -6.0] as const,
  },

  matte: { url: "/labs/painterly-textures/matte.jpg", width: 1536, height: 864 },

  /** Points on the set where projection stretch is measured (point, outward normal). */
  stretchSamples: [
    { p: [0.4, 2.4, -5.48], n: [0, 0, 1] },
    { p: [-1.5, 1.9, -5.48], n: [0, 0, 1] },
    { p: [1.55, 0.6, -5.48], n: [0, 0, 1] },
    { p: [-0.45, 1.25, -5.48], n: [0, 0, 1] },
    { p: [-1.6, 0.0, -3.6], n: [0, 1, 0] },
    { p: [0.2, 0.0, -1.2], n: [0, 1, 0] },
    { p: [1.6, 0.0, -2.3], n: [0, 1, 0] },
    { p: [-0.6, 0.0, -4.9], n: [0, 1, 0] },
    { p: [0.6, 0.56, -3.9], n: [0, 1, 0] },
    { p: [0.6, 0.3, -3.29], n: [0, 0, 1] },
    { p: [-2.39, 1.4, -3.6], n: [1, 0, 0] },
    { p: [-2.39, 0.8, -4.6], n: [1, 0, 0] },
    { p: [-0.6, 0.935, -2.3], n: [0, 1, 0] },
    { p: [-1.95, 1.2, -5.07], n: [0, 0, 1] },
  ] satisfies SurfacePoint[],
} as const;
