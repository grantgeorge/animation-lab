import { doorwayScene as sceneDescriptor } from "@/labs/lens-and-framing/config";
import type { BeatId } from "../types";

/**
 * The canonical mapping for the history page: the Lens & Framing lab's own cast, set and performance.
 * Components read names from here, so a recast lab changes copy in one place.
 */
export const SCENE = {
  version: "lab-doorway-wave-v1@2026-11-01",
  lead: { id: "bram", name: sceneDescriptor.characters.primary.name, description: "the tall lamplighter in the red coat" },
  companion: { id: "pip", name: sceneDescriptor.characters.secondary.name, description: "the small kid in the yellow sou'wester" },
  set: "a lamplit street doorway at night",
  target: { id: "scarf", label: "scarf", from: "#F4E9D8", to: "#2F6FD0", toLabel: "blue" },
  durationS: sceneDescriptor.timeline.durationS,
  fps: sceneDescriptor.timeline.fps,
  /** Beats of the authored performance (doorwayWave), in seconds. */
  beats: [
    { id: "establish", label: "Establish", start: 0, end: 1.2, action: "Bram waits by the lamplit doorway; the door swings open." },
    { id: "notice", label: "Notice", start: 1.2, end: 2.7, action: "Pip peeks round the door and steps out; Bram hears it." },
    { id: "react", label: "React", start: 2.7, end: 4.6, action: "Bram turns and waves back; Pip waves." },
    { id: "settle", label: "Settle", start: 4.6, end: 6, action: "Pip hops and heads back in; Bram settles." },
  ] satisfies { id: BeatId; label: string; start: number; end: number; action: string }[],
} as const;

export const NOTE_TEXT = `Make ${SCENE.lead.name}'s ${SCENE.target.label} ${SCENE.target.toLabel}. Keep the acting, camera, and background the same.`;
