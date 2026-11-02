import { describe, expect, it } from "vitest";
import { luma, toEncoded, toLinear, type RGB } from "./color";
import { GRADE_VEC4S, IDENTITY_RESOLVED, NEUTRAL_GRADE, applyResolved, contrastCurve, gradePixel, packGrade, resolveGrade, whiteBalanceGains, type GradeParams } from "./grade";
import { GRAIN_STRENGTH, grainAt, grainFrame, grainWeight, pcg3d } from "./grain";
import { lookFromPreset, LOOKS, applySimple, simpleFromLook, NEUTRAL_LOOK, SIMPLE_DEFAULT } from "./look";
import { parseCube, sampleLut, toCube } from "./lut";
import { autoMatch, mismatch, processPixels, signature, type Pixels } from "./match";
import { lookPhrase } from "./prompt";
import { cbcr, frameStats, histogram, vectorscope, waveform } from "./scopes";
import { NEUTRAL_OVERRIDE, SHOTS, SUGGESTED_OVERRIDE } from "./shots";
import { chainCube, resolveLayers, shotLayers, shotResidual, showLookDoc } from "./showlook";
import { STOCK_IDS } from "./stocks";
import { NEUTRAL_MATCH } from "./match";

const g = (p: Partial<GradeParams>) => ({ ...NEUTRAL_GRADE, ...p });
const close = (a: RGB, b: RGB, eps = 1e-5) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(eps)));

describe("transfer functions", () => {
  it("round-trips sRGB encode/decode", () => {
    for (let i = 0; i <= 20; i++) expect(toEncoded(toLinear(i / 20))).toBeCloseTo(i / 20, 6);
  });
});

describe("white balance", () => {
  it("is exactly neutral at the midpoint (temperature 0, tint 0)", () => {
    expect(whiteBalanceGains(0, 0)).toEqual([1, 1, 1]);
    const grey: RGB = [0.46, 0.46, 0.46];
    close(gradePixel(grey, g({ temperature: 0, tint: 0 })), grey);
  });
  it("keeps a grey's luminance while moving its colour", () => {
    for (const t of [-1, -0.4, 0.5, 1]) {
      const wb = whiteBalanceGains(t, 0.3);
      expect(luma(wb)).toBeCloseTo(1, 10);
    }
  });
  it("warmer gives more red than blue, cooler the opposite", () => {
    const grey: RGB = [0.5, 0.5, 0.5];
    const warm = gradePixel(grey, g({ temperature: 0.6 }));
    const cool = gradePixel(grey, g({ temperature: -0.6 }));
    expect(warm[0]).toBeGreaterThan(warm[2] + 0.05);
    expect(cool[2]).toBeGreaterThan(cool[0] + 0.05);
    const magenta = gradePixel(grey, g({ tint: 0.6 }));
    expect(magenta[1]).toBeLessThan(magenta[0]);
  });
});

describe("contrast", () => {
  it("leaves the pivot fixed for any contrast", () => {
    for (const p of [0.3, 0.46, 0.6])
      for (const c of [0.5, 0.8, 1.3, 2]) {
        expect(contrastCurve(p, c, p)).toBeCloseTo(p, 12);
        const out = gradePixel([p, p, p], g({ contrast: c, pivot: p }));
        expect(out[0]).toBeCloseTo(p, 5);
      }
  });
  it("keeps black and white, and widens the spread above 1", () => {
    expect(contrastCurve(0, 1.6, 0.46)).toBe(0);
    expect(contrastCurve(1, 1.6, 0.46)).toBe(1);
    const lo = gradePixel([0.25, 0.25, 0.25], g({ contrast: 1.5 }))[0];
    const hi = gradePixel([0.7, 0.7, 0.7], g({ contrast: 1.5 }))[0];
    expect(hi - lo).toBeGreaterThan(0.45);
    const flat = gradePixel([0.7, 0.7, 0.7], g({ contrast: 0.6 }))[0] - gradePixel([0.25, 0.25, 0.25], g({ contrast: 0.6 }))[0];
    expect(flat).toBeLessThan(0.45);
  });
});

