import { describe, expect, it } from "vitest";
import { SCENES, getScene } from "@/labs/lens-and-framing/config";
import { clipFor } from "@/scene/animation/performances";
import { makeSubjectFn, staticSubjects } from "@/labs/camera-movement/engine/subject";
import { axisAt, axisFrom, crossesAxis, reflectAcross, sideOf, signedDistance } from "./axis";
import { camSides, coverageFor, crossLine, defaultCoverage, focalForFraction, inZone, isCrossed, presetCamera } from "./presets";
import { describeShot, poseOf, screenInfo } from "./shots";
import { cameraAt, commit, editPreset, editStats, insertCut, MIN_SHOT, moveCut, normalize, removeCut, segments, setShotCamera, undo } from "./edit";
import { checkContinuity } from "./continuity";
import { buildMultiShotPrompt } from "./prompt";
import type { Cams, Cut } from "./types";

const doorway = getScene("doorway");
const subjectsOf = (id: "doorway" | "alley" | "workshop") => {
  const d = getScene(id);
  return makeSubjectFn(d, { primary: clipFor(id, "bram"), secondary: clipFor(id, "pip") });
};
const subj = subjectsOf("doorway");
const tRef = coverageFor(doorway).tRef;
const BEATS = doorway.timeline.markers.map(([t]) => t);

describe("axis of action", () => {
  it("sides, on-the-line tolerance and reflection", () => {
    const ax = axisFrom([0, 0], [2, 0]); // along +x: + side is +z
    expect(sideOf(ax, [1, 1.6, 3])).toBe(1);
    expect(sideOf(ax, [1, 1.6, -3])).toBe(-1);
    expect(sideOf(ax, [5, 1.6, 0.05])).toBe(0);
    expect(signedDistance(ax, [0, 0, 2])).toBeCloseTo(2);
    const r = reflectAcross(ax, [1.5, 1.2, 2.5]);
    expect(r[0]).toBeCloseTo(1.5);
    expect(r[1]).toBeCloseTo(1.2);
    expect(r[2]).toBeCloseTo(-2.5);
    expect(crossesAxis(ax, [0, 1, 2], r)).toBe(true);
    expect(crossesAxis(ax, [0, 1, 2], [3, 1, 4])).toBe(false);
    // a neutral camera on the line never "crosses"
    expect(crossesAxis(ax, [0, 1, 0], r)).toBe(false);
  });

  it("follows the characters: the line moves when Pip runs", () => {
    const s = subjectsOf("alley");
    const early = axisAt(s, 0.2);
    const late = axisAt(s, 4.2);
    expect(early.length).toBeGreaterThan(late.length * 3);
    expect(Math.abs(early.u[0])).toBeLessThan(Math.abs(late.u[0]));
  });
});

describe("coverage presets", () => {
  for (const d of SCENES) {
    it(`${d.scene.id}: default A/B/C sit on one side, inside the set, framing what they say`, () => {
      const s = subjectsOf(d.scene.id);
      const cams = defaultCoverage(d, s);
      const sides = camSides(cams, d, s);
      expect(sides).toEqual({ A: 1, B: 1, C: 1 });
      expect(isCrossed(cams, d, s)).toBe(false);
      const cov = coverageFor(d);
      for (const c of Object.values(cams)) expect(inZone(cov.zone, c.position)).toBe(true);
      const a = describeShot(cams.A, d, s, cov.tRef);
      expect(a.kind).toBe("master");
      expect(["EWS", "WS"]).toContain(a.size);
      // Master: Bram screen-left of Pip, looking right; Pip looking left.
      expect(a.info.primary.x).toBeLessThan(a.info.secondary.x);
      expect(a.info.primary.look).toBe("right");
      expect(a.info.secondary.look).toBe("left");
      const c = describeShot(cams.C, d, s, cov.tRef);
      expect(c.subject).toBe("secondary");
      expect(c.kind).toBe("ots");
      expect(c.foreground?.edge).toBe("left");
      expect(c.info.secondary.look).toBe("left");
      const b = describeShot(cams.B, d, s, cov.tRef);
      expect(b.subject).toBe("primary");
      expect(b.info.primary.look).toBe("right");
    });
  }

  it("shot size per preset comes from the body fraction", () => {
    const cu = describeShot(presetCamera("closeup", "pip", doorway, subj), doorway, subj, tRef);
    expect(["CU", "ECU"]).toContain(cu.size);
    const ms = describeShot(presetCamera("single", "bram", doorway, subj), doorway, subj, tRef);
    expect(ms.size).toBe("MS");
    expect(ms.kind).toBe("single");
    // focal from fraction: twice the distance needs twice the focal length
    expect(focalForFraction(doorway, 1.5, 4, 1.78)).toBeCloseTo(2 * focalForFraction(doorway, 1.5, 2, 1.78), -1);
  });
});

