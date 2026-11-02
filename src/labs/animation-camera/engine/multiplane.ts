import { Vector3 } from "three";
import { tanHalf, intrinsics, quaternionFromYawPitch, toCameraSpace } from "@/engine/projection";
import { rotateAboutY } from "@/labs/camera-movement/engine/math";
import { GATE, basis, shot, tuple, type Shot, type Vec3 } from "./common";

/** Experiment 3: one camera move as flat 2D art, a 2.5D multiplane stack and the real 3D set. */
export type MoveStyle = "2d" | "2.5d" | "3d";
export type MoveKind = "track" | "orbit";

/** The reference camera every layer is painted from (a wide establishing view of the doorway). */
export const REF = { position: [-0.1, 1.5, 1.6] as Vec3, yawDeg: 0, pitchDeg: 2, focalMm: 28, overscan: 1.55 } as const;

export const refShot = (): Shot => ({ position: new Vector3(...REF.position), quaternion: quaternionFromYawPitch(REF.yawDeg, REF.pitchDeg), focalMm: REF.focalMm });

export interface LayerDef {
  id: "sky" | "town" | "doorway" | "pip" | "ground" | "bram" | "fg";
  label: string;
  /** Where the card hangs, metres along the reference view axis. */
  depth: number;
  /** Set slices are cut from the 3D set with the capture camera's near/far planes. */
  slice?: readonly [number, number];
  /** Character cels are re-rendered every frame (with the set as a holdout matte). */
  who?: "bram" | "pip";
  opaque?: boolean;
  /** Painted wider than the frame so moves don't run off its edge (default REF.overscan). */
  overscan?: number;
}

/** Back to front. Depths match the real set: lantern 3.2 m, Bram 4.6 m, Pip 6.3 m, door 6.6 m, wall 10.6 m. */
export const LAYERS: readonly LayerDef[] = [
  { id: "sky", label: "Sky & clock tower", depth: 14.0, slice: [11.6, 60], opaque: true, overscan: 2.4 },
  { id: "town", label: "Back wall & window", depth: 10.6, slice: [8.4, 11.6] },
  { id: "doorway", label: "Doorway", depth: 6.6, slice: [5.6, 8.4] },
  { id: "pip", label: "Pip (cel)", depth: 6.3, who: "pip" },
  { id: "ground", label: "Ground", depth: 4.6, slice: [3.9, 5.6] },
  { id: "bram", label: "Bram (cel)", depth: 4.55, who: "bram" },
  { id: "fg", label: "Lantern (foreground)", depth: 3.2, slice: [0.3, 3.9] },
];

/** In 2D everything (one painted background + both cels) lives on a single plane at Bram's depth. */
export const FLAT_DEPTH = 4.6;

/** The move: a lateral track with a push-in, or an orbit around the pair. One loop = out and back. */
export const MOVE = { trackM: 0.85, pushM: 1.1, orbitDeg: 32, pivot: [0.18, 1.2, -3.85] as Vec3 } as const;

/** World placement and size of a card hung `depth` metres in front of the reference camera. */
export function cardPlacement(depth: number, overscan: number = REF.overscan) {
  const r = refShot();
  const { forward } = basis(r.quaternion);
  const th = tanHalf(intrinsics(r.focalMm, GATE));
  return {
    center: tuple(r.position.clone().addScaledVector(forward, depth)),
    quaternion: r.quaternion.clone(),
    width: 2 * depth * th.x * overscan,
    height: 2 * depth * th.y * overscan,
  };
}

/** The camera at move progress u ∈ [0, 1]. The same function drives all three styles. */
export function moveShot(kind: MoveKind, u: number): Shot {
  const r = refShot();
  if (kind === "orbit") {
    const angle = -MOVE.orbitDeg + 2 * MOVE.orbitDeg * u;
    const p = rotateAboutY(REF.position, MOVE.pivot, angle);
    return shot(p, MOVE.pivot, REF.focalMm);
  }
  const { right, forward } = basis(r.quaternion);
  const pos = r.position.clone().addScaledVector(right, -MOVE.trackM + 2 * MOVE.trackM * u).addScaledVector(forward, MOVE.pushM * u);
  return { position: pos, quaternion: r.quaternion.clone(), focalMm: REF.focalMm };
}

/** Real 3D anchor of each layer's subject (for the 3D style, which has no cards). */
export const LAYER_SUBJECTS: Record<LayerDef["id"], Vec3> = {
  sky: [-2.2, 5.2, -11.5],
  town: [-0.6, 2.1, -9.0],
  doorway: [0.34, 1.6, -5.0],
  pip: [0.72, 0.56, -4.7],
  ground: [-0.35, 0, -3.0],
  bram: [-0.35, 1.47, -3.0],
  fg: [0.62, 2.05, -1.6],
};

export interface LayerParallax {
  id: LayerDef["id"];
  /** Depth of the layer from the camera right now (along its view axis). */
  depthNow: number;
  /** Horizontal NDC of the layer's reference point. */
  ndcX: number;
  /**
   * Parallax slide (NDC): how far the layer has moved on screen because of the camera's sideways
   * component (track: versus the same push without the track; orbit: versus the middle of the arc).
   * For a sideways move this is −Δx / (depth · tan(hfov/2)): inverse to depth.
   */
  offset: number;
}

/** Each layer's on-screen position and parallax slide for a style, at move progress u. */
export function layerParallax(style: MoveStyle, kind: MoveKind, u: number): LayerParallax[] {
  const th = tanHalf(intrinsics(REF.focalMm, GATE));
  const r = refShot();
  const point = (l: LayerDef): Vec3 => {
    if (style === "3d") return LAYER_SUBJECTS[l.id];
    // A card's reference point is the spot where the layer's subject is painted on the card.
    const sub = toCameraSpace(r, LAYER_SUBJECTS[l.id]);
    const depth = style === "2d" ? FLAT_DEPTH : l.depth;
    const k = depth / -sub.z;
    return tuple(new Vector3(sub.x * k, sub.y * k, -depth).applyQuaternion(r.quaternion).add(r.position));
  };
  const cur = moveShot(kind, u);
  let base: Shot;
  if (kind === "track") {
    const { forward } = basis(r.quaternion);
    base = { position: r.position.clone().addScaledVector(forward, MOVE.pushM * u), quaternion: r.quaternion.clone(), focalMm: REF.focalMm };
  } else base = moveShot(kind, 0.5);
  return LAYERS.map((l) => {
    const p = point(l);
    const a = toCameraSpace(base, p);
    const b = toCameraSpace(cur, p);
    const ndcX = b.x / -b.z / th.x;
    return { id: l.id, depthNow: -b.z, ndcX, offset: ndcX - a.x / -a.z / th.x };
  });
}

/** Classic multiplane speed: how fast each layer slides relative to the farthest (∝ 1 / depth). */
export const relativeSpeed = (depth: number) => LAYERS[0].depth / depth;
