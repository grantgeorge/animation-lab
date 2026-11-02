import type { SceneDescriptor } from "@/engine/types";
import { axisAt, sideOf } from "./axis";
import { describeShot, viewDir } from "./shots";
import type { Cams, Edit, SubjectFn } from "./types";

export type FlagKind = "axis" | "jump" | "same";

export interface ContinuityFlag {
  /** Index of the cut (the shot it starts), ≥ 1. */
  cut: number;
  t: number;
  kind: FlagKind;
  /** One-line explanation. */
  text: string;
}

/** Below this change in camera angle on the same subject at a similar size, the cut reads as a jump. */
export const JUMP_ANGLE_DEG = 30;
/** "Similar size": the subject's height fraction changes by less than this ratio. */
export const JUMP_SIZE_RATIO = 1.5;

const NAME = { primary: "Bram", secondary: "Pip" } as const;

/**
 * Check every cut for the three classic continuity problems: crossing the axis of action (screen
 * direction flips), jump cuts (same subject, < 30° camera change, similar size) and cuts to the same
 * camera. Judged at the instant of the cut, against the axis where the characters are then.
 */
export function checkContinuity(edit: Edit, cams: Cams, d: SceneDescriptor, subjects: SubjectFn): ContinuityFlag[] {
  const flags: ContinuityFlag[] = [];
  for (let i = 1; i < edit.length; i++) {
    const { t } = edit[i];
    const a = edit[i - 1].cam;
    const b = edit[i].cam;
    if (a === b) {
      flags.push({ cut: i, t, kind: "same", text: `${a} → ${b}: cut to the same camera. Nothing changes, so the cut is invisible or reads as a glitch.` });
      continue;
    }
    const ca = cams[a];
    const cb = cams[b];
    const ax = axisAt(subjects, t);
    const sa = sideOf(ax, ca.position);
    const sb = sideOf(ax, cb.position);
    const da = describeShot(ca, d, subjects, t);
    const db = describeShot(cb, d, subjects, t);
    if (sa * sb < 0) {
      const before = da.info.primary.side === "L" ? "left" : "right";
      const after = db.info.primary.side === "L" ? "left" : "right";
      const what = before !== after ? `Bram jumps from screen-${before} to screen-${after}` : "screen direction flips";
      flags.push({ cut: i, t, kind: "axis", text: `${a} → ${b} crosses the line: ${what} and the eyelines reverse.` });
    }
    if (da.subject === db.subject) {
      const angle = (Math.acos(Math.min(1, Math.max(-1, viewDir(ca, d, subjects, t).dot(viewDir(cb, d, subjects, t))))) * 180) / Math.PI;
      const ratio = Math.max(da.fraction, db.fraction) / Math.max(1e-6, Math.min(da.fraction, db.fraction));
      if (angle < JUMP_ANGLE_DEG && ratio < JUMP_SIZE_RATIO) {
        const who = da.subject === "both" ? "the pair" : NAME[da.subject];
        flags.push({ cut: i, t, kind: "jump", text: `${a} → ${b} is a jump cut: same framing of ${who}, only ${Math.round(angle)}° apart. Change the angle 30°+ or the size.` });
      }
    }
  }
  return flags;
}
