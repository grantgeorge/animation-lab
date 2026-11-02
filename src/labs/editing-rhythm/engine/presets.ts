import { withIds } from "./edit";
import type { Clip, EditPresetId, ShotId } from "./types";

type Raw = [shot: ShotId, sourceIn: number, duration: number];

/**
 * The four treatments of the same six shots. They differ in ORDER, SOURCE RANGES and which shots
 * they use at all, not only in durations (main-reel local seconds):
 * - Suspense: Bram's fear before its cause; the insert is held back and overlaps time (stretches it).
 * - Comedy: quick setup, a jump in time to the creak, a timed pause, sudden reveal, THEN the reaction.
 * - Action: no establishing shot, tight in-points on movement, shots reused, every cut on motion.
 * - Emotion: long close-ups, no insert, few cuts; a second reaction after the reveal as the payoff.
 */
const RAW: Record<EditPresetId, Raw[]> = {
  suspense: [
    ["establish", 0.6, 4.0],
    ["reach", 4.6, 2.5],
    ["reaction", 7.1, 3.5],
    ["hesitate", 10.4, 3.0],
    ["glow", 11.8, 2.5],
    ["reveal", 14.3, 3.5],
  ],
  comedy: [
    ["establish", 2.2, 2.0],
    ["reach", 4.4, 1.4],
    ["glow", 8.6, 1.0],
    ["hesitate", 10.3, 2.6],
    ["reveal", 14.4, 1.4],
    ["reaction", 14.5, 2.4],
  ],
  action: [
    ["reach", 4.55, 1.2],
    ["reaction", 6.0, 0.9],
    ["glow", 8.8, 0.8],
    ["hesitate", 10.0, 1.0],
    ["reach", 13.0, 0.9],
    ["glow", 14.05, 0.6],
    ["reveal", 14.6, 2.2],
  ],
  emotion: [
    ["establish", 0.5, 4.0],
    ["reach", 4.5, 4.0],
    ["reaction", 8.5, 4.0],
    ["reveal", 14.2, 4.5],
    ["reaction", 18.2, 3.5],
  ],
};

export const PRESET_INFO: Record<EditPresetId, { label: string; feel: string; recipe: string }> = {
  suspense: { label: "Suspense", feel: "anxiety and anticipation", recipe: "Long holds, the reaction before the cause, the reveal delayed." },
  comedy: { label: "Comedy", feel: "surprise and humour", recipe: "Quick setup, a timed pause, a sudden reveal, the reaction as the punchline." },
  action: { label: "Action", feel: "urgency and excitement", recipe: "Short shots, tight in-points, every cut on movement, no establishing shot." },
  emotion: { label: "Emotion", feel: "empathy and connection", recipe: "Long close-ups, fewer cuts, a reaction placed after the reveal." },
};

export function presetEdit(id: EditPresetId): Clip[] {
  return withIds(RAW[id].map(([shot, sourceIn, duration]) => ({ shot, sourceIn, duration })), `${id[0]}`);
}
