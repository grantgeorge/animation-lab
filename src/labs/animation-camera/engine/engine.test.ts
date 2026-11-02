import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { matchOrtho, ndcOrtho, ndcPersp, pingPong, shot, subjects, type Vec3 } from "./common";
import { E1, ISO_PITCH_DEG, convergenceDeg, e1Readout, intersect, orthoFor, perspShot, rulerSegments, vanishingPoint, yawPitchOf } from "./projection";
import { E2, lensReadout, matchedDistance, matchedShot, sweepFocal } from "./lens";
import { FLAT_DEPTH, LAYERS, MOVE, REF, cardPlacement, layerParallax, moveShot, refShot, relativeSpeed } from "./multiplane";
import { aimBlend, angularVelocity, cocPx, drawingInfo, e4Focus, e4Shot, shutterOffsets, stepTime } from "./timing";
import { DEMOS, E5, cheatShots, demoFrame, faceExaggeration, pathStats, pipHeightFrac } from "./impossible";
import { MODEL_NOTES, e1Prompt, e2Prompt, e3Prompt, e4Prompt, E5_PROMPTS } from "./prompt";

describe("perspective vs orthographic", () => {
  it("matched ortho keeps Bram's on-screen size and position", () => {
    for (const view of ["street", "iso"] as const) {
      const s = perspShot(view);
      const f = orthoFor(view);
      const p = e1Readout(view, "perspective", 0);
      const o = e1Readout(view, "orthographic", 0);
      expect(o.bramFrac).toBeCloseTo(p.bramFrac, 3);
      const a: Vec3 = [-0.35, 1.47, -3.0];
      const pn = ndcPersp(s, a);
      const on = ndcOrtho(s, f, a);
      expect(on[0]).toBeCloseTo(pn[0], 6);
      expect(on[1]).toBeCloseTo(pn[1], 6);
    }
  });

  it("perspective shrinks Pip with depth; ortho shows his true height ratio", () => {
    const p = e1Readout("street", "perspective", 3.5);
    const o = e1Readout("street", "orthographic", 3.5);
    expect(o.pipToBram).toBeCloseTo(o.trueRatio, 2);
    expect(p.pipToBram).toBeLessThan(o.trueRatio * 0.92);
  });

  it("identical poles: equal in ortho, shrinking with depth in perspective", () => {
    const p = e1Readout("street", "perspective", 0);
    const o = e1Readout("street", "orthographic", 0);
    expect(Math.max(...o.poles) / Math.min(...o.poles)).toBeCloseTo(1, 6);
    expect(p.poles[0]).toBeGreaterThan(p.poles[1]);
    expect(p.poles[1]).toBeGreaterThan(p.poles[2]);
    // Perspective size ∝ 1/depth (the poles stand level, so this is exact up to pitch effects).
    expect(p.poles[0] / p.poles[2]).toBeCloseTo(p.poleDepths[2] / p.poleDepths[0], 1);
  });

  it("floor rulers converge at the vanishing point in perspective, stay parallel in ortho", () => {
    const s = perspShot("street");
    const f = orthoFor("street");
    const segs = rulerSegments(s, "perspective", f);
    const x = intersect(segs[0], segs[4])!;
    const vp = vanishingPoint(s, [0, 0, -1])!;
    expect(x[0]).toBeCloseTo(vp[0], 4);
    expect(x[1]).toBeCloseTo(vp[1], 4);
    expect(convergenceDeg(segs)).toBeGreaterThan(10);
    const o = rulerSegments(s, "orthographic", f);
    expect(intersect(o[0], o[4])).toBeNull();
    expect(convergenceDeg(o)).toBeLessThan(1e-6);
  });

  it("the isometric preset is exactly 45° around and 35.264° down", () => {
    const { yawDeg, pitchDeg } = yawPitchOf(perspShot("iso"));
    expect(Math.abs(yawDeg)).toBeCloseTo(45, 6);
    expect(pitchDeg).toBeCloseTo(-ISO_PITCH_DEG, 6);
    expect(ISO_PITCH_DEG).toBeCloseTo(35.264, 3);
  });

  it("matchOrtho is exact for an arbitrary shot", () => {
    const s = shot([1, 2, 3], [0, 1, -2], 40);
    const f = matchOrtho(s, [0, 0, -2], [0, 1.5, -2], [0, 0.8, -2]);
    const span = (P: (p: Vec3) => [number, number]) => P([0, 1.5, -2])[1] - P([0, 0, -2])[1];
    expect(span((p) => ndcOrtho(s, f, p))).toBeCloseTo(span((p) => ndcPersp(s, p)), 6);
    expect(E1.poles).toHaveLength(3);
  });
});

