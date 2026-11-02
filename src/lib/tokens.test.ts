import { describe, expect, it } from "vitest";
import { contrast, tokens } from "./tokens";

describe("tokens", () => {
  it("text on glass meets WCAG AA", () => {
    for (const ink of [tokens.ink0, tokens.ink1, tokens.focalText, tokens.distance, tokens.subject]) {
      expect(contrast(ink, tokens.glassBase)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
