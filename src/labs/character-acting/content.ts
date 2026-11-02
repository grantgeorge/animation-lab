import type { Emotion, EyeTarget } from "./performance";

export const LINE = "Oh, that's just great.";

export const EMOTION_META: Record<Emotion, { label: string; emoji: string }> = {
  neutral: { label: "Neutral", emoji: "😐" },
  excited: { label: "Genuinely excited", emoji: "😄" },
  sarcastic: { label: "Sarcastic", emoji: "😏" },
  nervous: { label: "Nervous", emoji: "😰" },
  frustrated: { label: "Frustrated", emoji: "😠" },
  disappointed: { label: "Disappointed", emoji: "😢" },
};

export const EYE_LABELS: Record<EyeTarget, string> = { partner: "Pip", audience: "Audience", down: "Down", away: "Away" };
