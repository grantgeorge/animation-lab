import { describe, expect, it } from "vitest";
import { presetCurves } from "./bezier";
import { DEFAULT_PARAMS, type MotionParams, applyWeight } from "./params";
import { motionPrompt } from "./prompt";

const base: MotionParams = { ...DEFAULT_PARAMS };

describe("motion prompt phrase", () => {
  it("is deterministic and comma separated", () => {
    expect(motionPrompt(base)).toBe(motionPrompt({ ...base }));
    expect(motionPrompt(base).split(", ").length).toBeGreaterThanOrEqual(5);
  });

  it("describes the default rubber ball", () => {
    expect(motionPrompt(base)).toBe(
      "springy rubber-ball bounce with real-world timing, natural arcs that hang at the top and accelerate into each impact, five shrinking rebounds, soft squash on landings and slight stretch on fast falls, quick crouch before the jump, antenna whips through with follow-through",
    );
  });

  it("describes a heavy rigid bowling ball with no windup", () => {
    const p = { ...applyWeight(base, "bowling"), squash: 0, anticipation: 0, followThrough: 0 };
    expect(motionPrompt(p)).toBe(
      "heavy bowling-ball bounce with a fast, snappy timing, natural arcs that hang at the top and accelerate into each impact, one short, low rebound that stops dead, rigid, no squash or stretch, launches with no windup",
    );
  });

  it("names linear, cushioned and inverted spacing", () => {
    expect(motionPrompt({ ...base, ...presetCurves("linear") })).toContain("constant-speed, mechanical V-shaped bounces");
    expect(motionPrompt({ ...base, ...presetCurves("easeInOut") })).toContain("eases into every landing as if cushioned");
    expect(motionPrompt({ ...base, ...presetCurves("easeIn") })).toContain("lingers on the floor and snaps at the top");
  });

  it("calls out broken rebound timing, twos and exaggerated squash", () => {
    const s = motionPrompt({ ...base, physicalTiming: false, onTwos: true, squash: 1 });
    expect(s).toContain("each taking the same time");
    expect(s).toContain("animated on twos");
    expect(s).toContain("exaggerated cartoon squash");
  });
});
