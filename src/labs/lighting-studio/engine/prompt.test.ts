import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt";
import { cloneRig, getPreset, soloMask } from "./presets";
import { effectiveRig } from "./ratio";

const phrase = (id: string) => {
  const p = getPreset(id)!;
  return buildPrompt(p.rig, { lead: p.promptLead });
};

describe("lighting prompt phrase", () => {
  it("is deterministic", () => {
    expect(phrase("storybook")).toBe(phrase("storybook"));
  });

  it("describes each look in its own words", () => {
    expect(phrase("flat")).toMatch(/^flat high-key children's animation lighting, soft frontal key/);
    expect(phrase("flat")).toMatch(/minimal shadows/);
    expect(phrase("storybook")).toMatch(/soft warm amber key from camera left at 46°/);
    expect(phrase("storybook")).toMatch(/3:1 key-to-fill ratio/);
    expect(phrase("dramatic")).toMatch(/hard warm side key from camera left at 100°/);
    expect(phrase("dramatic")).toMatch(/strong (cool )?blue rim light separating the silhouette, 8:1 key-to-fill ratio/);
    expect(phrase("noir")).toMatch(/no fill/);
    expect(phrase("noir")).toMatch(/venetian blind/);
    expect(phrase("noir")).toMatch(/desaturated near-monochrome/);
    expect(phrase("sunset")).toMatch(/hard orange backlight from behind, camera right, low on the horizon/);
    expect(phrase("sunset")).toMatch(/long shadows stretching toward camera/);
    expect(phrase("sunset")).toMatch(/orange glow on the backdrop fading to/);
  });

  it("derives a lead from the contrast when the look is custom", () => {
    const r = cloneRig(getPreset("dramatic")!.rig);
    expect(buildPrompt(r)).toMatch(/^low-key lighting, /);
    const flat = cloneRig(getPreset("flat")!.rig);
    expect(buildPrompt(flat)).toMatch(/^high-key lighting, /);
  });

  it("follows the picture: solo key reads as no fill, extreme contrast", () => {
    const eff = effectiveRig(getPreset("storybook")!.rig, soloMask("key"));
    const s = buildPrompt(eff);
    expect(s).toMatch(/no fill/);
    expect(s).toMatch(/extreme contrast/);
    expect(s).not.toMatch(/rim light/);
  });

  it("moves with the light", () => {
    const r = cloneRig(getPreset("three-point")!.rig);
    r.lights.key.azimuthDeg = 45;
    r.lights.key.elevationDeg = -20;
    expect(buildPrompt(r)).toMatch(/key from camera right at 45°, from below/);
  });
});