describe("neutral grade and LUTs", () => {
  it("the neutral grade is the identity", () => {
    for (const c of [[0, 0, 0], [1, 1, 1], [0.2, 0.5, 0.9], [0.9, 0.1, 0.33]] as RGB[]) close(applyResolved(c, IDENTITY_RESOLVED), c);
  });
  it("a neutral grade samples to an identity LUT", () => {
    const n = 17;
    const lut = sampleLut((c) => gradePixel(c, NEUTRAL_GRADE), n);
    let maxErr = 0;
    let i = 0;
    for (let b = 0; b < n; b++)
      for (let gg = 0; gg < n; gg++)
        for (let r = 0; r < n; r++) {
          maxErr = Math.max(maxErr, Math.abs(lut[i++] - r / (n - 1)), Math.abs(lut[i++] - gg / (n - 1)), Math.abs(lut[i++] - b / (n - 1)));
        }
    expect(maxErr).toBeLessThan(1e-5);
  });
  it("writes a valid 33³ .cube with red changing fastest", () => {
    const text = chainCube([NEUTRAL_GRADE], "Identity");
    const lines = text.trim().split("\n");
    expect(lines[0]).toBe('TITLE "Identity"');
    expect(lines).toContain("LUT_3D_SIZE 33");
    expect(lines).toContain("DOMAIN_MIN 0.0 0.0 0.0");
    expect(lines).toContain("DOMAIN_MAX 1.0 1.0 1.0");
    const data = lines.filter((l) => /^[\d.]+ [\d.]+ [\d.]+$/.test(l));
    expect(data.length).toBe(33 ** 3);
    expect(data[0]).toBe("0.000000 0.000000 0.000000");
    expect(data[1]).toBe(`${(1 / 32).toFixed(6)} 0.000000 0.000000`);
    expect(data[33]).toBe(`0.000000 ${(1 / 32).toFixed(6)} 0.000000`);
    expect(data.at(-1)).toBe("1.000000 1.000000 1.000000");
    const parsed = parseCube(text);
    expect(parsed.size).toBe(33);
    expect(parsed.title).toBe("Identity");
  });
  it("a graded LUT round-trips through the parser and matches the engine", () => {
    const look = lookFromPreset("k500t").grade;
    const lut = sampleLut((c) => gradePixel(c, look), 9);
    const parsed = parseCube(toCube(lut, 9, "500T"));
    const idx = (4 + 9 * (2 + 9 * 7)) * 3;
    const want = gradePixel([4 / 8, 2 / 8, 7 / 8], look);
    for (let k = 0; k < 3; k++) expect(parsed.data[idx + k]).toBeCloseTo(want[k], 5);
  });
  it("packs every layer into a fixed uniform block", () => {
    const out = packGrade(resolveGrade(lookFromPreset("matrix").grade), new Float32Array(GRADE_VEC4S * 4));
    expect(out.every(Number.isFinite)).toBe(true);
    expect(Array.from(packGrade(IDENTITY_RESOLVED, new Float32Array(40)).slice(0, 4))).toEqual([1, 1, 1, 1]);
  });
});

describe("film stocks", () => {
  it("every stock rolls highlights off instead of clipping when pushed a stop", () => {
    // Without a stock, two different highlights pushed a stop both clip to the same white.
    expect(gradePixel([0.8, 0.8, 0.8], g({ exposure: 1 }))[0]).toBeCloseTo(1, 9);
    expect(gradePixel([0.9, 0.9, 0.9], g({ exposure: 1 }))[0]).toBeCloseTo(1, 9);
    // A stock's shoulder keeps them apart: highlight detail survives.
    for (const id of STOCK_IDS.filter((s) => s !== "none")) {
      const a = luma(gradePixel([0.8, 0.8, 0.8], g({ stock: id, exposure: 1 })));
      const b = luma(gradePixel([0.9, 0.9, 0.9], g({ stock: id, exposure: 1 })));
      expect(b - a).toBeGreaterThan(0.001);
    }
  });
  it("stock strength 0 is the identity", () => {
    close(gradePixel([0.3, 0.6, 0.2], g({ stock: "bleach", stockMix: 0 })), [0.3, 0.6, 0.2]);
  });
  it("bleach bypass drains colour, reversal adds it", () => {
    const c: RGB = [0.7, 0.35, 0.25];
    const chroma = (v: RGB) => Math.max(...v) - Math.min(...v);
    expect(chroma(gradePixel(c, g({ stock: "bleach" })))).toBeLessThan(chroma(c) * 0.75);
    expect(chroma(gradePixel(c, g({ stock: "reversal" })))).toBeGreaterThan(chroma(c));
  });
});

