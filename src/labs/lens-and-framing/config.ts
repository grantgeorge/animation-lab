import type { SceneDescriptor } from "@/engine/types";
import { alleyScene } from "./scenes/alley";
import { workshopScene } from "./scenes/workshop";

/**
 * "Lamplighter's Square": the original doorway scene. A stable export that never changes with the
 * active scene (the /history pages pin to it). Every number here is recorded in docs/design/decisions.md.
 */
export const doorwayScene = {
  scene: { id: "doorway", title: "The Doorway", genre: "Gentle drama", logline: "Pip peeks out of a doorway and waves; Bram turns and tips his cap.", tip: "Compare 24 mm and 85 mm in Match framing: Bram stays the same size while the doorway grows behind him." },
  labels: { foreground: "the lantern", midground: "the doorway", background: "the back wall", landmark: "the clock tower" },
  look: {
    voidColor: "#07090E",
    hemi: { sky: "#3A4C66", ground: "#1A1410", intensity: 0.75 },
    key: { position: [-3.5, 6.0, 2.5], target: [0, 1.2, -3.8], color: "#FFE2C2", intensity: 2.3 },
    rim: { position: [4.0, 4.5, -8.0], color: "#BFE8FF", intensity: 40 },
    practicals: [
      { position: [0.62, 2.05, -1.6], color: "#FFB46A", intensity: 4, distance: 6 },
      { position: [1.35, 2.5, -4.75], color: "#FFB46A", intensity: 5, distance: 6 },
      { position: [-0.6, 2.2, -8.4], color: "#FFC98A", intensity: 3, distance: 5 },
    ],
  },
  gate: { widthMm: 36, heightMm: 20.25 },
  aspect: 16 / 9,
  clip: { near: 0.05, far: 60 },
  focal: { min: 18, max: 135, presets: [18, 24, 35, 50, 85, 135], default: 50 },
  rail: { x: -0.35, y: 1.47, sMin: -5.4, sMax: 2.4, meshZ: [-2.7, 5.7] },
  defaultRig: { railS: 0, yawDeg: 0, pitchDeg: 0, focalMm: 50 },
  noGoRadiusM: 0.45,
  characters: {
    primary: {
      name: "Bram",
      restYawDeg: -8,
      pronoun: "he",
      root: [-0.35, 0, -3.0],
      heightM: 1.78,
      anchor: [-0.35, 1.47, -3.0],
      framingBox: { bottom: 1.08, top: 1.86, halfWidthM: 0.3, label: "head & shoulders" },
      landmarks: {
        feet: 0,
        // measured on the Meshy 7.1 mesh (scripts/characters/face.mjs)
        crown: 1.74,
        capTop: 1.78,
        eyes: 1.6,
        chestTop: 1.3,
        noseTip: { y: 1.567, forward: 0.228 },
        earMid: { y: 1.58, forward: -0.05 },
      },
    },
    secondary: {
      name: "Pip",
      pronoun: "he",
      root: [0.72, 0, -4.7],
      heightM: 1.05,
      anchor: [0.72, 0.56, -4.7],
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
    },
  },
  anchors: { both: [0.185, 0.93, -3.85] },
  set: {
    lantern: { base: [0.62, 0, -1.6], head: [0.62, 2.05, -1.6] },
    doorway: { z: -5.0, openingX: [0.03, 0.65], heightM: 2.1, archR: 0.31, lamp: [1.35, 2.5, -4.85] },
    backWall: { z: -9.0, window: { centre: [-0.6, 2.1, -9.0], w: 1.6, h: 2.2 } },
    tower: { base: [-2.2, 0, -11.5], clockFace: [-2.2, 5.2, -11.5], heightM: 6.5 },
    backdropZ: -12.4,
    plate: { x: [-6, 6], z: [-12.5, 6.5] },
  },
  perspective: { refZ: -9.0, deep: 0.18, compressed: 0.45 },
  observer: {
    boundary: { min: [-5, 0.2, -12], max: [5, 6, 6] },
    limits: { minPolar: 0.12, maxPolar: Math.PI / 2 - 0.04, minDist: 1.2, maxDist: 28 },
    presets: {
      overview: { position: [-2.4, 4.3, 5.6], target: [0.7, 0.85, -3.3] },
      profile: { position: [7.2, 1.7, -2.2], target: [-0.35, 1.2, -2.6] },
      topdown: { position: [-0.35, 13, -1.0], target: [-0.35, 0, -3.0] },
    },
    defaultPreset: "overview",
  },
  timeline: {
    durationS: 6,
    fps: 24,
    markers: [
      [0.4, "Portrait"],
      [2.45, "The reaction"],
      [3.35, "The wave"],
      [4.65, "The hop"],
    ],
  },
  exercises: { ex2Start: { focalMm: 50, metric: 0.92 } },
} as const satisfies SceneDescriptor;

export const SCENES = [doorwayScene, alleyScene, workshopScene] as const satisfies readonly SceneDescriptor[];
export type SceneId = (typeof SCENES)[number]["scene"]["id"];
export const SCENE_IDS = SCENES.map((s) => s.scene.id) as readonly SceneId[];
export const isSceneId = (v: unknown): v is SceneId => typeof v === "string" && (SCENE_IDS as readonly string[]).includes(v);
export const getScene = (id: SceneId): SceneDescriptor => SCENES.find((s) => s.scene.id === id) ?? doorwayScene;

/**
 * The ACTIVE scene, as a live ES binding: modules that read `sceneDescriptor.x` at call time follow
 * scene switches. Switch only through `setActiveScene` (called before the lab remounts its scene subtree).
 * Code that must stay on the doorway set should import `doorwayScene` instead.
 */
