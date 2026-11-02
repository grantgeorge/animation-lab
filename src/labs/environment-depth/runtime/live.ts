import type { Group, Object3D } from "three";
import type { Band } from "../engine/layers";

/** Render layers. 0 = solid world, 2 = air effects (shafts, fireflies), 3 = canopy, 5 = 2D/2.5D cards. */
export const L = { WORLD: 0, FX: 2, CANOPY: 3, CARDS: 5 } as const;

/** DOM windows the orchestrator renders into (scissored), keyed by slot id. */
export const slots = new Map<string, HTMLElement>();

/** Scene objects the orchestrator moves, scales or hides between passes. */
export const actors = {
  pip: null as Group | null,
  fg: null as Group | null,
  refs: { cabin: null as Group | null, fence: null as Group | null, deer: null as Group | null },
  shafts: null as Object3D | null,
  pipDecals: null as Object3D | null,
};

export interface LayerLive {
  index: number;
  a: number;
  b: number;
  /** Card depth before / after the parallax squash (m). */
  depth: number;
  depthNow: number;
  /** Horizontal slide of the layer's anchor since frame 0 (NDC half-widths). */
  shiftX: number;
  /** Multiplane speed relative to the backdrop (∝ 1 / depth). */
  speed: number;
  band: Band;
}

export interface RevealLive {
  total: number;
  edge: number;
  disoccluded: number;
  bounds: null | { cx: number; cy: number; minX: number; minY: number; maxX: number; maxY: number; n: number };
}

/** Per-frame state outside React: written by the orchestrator, read by readouts, viz and tests. */
export const live = {
  t: 0,
  u: 0,
  frameId: 0,
  ready: false,
  cam: { x: 0, y: 0, z: 0, heightM: 0, distToPipM: 0, focalMm: 24, hfovDeg: 0, pitchDeg: 0, frameW: 0 },
  c0: { x: 0, z: 0, yawDeg: 0 },
  /** Frustum and path in plan view (x, z), for the inspect map. */
  plan: { frustum: [] as [number, number][], path: [] as [number, number][], c0Frustum: [] as [number, number][] },
  reveal: { total: 0, edge: 0, disoccluded: 0, bounds: null } as RevealLive,
  /** Revealed area at the end of the move (u = 1). */
  revealEnd: null as null | { total: number; edge: number; disoccluded: number },
  layers: [] as LayerLive[],
  /** 2D / 2.5D: share of the frame showing painted content, never-painted holes, and void past the card edges. */
  construction: null as null | { content: number; hole: number; void: number; bounds: RevealLive["bounds"]; samples: [number, number][] },
  scale: { k: 1, treeTrueM: 62, treeReadsM: 62, pipFrac: 0.12 },
  haze: { pip: 0, mg: 0, bg: 0, ridge: 0 },
  /** Normalised probe rectangles (x0, y0, x1, y1; y down) in the main picture. */
  probes: { far: [0, 0, 0, 0] as [number, number, number, number], near: [0, 0, 0, 0] as [number, number, number, number] },
  captures: 0,
  refs: 0,
  squash: { k: 1, D: 10 },
  path: { left: [] as [number, number][], right: [] as [number, number][], vp: null as null | [number, number] },
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
