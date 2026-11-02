import { describe, expect, it } from "vitest";
import { mouthAt } from "../character-acting/performance";
import { buildPrompt, mouthTime, PAD, sampleFace, TAKES, visemeAt } from "./engine";

describe("dialogue timing", () => {
  it("positive offsets delay the mouth; negative offsets anticipate it", () => {
    const t = PAD + 0.25;
    expect(visemeAt(TAKES.neutral, mouthTime(t, 0))).toBe("O");
    expect(visemeAt(TAKES.neutral, mouthTime(t, 300))).toBe("rest");
    const delayed = sampleFace("neutral", t + 0.3, 300, 1, false).mouth;
    const synced = sampleFace("neutral", t, 0, 1, false).mouth;
    for (const key of ["open", "wide", "round"] as const) expect(delayed[key]).toBeCloseTo(synced[key]);
    expect(sampleFace("neutral", t - 0.3, -300, 1, false).mouth.open).toBeCloseTo(sampleFace("neutral", t, 0, 1, false).mouth.open);
  });

  it("moving the mouth never shifts the eye performance or changes the source recording", () => {
    const a = sampleFace("sarcastic", 1.5, -300, 1, true);
    const b = sampleFace("sarcastic", 1.5, 300, 1, true);
    expect(a.pose).toEqual(b.pose);
    expect(a.blink).toBe(b.blink);
    expect(a.mouth).not.toEqual(b.mouth);
  });

  it("articulation scales shapes without changing the sampled cue", () => {
    const t = PAD + 0.25;
    const a = sampleFace("neutral", t, 0, 0.5, false);
    expect(a.mouth.open).toBeCloseTo(mouthAt(TAKES.neutral.visemes, 0.25).open / 2);
  });

  it("every take rests during the silent handles even at the extreme offsets", () => {
    for (const id of Object.keys(TAKES) as (keyof typeof TAKES)[]) {
      for (const offset of [-300, 0, 300]) {
        expect(sampleFace(id, 0, offset, 1, true).mouth.open).toBe(0);
        expect(sampleFace(id, TAKES[id].duration + PAD * 2, offset, 1, true).mouth.open).toBe(0);
      }
    }
  });

  it("writes deterministic direction with explicit offset sign and eye state", () => {
    expect(buildPrompt("neutral", -150, 0.5, false)).toContain("150 ms before");
    expect(buildPrompt("sarcastic", 300, 1.3, true)).toContain("300 ms after");
    expect(buildPrompt("neutral", 0, 1, false)).toContain("aligned to the recorded dialogue");
    expect(buildPrompt("neutral", 0, 1, false)).toContain("still brows");
  });
});
