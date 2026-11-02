import { describe, expect, it } from "vitest";
import { doorwayScene, getScene } from "@/labs/lens-and-framing/config";
import { clipFor } from "@/scene/animation/performances";
import { buildMove, defaultParams, dollyVsZoom, MOVE_ORDER, withPosition } from "./moves";
import { poseAt, progress, samplePath } from "./path";
import { analyzeMove, bodyFraction, movePhrase } from "./analyze";
import { makeSubjectFn, staticSubjects } from "./subject";
import { intrinsics, projectPoint } from "@/engine/projection";
import type { MoveKind } from "./types";

const d = doorwayScene;
const still = staticSubjects(d);
const live = (id: string) => {
  const s = getScene(id as "doorway");
  return makeSubjectFn(s, { primary: clipFor(id, "bram"), secondary: clipFor(id, "pip") });
};

describe("camera paths", () => {
  it.each(MOVE_ORDER.map((k) => [k]))("%s: holds its keys before t0 and after t1, eased in between", (kind) => {
    const p = defaultParams(kind as MoveKind, d);
    const m = buildMove(kind as MoveKind, p, still);
    expect(progress(m, 0)).toBe(kind === "tracking" ? 0 : 0);
    expect(progress(m, d.timeline.durationS)).toBe(1);
    const a = poseAt(m, Math.max(0, p.t0 - 0.2), still);
    const b = poseAt(m, Math.min(d.timeline.durationS, p.t1 + 0.2), still);
    if (m.interp !== "track") {
      expect(a.position.toArray()).toEqual(expect.arrayContaining([expect.closeTo(m.start.position[0], 6)]));
      expect(b.position.x).toBeCloseTo(m.end.position[0], 6);
      expect(b.position.z).toBeCloseTo(m.end.position[2], 6);
    }
    expect(samplePath(m, still, 10)).toHaveLength(11);
  });

  it("every preset frames the subject at the end of the move (a truck passes it through centre mid-move)", () => {
    for (const kind of MOVE_ORDER) {
      const p = defaultParams(kind, d);
      const m = buildMove(kind, p, still);
      const pose = poseAt(m, kind === "truck" ? (p.t0 + p.t1) / 2 : p.t1, still);
      const ndc = projectPoint(pose, intrinsics(pose.focalMm, d.gate), d.characters[p.subject].anchor).ndc;
      expect(Math.abs(ndc[0]), kind).toBeLessThan(0.2);
      expect(Math.abs(ndc[1]), kind).toBeLessThan(0.2);
    }
  });

  it("dolly zoom keeps the subject the same size while the focal length changes", () => {
    const p = defaultParams("dollyZoom", d);
    const m = buildMove("dollyZoom", p, still);
    const frac = (t: number) => bodyFraction(poseAt(m, t, still), d, still, "primary", t);
    const f0 = frac(p.t0);
    for (const t of [p.t0 + 0.7, (p.t0 + p.t1) / 2, p.t1 - 0.3, p.t1]) expect(frac(t) / f0).toBeCloseTo(1, 2);
    expect(poseAt(m, p.t1, still).focalMm / poseAt(m, p.t0, still).focalMm).toBeGreaterThan(2);
  });

  it("dolly vs zoom: same start and end framing of the subject, different background growth", () => {
    const p = defaultParams("dollyIn", d);
    const { dolly, zoom } = dollyVsZoom(p, still);
    const frac = (m: typeof dolly, t: number) => bodyFraction(poseAt(m, t, still), d, still, "primary", t);
    expect(frac(dolly, p.t0)).toBeCloseTo(frac(zoom, p.t0), 6);
    expect(frac(dolly, p.t1)).toBeCloseTo(frac(zoom, p.t1), 2);
    // The doorway (5 m back) grows far less with the dolly than with the zoom.
    const door = [(d.set.doorway.openingX[0] + d.set.doorway.openingX[1]) / 2, 1.0, d.set.doorway.z] as const;
    const width = (m: typeof dolly, t: number) => {
      const pose = poseAt(m, t, still);
      const i = intrinsics(pose.focalMm, d.gate);
      return Math.abs(projectPoint(pose, i, [door[0] + 0.3, door[1], door[2]]).ndc[0] - projectPoint(pose, i, [door[0] - 0.3, door[1], door[2]]).ndc[0]);
    };
    const growD = width(dolly, p.t1) / width(dolly, p.t0);
    const growZ = width(zoom, p.t1) / width(zoom, p.t0);
    // zoom: ×d0/d1 = 2.47; dolly: ×(d0+2)/(d1+2) ≈ 1.68 for a doorway 2 m behind Bram
    expect(growZ).toBeGreaterThan(growD * 1.4);
  });

  it("dragging a key moves only that key", () => {
    const m = buildMove("truck", defaultParams("truck", d), still);
    const m2 = withPosition(m, "end", [3, 2, 1]);
    expect(m2.end.position).toEqual([3, 2, 1]);
    expect(m2.start).toEqual(m.start);
    expect(m2.end.target).toEqual(m.end.target);
  });
});

