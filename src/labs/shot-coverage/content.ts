import type { EditPresetId } from "./engine/edit";
import type { Mode } from "./store";

/** Concept copy: one card per mode, one per edit preset. Short and concrete. */
export const MODE_COPY: Record<Mode, { title: string; body: string; tip: string }> = {
  watch: {
    title: "Watch the cut",
    body: "Three locked-off cameras, one performance, cut together. Watch where Bram and Pip sit on screen at every cut, and whether you ever lose track of who is looking at whom.",
    tip: "Press E to experiment with the edit, I to inspect the cameras.",
  },
  inspect: {
    title: "The 180° line",
    body: "Draw a line through Bram and Pip: the axis of action. Keep every camera on one side and Bram stays screen-left looking right, Pip screen-right looking left, in every shot. Put one camera across it and they swap sides, so the audience feels the characters turned around.",
    tip: "Compare the L/R tags on the three monitors. Press X to send the selected camera across.",
  },
  experiment: {
    title: "Coverage",
    body: "Coverage means filming the same action from several angles so the editor has choices. The master sets up the geography, over-the-shoulders and singles carry the exchange, and close-ups catch the reactions. A scene is built from these shots, not found in one frame.",
    tip: "Play, then press 1 / 2 / 3 to cut live to A / B / C. Drag cut points to trim, click a shot to swap its camera.",
  },
};

export const EDIT_COPY: Record<EditPresetId, { title: string; body: string }> = {
  classic: {
    title: "Classic coverage",
    body: "Open on the master for geography, go in to the over-the-shoulders as the moment builds, then back out to the master to release it. Every camera is on one side, so the cuts disappear.",
  },
  crossing: {
    title: "Crossing the line",
    body: "This is the same edit, but camera C has moved across the axis. In shot 3 Pip suddenly looks the other way and Bram swaps sides. Break the rule on purpose (for a jolt, or a shift in power), or carry the audience across with a camera move over the line or a neutral shot straight down it.",
  },
  reaction: {
    title: "Reaction-heavy",
    body: "Stay on the listener. A reaction shot often says more than the action: we read the moment in Pip's face. Cut to a face while the other character acts.",
  },
  fast: {
    title: "Fast cutting",
    body: "Shots of about 0.6 s raise energy and anxiety. Action and comedy beats cut fast, but cut too fast and nobody can read a face. Compare the average shot length with slow cutting.",
  },
  slow: {
    title: "Slow cutting",
    body: "Long takes let the performance breathe and make the audience search the frame. Drama holds the shot, so the single cut lands hard.",
  },
};

export const RULE_BREAK = "When to break the 180° rule: deliberately, for disorientation or a power shift. Or cross on camera, with a move across the line, or cut through a neutral shot on the line itself.";

export const FLAG_TITLE = { axis: "Crosses the line", jump: "Jump cut", same: "Same camera" } as const;

export const KEYS: [string, string][] = [
  ["1 2 3", "Cut to A / B / C while playing (Experiment), else select"],
  ["Space", "Play / pause"],
  [", .", "Step one frame back / forward"],
  ["X", "Cross the line with the selected camera"],
  ["Z", "Undo the last edit"],
  ["W I E", "Watch / Inspect / Experiment"],
  ["Home", "Back to the start"],
  ["?", "This help"],
];
