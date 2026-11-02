import { describe, expect, it } from "vitest";
import { CAMERAS, camerasIn, getCamera, isCameraId, type CameraSpec } from "./cameras";
import { cocMm, cropFactor, extraction, FF_WIDTH_MM, FORMATS, shotGate } from "./formats";
import { curveUniforms, curveValue, headroomStops, LOOK_ORDER, LOOKS, midSlope, rawSlope, softClip } from "./looks";
import { blurDiscMm, blurInCoc, classifyDof, depthOfField, equivalentFocal, equivalentStop, ffEquivalentFocal, formatStop, hfovDeg, vfovDeg } from "./optics";
import { buildPrompt, lensPhrase } from "./prompt";
import { assignGuess, BLIND_POOL, blindRound, scoreBlind } from "./blind";
import { depthAlongAxis, markDepth, MARKS, subjectWidthFraction } from "./shot";
import { exposureS, frameTime, panPeakSpeedDegS, playbackSpeed, rowOffsetS, sampleCount, sampleTimes, shutterSpeedLabel, skewDeg } from "./shutter";
import { deriveShot, type ShotInput } from "./derive";

const S35 = FORMATS["s35-3perf"];
const FF = FORMATS.ff;
const A35 = FORMATS.alexa35;
const A265 = FORMATS.alexa265;

describe("formats", () => {
  it("measures crop factor as a width ratio against full frame", () => {
    expect(cropFactor(FF)).toBe(1);
    expect(cropFactor(S35)).toBeCloseTo(36 / 24.89, 6);
    expect(cropFactor(A265)).toBeLessThan(1);
  });
  it("scales the circle of confusion with the frame width", () => {
    expect(cocMm(FF)).toBeCloseTo(0.03, 6);
    expect(cocMm(S35)).toBeCloseTo(24.89 / 1200, 6);
  });
  it("extracts a 16:9 frame across the full width, or keeps the open gate", () => {
    expect(extraction(FF)).toEqual({ widthMm: 36, heightMm: 20.25 });
    expect(shotGate(FORMATS.imax, true).heightMm).toBeCloseTo(51.61, 2);
    expect(shotGate(FORMATS.imax, false).heightMm).toBeCloseTo(70.41 / (16 / 9), 6);
  });
});

describe("optics", () => {
  it("gives the textbook fields of view", () => {
    expect(hfovDeg(18, FF)).toBeCloseTo(90, 6);
    expect(vfovDeg(50, { widthMm: 36, heightMm: 24 })).toBeCloseTo(26.99, 1);
  });
  it("same framing: the equivalent focal keeps the field of view on every format", () => {
    for (const f of Object.values(FORMATS)) expect(hfovDeg(equivalentFocal(35, FF, f), f)).toBeCloseTo(hfovDeg(35, FF), 9);
    expect(ffEquivalentFocal(35, S35)).toBeCloseTo(50.6, 1);
  });
  it("same framing and the same aperture diameter give the same depth-of-field band (to within 0.5 %)", () => {
    const s = 3.5;
    const base = depthOfField(32, 2, s, A35);
    for (const f of [FF, FORMATS.vv, A265, FORMATS.imax]) {
      const other = depthOfField(equivalentFocal(32, A35, f), equivalentStop(2, A35, f), s, f);
      // Exact in the far-field limit; the thin-lens f terms leave a sub-percent residue.
      expect(Math.abs(other.nearM - base.nearM) / base.nearM).toBeLessThan(0.005);
      expect(Math.abs(other.farM - base.farM) / base.farM).toBeLessThan(0.005);
    }
  });
  it("teaches the rule of thumb: S35 T2 ≈ FF T2.8 ≈ 65 mm ≈ T4", () => {
    expect(equivalentStop(2, S35, FF)).toBeGreaterThan(2.7);
    expect(equivalentStop(2, S35, FF)).toBeLessThan(3);
    const t65 = equivalentStop(2, S35, FORMATS["65-5perf"]);
    expect(Math.abs(Math.log2(t65 / 4) * 2)).toBeLessThan(0.34); // within a third of a stop
  });
  it("puts the blur disc exactly at the CoC on the near and far limits", () => {
    const dof = depthOfField(50, 2.8, 4, FF);
    expect(blurInCoc(50, 2.8, 4, dof.nearM, FF)).toBeCloseTo(1, 6);
    expect(blurInCoc(50, 2.8, 4, dof.farM, FF)).toBeCloseTo(1, 6);
    expect(blurDiscMm(50, 2.8, 4, 4)).toBe(0);
  });
  it("opens up for shallower depth and goes to infinity past the hyperfocal distance", () => {
    const wide = depthOfField(50, 1.4, 4, FF);
    const deep = depthOfField(50, 8, 4, FF);
    expect(wide.totalM).toBeLessThan(deep.totalM);
    const h = depthOfField(24, 8, 1, FF).hyperfocalM;
    const atH = depthOfField(24, 8, h + 0.01, FF);
    expect(atH.farM).toBe(Infinity);
    expect(atH.nearM).toBeCloseTo(h / 2, 1);
  });
  it("classifies background blur and formats stops", () => {
    expect(classifyDof(0.5)).toBe("deep");
    expect(classifyDof(20)).toBe("very-shallow");
    expect(formatStop(2.8)).toBe("2.8");
    expect(formatStop(4)).toBe("4");
    expect(formatStop(16)).toBe("16");
  });
});