describe("crossing the line", () => {
  it("mirrors the camera, flips screen positions and eyelines, and is undone by crossing back", () => {
    const cams = defaultCoverage(doorway, subj);
    const crossed = crossLine(cams.C, doorway, subj);
    const sides = camSides({ ...cams, C: crossed }, doorway, subj);
    expect(sides.C).toBe(-1);
    expect(isCrossed({ ...cams, C: crossed }, doorway, subj)).toBe(true);
    const before = screenInfo(poseOf(cams.C, doorway, subj, tRef), doorway, subj, tRef);
    const after = screenInfo(poseOf(crossed, doorway, subj, tRef), doorway, subj, tRef);
    expect(before.secondary.look).toBe("left");
    expect(after.secondary.look).toBe("right");
    expect(before.primary.side).toBe("L");
    expect(after.primary.side).toBe("R");
    expect(after.primary.x).toBeGreaterThan(after.secondary.x);
    const back = crossLine(crossed, doorway, subj);
    back.position.forEach((v, i) => expect(v).toBeCloseTo(cams.C.position[i], 2));
  });

  it("projection agrees with geometry for a static two-shot", () => {
    const s = staticSubjects(doorway);
    const cam = { position: [3, 1.4, -2] as [number, number, number], aim: "both" as const, target: [0, 0, 0] as [number, number, number], focalMm: 24, preset: "custom" };
    const front = screenInfo(poseOf(cam, doorway, s, 0), doorway, s, 0);
    const mirrored = screenInfo(poseOf({ ...cam, position: reflectAcross(axisAt(s, 0), cam.position) }, doorway, s, 0), doorway, s, 0);
    expect(Math.sign(front.primary.x - front.secondary.x)).toBe(-Math.sign(mirrored.primary.x - mirrored.secondary.x));
    expect(front.axisSide).toBe(-mirrored.axisSide);
  });
});

describe("edit list", () => {
  const T = 6;
  const base: Cut[] = [{ t: 0, cam: "A" }];
  it("live switching inserts cuts, ignores the camera already on air, merges too-short shots", () => {
    let e = insertCut(base, 1.5, "B", T);
    expect(e).toEqual([{ t: 0, cam: "A" }, { t: 1.5, cam: "B" }]);
    expect(insertCut(e, 2, "B", T)).toEqual(e);
    e = insertCut(e, 3, "C", T);
    expect(cameraAt(e, 2.9)).toBe("B");
    expect(cameraAt(e, 3)).toBe("C");
    // a cut 0.1 s after the last one replaces that shot's camera instead of making a 2-frame shot
    const e2 = insertCut(e, 3.1, "A", T);
    expect(e2.length).toBe(3);
    expect(e2[2]).toEqual({ t: 3, cam: "A" });
    expect(insertCut(base, 0.5, "B", T)[1].t).toBeCloseTo(0.5);
  });

  it("trim, change camera, remove cut, normalize and segments", () => {
    const e: Cut[] = [{ t: 0, cam: "A" }, { t: 2, cam: "B" }, { t: 4, cam: "C" }];
    expect(moveCut(e, 1, 3.95, T)[1].t).toBeCloseTo(4 - MIN_SHOT, 5);
    expect(moveCut(e, 1, 0, T)[1].t).toBeCloseTo(MIN_SHOT, 5);
    expect(moveCut(e, 0, 1, T)).toEqual(e);
    expect(setShotCamera(e, 1, "C")[1].cam).toBe("C");
    expect(removeCut(e, 1)).toEqual([{ t: 0, cam: "A" }, { t: 4, cam: "C" }]);
    expect(normalize([{ t: 3, cam: "B" }, { t: 0.4, cam: "C" }], T)).toEqual([{ t: 0, cam: "C" }, { t: 3, cam: "B" }]);
    expect(segments(e, T).map((s) => s.t1 - s.t0)).toEqual([2, 2, 2]);
    const st = editStats(e, T);
    expect(st.aslS).toBeCloseTo(2);
    expect(st.cutsPerMin).toBeCloseTo(20);
  });

  it("undo restores the edit before the last change", () => {
    let h = { past: [] as Cut[][], present: base };
    h = commit(h, insertCut(h.present, 2, "B", T));
    h = commit(h, insertCut(h.present, 4, "C", T));
    expect(h.present.length).toBe(3);
    h = undo(h);
    expect(h.present).toEqual([{ t: 0, cam: "A" }, { t: 2, cam: "B" }]);
    h = undo(undo(h));
    expect(h.present).toEqual(base);
    expect(commit(h, base)).toBe(h);
  });

  it("presets: fast cutting has a much shorter average shot than slow cutting", () => {
    const fast = editStats(editPreset("fast", T), T);
    const slow = editStats(editPreset("slow", T), T);
    expect(fast.aslS).toBeLessThan(0.8);
    expect(slow.aslS).toBeGreaterThanOrEqual(3);
    expect(editPreset("classic", T).map((c) => c.cam)).toEqual(["A", "B", "C", "A"]);
    // with story beats, the classic edit cuts on them
    expect(editPreset("classic", T, [0.4, 2.45, 3.35, 4.65]).map((c) => c.t)).toEqual([0, 59 / 24, 80 / 24, 112 / 24]);
    for (const c of editPreset("reaction", T)) expect(c.t * 24).toBeCloseTo(Math.round(c.t * 24), 6);
  });
});

