import { describe, expect, it } from "vitest";
import { audibleEvents, audioSegments, humLevel } from "./audio";
import { runtime, stats } from "./edit";
import { analyseKnows } from "./explain";
import { COMEDY_PRESETS, KULE_FACE, comedyBeats, comedyEdit, compression, continuityCams, eyelines, flipAcross, jlEdit, kuleshovEdit, montageEdit, reactionEdit, screenDirection } from "./experiments";
import { MARKS } from "./marks";
import { REELS } from "./source";
import { SHOTS } from "./shots";

describe("Kuleshov", () => {
  it("uses the identical neutral frames either side of every insert", () => {
    for (const ins of ["box", "gift", "lantern"] as const) {
      const e = kuleshovEdit(ins);
      expect(e).toHaveLength(3);
      for (const c of [e[0], e[2]]) expect(c).toMatchObject(KULE_FACE);
    }
    expect(new Set((["box", "gift", "lantern"] as const).map((i) => kuleshovEdit(i)[1].shot)).size).toBe(3);
  });
});

describe("reaction shots", () => {
  it("before vs after flips what the audience learns first", () => {
    expect(analyseKnows(reactionEdit("before")).reactionBeforeDanger).toBe(true);
    const after = analyseKnows(reactionEdit("after"));
    expect(after.reactionBeforeDanger).toBe(false);
    expect(after.reactionAfterReveal).toBe(true);
  });
});

describe("continuity", () => {
  it("default coverage keeps matching eyelines on one side of the line", () => {
    const r = eyelines(SHOTS.hesitate.cam, SHOTS.reaction.cam);
    expect(r).toMatchObject({ pipLooks: "left", bramLooks: "right", matched: true, crossed: false, pipSide: 1, bramSide: 1 });
  });
  it("flipping the reaction camera across the line breaks the eyeline", () => {
    const flipped = continuityCams(true).reaction!;
    const r = eyelines(SHOTS.hesitate.cam, flipped);
    expect(r.crossed).toBe(true);
    expect(r.matched).toBe(false);
    expect(r.bramSide).toBe(-1);
    // a look along the line reverses screen direction for any camera mirrored across it
    const [b, p] = [MARKS.bram.at, MARKS.pip.stepTo];
    expect(screenDirection(flipAcross(SHOTS.establish.cam), b, p)).not.toBe(screenDirection(SHOTS.establish.cam, b, p));
  });
});

describe("J and L cuts", () => {
  it("a J-cut brings the next clip's sound in before the picture", () => {
    const straight = audibleEvents(jlEdit(0));
    const j = audibleEvents(jlEdit(1.0));
    const cut = jlEdit(0)[0].duration;
    expect(straight.some((x) => x.kind === "sting")).toBe(false);
    const sting = j.find((x) => x.kind === "sting")!;
    expect(sting.rec).toBeLessThan(cut);
    expect(sting.overPicture).toBe(true);
    expect(audioSegments(jlEdit(1.0))[1].recStart).toBeCloseTo(cut - 1.0);
  });
  it("an L-cut lets the previous clip's sound run over the new picture", () => {
    const l = audibleEvents(jlEdit(-1.0));
    const cut = jlEdit(0)[0].duration;
    const plea = l.find((x) => x.label === "Bram's pleading breath")!;
    expect(plea.index).toBe(0);
    expect(plea.rec).toBeGreaterThan(cut);
    expect(audibleEvents(jlEdit(0)).some((x) => x.label === "Bram's pleading breath")).toBe(false);
    expect(audioSegments(jlEdit(-1.0))[0].recEnd).toBeCloseTo(cut + 1.0);
  });
  it("the hum follows the audio edit, not the picture", () => {
    const cut = jlEdit(0)[0].duration;
    // just before the cut: straight = Bram clip's hum; J-cut = the reveal's (burst) hum
    expect(humLevel(jlEdit(1.2), cut - 0.3)).not.toBeCloseTo(humLevel(jlEdit(0), cut - 0.3), 2);
  });
});

describe("montage", () => {
  it("compresses 60 s of story into 10 s", () => {
    expect(compression(montageEdit("realtime")).ratio).toBe(1);
    const jump = compression(montageEdit("jump"));
    expect(jump.screen).toBe(10);
    expect(jump.ratio).toBeGreaterThan(5.5);
    expect(jump.ratio).toBeLessThan(6.2);
    expect(compression(montageEdit("dissolve")).ratio).toBe(jump.ratio);
    expect(montageEdit("dissolve").slice(1).every((c) => c.dissolve === 0.6)).toBe(true);
    for (const c of montageEdit("dissolve")) expect(c.sourceIn + c.duration).toBeLessThanOrEqual(REELS.mont.length);
  });
});

describe("comedy timing", () => {
  it("each preset changes the gaps between step, fall and reaction", () => {
    const b = Object.fromEntries(Object.entries(COMEDY_PRESETS).map(([k, p]) => [k, comedyBeats(p.gaps)]));
    expect(b.instant.fall - b.instant.step).toBeLessThan(1.2);
    expect(b.hold.fall - b.hold.step).toBeGreaterThan(b.instant.fall - b.instant.step + 2);
    expect(b.aftermath.reaction - b.aftermath.fall).toBeGreaterThan(b.instant.reaction - b.instant.fall + 1.5);
    expect(b.anticipation.step).toBeGreaterThan(b.instant.step + 1.5);
    expect(comedyEdit(COMEDY_PRESETS.anticipation.gaps).some((c) => c.shot === "cPeel")).toBe(true);
    expect(comedyEdit(COMEDY_PRESETS.instant.gaps).some((c) => c.shot === "cPeel" || c.shot === "cFace")).toBe(false);
    expect(comedyEdit(COMEDY_PRESETS.hold.gaps).some((c) => c.shot === "cFace")).toBe(true);
  });
  it("stays inside the reel at the extremes", () => {
    for (const g of [{ setup: 9, anticipation: 9, hold: 9, aftermath: 9 }, { setup: 0, anticipation: 0, hold: 0, aftermath: 0 }]) {
      const e = comedyEdit(g);
      for (const c of e) {
        expect(c.sourceIn).toBeGreaterThanOrEqual(0);
        expect(c.sourceIn + c.duration).toBeLessThanOrEqual(REELS.slip.length);
      }
      expect(runtime(e)).toBeGreaterThan(2);
    }
    expect(stats(comedyEdit(COMEDY_PRESETS.instant.gaps)).cuts).toBe(2);
  });
});
