/**
 * What every Lens & Framing scene shares: the sound stage's camera, rail and lens kit, and the
 * two characters' bodies (the same Meshy models walk from set to set, as a studio's cast would).
 * Scenes differ in set, marks, performance, lighting and timeline.
 */
export const stage = {
  gate: { widthMm: 36, heightMm: 20.25 },
  aspect: 16 / 9,
  clip: { near: 0.05, far: 60 },
  focal: { min: 18, max: 135, presets: [18, 24, 35, 50, 85, 135], default: 50 },
  rail: { x: -0.35, y: 1.47, sMin: -5.4, sMax: 2.4, meshZ: [-2.7, 5.7] },
  defaultRig: { railS: 0, yawDeg: 0, pitchDeg: 0, focalMm: 50 },
  noGoRadiusM: 0.45,
  exercises: { ex2Start: { focalMm: 50, metric: 0.92 } },
} as const;

export const bramBody = {
  name: "Bram",
  pronoun: "he",
  heightM: 1.78,
  framingBox: { bottom: 1.08, top: 1.86, halfWidthM: 0.3, label: "head & shoulders" },
  landmarks: {
    feet: 0,
    crown: 1.74,
    capTop: 1.78,
    eyes: 1.6,
    chestTop: 1.3,
    noseTip: { y: 1.567, forward: 0.228 },
    earMid: { y: 1.58, forward: -0.05 },
  },
} as const;

export const pipBody = {
  name: "Pip",
  pronoun: "he",
  heightM: 1.05,
  framingBox: { bottom: 0, top: 1.12, halfWidthM: 0.26, label: "full height" },
  landmarks: {
    feet: 0,
    crown: 1.05,
    capTop: 1.12,
    eyes: 0.91,
    chestTop: 0.72,
    noseTip: { y: 0.887, forward: 0.15 },
    earMid: { y: 0.9, forward: -0.02 },
  },
} as const;

export const observerLimits = { minPolar: 0.12, maxPolar: Math.PI / 2 - 0.04, minDist: 1.2, maxDist: 28 } as const;
