import { describe, expect, it } from "vitest";
import { labelClipPath } from "./htmlLayer";

const main = { left: 20, top: 80, width: 800, height: 450 };
const inset = { left: 600, top: 380, width: 200, height: 130 };

describe("studio label clipping", () => {
  it("keeps labels inside the studio inset when the camera shot is primary", () => {
    expect(labelClipPath(inset, main)).toBe("polygon(600px 380px, 800px 380px, 800px 510px, 600px 510px, 600px 380px)");
  });

  it("cuts the camera inset out of a larger studio view", () => {
    const clip = labelClipPath(main, inset);
    expect(clip).toContain("polygon(evenodd, 20px 80px");
    expect(clip).toContain("600px 380px, 600px 510px, 800px 510px, 800px 380px, 600px 380px");
  });

  it("hides labels when the studio slot is absent or collapsed", () => {
    expect(labelClipPath(null, main)).toBe("inset(100%)");
    expect(labelClipPath({ ...main, width: 0 }, inset)).toBe("inset(100%)");
  });
});
