import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { amountToLight, bandEdges, bandIndex, countPlateaus, DEFAULT_RAMP, lightToAmount, rampCurve, rampValue } from "./ramp";
import { hashInt3, patchValue, periodicNoise2, screenSample, surfaceSample, valueNoise3 } from "./noise";
import { strokeLayout, TILE_LAYOUT, wrapOffsets } from "./strokes";
import { boilDrawing, frameIndex, seedOffset } from "./seeds";
import { meanStretch, offsetPose, projectUv, singularValues2, stretchAt, viewProjection, type CamPose, type SurfacePoint } from "./projection";
import { cellMeans, crawlBetween, ema } from "./crawl";
import { artStylePrompt, finishingPrompt } from "./prompt";
import { buildUp, DEFAULT_PARAMS, stepOf } from "./types";

describe("ramp banding", () => {
  const hard = { ...DEFAULT_RAMP, soft: 0 };
  it.each([2, 3, 4])("%i bands give exactly that many painted values", (bands) => {
    const values = rampCurve({ ...hard, bands }, 401).map((s) => s.banded);
    expect(countPlateaus(values)).toBe(bands);
  });
  it("is monotonic and spans qMin..qMax", () => {
    const c = rampCurve(DEFAULT_RAMP, 200);
    for (let i = 1; i < c.length; i++) expect(c[i].banded).toBeGreaterThanOrEqual(c[i - 1].banded - 1e-12);
    expect(c[0].banded).toBeCloseTo(DEFAULT_RAMP.qMin, 6);
    expect(c.at(-1)!.banded).toBeCloseTo(DEFAULT_RAMP.qMax, 6);
  });
  it("is flat inside a band (the gradient is gone) and steps at the edges", () => {
    const [e1] = bandEdges(hard);
    expect(rampValue(e1 - 0.05, hard)).toBe(rampValue(e1 - 0.15, hard));
    expect(rampValue(e1 + 0.01, hard)).toBeGreaterThan(rampValue(e1 - 0.01, hard));
    expect(bandIndex(0.01, hard)).toBe(0);
    expect(bandIndex(0.99, hard)).toBe(hard.bands - 1);
  });
  it("soft edges stay between the neighbouring plateaus", () => {
    const [e1] = bandEdges(DEFAULT_RAMP);
    const v = rampValue(e1, DEFAULT_RAMP);
    expect(v).toBeGreaterThan(DEFAULT_RAMP.qMin);
    expect(v).toBeLessThan(rampValue(e1 + 0.05, DEFAULT_RAMP));
  });
  it("light ↔ amount mapping round-trips", () => {
    for (const L of [0.05, 0.3, 0.8, 2]) expect(amountToLight(lightToAmount(L, 0.3), 0.3)).toBeCloseTo(L, 6);
  });
});

describe("brush noise in surface coordinates", () => {
  it("is deterministic and in [0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const p = [Math.sin(i) * 9, Math.cos(i * 1.3) * 7, i * 0.37] as const;
      const a = valueNoise3(...p, 3);
      expect(a).toBe(valueNoise3(...p, 3));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
    expect(hashInt3(1, 2, 3)).toBe(hashInt3(1, 2, 3));
    expect(hashInt3(1, 2, 3)).not.toBe(hashInt3(1, 2, 4));
  });
  it("tiles with its period", () => {
    expect(periodicNoise2(0.3, 0.7, 8)).toBeCloseTo(periodicNoise2(8.3, 16.7, 8), 12);
  });
  it("surface paint moves with the object; screen paint does not", () => {
    const restPoints = Array.from({ length: 64 }, (_, i) => new Vector3(Math.sin(i) * 0.12, 1.5 + Math.cos(i * 0.7) * 0.1, Math.sin(i * 2.1) * 0.1));
    const vp = viewProjection({ position: [0, 1.5, 1.2], target: [0, 1.5, 0], fovDeg: 30, aspect: 1 });
    const pose = (yawDeg: number) => new Matrix4().compose(new Vector3(0, 0, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (yawDeg * Math.PI) / 180), new Vector3(1, 1, 1));
    let surfaceChanged = 0;
    let screenChanged = 0;
    for (const r of restPoints) {
      const m0 = pose(0), m1 = pose(25);
      const w0 = r.clone().applyMatrix4(m0), w1 = r.clone().applyMatrix4(m1);
      if (surfaceSample(w0, m0, 40) !== surfaceSample(w1, m1, 40)) surfaceChanged++;
      if (screenSample(w0, vp, 0.08, [800, 800]) !== screenSample(w1, vp, 0.08, [800, 800])) screenChanged++;
    }
    expect(surfaceChanged).toBe(0);
    expect(screenChanged).toBeGreaterThan(restPoints.length * 0.3);
  });
  it("patches are terraced into a few colour blocks", () => {
    const vals = new Set<number>();
    for (let i = 0; i < 500; i++) vals.add(patchValue(new Vector3(i * 0.13, i * 0.07, i * 0.05), 2));
    expect(vals.size).toBeLessThanOrEqual(4);
  });
});