describe("move analysis speaks the operator's vocabulary", () => {
  const first = (kind: MoveKind, amount?: number) => {
    const p = { ...defaultParams(kind, d), ...(amount !== undefined ? { amount } : {}) };
    return analyzeMove(buildMove(kind, p, still), d, still).components[0];
  };
  it("labels each preset by its dominant component", () => {
    expect(first("static")).toBe("locked off");
    expect(first("dollyIn")).toBe("dolly in");
    expect(first("dollyOut")).toBe("dolly out");
    expect(first("zoomIn")).toBe("zoom in");
    expect(first("pan", 40)).toBe("pan right");
    expect(first("pan", -40)).toBe("pan left");
    expect(first("tilt", 28)).toBe("tilt up");
    expect(first("truck", 2.4)).toBe("truck right");
    expect(first("truck", -2.4)).toBe("truck left");
    expect(first("crane", 2.6)).toBe("crane up");
    expect(first("orbit", 70)).toMatch(/^arc (left|right)$/);
    expect(first("tracking")).toBe("tracking");
    expect(first("dollyZoom", 3)).toBe("dolly zoom (pull back, zoom in)");
    expect(first("dollyZoom", -2)).toBe("dolly zoom (push in, zoom out)");
  });

  it("a dolly in changes shot size; a truck keeps it", () => {
    const din = analyzeMove(buildMove("dollyIn", defaultParams("dollyIn", d), still), d, still);
    expect(din.endFraction).toBeGreaterThan(din.startFraction * 2);
    const tr = analyzeMove(buildMove("truck", defaultParams("truck", d), still), d, still);
    expect(tr.endFraction).toBeCloseTo(tr.startFraction, 2);
  });

  it("writes a deterministic prompt phrase that names the move first", () => {
    const m = buildMove("dollyIn", defaultParams("dollyIn", d), still);
    const phrase = movePhrase(m, d, analyzeMove(m, d, still));
    expect(phrase).toMatch(/^(Slow|Steady|Fast) dolly in, from a .+ to a .+ of Bram, 35 mm .+; 4-second move, easing in and out\.$/);
    const dz = buildMove("dollyZoom", defaultParams("dollyZoom", d), still);
    expect(movePhrase(dz, d, analyzeMove(dz, d, still))).toMatch(/^Dolly zoom on Bram: the camera pulls back while zooming in from 24 mm to \d+ mm/);
  });
});

describe("tracking follows a moving subject", () => {
  it("keeps the running Pip near frame centre for the whole alley loop", () => {
    const s = getScene("alley");
    const subj = live("alley");
    const p = defaultParams("tracking", s);
    const m = buildMove("tracking", p, subj);
    for (let t = 0; t <= s.timeline.durationS; t += 0.25) {
      const pose = poseAt(m, t, subj);
      const ndc = projectPoint(pose, intrinsics(pose.focalMm, s.gate), subj("secondary", t).anchor).ndc;
      expect(Math.abs(ndc[0])).toBeLessThan(0.05);
      expect(Math.abs(ndc[1])).toBeLessThan(0.05);
    }
  });

  it("the camera travels with him (more than 8 m over the run)", () => {
    const s = getScene("alley");
    const subj = live("alley");
    const m = buildMove("tracking", defaultParams("tracking", s), subj);
    const z0 = poseAt(m, 0, subj).position.z;
    const z1 = poseAt(m, 3.0, subj).position.z;
    expect(z1 - z0).toBeGreaterThan(8);
    expect(analyzeMove(m, s, subj).speed).toBe("fast");
  });
});