describe("matched framing 24 / 50 / 100", () => {
  it("holds Bram's metric while the distance scales with focal length", () => {
    const r = E2.focals.map((f) => lensReadout(matchedShot(f, 0), 0));
    for (const x of r) expect(x.metric).toBeCloseTo(E2.fraction, 2);
    expect(matchedDistance(100) / matchedDistance(24)).toBeCloseTo(100 / 24, 6);
    expect(r[2].distanceM / r[0].distanceM).toBeGreaterThan(3.8);
  });

  it("wide lens exaggerates the nose; tele compresses the background", () => {
    const [w, n, t] = E2.focals.map((f) => lensReadout(matchedShot(f, 0), 0));
    expect(w.noseToEar).toBeGreaterThan(n.noseToEar);
    expect(n.noseToEar).toBeGreaterThan(t.noseToEar);
    expect(t.noseToEar).toBeLessThan(1.1);
    expect(w.noseToEar).toBeGreaterThan(1.25);
    expect(t.doorwayRatio).toBeGreaterThan(w.doorwayRatio * 1.6);
    expect(t.windowRatio).toBeGreaterThan(w.windowRatio * 2);
    expect(t.wallWidthM).toBeLessThan(w.wallWidthM / 2.5);
  });

  it("still matches while Bram performs (camera follows his live anchor)", () => {
    for (const time of [1.1, 2.6, 4.2]) expect(lensReadout(matchedShot(35, time), time).metric).toBeCloseTo(E2.fraction, 2);
  });

  it("the dolly-zoom sweep runs 24 → 100 → 24 mm", () => {
    expect(sweepFocal(0, 6)).toBeCloseTo(24, 6);
    expect(sweepFocal(3, 6)).toBeCloseTo(100, 6);
  });
});

describe("2D vs 2.5D vs 3D", () => {
  it("cards fill the overscanned reference frustum at their depth", () => {
    const c = cardPlacement(10);
    const r = refShot();
    const corner = new Vector3(c.width / 2, c.height / 2, 0).applyQuaternion(r.quaternion).add(new Vector3(...c.center));
    const n = ndcPersp(r, [corner.x, corner.y, corner.z]);
    expect(n[0]).toBeCloseTo(REF.overscan, 5);
    expect(n[1]).toBeCloseTo(REF.overscan, 5);
  });

  it("2.5D layers slide in inverse proportion to depth; 2D layers all slide together", () => {
    const mp = layerParallax("2.5d", "track", 0.8);
    const k = mp.map((l) => l.offset * l.depthNow);
    for (const v of k) expect(v).toBeCloseTo(k[0], 6);
    expect(Math.abs(k[0])).toBeGreaterThan(0.1);
    expect(Math.abs(mp.find((l) => l.id === "fg")!.offset)).toBeGreaterThan(Math.abs(mp.find((l) => l.id === "sky")!.offset) * 3);
    const real = layerParallax("3d", "track", 0.8).map((l) => l.offset * l.depthNow);
    for (const v of real) expect(v).toBeCloseTo(k[0], 6);
    const flat = layerParallax("2d", "track", 0.8);
    for (const l of flat) expect(l.offset).toBeCloseTo(flat[0].offset, 6);
    for (const l of flat) expect(l.depthNow).toBeCloseTo(FLAT_DEPTH - MOVE.pushM * 0.8, 6);
  });

  it("track keeps the reference orientation; orbit keeps its radius around the pivot", () => {
    const a = moveShot("track", 0);
    const b = moveShot("track", 1);
    expect(a.quaternion.angleTo(b.quaternion)).toBeCloseTo(0, 6);
    expect(a.position.distanceTo(b.position)).toBeCloseTo(Math.hypot(2 * MOVE.trackM, MOVE.pushM), 4);
    const piv = new Vector3(...MOVE.pivot);
    const r0 = Math.hypot(moveShot("orbit", 0).position.x - piv.x, moveShot("orbit", 0).position.z - piv.z);
    const r1 = Math.hypot(moveShot("orbit", 1).position.x - piv.x, moveShot("orbit", 1).position.z - piv.z);
    expect(r0).toBeCloseTo(r1, 6);
    expect(moveShot("orbit", 0.5).position.distanceTo(refShot().position)).toBeLessThan(1e-6);
    expect(pingPong(0)).toBe(0);
    expect(pingPong(3)).toBeCloseTo(1, 9);
  });

  it("multiplane speed is inverse to depth", () => {
    expect(relativeSpeed(LAYERS[0].depth)).toBe(1);
    expect(relativeSpeed(3.2)).toBeCloseTo(14 / 3.2, 6);
    for (let i = 1; i < LAYERS.length; i++) expect(LAYERS[i].depth).toBeLessThan(LAYERS[i - 1].depth);
  });
});