describe("brush tile layout", () => {
  it("is deterministic per seed", () => {
    expect(strokeLayout()).toEqual(strokeLayout());
    expect(strokeLayout({ ...TILE_LAYOUT, seed: 8 })[0]).not.toEqual(strokeLayout()[0]);
  });
  it("repeats border strokes so the tile wraps", () => {
    const s = { ...strokeLayout()[0], x: 5, y: 250, length: 80, width: 20 };
    expect(wrapOffsets(s, 512)).toContainEqual([512, 0]);
    expect(wrapOffsets({ ...s, x: 256 }, 512)).toEqual([[0, 0]]);
  });
});

describe("test seeds", () => {
  it("surface never changes, random changes every 24 fps frame", () => {
    expect(seedOffset("surface", 1.234)).toEqual([0, 0, 0]);
    expect(seedOffset("random", 1 / 24 + 0.001)).not.toEqual(seedOffset("random", 2 / 24 + 0.001));
    expect(seedOffset("random", 1 / 24 + 0.001)).toEqual(seedOffset("random", 1 / 24 + 0.02));
  });
  it("boil holds each drawing for two frames and cycles three drawings", () => {
    const d = Array.from({ length: 12 }, (_, f) => boilDrawing(f, 2));
    expect(d).toEqual([0, 0, 1, 1, 2, 2, 0, 0, 1, 1, 2, 2]);
    expect(seedOffset("boil", 0.01)).toEqual(seedOffset("boil", 6 / 24 + 0.01));
    expect(frameIndex(1)).toBe(24);
  });
});

describe("projection stretch", () => {
  const projector: CamPose = { position: [-0.1, 1.5, 1.0], target: [0.1, 1.3, -3.4], fovDeg: 38, aspect: 16 / 9 };
  const samples: SurfacePoint[] = [
    { p: [0.3, 1.8, -5.6], n: [0, 0, 1] },
    { p: [-1.2, 1.2, -5.6], n: [0, 0, 1] },
    { p: [0.2, 0, -3.0], n: [0, 1, 0] },
    { p: [-0.8, 0, -4.2], n: [0, 1, 0] },
    { p: [-2.39, 1.3, -3.4], n: [1, 0, 0] },
  ];
  it("is exactly 1 from the projector", () => {
    for (const s of samples) {
      const r = stretchAt(projector, projector, s.p, s.n);
      expect(r.visible).toBe(true);
      expect(r.anisotropy).toBeCloseTo(1, 4);
      expect(r.magnification).toBeCloseTo(1, 4);
    }
  });
  it("grows as the camera swings off the projector", () => {
    const pivot = [0, 1.2, -3.4] as const;
    const at = (yaw: number) => meanStretch(projector, offsetPose(projector, pivot, yaw, yaw * 0.01), samples).stretch;
    expect(at(0)).toBeCloseTo(1, 4);
    expect(at(15)).toBeGreaterThan(at(0) + 0.01);
    expect(at(35)).toBeGreaterThan(at(15));
  });
  it("offsetPose(0) is the projector and projectUv centres the target", () => {
    offsetPose(projector, [0, 1.2, -3.4], 0).position.forEach((v, i) => expect(v).toBeCloseTo(projector.position[i], 9));
    const q = projectUv(viewProjection(projector), projector.target);
    expect(q.u).toBeCloseTo(0.5, 6);
    expect(q.v).toBeCloseTo(0.5, 6);
  });
  it("singular values of a scale-shear", () => {
    const [a, b] = singularValues2(3, 0, 0, 1);
    expect(a).toBeCloseTo(3);
    expect(b).toBeCloseTo(1);
  });
});

/** Synthetic frames: a band of "surface" that slides right by `shift` px between frames. */
function synth(width: number, height: number, shift: number, shade: (surfaceX: number, px: number, py: number) => number) {
  const coords = new Uint8Array(width * height * 4);
  const image = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const sx = x - shift;
      if (sx >= 8 && sx < width - 16) {
        const cell = Math.floor(sx / 4) + Math.floor(y / 4) * 64;
        coords[i] = cell & 255;
        coords[i + 1] = (cell >> 8) & 255;
        coords[i + 2] = 0;
        coords[i + 3] = 255;
      }
      const v = Math.round(255 * shade(sx, x, y));
      image[i] = image[i + 1] = image[i + 2] = v;
      image[i + 3] = 255;
    }
  return { coords, image };
}