describe("continuity checker", () => {
  const cams = defaultCoverage(doorway, subj);
  it("a classic edit on one side of the line is clean", () => {
    expect(checkContinuity(editPreset("classic", 6, BEATS), cams, doorway, subj)).toEqual([]);
  });
  it("flags cuts that cross the line, with the direction flip spelled out", () => {
    const crossed: Cams = { ...cams, C: crossLine(cams.C, doorway, subj) };
    const flags = checkContinuity(editPreset("crossing", 6, BEATS), crossed, doorway, subj);
    const axis = flags.filter((f) => f.kind === "axis");
    expect(axis.map((f) => f.cut)).toEqual([2, 3]);
    expect(axis[0].text).toMatch(/crosses the line/);
  });
  it("flags jump cuts (same subject, small angle, similar size) and same-camera cuts", () => {
    const B = presetCamera("single", "bram", doorway, subj);
    const near = { ...B, position: [B.position[0] + 0.25, B.position[1], B.position[2] + 0.2] as [number, number, number], focalMm: B.focalMm + 4 };
    const jc: Cams = { A: cams.A, B, C: near };
    const flags = checkContinuity([{ t: 0, cam: "B" }, { t: 3.4, cam: "C" }, { t: 4.5, cam: "C" }], jc, doorway, subj);
    expect(flags.map((f) => f.kind)).toEqual(["jump", "same"]);
    // a big change in size on the same subject is not a jump cut
    const cu = presetCamera("closeup", "bram", doorway, subj);
    expect(checkContinuity([{ t: 0, cam: "B" }, { t: 3.4, cam: "C" }], { A: cams.A, B, C: cu }, doorway, subj)).toEqual([]);
  });
});

describe("multi-shot prompt", () => {
  it("is deterministic and names every shot, its time range, framing and the screen geography", () => {
    const cams = defaultCoverage(doorway, subj);
    const edit = editPreset("classic", 6, BEATS);
    const p = buildMultiShotPrompt(edit, cams, doorway, subj, 6);
    expect(p).toBe(buildMultiShotPrompt(edit, defaultCoverage(doorway, subjectsOf("doorway")), doorway, subj, 6));
    const lines = p.split("\n");
    expect(lines[0]).toMatch(/^Multi-shot sequence, 6\.0 s, 4 shots, hard cuts\. The Doorway/);
    expect(lines[1]).toMatch(/^Shot 1 \(0\.0–2\.5 s\): Wide master, wide shot of Bram and Pip, .* mm .*; Bram screen-left, Pip screen-right\.$/);
    expect(lines[3]).toMatch(/^Shot 3 \(3\.3–4\.7 s\): Over-the-shoulder .* on Pip, past Bram's shoulder frame-left/);
    expect(lines[3]).toMatch(/Pip looks screen-left toward Bram/);
    expect(p).toMatch(/Continuity: keep Bram screen-left and Pip screen-right in every shot \(180-degree rule\)/);
  });
  it("names the shot that crosses the line", () => {
    const cams = defaultCoverage(doorway, subj);
    const p = buildMultiShotPrompt(editPreset("crossing", 6, BEATS), { ...cams, C: crossLine(cams.C, doorway, subj) }, doorway, subj, 6);
    expect(p).toMatch(/shot 3 deliberately crosses the line, flipping to Bram screen-right and Pip screen-left/);
    expect(p).toMatch(/Pip looks screen-right toward Bram/);
  });
});
