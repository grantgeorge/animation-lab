import type { Vec3 } from "@/engine/types";
import type { SubjectFn, SubjectId } from "@/labs/camera-movement/engine/types";

export type { Vec3, SubjectFn, SubjectId };

/** The three coverage cameras. */
export type CamId = "A" | "B" | "C";
export const CAM_IDS: readonly CamId[] = ["A", "B", "C"];

/** What a camera aims at: a character's face, the midpoint between them, or a fixed point. */
export type Aim = "bram" | "pip" | "both" | "free";

/** Coverage presets. `ots` and `single`/`closeup` need a subject; `master` frames both. */
export type PresetKind = "master" | "ots" | "single" | "closeup";
export type Who = "bram" | "pip";

/** One locked-off coverage camera. The aim follows its subject as they move. */
export interface CamSpec {
  position: Vec3;
  aim: Aim;
  /** Aim point when `aim` is "free" (ignored otherwise). */
  target: Vec3;
  focalMm: number;
  /** Preset that produced it ("master", "ots-pip", …) or "custom" once edited by hand. */
  preset: string;
}

export type Cams = Record<CamId, CamSpec>;

/** One cut: from time `t` (seconds) the program shows camera `cam`. The first cut is at 0. */
export interface Cut {
  t: number;
  cam: CamId;
}

export type Edit = readonly Cut[];

export const WHO_ID: Record<Who, SubjectId> = { bram: "primary", pip: "secondary" };
export const ID_WHO: Record<SubjectId, Who> = { primary: "bram", secondary: "pip" };
