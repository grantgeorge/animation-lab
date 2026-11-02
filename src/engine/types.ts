/** World: three.js convention. Y up, right-handed, meters. Cameras look down −Z. */
export type Vec3 = readonly [number, number, number];

export type TargetId = "primary" | "secondary" | "both";
export type CameraMode = "fixed" | "match";
export type ClampHint = null | "min" | "max" | "both";

export interface Gate {
  /** Active filmback width in mm (horizontal fit). */
  widthMm: number;
  /** Active filmback height in mm (16:9 crop of the width). */
  heightMm: number;
}

export interface FramingBox {
  /** Bottom and top of the framing box, world Y in meters. */
  bottom: number;
  top: number;
  /** Half the box width, meters (used for the Both union). */
  halfWidthM: number;
  label: string;
}

export interface CharacterDescriptor {
  name: string;
  /** Rest yaw of the character on its mark (degrees, > 0 turns toward −X… three's +Y rotation). */
  restYawDeg?: number;
  pronoun: "he" | "she" | "they";
  root: Vec3;
  heightM: number;
  anchor: Vec3;
  framingBox: FramingBox;
  landmarks: {
    feet: number;
    crown: number;
    capTop: number;
    eyes: number;
    chestTop: number;
    /** Nose tip: height and forward offset from the head centre (toward the default camera, +Z). */
    noseTip: { y: number; forward: number };
    earMid: { y: number; forward: number };
  };
}

export interface ObserverPreset {
  position: Vec3;
  target: Vec3;
}

export interface PracticalLight {
  position: Vec3;
  color: string;
  intensity: number;
  distance: number;
}

/** Per-scene lighting and atmosphere. Renderer reads it; the engine never does. */
export interface SceneLook {
  voidColor: string;
  hemi: { sky: string; ground: string; intensity: number };
  key: { position: Vec3; target: Vec3; color: string; intensity: number };
  rim: { position: Vec3; color: string; intensity: number };
  practicals: readonly PracticalLight[];
  fog?: { color: string; near: number; far: number };
  /** Key-light shadow box (light space). Defaults suit the 19 m doorway stage. */
  shadow?: { left: number; right: number; top: number; bottom: number; far: number };
}

export interface SceneDescriptor {
  /** Which scene this is; the lab can switch between several sets that share the camera rail. */
  scene: { id: string; title: string; genre: string; logline: string; tip: string };
  /**
   * What the generic set references are called in this scene (for copy and the perspective guide).
   * foreground ↔ set.lantern, midground ↔ set.doorway, background ↔ set.backWall, landmark ↔ set.tower.
   */
  labels: { foreground: string; midground: string; background: string; landmark: string };
  look: SceneLook;
  gate: Gate;
  aspect: number;
  clip: { near: number; far: number };
  focal: { min: number; max: number; presets: readonly number[]; default: number };
  rail: {
    /** The rail runs along −Z at fixed x and lens height. Camera z = −railS. */
    x: number;
    y: number;
    sMin: number;
    sMax: number;
    /** Mesh extent along z (slightly longer than travel). */
    meshZ: readonly [number, number];
  };
  defaultRig: CameraRig;
  noGoRadiusM: number;
  characters: { primary: CharacterDescriptor; secondary: CharacterDescriptor };
  anchors: { both: Vec3 };
  set: {
    lantern: { base: Vec3; head: Vec3 };
    doorway: { z: number; openingX: readonly [number, number]; heightM: number; archR: number; lamp: Vec3 };
    backWall: { z: number; window: { centre: Vec3; w: number; h: number } };
    tower: { base: Vec3; clockFace: Vec3; heightM: number };
    backdropZ: number;
    plate: { x: readonly [number, number]; z: readonly [number, number] };
  };
  perspective: { refZ: number; deep: number; compressed: number };
  observer: {
    boundary: { min: Vec3; max: Vec3 };
    limits: { minPolar: number; maxPolar: number; minDist: number; maxDist: number };
    presets: Record<"overview" | "profile" | "topdown", ObserverPreset>;
    defaultPreset: "overview";
  };
  timeline: { durationS: number; fps: number; markers: readonly (readonly [number, string])[] };
  exercises: { ex2Start: { focalMm: number; metric: number } };
}

/** Canonical camera: a position on the dolly rail plus an explicit zero-roll orientation. */
export interface CameraRig {
  railS: number;
  /** > 0 turns the camera toward +X. */
  yawDeg: number;
  /** > 0 looks up. */
  pitchDeg: number;
  focalMm: number;
}

export interface MatchRef {
  /** Framing metric captured when Match was enabled (fraction of frame height). */
  metric: number;
  /** Where the target anchor sat on screen at capture, NDC [-1, 1]. */
  anchorNdc: readonly [number, number];
}