describe("photoreal vs anime timing", () => {
  it("on twos holds each drawing for two frames, on threes for three", () => {
    const f = (n: number) => n / 24 + 1e-4;
    expect(stepTime(f(0), 2)).toBe(stepTime(f(1), 2));
    expect(stepTime(f(2), 2)).not.toBe(stepTime(f(1), 2));
    expect(stepTime(f(3), 3)).toBe(stepTime(f(5), 3));
    expect(stepTime(f(6), 3)).toBeCloseTo(6 / 24, 9);
    expect(stepTime(1.2345, 1)).toBe(1.2345);
    expect(drawingInfo(f(5), 2)).toMatchObject({ frame: 5, drawing: 2, held: true, drawingsPerSecond: 12 });
  });

  it("shutter samples spread across 180° of a 24 fps frame, centred", () => {
    const o = shutterOffsets(8, 180);
    expect(o).toHaveLength(8);
    expect(o[0] + o[7]).toBeCloseTo(0, 9);
    expect(o[7] - o[0]).toBeCloseTo((0.5 / 24) * (7 / 8), 9);
    expect(shutterOffsets(1, 180)).toEqual([0]);
  });

  it("circle of confusion: zero at focus, grows with aperture and distance from focus", () => {
    expect(cocPx(3, 3, 75, 1.4, 20.25, 1000)).toBeCloseTo(0, 9);
    expect(cocPx(8, 3, 75, 1.4, 20.25, 1000)).toBeGreaterThan(cocPx(8, 3, 75, 8, 20.25, 1000) * 5);
    expect(cocPx(8, 3, 75, 1.4, 20.25, 1000)).toBeGreaterThan(cocPx(5, 3, 75, 1.4, 20.25, 1000));
  });

  it("the whip pan is fast, holds are still, focus racks with the aim", () => {
    expect(aimBlend(1)).toBe(0);
    expect(aimBlend(4)).toBe(1);
    expect(angularVelocity(e4Shot, 2.7).degPerS).toBeGreaterThan(30);
    expect(angularVelocity(e4Shot, 1.0).degPerS).toBeLessThan(5);
    expect(e4Focus(4)).toBeGreaterThan(e4Focus(1));
  });
});

describe("impossible camera", () => {
  it("perspective cheat: wide and tele frame Bram the same, faces differ", () => {
    const { wide, tele } = cheatShots(0);
    const a: Vec3 = [subjects()("primary", 0).anchor[0], E5.cheat.box.top, subjects()("primary", 0).anchor[2]];
    const b: Vec3 = [a[0], E5.cheat.box.bottom, a[2]];
    const span = (s: typeof wide) => ndcPersp(s, a)[1] - ndcPersp(s, b)[1];
    expect(span(wide)).toBeCloseTo(span(tele), 1);
    expect(faceExaggeration(wide, 0)).toBeGreaterThan(faceExaggeration(tele, 0) * 1.15);
  });

  it("scale cheat keeps Pip big while the physical camera loses him", () => {
    const t = 4.4;
    const f = demoFrame("scale", t);
    expect(f.pipScale).toBeGreaterThan(1.6);
    expect(pipHeightFrac(f.shot, t, f.pipScale)).toBeGreaterThan(pipHeightFrac(f.physical, t, 1) * 1.5);
  });

  it("through the wall: the impossible path crosses it, the physical one stops", () => {
    expect(demoFrame("wall", 5.5).shot.position.z).toBeLessThan(E5.wall.wallZ - 1);
    expect(demoFrame("wall", 5.5).physical.position.z).toBeGreaterThanOrEqual(E5.wall.physicalStopZ - 1e-9);
    const inside = Array.from({ length: 600 }, (_, i) => demoFrame("wall", i / 100).insideWall).filter(Boolean).length;
    expect(inside).toBeGreaterThan(0);
  });

  it("the whip move needs tens of g; the physical whip pan stays put", () => {
    const imp = pathStats("whip", false);
    const phy = pathStats("whip", true);
    expect(imp.peakG).toBeGreaterThan(20);
    expect(phy.peakG).toBeLessThan(0.5);
    expect(imp.peakDegPerS).toBeGreaterThan(200);
  });

  it("the push ramps a fisheye bulge only on the impossible version", () => {
    expect(demoFrame("push", 4.2).fisheye).toBeCloseTo(E5.push.fisheyeMax, 6);
    expect(demoFrame("push", 1).fisheye).toBe(0);
    expect(demoFrame("push", 4.2).shot.focalMm).toBeCloseTo(E5.push.near.focalMm, 6);
    for (const d of DEMOS) expect(demoFrame(d, 3.1).demo).toBe(d);
  });
});

describe("prompts", () => {
  it("are deterministic one-liners that name the technique", () => {
    expect(e1Prompt("orthographic", "iso")).toMatch(/isometric/i);
    expect(e1Prompt("orthographic", "street")).toMatch(/no perspective convergence/i);
    expect(e2Prompt(24, 1.2, false)).toMatch(/24 mm wide-angle/);
    expect(e2Prompt(100, 4.8, false)).toMatch(/compressed background/);
    expect(e2Prompt(50, 2, true)).toMatch(/dolly zoom/i);
    expect(e3Prompt("2.5d", "track")).toMatch(/multiplane parallax/);
    expect(e3Prompt("2d", "track")).toMatch(/no parallax/);
    expect(e4Prompt("anime", 2, 1.4, true, false)).toMatch(/on twos/);
    expect(e4Prompt("photoreal", 2, 2, true, false)).toMatch(/f\/2 shallow depth of field/);
    for (const p of Object.values(E5_PROMPTS)) expect(p.length).toBeGreaterThan(40);
    expect(MODEL_NOTES.some((n) => n.verdict === "rarely")).toBe(true);
    expect(e1Prompt("perspective", "street")).toBe(e1Prompt("perspective", "street"));
  });
});