export let sceneDescriptor: SceneDescriptor = doorwayScene;

export function setActiveScene(id: SceneId) {
  sceneDescriptor = getScene(id);
}

export type LensFramingDescriptor = SceneDescriptor;

/** Staging lab: floor marks and camera limits, in metres; see decisions.md. */
export const blockingConfig = {
  target: [0, 1, -3] as const,
  radius: 6.6, cameraHeight: 2.2, focal: 40, angleLimit: 55,
  /** Set view: frames the doorway and the filming camera together. */
  studio: [8.2, 6.4, 5.2] as const, studioTarget: [.4, .6, -.8] as const,
  bounds: { x: [-2.2, 2.2] as const, z: [-4.4, -1.8] as const },
  presets: {
    Conversation: { bram: { x: -.9, z: -2.8 }, pip: { x: 1, z: -3.3 } },
    Hidden: { bram: { x: 0, z: -2.6 }, pip: { x: 0, z: -4 } },
    Distance: { bram: { x: -1.7, z: -2.3 }, pip: { x: 1.7, z: -4 } },
    Profile: { bram: { x: -.8, z: -3 }, pip: { x: .8, z: -3 } },
  },
  clearance: .65, actorRadius: .32,
  /** "Cheat open": share of the turn from facing the partner toward facing the camera. */
  cheat: .45,
  /** Hall's proxemic zones (The Hidden Dimension, 1966), upper bounds in metres; see decisions.md. */
  proxemics: { intimate: .45, personal: 1.2, social: 3.6 },
  /** Doorway flat, for the floor plan: x extent and z of its face. */
  flat: { x: [-1.6, 2.6] as const, z: -5, door: [.03, .65] as const },
} as const;

/** Animation Style lab: Pip's mark beside the doorway and the locked-off film camera; see decisions.md. */
export const styleConfig = {
  mark: [1.0, 0, -4.35] as const,
  camera: [0.75, 1.2, -0.15] as const,
  target: [1.05, 0.82, -4.35] as const,
  focal: 40,
} as const;

/**
 * Character Design lab: the model-sheet figure, its cameras, the silhouette mask, and the cast measured
 * as designs. Cast head and eye sizes come from the procedural puppets (src/scene/characters/Pip.tsx,
 * Bram.tsx), whose eyes sit on the measured landmarks; crowns are the measured landmarks. See decisions.md.
 */
export const designConfig = {
  /** Every design is built to this total height, in metres, so proportions compare like with like. */
  heightM: 1.5,
  /** Shaded three-quarter view: perspective camera and the figure's turn. */
  camera: { position: [0, 0.98, 6.2] as const, target: [0, 0.86, 0] as const, fovDeg: 18, turnDeg: -32 },
  /** Orthographic silhouettes: vertical extent as a share of the height, from just below the floor. */
  frame: { bottom: -0.04, top: 1.26 },
  /** Offscreen silhouette mask used for the metrics, in pixels (front view, fixed frame). */
  mask: { w: 96, h: 120 },
  cast: {
    pip: { crownM: 1.05, headM: 0.298, eyeDiaM: 0.07, eyeCentresM: 0.1, eyeLineM: 0.129, legM: 0.43, thickness: 1.15, extremities: 1.15, shape: [0.8, 0.15, 0.05] as const },
    bram: { crownM: 1.74, headM: 0.372, eyeDiaM: 0.08, eyeCentresM: 0.132, eyeLineM: 0.149, legM: 0.85, thickness: 1.25, extremities: 1.05, shape: [0.25, 0.62, 0.13] as const },
  },
} as const;

/**
 * 2D vs 3D lab: one framing shared by the drawn, cut-out and 3D panes (metres; see decisions.md).
 * Every pane shows `frameM` of height with the floor `floorM` above the frame bottom; the 3D camera
 * orbits Pip at `cameraDistM`.
 */
export const twoDThreeDConfig = {
  /** Vertical extent every pane shows, and where the floor line sits above the frame bottom. */
  frameM: 1.72, floorM: 0.16,
  cameraDistM: 6, focal: 85,
  /** Rig rest: arms hang 12° out (Characters.tsx PIP arm offsets), legs 0.36 m hip to ankle. */
  restArmUp: 12, legM: 0.36, crouchMaxDeg: 60,
  /** The cut-out's drawn view library (camera turn, degrees). */
  views: [0, 45, 90] as const,
} as const;

/**
 * Character Rigging lab: a turntable studio with the character at the origin facing +Z (see decisions.md).
 * Camera views are for Bram (1.78 m) and scale with the character's height for Pip.
 */
export const riggingConfig = {
  focal: 35,
  /** Camera position and aim per view. `arm` is a close-up for the skinning demos, relative to the left elbow and following it. */
  views: {
    front: { pos: [0, 1.05, 3.9] as const, target: [0, 0.93, 0] as const },
    threeQuarter: { pos: [2.5, 1.3, 3.0] as const, target: [0, 0.93, 0] as const },
    side: { pos: [3.9, 1.05, 0.1] as const, target: [0, 0.93, 0] as const },
    arm: { pos: [0.3, 0.08, 1.45] as const, target: [0.05, -0.04, 0] as const },
  },
  /** The reach mark, from the rest shoulder in arm lengths (x out, y up, z forward): 72% of full reach. */
  mark: [0.25, 0.3, 0.6] as const,
  /** Seconds of the doorway-wave clip looped in the bind-pose comparison. */
  wave: { bram: [2.6, 5.6] as const, pip: [2.6, 4.6] as const },
} as const;
