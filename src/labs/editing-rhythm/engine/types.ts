/** Plain 3D vector [x, y, z] in metres (the engine stays renderer-free). */
export type V3 = readonly [number, number, number];

/**
 * Source reels. Every shot is a camera on ONE continuous, deterministic performance, recorded on a
 * single master source timeline. A reel is a window of that timeline (a "scene" of the dailies).
 */
export type ReelId = "main" | "kule" | "slip" | "mont";

/** The six coverage shots of the box scene, plus the plates used by the concept experiments. */
export type ShotId =
  | "establish"
  | "reach"
  | "reaction"
  | "glow"
  | "hesitate"
  | "reveal"
  | "kNeutral"
  | "kGift"
  | "kLantern"
  | "cWide"
  | "cPeel"
  | "cFace"
  | "cAway"
  | "mWide";

/** One clip of an edit: a shot (camera), where it starts in its reel, and how long it plays. */
export interface Clip {
  /** Stable id (selection, diffing): unique within an edit. */
  id: string;
  shot: ShotId;
  /** Source in, seconds from the start of the shot's reel. */
  sourceIn: number;
  /** Seconds on screen. */
  duration: number;
  /**
   * Split edit at the cut INTO this clip (seconds). > 0: J-cut, this clip's sound starts that much
   * before its picture. < 0: L-cut, the previous clip's sound carries on past the cut. 0: straight cut.
   */
  audioLead?: number;
  /** Cross-dissolve centred on the cut into this clip (seconds). 0 / undefined: hard cut. */
  dissolve?: number;
}

export type Edit = readonly Clip[];

export type EditPresetId = "suspense" | "comedy" | "action" | "emotion";
export const EDIT_PRESETS: readonly EditPresetId[] = ["suspense", "comedy", "action", "emotion"];

export type ExperimentId = "timeline" | "pacing" | "kuleshov" | "reaction" | "continuity" | "jl" | "montage" | "comedy";
export const EXPERIMENTS: readonly ExperimentId[] = ["timeline", "pacing", "kuleshov", "reaction", "continuity", "jl", "montage", "comedy"];

export type Mode = "watch" | "inspect" | "experiment";
export const MODES: readonly Mode[] = ["watch", "inspect", "experiment"];
