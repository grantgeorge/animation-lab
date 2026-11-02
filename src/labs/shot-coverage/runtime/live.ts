import type { Camera } from "three";
import type { Axis } from "../engine/axis";
import type { ScreenInfo, ShotPose } from "../engine/shots";
import type { CamId } from "../engine/types";

/**
 * Per-frame state outside React, written by the orchestrator before anything renders and read by
 * the stage viz, the monitor overlays, the plan view and the test hook.
 */
export const live = {
  t: 0,
  frameId: 0,
  poses: {} as Partial<Record<CamId, ShotPose>>,
  info: {} as Partial<Record<CamId, ScreenInfo>>,
  fractions: {} as Partial<Record<CamId, number>>,
  axis: null as Axis | null,
  program: "A" as CamId,
  shotIndex: 0,
  /** The observer (stage) camera, for DOM labels over the stage. */
  observer: null as Camera | null,
};

/** DOM windows the shot passes render into: "A" | "B" | "C" (ISO), "P" (program), "W" (watch). */
export type SlotId = CamId | "P" | "W";
export const slots = new Map<SlotId, HTMLElement>();

export const stageWindow: { current: HTMLElement | null } = { current: null };
