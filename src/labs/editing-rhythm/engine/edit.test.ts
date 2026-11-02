import { describe, expect, it } from "vitest";
import { MAX_CLIP, MIN_CLIP, audioLeadRange, clampClip, clipAt, frameAt, handles, moveClip, reorder, runtime, sameEdit, scaleTempo, setAudioLead, setDuration, starts, stats, trimHead, trimTail, withIds } from "./edit";
import { presetEdit, PRESET_INFO } from "./presets";
import { REELS } from "./source";
import { COVERAGE, SHOTS } from "./shots";
import { EDIT_PRESETS } from "./types";

const ref = () => withIds(COVERAGE.map((shot, i) => ({ shot, sourceIn: i * 3, duration: [4, 2.5, 3, 2.5, 3.5, 2.5][i] })));

describe("edit model", () => {
  it("computes the reference playground stats (18 s, ASL 3.0, 5 cuts)", () => {
    const e = ref();
    expect(stats(e)).toMatchObject({ runtime: 18, asl: 3, cuts: 5, clips: 6 });
    expect(starts(e)).toEqual([0, 4, 6.5, 9.5, 12, 15.5]);
  });

  it("finds the clip and source time on screen", () => {
    const e = ref();
    const at = clipAt(e, 7)!;
    expect(at.clip.shot).toBe("reaction");
    expect(at.local).toBeCloseTo(6 + 0.5);
    expect(clipAt(e, 99)!.index).toBe(5);
    expect(clipAt([], 1)).toBeNull();
  });

  it("moves clips earlier/later and drags to any slot", () => {
    const e = ref();
    expect(moveClip(e, 2, -1).map((c) => c.shot)).toEqual(["establish", "reaction", "reach", "glow", "hesitate", "reveal"]);
    expect(moveClip(e, 5, 1).map((c) => c.shot)).toEqual(e.map((c) => c.shot));
    expect(reorder(e, 3, 1).map((c) => c.shot)).toEqual(["establish", "glow", "reach", "reaction", "hesitate", "reveal"]);
    expect(runtime(reorder(e, 0, 5))).toBe(18);
  });

  it("changes durations within the handles", () => {
    const e = ref();
    const longer = setDuration(e, 2, 4);
    expect(stats(longer)).toMatchObject({ runtime: 19, asl: 3.167 });
    expect(setDuration(e, 2, 0.01)[2].duration).toBe(MIN_CLIP);
    expect(setDuration(e, 2, 99)[2].duration).toBe(MAX_CLIP);
    // the tail handle limits a clip near the end of its reel
    const late = withIds([{ shot: "reveal", sourceIn: 20, duration: 1 }]);
    expect(setDuration(late, 0, 5)[0].duration).toBe(REELS.main.length - 20);
  });

  it("trims heads and tails without leaving the reel", () => {
    const e = ref();
    const h = trimHead(e, 1, 2);
    expect(h[1]).toMatchObject({ sourceIn: 2, duration: 3.5 });
    expect(trimHead(e, 1, -5)[1].sourceIn).toBe(0);
    expect(trimHead(e, 1, 99)[1].duration).toBe(MIN_CLIP);
    expect(trimTail(e, 1, 6)[1].duration).toBe(3);
    expect(handles(e[1])).toEqual({ before: 3, after: REELS.main.length - 5.5 });
    expect(clampClip({ id: "x", shot: "glow", sourceIn: 30, duration: 2 }).sourceIn).toBe(20);
  });

  it("scales tempo and keeps in-points", () => {
    const e = ref();
    const t = scaleTempo(e, 0.5);
    expect(runtime(t)).toBe(9);
    expect(t.map((c) => c.sourceIn)).toEqual(e.map((c) => c.sourceIn));
  });

  it("clamps split edits to the available handles", () => {
    const e = ref();
    const r = audioLeadRange(e, 1);
    expect(r.max).toBeLessThanOrEqual(e[1].sourceIn);
    expect(setAudioLead(e, 1, 99)[1].audioLead).toBe(r.max);
    expect(setAudioLead(e, 1, -99)[1].audioLead).toBe(r.min);
    expect(audioLeadRange(e, 0)).toEqual({ min: 0, max: 0 });
    // moving a split clip to the head drops its split (nothing to split from)
    expect(reorder(setAudioLead(e, 1, 1), 1, 0)[0].audioLead).toBe(0);
  });

  it("dissolves blend the outgoing tail with the incoming head", () => {
    const e = withIds([
      { shot: "mWide", sourceIn: 0, duration: 2 },
      { shot: "mWide", sourceIn: 20, duration: 2, dissolve: 1 },
    ]);
    const f = frameAt(e, 2.0)!;
    expect(f.b?.mix).toBeCloseTo(0.5);
    expect(f.a.local).toBeCloseTo(2.0);
    expect(f.b?.local).toBeCloseTo(20);
    expect(frameAt(e, 1)!.b).toBeUndefined();
    expect(frameAt(e, 3)!.b).toBeUndefined();
  });
});

describe("presets", () => {
  it("every clip sits inside its reel", () => {
    for (const id of EDIT_PRESETS) for (const c of presetEdit(id)) {
      expect(c.sourceIn).toBeGreaterThanOrEqual(0);
      expect(c.sourceIn + c.duration).toBeLessThanOrEqual(REELS[SHOTS[c.shot].reel].length + 1e-9);
    }
  });

  it("differ structurally, not only in durations", () => {
    const orders = EDIT_PRESETS.map((id) => presetEdit(id).map((c) => c.shot).join(","));
    expect(new Set(orders).size).toBe(4);
    const ins = EDIT_PRESETS.map((id) => presetEdit(id).map((c) => c.sourceIn).join(","));
    expect(new Set(ins).size).toBe(4);
    expect(presetEdit("action").some((c) => c.shot === "establish")).toBe(false);
    expect(presetEdit("emotion").some((c) => c.shot === "glow")).toBe(false);
    expect(presetEdit("comedy").at(-1)!.shot).toBe("reaction");
    expect(presetEdit("suspense").findIndex((c) => c.shot === "reaction")).toBeLessThan(presetEdit("suspense").findIndex((c) => c.shot === "glow"));
  });

  it("have the expected tempo ordering", () => {
    const asl = Object.fromEntries(EDIT_PRESETS.map((id) => [id, stats(presetEdit(id)).asl]));
    expect(asl.action).toBeLessThan(asl.comedy);
    expect(asl.comedy).toBeLessThan(asl.suspense);
    expect(asl.suspense).toBeLessThan(asl.emotion);
    expect(stats(presetEdit("emotion")).cuts).toBeLessThan(stats(presetEdit("action")).cuts);
    for (const id of EDIT_PRESETS) expect(PRESET_INFO[id].label).toBeTruthy();
  });

  it("presets compare equal to themselves only", () => {
    expect(sameEdit(presetEdit("suspense"), presetEdit("suspense"))).toBe(true);
    expect(sameEdit(presetEdit("suspense"), setDuration(presetEdit("suspense"), 0, 3))).toBe(false);
  });
});
