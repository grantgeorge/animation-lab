import type { Camera, DirectionalLight, Group, Mesh } from "three";
import type { Vec3 } from "@/engine/types";
import type { E1Readout } from "../engine/projection";
import type { LensReadout } from "../engine/lens";
import type { LayerParallax } from "../engine/multiplane";
import type { DemoFrame } from "../engine/impossible";

/** Lab-only render layers (the shared scene uses 0 = world and 1 = tech). */
export const AC_LAYER = { GUIDES: 4, FLAT25: 5, CAST: 6, FLAT2D: 7, OUTLINE: 8 } as const;

/** DOM windows the orchestrator renders into (scissored), keyed by slot id. */
export const slots = new Map<string, HTMLElement>();
export const stageWindow: { current: HTMLElement | null } = { current: null };

/** Scene objects the orchestrator needs to hide, re-layer or scale between passes. */
export const actors = {
  set: null as Group | null,
  bram: null as Group | null,
  pip: null as Group | null,
  light: null as DirectionalLight | null,
  cards25: new Map<string, Mesh>(),
  cards2d: new Map<string, Mesh>(),
};

export interface VizCam {
  camera: Camera;
  color: string;
  /** How far to draw the frustum, metres. */
  length: number;
}

/** Per-frame state outside React: written by the orchestrator, read by readouts, viz and tests. */
export const live = {
  t: 0,
  frameId: 0,
  /** three.js camera type rendered into each slot (e.g. main → "OrthographicCamera"). */
  camType: {} as Record<string, string>,
  e1: null as null | { main: E1Readout; persp: E1Readout; ortho: E1Readout },
  e2: null as null | { main: LensReadout; trio: LensReadout[] },
  e3: null as null | { u: number; layers: LayerParallax[]; captured: boolean },
  e4: null as null | { camT: number; charT: number; frame: number; drawing: number; held: boolean; degPerS: number; focusM: number; samples: number },
  e5: null as null | { frame: DemoFrame; pipFrac: number; pipFracPhysical: number; faceWide: number; faceTele: number; nearM: number },
  viz: { cams: [] as VizCam[], path: [] as Vec3[], pathPhysical: [] as Vec3[], focusPlane: null as null | { camera: Camera; distance: number } },
};

type Fn = () => void;
const after = new Set<Fn>();
/** Run once per frame after every pass (DOM readouts). */
export function onAfterFrame(fn: Fn) {
  after.add(fn);
  return () => void after.delete(fn);
}
export function runAfterFrame() {
  for (const f of after) f();
}
