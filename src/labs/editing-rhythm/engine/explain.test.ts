import { describe, expect, it } from "vitest";
import { moveClip, setDuration, scaleTempo, setAudioLead } from "./edit";
import { analyseKnows, closest, cutsOnMovement, diffEdits, explain, scoreTreatments, timeStructure } from "./explain";
import { presetEdit } from "./presets";
import { EDIT_PRESETS } from "./types";

describe("information order", () => {
  it("suspense shows Bram's fear before the danger", () => {
    const k = analyseKnows(presetEdit("suspense"));
    expect(k.reactionAt).not.toBeNull();
    expect(k.dangerAt).not.toBeNull();
    expect(k.reactionAt!).toBeLessThan(k.dangerAt!);
    expect(k.reactionBeforeDanger).toBe(true);
    expect(k.revealAt!).toBeGreaterThan(k.dangerAt!);
  });

  it("comedy puts the reaction after the reveal", () => {
    const k = analyseKnows(presetEdit("comedy"));
    expect(k.reactionBeforeDanger).toBe(false);
    expect(k.reactionAfterReveal).toBe(true);
    expect(k.reaction.some((r) => r.kind === "startle")).toBe(true);
  });

  it("each preset reads as its own treatment", () => {
    for (const id of EDIT_PRESETS) expect(closest(scoreTreatments(presetEdit(id)))).toBe(id);
  });

  it("moving the insert before the reaction flips the order", () => {
    const s = presetEdit("suspense");
    // glow insert is slot 5; move it earlier until it passes the reaction (slot 3)
    const prev = moveClip(s, 4, -1);
    expect(analyseKnows(prev).reactionBeforeDanger).toBe(true);
    const e = moveClip(prev, 3, -1);
    const k = analyseKnows(e);
    expect(k.reactionBeforeDanger).toBe(false);
    const ex = explain(e, { previous: prev, baseline: s });
    expect(ex.headline).toMatch(/box is revealed before Bram reacts/);
    expect(ex.points.map((p) => p.id)).toContain("order.danger-first");
  });
});

describe("explanation rules", () => {
  it("holding the reaction longer before the reveal names the consequence", () => {
    const s = presetEdit("suspense");
    const e = setDuration(s, 2, 4.5);
    const ex = explain(e, { previous: s, baseline: s });
    expect(ex.headline).toBe("You held the reaction shot longer before revealing the box. The audience now experiences Bram's fear for 4.5 s before discovering its cause.");
    expect(ex.points.find((p) => p.id === "hold.longer")?.text).toMatch(/reaction is held 1.0 s longer/);
  });

  it("is deterministic", () => {
    const e = presetEdit("action");
    expect(explain(e)).toEqual(explain(e));
  });

  it("fires tempo, movement, coverage and time rules from structure", () => {
    const action = explain(presetEdit("action"));
    const ids = action.points.map((p) => p.id);
    expect(ids).toContain("tempo.fast");
    expect(ids).toContain("cuts.movement");
    expect(ids).toContain("coverage.no-establish");
    expect(ids).toContain("coverage.repeat");
    expect(cutsOnMovement(presetEdit("action")).length).toBeGreaterThanOrEqual(4);
    expect(explain(presetEdit("emotion")).points.map((p) => p.id)).toEqual(expect.arrayContaining(["tempo.slow", "reaction.payoff"]));
    expect(explain(presetEdit("comedy")).points.map((p) => p.id)).toEqual(expect.arrayContaining(["reaction.punchline", "time.ellipsis"]));
    expect(timeStructure(presetEdit("suspense")).stretch).toBeGreaterThan(1);
  });

  it("recognises preset loads, tempo changes and split edits", () => {
    const s = presetEdit("suspense");
    expect(explain(s, { change: { kind: "preset", preset: "suspense" } }).headline).toMatch(/^Suspense cut/);
    const fast = scaleTempo(s, 0.6);
    expect(diffEdits(s, fast).kind).toBe("tempo");
    expect(explain(fast, { previous: s }).headline).toMatch(/tightened every shot/);
    const j = setAudioLead(s, 3, 0.8);
    expect(explain(j, { previous: s }).headline).toMatch(/^J-cut/);
    expect(explain(j).points.map((p) => p.id)).toContain("audio.j");
  });

  it("removing every reaction is called out", () => {
    // the low wide reveal also shows Bram jump, so drop it too
    const e = presetEdit("suspense").filter((c) => c.shot !== "reaction" && c.shot !== "reveal");
    expect(explain(e).points[0].id).toBe("order.no-reaction");
  });
});