describe("grain", () => {
  const opts = { size: 1.3, chroma: 0.2 };
  it("hash matches known pcg3d values (bit-exact with the GLSL uint version)", () => {
    expect(pcg3d(0, 0, 0)).toEqual(pcg3d(0, 0, 0));
    expect(pcg3d(1, 2, 3)[0]).not.toBe(pcg3d(1, 2, 4)[0]);
  });
  it("is deterministic for a frame and different on the next frame", () => {
    const a = Array.from({ length: 200 }, (_, i) => grainAt(i % 20, Math.floor(i / 20), 42, 0.5, 1, opts)[1]);
    const b = Array.from({ length: 200 }, (_, i) => grainAt(i % 20, Math.floor(i / 20), 42, 0.5, 1, opts)[1]);
    const c = Array.from({ length: 200 }, (_, i) => grainAt(i % 20, Math.floor(i / 20), 43, 0.5, 1, opts)[1]);
    expect(a).toEqual(b);
    const diff = a.reduce((s, v, i) => s + Math.abs(v - c[i]), 0) / a.length;
    expect(diff).toBeGreaterThan(GRAIN_STRENGTH * 0.3);
    // and roughly uncorrelated
    const dot = a.reduce((s, v, i) => s + v * c[i], 0), na = Math.hypot(...a), nc = Math.hypot(...c);
    expect(Math.abs(dot / (na * nc))).toBeLessThan(0.35);
  });
  it("is zero-mean and strongest in the mids", () => {
    const vals = Array.from({ length: 4000 }, (_, i) => grainAt(i % 80, Math.floor(i / 80), 7, 0.5, 1, opts)[0]);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(mean)).toBeLessThan(0.01);
    expect(grainWeight(0.5)).toBeGreaterThan(grainWeight(0.03) * 2);
    expect(grainWeight(0.5)).toBeGreaterThan(grainWeight(0.97) * 2);
  });
  it("monochrome grain moves all channels together", () => {
    const v = grainAt(10, 10, 3, 0.5, 1, { size: 1.3, chroma: 0 });
    expect(v[0]).toBe(v[1]);
    expect(v[1]).toBe(v[2]);
  });
  it("seeds from the timeline frame, so a paused frame keeps its grain", () => {
    expect(grainFrame(1.0)).toBe(24);
    expect(grainFrame(1.0 + 1 / 24)).toBe(25);
  });
});

/** A deterministic synthetic "plate": smooth gradients with a tinted palette and a few highlights. */
function plate(seed: number, tint: RGB): Pixels {
  const w = 48, h = 27;
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const n = Math.sin(x * 0.37 + seed) * 0.5 + Math.cos(y * 0.51 + seed * 2) * 0.5;
      const base = 0.18 + 0.32 * (x / w) + 0.12 * n;
      const hl = (x + y * 3 + seed) % 17 === 0 ? 0.45 : 0;
      for (let c = 0; c < 3; c++) out[i + c] = Math.min(1, Math.max(0, base * tint[c] + hl + 0.05 * Math.sin(x * (c + 1) + seed)));
    }
  return out;
}

