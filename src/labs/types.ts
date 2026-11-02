import type { ComponentType } from "react";

export type LabModuleId = "lens-and-framing" | "camera-movement" | "lighting-studio" | "timing-and-spacing" | "character-acting" | "animation-style" | "shot-coverage" | "facial-animation" | "staging-and-blocking" | "storyboards-animatics" | "color-scripting" | "camera-families" | "animation-camera" | "grading-finishing" | "painterly-textures" | "environment-depth" | "editing-rhythm" | "vfx-simulation" | "character-rigging" | "character-design" | "2d-vs-3d";
export type LabStatus = "available" | "concept";
export type LabCategory = "camera" | "staging" | "composition" | "lighting" | "focus" | "animation" | "editing" | "lookdev" | "simulation" | "ai";

/** The six disciplines the curriculum is organized around (docs/roadmap.md). */
export type Discipline = "cinematography" | "character-animation" | "visual-storytelling" | "look-development" | "simulation" | "ai-animation";
export const DISCIPLINES: readonly { id: Discipline; title: string; blurb: string }[] = [
  { id: "cinematography", title: "Cinematography", blurb: "Lens, camera, coverage and the language of shots." },
  { id: "character-animation", title: "Character Animation", blurb: "Timing, posing, acting and the craft of movement." },
  { id: "visual-storytelling", title: "Visual Storytelling", blurb: "Staging, boards, color and pacing in sequence." },
  { id: "look-development", title: "Look Development", blurb: "Light, materials, rendering and style." },
  { id: "simulation", title: "Simulation", blurb: "Secondary motion, particles and physical effects." },
  { id: "ai-animation", title: "AI Animation", blurb: "Directing generative video with the vocabulary above." },
];

export interface LabEntry {
  id: string;
  title: string;
  description: string;
  category: LabCategory;
  discipline: Discipline;
  status: LabStatus;
  order: number;
  minutes?: number;
  preview: { kind: "image"; src: string; alt: string } | { kind: "gradient"; from: string; to: string };
  concepts: string[];
  /** Module entry point; null for concepts that are not built. */
  entry: LabModuleId | null;
}

export interface LabModule {
  id: LabModuleId;
  Component: ComponentType;
}
