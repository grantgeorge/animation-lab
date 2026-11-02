import { describe, expect, it } from "vitest";
import data from "./takes.json";
import { anchorsFor, blinkAt, direct, EMOTIONS, LEAD_IN, mouthAt, NEUTRAL, PERFORMANCES, resolveKeys, samplePose, type Direction } from "./performance";

const takes = data.takes as Record<string, { words: { text: string; start: number; end: number }[]; visemes: { t: number; v: string }[]; duration: number }>;
const base: Direction = { emotion: "sarcastic", exaggeration: 1, gesture: 1, eyes: "audience" };

describe("voice takes", () => {
  it("every emotion has a take with the four words of the line", () => {
    for (const e of EMOTIONS) {
      expect(takes[e].words.map((w) => w.text.replace(/[^a-z']/gi, "").toLowerCase())).toEqual(["oh", "that's", "just", "great"]);
    }
  });
});

describe("acting is keyed to words, so it retimes to any voice", () => {
  it("the accent on “great” lands on that take's word, whichever voice plays", () => {
    for (const voice of ["sarcastic", "excited", "disappointed"]) {
      const w = takes[voice].words;
      expect(anchorsFor(w).w3).toBeCloseTo(LEAD_IN + w[3].start);
      const keys = resolveKeys("sarcastic", w);
      expect(keys.some((k) => Math.abs(k.t - (LEAD_IN + w[3].start)) < 1e-9)).toBe(true);
    }
  });
  it("the same body performance changes timing, not choreography, across voices", () => {
    const a = resolveKeys("frustrated", takes.frustrated.words);
    const b = resolveKeys("frustrated", takes.disappointed.words);
    expect(a.map((k) => k.pose)).toEqual(b.map((k) => k.pose));
    expect(a.map((k) => k.t)).not.toEqual(b.map((k) => k.t));
  });
  it("sarcasm's eye-roll happens in the pause before “great”", () => {
    const w = takes.sarcastic.words;
    const mid = LEAD_IN + (w[2].end + w[3].start) / 2;
    expect(samplePose(base, w, mid).gazeY).toBeLessThan(-0.5);
  });
});

describe("direction controls", () => {
  const w = takes.excited.words;
  const t = LEAD_IN + w[3].start + 0.3;
  it("exaggeration scales face and body deltas from neutral", () => {
    const sub = samplePose({ ...base, emotion: "excited", exaggeration: 0.5 }, w, t);
    const big = samplePose({ ...base, emotion: "excited", exaggeration: 1.5 }, w, t);
    expect(big.smile - NEUTRAL.smile).toBeGreaterThan(sub.smile - NEUTRAL.smile);
    expect(big.armR.up).toBeGreaterThan(sub.armR.up);
  });
  it("gesture intensity changes the body but not the face", () => {
    const lo = samplePose({ ...base, emotion: "excited", gesture: 0.4 }, w, t);
    const hi = samplePose({ ...base, emotion: "excited", gesture: 1.5 }, w, t);
    expect(hi.armR.up).toBeGreaterThan(lo.armR.up);
    expect(hi.smile).toBeCloseTo(lo.smile);
    expect(hi.browRaise).toBeCloseTo(lo.browRaise);
  });
  it("squash and stretch only appears in broad acting", () => {
    expect(samplePose({ ...base, emotion: "excited", exaggeration: 0.7 }, w, t).stretch).toBe(0);
    expect(samplePose({ ...base, emotion: "excited", exaggeration: 1.5 }, w, t).stretch).toBeGreaterThan(0);
  });
  it("eye direction moves the gaze toward the target", () => {
    const p = direct(NEUTRAL, { ...base, emotion: "neutral", eyes: "partner" });
    const d = direct(NEUTRAL, { ...base, emotion: "neutral", eyes: "down" });
    expect(p.gazeX).toBeGreaterThan(0.5);
    expect(d.gazeY).toBeGreaterThan(0.5);
  });
  it("neutral direction at rest is the neutral pose", () => {
    expect(samplePose({ ...base, emotion: "neutral" }, w, 0)).toEqual(direct(NEUTRAL, { ...base, emotion: "neutral" }));
  });
});

describe("lip sync and blinks", () => {
  it("the mouth is open inside words and closed in the pause before “great”", () => {
    const { words, visemes } = takes.sarcastic;
    const inGreat = mouthAt(visemes, (words[3].start + words[3].end) / 2 + 0.05).open;
    const pause = mouthAt(visemes, (words[2].end + words[3].start) / 2 + 0.05).open;
    expect(inGreat).toBeGreaterThan(0.3);
    expect(pause).toBeLessThan(0.1);
  });
  it("every emotion defines at least one blink, inside the performance", () => {
    for (const e of EMOTIONS) {
      expect(PERFORMANCES[e].blinks.length).toBeGreaterThan(0);
      const w = takes[e].words;
      const peaks = Array.from({ length: 600 }, (_, i) => blinkAt(e, w, i / 100));
      expect(Math.max(...peaks)).toBeGreaterThan(0.9);
    }
  });
});
