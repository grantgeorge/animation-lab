import type { SceneId } from "@/labs/lens-and-framing/config";
import type { GradeParams } from "./grade";
import type { FinishParams } from "./look";
import type { MatchParams } from "./match";

/**
 * The mini show: the three scenes as three "shots", each delivered with a different raw drift, as if
 * generated on different days or by different models.
 */
export interface ShotDef {
  id: SceneId;
  label: string;
  /** The clip as the model delivered it: a deliberately wrong grade layer. */
  drift: Partial<GradeParams>;
  driftLabel: string;
  driftNote: string;
  /** Timeline moment captured as the shot's gallery still (plates/<id>.jpg). */
  plateT: number;
}

export const SHOTS: readonly ShotDef[] = [
  { id: "doorway", label: "Shot 1 · Doorway", drift: { temperature: 0.75, tint: 0.12 }, driftLabel: "Too warm", driftNote: "Came back with a tungsten cast: the moonlit night now reads as sunset.", plateT: 3.4 },
  { id: "alley", label: "Shot 2 · Alley", drift: { exposure: -1.1, contrast: 0.66 }, driftLabel: "Under & flat", driftNote: "A different model: a stop darker and milky, with no real blacks.", plateT: 1.6 },
  { id: "workshop", label: "Shot 3 · Workshop", drift: { saturation: 1.65, contrast: 1.08 }, driftLabel: "Oversaturated", driftNote: "Generated hot: the practicals and the coat have gone neon.", plateT: 2.2 },
];

export const getShot = (id: SceneId) => SHOTS.find((s) => s.id === id) ?? SHOTS[0];

/** A per-shot override on top of the show look: a small grade layer plus a few finishing amounts. */
export interface ShotOverride {
  grade: Pick<GradeParams, "exposure" | "temperature" | "saturation">;
  finish: { halation: number | null; grain: number | null };
}

export const NEUTRAL_OVERRIDE: ShotOverride = { grade: { exposure: 0, temperature: 0, saturation: 1 }, finish: { halation: null, grain: null } };

export const isOverrideActive = (o: ShotOverride) =>
  o.grade.exposure !== 0 || o.grade.temperature !== 0 || o.grade.saturation !== 1 || o.finish.halation !== null || o.finish.grain !== null;

/** The suggested override for step (c): the workshop is the comic beat, so it runs warmer and brighter. */
export const SUGGESTED_OVERRIDE: { shot: SceneId; override: ShotOverride; why: string } = {
  shot: "workshop",
  override: { grade: { exposure: 0.2, temperature: 0.22, saturation: 1.08 }, finish: { halation: 0.65, grain: null } },
  why: "The workshop is the comedy beat: a touch warmer and brighter, with more glow on the bulb, while still sharing the show's stock, grain and contrast.",
};

/** Apply an override's finishing amounts to the show finish. */
export function overrideFinish(f: FinishParams, o: ShotOverride | undefined): FinishParams {
  if (!o) return f;
  return {
    ...f,
    halation: o.finish.halation === null ? f.halation : { ...f.halation, amount: o.finish.halation },
    grain: o.finish.grain === null ? f.grain : { ...f.grain, amount: o.finish.grain },
  };
}

export type ShowStep = "raw" | "match" | "look" | "override";
export const SHOW_STEPS: readonly ShowStep[] = ["raw", "match", "look", "override"];

export interface ShowShotState {
  match: MatchParams;
  override: ShotOverride;
}
