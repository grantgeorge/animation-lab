import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, neighbor, parseState, serializeState } from "./state";

describe("history URL state", () => {
  it("defaults to Drawings / watch", () => {
    expect(parseState("")).toEqual(DEFAULT_STATE);
  });
  it("falls back to the first chapter for unknown ids", () => {
    expect(parseState("?chapter=nope&view=bogus").chapterId).toBe("drawings");
    expect(parseState("?chapter=nope&view=bogus").view).toBe("watch");
  });
  it("round-trips every durable field", () => {
    const s = { chapterId: "multiplane", view: "process", compareChapterId: "cg", directorNote: "blue-scarf" } as const;
    expect(serializeState(s)).toBe("?chapter=multiplane&view=process&compare=cg&note=blue-scarf");
    expect(parseState(serializeState(s))).toEqual(s);
  });
  it("omits defaults", () => {
    expect(serializeState(DEFAULT_STATE)).toBe("");
  });
  it("ignores an invalid compare chapter", () => {
    expect(parseState("?compare=xyz").compareChapterId).toBeNull();
  });
  it("wraps neighbors", () => {
    expect(neighbor("drawings", -1)).toBe("generative");
    expect(neighbor("generative", 1)).toBe("drawings");
  });
});
