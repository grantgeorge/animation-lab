import { describe, expect, it } from "vitest";
import { presetCurves } from "./bezier";
import { buildVariants } from "./comparisons";
import { DEFAULT_PARAMS, type MotionParams } from "./params";
import { poseAt, poseContext, sampleFrames } from "./pose";
import { deform, halfHeight, volume } from "./squash";
import { buildTimeline } from "./timeline";

const base: MotionParams = { ...DEFAULT_PARAMS };

describe("squash & stretch", () => {
  it("preserves volume along any axis", () => {
    for (const s of [0.5, 0.8, 1, 1.3, 1.7]) for (const a of [0, 0.4, -1.1, Math.PI / 2]) expect(volume(deform(s, a))).toBeCloseTo(1, 9);
  });

  it("squashes on the impact frame and stretches on the fast frames around it", () => {
    const ctx = poseContext(buildTimeline({ ...base, squash: 1 }));
    const c = ctx.tl.contacts[0];
    const hit = poseAt(ctx, c.frame);
    const before = poseAt(ctx, c.frame - 1);
    const after = poseAt(ctx, c.frame + c.frames);
    expect(hit.phase).toBe("contact");
    expect(hit.impact).toBe(true);
    expect(hit.deform.stretch).toBeLessThan(0.7);
    expect(hit.deform.girth).toBeGreaterThan(1.15);
    expect(before.deform.stretch).toBeGreaterThan(1.2);
    expect(after.deform.stretch).toBeGreaterThan(1.1);
    expect(hit.blink).toBe(1);
  });

  it("is rigid with squash 0 (except the anticipation crouch)", () => {
    const tl = buildTimeline({ ...base, squash: 0, anticipation: 0 });
    for (const p of sampleFrames(poseContext(tl))) expect(p.deform.stretch).toBeCloseTo(1, 9);
  });

  it("never pushes the deformed body through the floor", () => {
    const ctx = poseContext(buildTimeline({ ...base, squash: 1 }));
    for (const p of sampleFrames(ctx)) expect(p.cy - halfHeight(p.deform)).toBeGreaterThanOrEqual(-1e-9);
  });

  it("stretch axis follows the velocity", () => {
    const ctx = poseContext(buildTimeline({ ...base, squash: 1 }));
    const a = ctx.tl.arcs[0];
    const falling = poseAt(ctx, a.land - 1);
    // Falling forward (+x, −y): the axis tilts back at the top (negative angle from vertical).
    expect(falling.vy).toBeLessThan(0);
    expect(falling.deform.axis).toBeLessThan(0);
    expect(falling.lookY).toBeLessThan(-0.5);
  });
});

describe("anticipation & follow-through", () => {
  it("crouches before takeoff and the crouch deepens with amount", () => {
    const deep = poseContext(buildTimeline({ ...base, anticipation: 1, anticipationFrames: 10 }));
    const light = poseContext(buildTimeline({ ...base, anticipation: 0.3, anticipationFrames: 10 }));
    const f = deep.tl.takeoffFrame - 1;
    expect(poseAt(deep, f).phase).toBe("antic");
    expect(poseAt(deep, f).deform.stretch).toBeLessThan(poseAt(light, f).deform.stretch);
    expect(poseAt(deep, f).lean).toBeLessThan(0);
  });

  it("antenna lags after impacts and is still at the loop seam", () => {
    const ctx = poseContext(buildTimeline(base));
    const c = ctx.tl.contacts[0];
    const swing = Math.max(...[1, 2, 3, 4].map((k) => Math.abs(poseAt(ctx, c.frame + k).antenna)));
    expect(swing).toBeGreaterThan(0.1);
    expect(Math.abs(poseAt(ctx, ctx.tl.totalFrames - 1).antenna)).toBeLessThan(0.05);
    expect(Math.abs(poseAt(ctx, 0).antenna)).toBe(0);
    const rigid = poseContext(buildTimeline({ ...base, followThrough: 0 }));
    expect(poseAt(rigid, c.frame + 2).antenna).toBe(0);
  });

  it("is deterministic", () => {
    const a = sampleFrames(poseContext(buildTimeline(base)));
    const b = sampleFrames(poseContext(buildTimeline(base)));
    expect(a).toEqual(b);
  });
});

describe("frame sampling", () => {
  it("on twos holds every other drawing but always draws impacts", () => {
    const ctx = poseContext(buildTimeline({ ...base, onTwos: true }));
    const frames = sampleFrames(ctx);
    const impacts = new Set(ctx.tl.contacts.map((c) => c.frame));
    for (let f = 1; f < frames.length; f += 2) {
      if (impacts.has(f)) expect(frames[f].impact).toBe(true);
      else expect(frames[f].cy).toBe(frames[f - 1].cy);
    }
  });
});

describe("comparisons", () => {
  it("both sides share length; anticipation sides take off on the same frame", () => {
    for (const id of ["easing", "weight", "anticipation", "squash"] as const) {
      const [a, b] = buildVariants(base, id);
      expect(a.timeline.totalFrames).toBe(b.timeline.totalFrames);
    }
    const [a, b] = buildVariants(base, "anticipation");
    expect(a.params.anticipation).toBe(0);
    expect(b.params.anticipation).toBeGreaterThan(0.7);
    expect(a.timeline.takeoffFrame).toBe(b.timeline.takeoffFrame);
  });

  it("each comparison changes only its variable", () => {
    const [a, b] = buildVariants(base, "easing");
    expect(a.params.rise).toEqual(presetCurves("linear").rise);
    expect(b.params.rise).toEqual(presetCurves("gravity").rise);
    expect(a.params.squash).toBe(b.params.squash);
    const [sa, sb] = buildVariants(base, "squash");
    expect([sa.params.squash, sb.params.squash]).toEqual([0, 1]);
    const [wa, wb] = buildVariants(base, "weight");
    expect(wa.params.weight).toBe("bowling");
    expect(wb.params.weight).toBe("beach");
    expect(wb.timeline.arcs.length).toBeGreaterThan(wa.timeline.arcs.length);
  });

  it("free play builds a single variant", () => {
    expect(buildVariants(base, null).map((v) => v.id)).toEqual(["main"]);
  });
});
