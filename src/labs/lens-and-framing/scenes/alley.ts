import type { SceneDescriptor } from "@/engine/types";
import { bramBody, observerLimits, pipBody, stage } from "./stage";

/**
 * "The Long Alley" (action). Pip sprints 12 m down a narrow, lamp-lit alley to reach Bram, then
 * dashes back. The lesson: matched on Pip, a long lens parks the camera far away, so his distance
 * changes by a small ratio and the sprint seems to go nowhere; a wide lens up close makes it explode.
 * Same rail and lens height as the doorway scene; Bram's plane is unchanged (z −3); he stands beside the rail.
 */
export const alleyScene = {
  scene: { id: "alley", title: "The Long Alley", genre: "Action", logline: "Pip sprints the length of a lamp-lit alley to reach Bram, then races back.", tip: "Target Pip, turn on Match framing and play. Compare 24 mm with 85 mm: how quickly does he grow in the frame as he runs toward you?" },
  labels: { foreground: "the street lamp", midground: "the archway", background: "the far wall", landmark: "the water tower" },
  look: {
    voidColor: "#05070C",
    hemi: { sky: "#2B3C5C", ground: "#120E0C", intensity: 0.7 },
    key: { position: [3.2, 7.5, 1.5], target: [0, 1.0, -6.0], color: "#AFC6FF", intensity: 1.4 },
    rim: { position: [-1.0, 5.0, -16.0], color: "#9FD4FF", intensity: 60 },
    practicals: [
      { position: [0.95, 2.35, -1.2], color: "#FFB46A", intensity: 5, distance: 6 },
      { position: [-1.75, 2.7, -6.0], color: "#FFB46A", intensity: 6, distance: 7 },
      { position: [1.35, 2.7, -10.5], color: "#FFB46A", intensity: 6, distance: 7 },
      { position: [-1.75, 2.7, -15.0], color: "#FFB46A", intensity: 6, distance: 7 },
      { position: [0.0, 3.5, -19.55], color: "#FFC98A", intensity: 5, distance: 7 },
    ],
    fog: { color: "#0B1220", near: 9, far: 34 },
    shadow: { left: -6, right: 6, top: 16, bottom: -7, far: 40 },
  },
  ...stage,
  characters: {
    // Bram waits beside the rail, not on it, so a close camera matched on Pip sees past him.
    primary: { ...bramBody, restYawDeg: 14, root: [-1.0, 0, -3.0], anchor: [-1.0, 1.47, -3.0] },
    secondary: { ...pipBody, root: [0.2, 0, -4.4], anchor: [0.2, 0.56, -4.4] },
  },
  anchors: { both: [-0.42, 0.93, -3.7] },
  set: {
    lantern: { base: [0.95, 0, -1.2], head: [0.95, 2.35, -1.2] },
    doorway: { z: -9.0, openingX: [-1.3, 1.1], heightM: 3.1, archR: 1.2, lamp: [1.35, 2.7, -10.5] },
    backWall: { z: -20.0, window: { centre: [0.0, 2.4, -20.0], w: 1.2, h: 1.6 } },
    tower: { base: [0.9, 0, -23.0], clockFace: [0.9, 7.2, -23.0], heightM: 8.0 },
    backdropZ: -24.0,
    plate: { x: [-4.5, 4.5], z: [-24.5, 6.5] },
  },
  perspective: { refZ: -20.0, deep: 0.1, compressed: 0.3 },
  observer: {
    boundary: { min: [-6, 0.2, -24], max: [6, 9, 7] },
    limits: observerLimits,
    presets: {
      overview: { position: [1.9, 6.2, 7.2], target: [-0.4, 0.9, -7.5] },
      profile: { position: [7.8, 2.6, -3.4], target: [-0.4, 1.0, -4.0] },
      topdown: { position: [-0.2, 22, -6.0], target: [-0.2, 0, -8.0] },
    },
    defaultPreset: "overview",
  },
  timeline: {
    durationS: 8,
    fps: 24,
    markers: [
      [0.6, "The start"],
      [1.8, "Mid-sprint"],
      [3.05, "The skid"],
      [6.0, "Back down the alley"],
    ],
  },
} as const satisfies SceneDescriptor;