describe("shutter", () => {
  it("computes exposure from angle and frame rate", () => {
    expect(exposureS(180, 24)).toBeCloseTo(1 / 48, 12);
    expect(shutterSpeedLabel(45, 24)).toBe("1/192");
    expect(shutterSpeedLabel(360, 48)).toBe("1/48");
  });
  it("spreads the samples across the open shutter only", () => {
    const ts = sampleTimes(1, 90, 24, 8);
    expect(ts).toHaveLength(8);
    expect(ts[0]).toBeGreaterThan(1);
    expect(ts[7]).toBeLessThan(1 + exposureS(90, 24));
    const wide = sampleTimes(1, 360, 24, 8);
    expect(wide[7] - wide[0]).toBeCloseTo((ts[7] - ts[0]) * 4, 9);
  });
  it("holds frames at the capture rate and slows the clock for conformed high speed", () => {
    expect(frameTime(1.03, 24)).toBeCloseTo(1, 9);
    expect(frameTime(1.05, 24)).toBeCloseTo(25 / 24, 9);
    expect(playbackSpeed(240, true)).toBeCloseTo(0.1, 9);
    expect(playbackSpeed(48, false)).toBe(1);
  });
  it("offsets rolling-shutter rows and sizes the skew", () => {
    expect(rowOffsetS(0, 10, 0.02)).toBeCloseTo(0.001, 9);
    expect(rowOffsetS(9, 10, 0.02)).toBeCloseTo(0.019, 9);
    expect(skewDeg(panPeakSpeedDegS(), 0)).toBe(0);
    expect(sampleCount(4, true, 180)).toBe(4);
    expect(sampleCount(16, true, 180)).toBe(16);
  });
});

describe("looks", () => {
  it("are labelled as styles, never as a manufacturer's science", () => {
    for (const id of LOOK_ORDER) {
      const l = LOOKS[id];
      if (/ARRI|RED|Sony|Canon/.test(l.label)) expect(l.label).toMatch(/-style/);
    }
  });
  it("map grey to mid grey, the clip point to white, and rise monotonically", () => {
    for (const id of LOOK_ORDER) {
      const u = curveUniforms(LOOKS[id]);
      expect(curveValue(u, 0)).toBeCloseTo(LOOKS[id].midGrey, 9);
      expect(curveValue(u, LOOKS[id].clipStops)).toBeCloseTo(1, 9);
      expect(curveValue(u, LOOKS[id].clipStops + 3)).toBeCloseTo(1, 9);
      expect(midSlope(u)).toBeCloseTo(LOOKS[id].contrast, 3);
      let prev = -1;
      for (let s = -10; s <= LOOKS[id].clipStops; s += 0.25) {
        const v = curveValue(u, s);
        expect(v).toBeGreaterThan(prev);
        prev = v;
      }
      expect(curveValue(u, -14)).toBeGreaterThanOrEqual(LOOKS[id].black - 1e-3);
    }
  });
  it("gives the film-style looks more highlight headroom than the video-style looks", () => {
    const h = (id: keyof typeof LOOKS) => headroomStops(curveUniforms(LOOKS[id]));
    expect(h("naturalistic")).toBeGreaterThan(h("doc") + 1);
    expect(h("film35")).toBeGreaterThan(h("action"));
    expect(softClip(0.5, 100)).toBeCloseTo(0.5, 3);
    expect(rawSlope(LOOKS.doc)).toBeLessThanOrEqual(LOOKS.doc.contrast + 1e-9);
  });
});

describe("shot geometry", () => {
  it("measures depths along the optical axis", () => {
    expect(markDepth("lantern")).toBeLessThan(markDepth("bram"));
    expect(markDepth("bram")).toBeLessThan(markDepth("pip"));
    expect(markDepth("pip")).toBeLessThan(markDepth("wall"));
    expect(depthAlongAxis(MARKS.bram.point)).toBeGreaterThan(3);
  });
  it("same framing keeps Bram's size; same lens changes it", () => {
    const ref = subjectWidthFraction(A35, 32);
    for (const f of [FF, FORMATS.vv, A265, FORMATS.action]) {
      expect(subjectWidthFraction(f, equivalentFocal(32, A35, f))).toBeCloseTo(ref, 9);
    }
    expect(subjectWidthFraction(A265, 32)).toBeLessThan(ref * 0.6);
  });
});

