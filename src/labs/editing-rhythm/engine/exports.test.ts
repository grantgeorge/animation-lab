import { describe, expect, it } from "vitest";
import { setAudioLead, setDuration } from "./edit";
import { explain } from "./explain";
import { jlEdit, montageEdit } from "./experiments";
import { cutList, edl, parseTimecode, seedancePrompt, timecode, validateCutList, validateEdl } from "./exports";
import { presetEdit } from "./presets";
import { EDIT_PRESETS } from "./types";

describe("timecode", () => {
  it("round-trips at 24 fps with an hour offset", () => {
    expect(timecode(0, 24, 1)).toBe("01:00:00:00");
    expect(timecode(4.5)).toBe("00:00:04:12");
    expect(timecode(61.25)).toBe("00:01:01:06");
    expect(parseTimecode("00:01:01:06")).toBe(61 * 24 + 6);
  });
});

describe("cut list JSON", () => {
  it("is valid for every preset and survives a JSON round trip", () => {
    for (const id of EDIT_PRESETS) {
      const e = presetEdit(id);
      const c = JSON.parse(JSON.stringify(cutList(e, id, explain(e))));
      expect(validateCutList(c)).toEqual([]);
      expect(c.clips).toHaveLength(e.length);
      expect(c.notes.length).toBeGreaterThan(1);
    }
  });
  it("records split edits and dissolves", () => {
    const c = cutList(jlEdit(0.8), "jl");
    expect(c.clips[1].audio).toMatchObject({ relation: "J", offset: 0.8 });
    expect(c.clips[1].audio.recordIn).toBeCloseTo(c.clips[1].record.in - 0.8);
    expect(cutList(jlEdit(-0.5), "jl").clips[1].audio.relation).toBe("L");
    expect(cutList(montageEdit("dissolve"), "m").clips[2].transition).toEqual({ kind: "dissolve", duration: 0.6 });
    expect(validateCutList({ format: "nope" })).not.toEqual([]);
  });
});

describe("EDL", () => {
  it("is well formed CMX3600 for every preset, with contiguous record times", () => {
    for (const id of EDIT_PRESETS) {
      const { errors, events } = validateEdl(edl(presetEdit(id), `Editing Rhythm ${id}`));
      expect(errors).toEqual([]);
      expect(events).toHaveLength(presetEdit(id).length);
      for (let i = 1; i < events.length; i++) expect(events[i].recIn).toBe(events[i - 1].recOut);
      expect(events[0].recIn).toBe(parseTimecode("01:00:00:00"));
    }
  });
  it("writes split edits as separate V and A events", () => {
    const text = edl(setAudioLead(setDuration(presetEdit("suspense"), 0, 4), 2, 1), "split");
    const { errors, events } = validateEdl(text);
    expect(errors).toEqual([]);
    expect(events.some((e) => e.track === "A")).toBe(true);
    expect(text).toMatch(/J-CUT/);
  });
  it("writes dissolves in the two-line C → D form", () => {
    const text = edl(montageEdit("dissolve"), "montage");
    expect(validateEdl(text).errors).toEqual([]);
    expect(text).toMatch(/ V {5}D {4}014 /);
  });
});

describe("Seedance prompt", () => {
  it("spells out the rhythm shot by shot", () => {
    const p = seedancePrompt(presetEdit("suspense"), "suspense");
    const lines = p.split("\n");
    expect(lines[0]).toMatch(/^Multi-shot sequence, 19.0 s, 6 shots, suspense: measured/);
    expect(lines[0]).toMatch(/reaction comes BEFORE/);
    expect(lines).toHaveLength(7);
    expect(lines[3]).toMatch(/^Shot 3 \(6.5–10.0 s\): hold on close-up of Bram's face 3.5 s before the reveal/);
    expect(seedancePrompt(presetEdit("action"), "action")).toMatch(/Cut on movement/);
    expect(seedancePrompt(jlEdit(1), "jl")).toMatch(/J-cut: its sound starts 1.0 s before the cut/);
  });
});
