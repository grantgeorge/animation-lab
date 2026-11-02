import type { SceneDescriptor } from "@/engine/types";
import { bramBody, observerLimits, pipBody, stage } from "./stage";

/**
 * "The Workshop" (comedy). Bram tinkers at his bench in a cramped attic; Pip pops out of the floor
 * hatch right behind him. The lesson: close quarters. A wide lens up close inflates the clutter
 * and Bram's face and pushes Pip far away; a long lens from back stacks Pip right on Bram's shoulder,
 * the classic comic two-shot. Bram's mark and the rail are unchanged.
 */
export const workshopScene = {
  scene: { id: "workshop", title: "The Workshop", genre: "Comedy", logline: "Bram tinkers at his bench; Pip pops out of the trapdoor behind him.", tip: "In Match framing, compare 24 mm and 85 mm. Watch how Pip and the round window change size behind Bram." },
  labels: { foreground: "the hanging bulb", midground: "the round window", background: "the back wall", landmark: "the grandfather clock" },
  look: {
    voidColor: "#0A0806",
    hemi: { sky: "#5A4A3A", ground: "#1A120C", intensity: 0.7 },
    key: { position: [-2.6, 4.2, 1.8], target: [0, 1.0, -3.4], color: "#FFD9A8", intensity: 1.9 },
    rim: { position: [2.4, 3.2, -6.0], color: "#BFD8FF", intensity: 22 },
    practicals: [
      { position: [0.65, 2.05, -1.3], color: "#FFB46A", intensity: 4.5, distance: 5 },
      { position: [0.25, 1.32, -2.35], color: "#FFC98A", intensity: 3.5, distance: 3.5 },
      { position: [0.4, 2.1, -5.2], color: "#CFE2FF", intensity: 3, distance: 4 },
    ],
  },
  ...stage,
  characters: {
    primary: { ...bramBody, restYawDeg: 0, root: [-0.35, 0, -3.0], anchor: [-0.35, 1.47, -3.0] },
    secondary: {
      ...pipBody,
      restYawDeg: -30,
      // on the loft riser behind the bench (0.55 m), so his head reaches Bram's shoulder
      root: [0.35, 0.55, -3.75],
      anchor: [0.35, 1.11, -3.75],
      framingBox: { bottom: 0.55, top: 1.67, halfWidthM: 0.26, label: "full height" },
    },
  },
  anchors: { both: [-0.02, 1.205, -3.375] },
  set: {
    lantern: { base: [0.65, 2.9, -1.3], head: [0.65, 2.05, -1.3] },
    doorway: { z: -5.6, openingX: [-0.15, 0.95], heightM: 2.65, archR: 0.55, lamp: [0.4, 2.1, -5.2] },
    backWall: { z: -5.6, window: { centre: [0.4, 2.1, -5.6], w: 1.1, h: 1.1 } },
    tower: { base: [-1.95, 0, -5.25], clockFace: [-1.95, 1.85, -5.25], heightM: 2.2 },
    backdropZ: -6.4,
    plate: { x: [-3.2, 3.2], z: [-6.6, 6.5] },
  },
  perspective: { refZ: -5.6, deep: 0.33, compressed: 0.64 },
  observer: {
    boundary: { min: [-5, 0.2, -6.2], max: [5, 6, 7] },
    limits: observerLimits,
    presets: {
      overview: { position: [-2.6, 3.6, 4.4], target: [0.1, 1.0, -3.4] },
      profile: { position: [6.2, 1.7, -2.4], target: [-0.1, 1.1, -3.3] },
      topdown: { position: [-0.2, 11, -1.8], target: [-0.2, 0, -3.4] },
    },
    defaultPreset: "overview",
  },
  timeline: {
    durationS: 6,
    fps: 24,
    markers: [
      [0.4, "Tinkering"],
      [2.2, "The peek"],
      [3.1, "The startle"],
      [4.6, "Recovery"],
    ],
  },
} as const satisfies SceneDescriptor;
