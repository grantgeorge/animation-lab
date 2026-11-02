import type { Measurements } from "../measure";
import { ANGLE_LABEL, LENS_LABEL, PERSPECTIVE_LABEL, SHOT_SIZE_LABEL } from "../classify";

export interface PromptParts {
  shotSize: string;
  subject: string;
  lens: string;
  angle: string;
  distance: string;
  perspective: string;
  movement: string;
}

export const formatMeters = (m: number) => (m < 1 ? m.toFixed(2) : m.toFixed(1));

/**
 * Shot language for storyboards and AI video prompts (e.g. Seedance): name the shot first,
 * then lens, angle, distance, perspective, movement. One camera move per shot; the MVP is always static.
 */
export function promptPhrase(m: Measurements): { phrase: string; parts: PromptParts } {
  const prefix = m.targetId === "both" ? "Two-shot — " : "";
  const parts: PromptParts = {
    shotSize: `${prefix}${SHOT_SIZE_LABEL[m.shotSize]}`,
    subject: m.targetName,
    lens: `${Math.round(m.focalMm)} mm ${LENS_LABEL[m.lensClass]}`,
    angle: ANGLE_LABEL[m.angle],
    distance: `camera ${formatMeters(m.distanceM)} m from ${m.targetName}`,
    perspective: PERSPECTIVE_LABEL[m.perspective],
    movement: "locked-off static shot",
  };
  const phrase =
    [`${parts.shotSize} of ${parts.subject}`, parts.lens, parts.angle, parts.distance, parts.perspective, parts.movement].join(", ") + ".";
  return { phrase, parts };
}