describe("prompt", () => {
  it("describes controls, never brands", () => {
    for (const c of CAMERAS as readonly CameraSpec[]) {
      for (const id of LOOK_ORDER) {
        const p = buildPrompt({ format: FORMATS[c.format], film: !!c.film, focalMm: 35, tStop: 2, dof: "shallow", shutterDeg: 180, fps: 24, slowMotion: false, move: "locked", look: LOOKS[id] });
        expect(p).not.toMatch(/ALEXA|ARRI|VENICE|Sony|RED|Blackmagic|Canon|GoPro|DJI|Phantom/);
      }
    }
  });
  it("builds the example line deterministically", () => {
    const p = buildPrompt({ format: FORMATS.vv, film: false, focalMm: 35, tStop: 2, dof: "shallow", shutterDeg: 180, fps: 24, slowMotion: false, move: "locked", look: LOOKS.naturalistic });
    expect(p).toBe("shot on large-format digital, 35 mm lens (31 mm full-frame equivalent) at T2, shallow depth of field, background softly out of focus, 180° shutter, natural motion blur, soft highlight roll-off, naturalistic color and skin tones");
    expect(lensPhrase(S35, 32, 2.8)).toBe("32 mm lens (46 mm full-frame equivalent) at T2.8");
    const slow = buildPrompt({ format: FF, film: false, focalMm: 50, tStop: 4, dof: "moderate", shutterDeg: 180, fps: 240, slowMotion: true, move: "pan", look: LOOKS.action });
    expect(slow).toContain("240 fps played back at 24 fps (10× slow motion)");
    expect(slow).toContain("fast whip pan");
  });
});

describe("blind test", () => {
  it("draws three different looks, deterministically", () => {
    for (let r = 0; r < 12; r++) {
      const a = blindRound(r);
      expect(new Set(a.looks).size).toBe(3);
      expect(blindRound(r)).toEqual(a);
      for (const l of a.looks) expect(BLIND_POOL).toContain(l);
      if (r % 2 === 0) for (const l of a.looks) expect(["naturalistic", "large-format", "clean-hires"]).toContain(l);
    }
  });
  it("assigns each name once and scores the guesses", () => {
    const round = blindRound(1);
    let g = assignGuess([null, null, null], 0, round.looks[1]);
    g = assignGuess(g, 1, round.looks[1]);
    expect(g).toEqual([null, round.looks[1], null]);
    g = assignGuess(assignGuess(g, 0, round.looks[0]), 2, round.looks[2]);
    expect(scoreBlind(round, g)).toEqual({ correct: 3, total: 3, complete: true });
    expect(scoreBlind(round, [round.looks[1], round.looks[0], round.looks[2]]).correct).toBe(1);
  });
});

describe("camera catalogue", () => {
  it("covers the families the lab teaches", () => {
    expect(camerasIn("cinema")).toHaveLength(6);
    expect(camerasIn("film")).toHaveLength(2);
    expect(camerasIn("specialized")).toHaveLength(6);
    expect(new Set(CAMERAS.map((c) => c.id)).size).toBe(CAMERAS.length);
  });
  it("cites a source for every card and labels DR as a claim or its absence", () => {
    for (const c of CAMERAS) {
      expect(FORMATS[c.format]).toBeDefined();
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.url).toMatch(/^https:\/\//);
      if (c.dr !== null) expect(c.dr).toMatch(/stops/);
    }
    expect(getCamera("vraptorx").shutter).toBe("Global");
    expect(isCameraId("nope")).toBe(false);
    expect(FORMATS.ff.widthMm).toBe(FF_WIDTH_MM);
  });
});

describe("deriveShot", () => {
  const base: ShotInput = { cameraId: "alexa35", openGate: false, focalMm: 32, tStop: 2.8, focusM: markDepth("bram"), shutterDeg: 180, fps: 24, slowMotion: false, move: "locked", lookId: "naturalistic" };
  it("keeps Bram in focus and reports the equivalents", () => {
    const d = deriveShot(base);
    expect(d.blur.bram).toBeLessThan(1e-9);
    expect(d.ffFocal).toBeCloseTo(32 * (36 / 27.99), 6);
    expect(d.shutterSpeed).toBe("1/48");
    expect(d.globalShutter).toBe(false);
    expect(deriveShot({ ...base, cameraId: "vraptorx" }).skewDeg).toBe(0);
  });
  it("a wider aperture blurs the back wall more", () => {
    expect(deriveShot({ ...base, tStop: 1.4 }).blur.wall).toBeGreaterThan(deriveShot({ ...base, tStop: 8 }).blur.wall * 4);
  });
});