describe("crawl metric on synthetic frames", () => {
  const W = 96, H = 48;
  // stroke-sized stripes (8 px period) over 4 px surface cells; the surface slides 1 px per frame
  const stripes = (u: number) => (((Math.floor(u / 4) % 2) + 2) % 2 ? 0.75 : 0.3);
  it("ranks surface-attached < screen-space < per-frame random", () => {
    const attached = crawlBetween(synth(W, H, 0, (sx) => stripes(sx)), synth(W, H, 1, (sx) => stripes(sx))).crawl;
    const screen = crawlBetween(synth(W, H, 0, (_s, px) => stripes(px)), synth(W, H, 1, (_s, px) => stripes(px))).crawl;
    // per-frame random: the same kind of strokes, re-laid with a new random phase each frame
    const phase = (frame: number, py: number) => Math.floor(hashInt3(frame, Math.floor(py / 4), 11) * 8);
    const random = crawlBetween(synth(W, H, 0, (_s, px, py) => stripes(px + phase(0, py))), synth(W, H, 1, (_s, px, py) => stripes(px + phase(1, py)))).crawl;
    expect(attached).toBeLessThan(0.5);
    expect(screen).toBeGreaterThan(attached + 5);
    expect(random).toBeGreaterThan(screen);
  });
  it("subtracts change the clean render also shows (lighting)", () => {
    const lit = (k: number) => (sx: number) => 0.4 + 0.1 * k + 0.0 * sx;
    const a = synth(W, H, 0, lit(0));
    const b = synth(W, H, 1, lit(1));
    const ex = crawlBetween(a, b, { a: a.image, b: b.image }, { mode: "excess" });
    expect(ex.raw).toBeGreaterThan(5);
    expect(ex.crawl).toBeCloseTo(0, 6);
    // residual mode: stylisation = clean + attached stripes; the lighting change cancels
    const paintA = synth(W, H, 0, (sx) => lit(0)(sx) + 0.3 * stripes(sx));
    const paintB = synth(W, H, 1, (sx) => lit(1)(sx) + 0.3 * stripes(sx));
    const res = crawlBetween({ coords: a.coords, image: paintA.image }, { coords: b.coords, image: paintB.image }, { a: a.image, b: b.image });
    expect(res.crawl).toBeLessThan(0.5);
    const swim = crawlBetween(
      { coords: a.coords, image: synth(W, H, 0, (sx, px) => lit(0)(sx) + 0.3 * stripes(px)).image },
      { coords: b.coords, image: synth(W, H, 1, (sx, px) => lit(1)(sx) + 0.3 * stripes(px)).image },
      { a: a.image, b: b.image },
    );
    expect(swim.crawl).toBeGreaterThan(res.crawl + 3);
  });
  it("scores only cells that moved when asked", () => {
    const a = synth(W, H, 0, (_s, px) => stripes(px));
    const still = crawlBetween(a, synth(W, H, 0, (_s, px) => stripes(px)), undefined, { width: W, minMove: 0.5 });
    expect(still.moving).toBe(0);
    const moved = crawlBetween(a, synth(W, H, 1, (_s, px) => stripes(px)), undefined, { width: W, minMove: 0.5 });
    expect(moved.moving).toBeGreaterThan(50);
    expect(moved.crawl).toBeGreaterThan(5);
  });
  it("cell means ignore uncovered pixels", () => {
    const f = synth(W, H, 0, () => 0.5);
    for (const v of cellMeans(f.coords, f.image).values()) expect(v.mean).toBeCloseTo(Math.round(127.5) / 255, 6);
  });
  it("ema starts at the first value", () => {
    expect(ema(null, 4)).toBe(4);
    expect(ema(4, 8, 0.5)).toBe(6);
  });
});

describe("prompts and build-up", () => {
  it("splits art style (generation) from finishing (post)", () => {
    const all = buildUp(5);
    const art = artStylePrompt(all, DEFAULT_PARAMS);
    expect(art).toMatch(/hand-painted character textures/);
    expect(art).toMatch(/graphic shadow shapes/);
    expect(art).not.toMatch(/grain/);
    expect(finishingPrompt(all, DEFAULT_PARAMS)).toMatch(/paper texture/);
    expect(finishingPrompt(buildUp(4), DEFAULT_PARAMS)).toMatch(/none/);
    expect(artStylePrompt(buildUp(0), DEFAULT_PARAMS)).toMatch(/clean/);
  });
  it("build-up steps round-trip", () => {
    for (let k = 0; k <= 5; k++) expect(stepOf(buildUp(k))).toBe(k);
    expect(stepOf({ ...buildUp(0), shading: true })).toBeNull();
  });
});
