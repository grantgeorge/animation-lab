import { cropFactor, type Format } from "./formats";
import { describeRollOff, type Look } from "./looks";
import { formatFocal, formatStop, type DofClass } from "./optics";
import { describeShutter, slowMotionFactor } from "./shutter";

export interface PromptInput {
  format: Format;
  /** Photochemical capture (a film camera) rather than a digital sensor. */
  film: boolean;
  focalMm: number;
  tStop: number;
  dof: DofClass;
  shutterDeg: number;
  fps: number;
  slowMotion: boolean;
  move: "locked" | "pan";
  look: Look;
}

export function formatPhrase(format: Format, film: boolean): string {
  if (film) return format.id === "imax" ? "shot on IMAX 65 mm film" : format.family === "65" ? "shot on 65 mm film" : "shot on 35 mm film";
  switch (format.family) {
    case "small":
      return "shot on a small-sensor camera";
    case "s35":
      return "shot on Super 35 digital cinema camera";
    case "ff":
      return "shot on full-frame digital cinema camera";
    case "lf":
      return "shot on large-format digital";
    case "65":
      return "shot on 65 mm large-format digital";
  }
}

const DOF_WORDS: Record<DofClass, string> = {
  deep: "deep focus, everything sharp",
  moderate: "moderate depth of field",
  shallow: "shallow depth of field, background softly out of focus",
  "very-shallow": "very shallow depth of field, creamy out-of-focus background",
};

/** The lens phrase, with the full-frame equivalent when the format crops noticeably. */
export function lensPhrase(format: Format, focalMm: number, tStop: number): string {
  const k = cropFactor(format);
  const eq = focalMm * k;
  const equiv = Math.abs(k - 1) > 0.08 ? ` (${formatFocal(eq)} mm full-frame equivalent)` : "";
  return `${formatFocal(focalMm)} mm lens${equiv} at T${formatStop(tStop)}`;
}

export function motionPhrase(shutterDeg: number, fps: number, slowMotion: boolean): string {
  const shutter = describeShutter(shutterDeg);
  if (fps > 24 && slowMotion) return `${fps} fps played back at 24 fps (${Math.round(slowMotionFactor(fps) * 10) / 10}× slow motion), ${shutter}`;
  if (fps > 24) return `${fps} fps high frame rate, ${shutter}`;
  return shutter;
}

/**
 * One Seedance-style line built only from the controls. Brand names are deliberately absent:
 * describing what the camera does is more reliable than naming the camera.
 */
export function buildPrompt(p: PromptInput): string {
  const parts = [formatPhrase(p.format, p.film), lensPhrase(p.format, p.focalMm, p.tStop), DOF_WORDS[p.dof]];
  if (p.move === "pan") parts.push("fast whip pan");
  parts.push(motionPhrase(p.shutterDeg, p.fps, p.slowMotion), describeRollOff(p.look));
  if (p.look.id !== "neutral") parts.push(p.look.prompt);
  return parts.join(", ");
}

export const PROMPT_NOTE = "Describe the controls, not the brand. Video models don't reliably know what an ALEXA or a VENICE looks like, but they do respond to format, focal length, aperture, shutter and highlight words.";
