import { describe, expect, it } from "vitest";
import { LABS, availableLabs } from "./registry";
import { LAB_LOADERS } from "./loaders";
import { DISCIPLINES } from "./types";

describe("lab registry", () => {
  it("every available lab has a loader; no concept lab has an entry", () => {
    for (const l of LABS) {
      if (l.status === "available") expect(l.entry && l.entry in LAB_LOADERS).toBe(true);
      else expect(l.entry).toBeNull();
    }
    expect(availableLabs().map((l) => l.id)).toEqual(["lens-and-framing", "camera-movement", "camera-families", "animation-camera", "lighting-studio", "grading-finishing", "painterly-textures", "timing-and-spacing", "animation-style", "character-acting", "shot-coverage", "staging-and-blocking", "environment-depth", "facial-animation", "stylized-rendering", "storyboards-animatics", "editing-rhythm", "color-scripting", "secondary-motion", "character-rigging", "vfx-simulation", "character-design", "compositing-passes", "2d-vs-3d", "ai-shot-continuity", "voice-direction", "procedural-vs-keyframe"]);
  });
  it("every lab belongs to one of the six disciplines", () => {
    const ids = new Set(DISCIPLINES.map((d) => d.id));
    for (const l of LABS) expect(ids.has(l.discipline), l.id).toBe(true);
  });
  it("ids are unique and ordered", () => {
    expect(new Set(LABS.map((l) => l.id)).size).toBe(LABS.length);
    expect(LABS.map((l) => l.order)).toEqual([...LABS.map((l) => l.order)].sort((a, b) => a - b));
  });
});
