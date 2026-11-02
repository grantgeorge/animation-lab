import type { ShotPose } from "../engine/path";

/**
 * Per-frame state outside React: the time and each view's camera pose, written by the orchestrator
 * before anything renders, read by the stage viz and the monitor readouts.
 */
export const live = {
  t: 0,
  frameId: 0,
  poses: [] as ShotPose[],
  /** Subject height fraction per view (for readouts and tests). */
  fractions: [] as number[],
};

/** DOM windows the shot passes render into (one per view). */
export const slots = new Map<"A" | "B", HTMLElement>();
export const stageWindow: { current: HTMLElement | null } = { current: null };
