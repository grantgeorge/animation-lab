import type { V3 } from "./types";

/**
 * Floor marks for the Editing & Rhythm stage (metres, the doorway set's world frame). The cast is
 * placed entirely through root tracks, so these are the only staging numbers. Yaw: degrees about +Y,
 * 0 faces +Z (toward the front cameras).
 *
 * Staging: the box sits on a crate downstage centre; Pip is just right of it, facing it; Bram stands
 * upstage-left, facing down toward Pip, so the front cameras read both faces. The axis of action runs
 * diagonally from Bram to Pip and every camera stays on its camera-left side.
 */
export const MARKS = {
  crate: [-0.2, 0, -2.8] as V3,
  crateHeight: 0.46,
  box: [-0.2, 0.46, -2.8] as V3,
  pip: { at: [0.5, 0, -3.02] as V3, stepTo: [0.3, 0, -2.96] as V3, lunge: [0.22, 0, -2.93] as V3, yaw: -75 },
  bram: { at: [-0.95, 0, -4.25] as V3, yaw: 42 },
  /** Kuleshov plates: Bram on his mark, Pip holding the gift, the lantern fallen. */
  kule: { pip: [0.2, 0, -3.05] as V3, pipYaw: -38, lantern: [0.62, 0, -1.6] as V3 },
  /** Comedy: Bram struts in from screen-left, the peel lies at `peel`. */
  slip: { fromX: -3.75, z: -3.3, peel: [-0.66, 0, -3.26] as V3, yaw: 80 },
  /** Montage: four street lamps along the doorway wall; Bram walks the line lighting them. */
  mont: { lamps: [[-3.0, 0, -4.4], [-1.0, 0, -4.4], [1.0, 0, -4.4], [3.0, 0, -4.4]] as V3[], walkZ: -3.8, enterX: -4.6 },
  /** Where the cast waits when a reel doesn't use them (behind the back wall). */
  offstage: { bram: [-3.5, 0, -10.6] as V3, pip: [3.5, 0, -10.6] as V3 },
} as const;