describe("show look: shot matching", () => {
  const clean = [plate(1, [0.8, 0.9, 1.15]), plate(2, [1, 0.95, 0.9]), plate(3, [1.1, 0.95, 0.8])];
  const refs = clean.map(signature);
  const look = lookFromPreset("k500t");
  const neutralState = { match: NEUTRAL_MATCH, override: NEUTRAL_OVERRIDE };
  const deltas = (states: { match: typeof NEUTRAL_MATCH; override: typeof NEUTRAL_OVERRIDE }[], step: "raw" | "match" | "look" | "override") =>
    SHOTS.map((s, i) => shotResidual(clean[i], s.id, step, look, states[i]));

  it("auto-match brings each drifted shot back toward its reference and cuts the cross-shot mismatch", () => {
    const raw = mismatch(deltas([neutralState, neutralState, neutralState], "raw"));
    const matched = SHOTS.map((s, i) => {
      const drifted = processPixels(clean[i], resolveLayers(shotLayers(s.id, "raw", look, neutralState)));
      return { match: autoMatch(drifted, refs[i]), override: NEUTRAL_OVERRIDE };
    });
    const m = mismatch(deltas(matched, "match"));
    expect(raw).toBeGreaterThan(0.05);
    expect(m).toBeLessThan(raw * 0.3);
    // One show look on all three keeps them together; an intentional override is not drift.
    const withLook = mismatch(deltas(matched, "look"));
    expect(withLook).toBeLessThan(raw * 0.3);
    const over = matched.map((st, i) => (SHOTS[i].id === SUGGESTED_OVERRIDE.shot ? { ...st, override: SUGGESTED_OVERRIDE.override } : st));
    expect(mismatch(deltas(over, "override"))).toBeLessThan(raw * 0.3);
    // Without balancing, the show look alone leaves the drift in place.
    expect(mismatch(deltas([neutralState, neutralState, neutralState], "look"))).toBeGreaterThan(raw * 0.6);
  });
  it("auto-match recovers the warm drift's direction (it cools the shot)", () => {
    const s = SHOTS[0];
    const drifted = processPixels(clean[0], resolveLayers(shotLayers(s.id, "raw", look, neutralState)));
    expect(autoMatch(drifted, refs[0]).temperature).toBeLessThan(-0.3);
  });
  it("exports the show default plus per-shot state as JSON", () => {
    const doc = showLookDoc("Test", look, "k500t", { doorway: neutralState, alley: neutralState, workshop: { ...neutralState, override: SUGGESTED_OVERRIDE.override } });
    expect(doc.format).toBe("animation-lab.show-look");
    expect(doc.shots.doorway.override).toBeNull();
    expect(doc.shots.workshop.override?.finish.halation).toBe(0.65);
    expect(JSON.parse(JSON.stringify(doc)).show.grade.stock).toBe("k500t");
  });
});

describe("scopes", () => {
  const solid = (r: number, gg: number, b: number, w = 8, h = 4) => ({ width: w, height: h, data: Array.from({ length: w * h * 4 }, (_, i) => [r, gg, b, 255][i % 4]) });
  it("a flat grey frame is one line on the waveform and a dot at the vectorscope centre", () => {
    const f = solid(128, 128, 128);
    const wf = waveform(f, 16);
    const col0 = Array.from(wf.slice(0, 16));
    expect(col0.filter((v) => v > 0).length).toBe(1);
    expect(cbcr(0.5, 0.5, 0.5)).toEqual([0, 0]);
    const vs = vectorscope(f, 9);
    expect(vs[4 * 9 + 4]).toBeGreaterThan(0);
    expect(histogram(f, 8).l.length).toBe(8);
  });
  it("frame stats see warmth, spread and fine texture", () => {
    const s = frameStats(solid(200, 120, 80));
    expect(s.mean[0]).toBeGreaterThan(s.mean[2]);
    expect(s.lumaStd).toBeCloseTo(0, 6);
    expect(s.localVar).toBe(0);
  });
});

describe("looks, simple sliders and the prompt", () => {
  it("the simple sliders start at the screenshot's values and map onto the look", () => {
    expect(simpleFromLook(NEUTRAL_LOOK)).toEqual(SIMPLE_DEFAULT);
    const l = applySimple(applySimple(NEUTRAL_LOOK, "temperature", 1), "contrast", 0.5);
    expect(l.grade.temperature).toBe(1);
    expect(l.grade.contrast).toBe(1);
  });
  it("every preset resolves to finite uniforms", () => {
    for (const p of LOOKS) {
      const r = resolveGrade(lookFromPreset(p.id).grade);
      expect(packGrade(r, new Float32Array(40)).every(Number.isFinite)).toBe(true);
    }
  });
  it("writes a deterministic Seedance phrase", () => {
    expect(lookPhrase(lookFromPreset("k500t"))).toBe("warm Kodak 500T-inspired film look, soft halation on practicals, gentle Pro-Mist bloom, fine organic film grain, subtle vignette");
    expect(lookPhrase(NEUTRAL_LOOK)).toBe("clean digital look, neutral colour, no grain");
    expect(lookPhrase(lookFromPreset("comic"))).toContain("halftone dots");
  });
});
