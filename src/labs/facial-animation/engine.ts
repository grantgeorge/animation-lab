import data from "../character-acting/takes.json";
import { blinkAt, LEAD_IN, mouthAt, NEUTRAL, samplePose, type Emotion, type VisemeId } from "../character-acting/performance";
import type { RigFrame } from "../character-acting/ActorRig";

export const TAKES = data.takes;
export type TakeId = keyof typeof TAKES;
export type Take = (typeof TAKES)[TakeId];
export const PAD = 0.4;
export const VISEME_LABELS: Record<VisemeId, string> = {
  rest: "Rest", A: "Open", E: "Wide", O: "Round", M: "Closed", F: "Lip / teeth", L: "Tongue / teeth",
};

/** Positive offset delays only the mouth. The voice, gaze and brows stay on the audio clock. */
export function mouthTime(t: number, offsetMs: number) {
  return t - PAD - offsetMs / 1000;
}

export function visemeAt(take: Take, s: number): VisemeId {
  let v: VisemeId = "rest";
  for (const cue of take.visemes) {
    if (cue.t > s) break;
    v = cue.v as VisemeId;
  }
  return v;
}

export function sampleFace(takeId: TakeId, t: number, offsetMs: number, strength: number, eyeActing: boolean): RigFrame {
  const take = TAKES[takeId];
  const pose = eyeActing ? samplePose({ emotion: takeId as Emotion, exaggeration: 1, gesture: 0, eyes: "audience" }, take.words, t - PAD + LEAD_IN) : { ...NEUTRAL };
  // Isolate facial animation: no gestures or added jaw opening from the acting performance.
  const mouth = mouthAt(take.visemes, mouthTime(t, offsetMs));
  return {
    pose: { ...pose, jaw: 0, lean: 0, slump: 0, shrug: 0, stretch: 0, headTurn: 0, headTilt: 0, headNod: 0, armL: NEUTRAL.armL, armR: NEUTRAL.armR },
    blink: eyeActing ? blinkAt(takeId as Emotion, take.words, t - PAD + LEAD_IN) : 0,
    mouth: { ...mouth, open: mouth.open * strength, wide: mouth.wide * strength, round: mouth.round * strength },
    breathe: 0, t: 0,
  };
}

export function offsetLabel(ms: number) {
  return ms === 0 ? "In sync" : `${Math.abs(ms)} ms ${ms < 0 ? "early" : "late"}`;
}

export function buildPrompt(takeId: TakeId, offsetMs: number, strength: number, eyeActing: boolean) {
  return `Locked close-up of Bram saying “${data.line}” with a ${takeId} delivery. ${offsetMs === 0 ? "Keep the mouth shapes aligned to the recorded dialogue" : `Let the mouth shapes arrive ${Math.abs(offsetMs)} ms ${offsetMs < 0 ? "before" : "after"} the recorded dialogue`}. Use ${strength < 0.75 ? "restrained" : strength > 1.15 ? "broad" : "natural"} mouth articulation, ${eyeActing ? "expressive brows and timed blinks" : "still brows and a steady gaze"}. Keep the camera, character design and lighting consistent.`;
}
