import { describe, expect, it } from "vitest";
import { Matrix4, Vector3 } from "three";
import { HAZE_COLORS, applyHaze, contrastAt, hazeCurve, hazeFactor, hazeParams, hexToLinear, luminance, michelson, transmittance } from "./haze";
import { REFS, STORIES, frameFraction, impliedFromPixels, impliedHeight, pipsTall } from "./scale";
import { AIM, CAMERA, LOOP_S, baseShot, distanceForFocal, lookAtQuat, moveShot, moveU, planBounds, project, tanHalf, timeForU, viewMatrix, type Shot } from "./camera";
import { anchorShift, cardDepths, layerRanges, medianDepth, parallaxNdc, relativeSpeed, sliceBounds, squashDepth, bandOf } from "./layers";
import { MASK, decodeDepth01, decodeDepthBuffer, encodeDepth01, maskBounds, packDepthBytes, revealedArea, unpackDepthBytes, type DepthView } from "./reveal";
import { HERO_TREES, PATH, PIP, REF_SPOTS, TREE_HEIGHT_M, bushes, fillTrees, ferns, groundY, inCameraCorridor, pathCenterX } from "./world";
import { guidance, promptPhrase, riskOf, type PromptInput } from "./prompt";

const EYE = 1.1;

describe("atmospheric perspective", () => {
  const p = hazeParams(1);
  it("transmittance falls monotonically with distance and is 1 with the cue off", () => {
    let prev = 1;
    for (const d of [1, 10, 40, 120, 600, 2500]) {
      const t = transmittance(EYE, EYE, d, p);
      expect(t).toBeLessThan(prev);
      prev = t;
    }
    expect(transmittance(EYE, EYE, 2500, hazeParams(0))).toBe(1);
  });
  it("contrast falls off with distance: two surfaces keep (1 − f) of their difference", () => {
    const haze = hexToLinear(HAZE_COLORS.blue.hex);
    const bark: [number, number, number] = [0.05, 0.03, 0.02];
    const moss: [number, number, number] = [0.12, 0.2, 0.06];
    let prevC = Infinity;
    for (const d of [5, 30, 100, 400]) {
      const f = hazeFactor(EYE, EYE, d, p);
      const a = luminance(applyHaze(bark, haze, f));
      const b = luminance(applyHaze(moss, haze, f));
      expect(Math.abs(a - b)).toBeCloseTo(Math.abs(luminance(bark) - luminance(moss)) * (1 - f), 9);
      const c = michelson(a, b);
      expect(c).toBeLessThan(prevC);
      prevC = c;
      expect(contrastAt(EYE, EYE, d, p)).toBeCloseTo(1 - f, 12);
    }
  });
  it("far things get lighter and bluer", () => {
    const haze = hexToLinear(HAZE_COLORS.blue.hex);
    const bark: [number, number, number] = [0.05, 0.03, 0.02];
    const near = applyHaze(bark, haze, hazeFactor(EYE, EYE, 8, p));
    const far = applyHaze(bark, haze, hazeFactor(EYE, EYE, 300, p));
    expect(luminance(far)).toBeGreaterThan(luminance(near) * 3);
    expect(far[2] / far[0]).toBeGreaterThan(near[2] / near[0]);
  });
  it("ground mist is denser low down: a ridge top is clearer than the valley floor at the same range", () => {
    expect(hazeFactor(EYE, 600, 2000, p)).toBeLessThan(hazeFactor(EYE, -40, 2000, p));
  });
  it("haze curve samples are log spaced and monotonic", () => {
    const c = hazeCurve(p, EYE, 16);
    expect(c[0].d).toBeCloseTo(1);
    expect(c[15].d).toBeCloseTo(3000);
    for (let i = 1; i < c.length; i++) expect(c[i].contrast).toBeLessThanOrEqual(c[i - 1].contrast);
  });
});

describe("scale cues", () => {
  it("matched framing keeps Pip at the same fraction of the frame for every lens", () => {
    for (const f of [18, 24, 50, 85, 135]) expect(frameFraction(PIP.heightM, distanceForFocal(f), f)).toBeCloseTo(CAMERA.pipFrac, 10);
  });
  it("the same tree reads as tree ÷ k when the reference is scaled by k", () => {
    const depth = 30;
    for (const story of Object.values(STORIES)) {
      for (const ref of Object.values(REFS)) {
        const treePx = frameFraction(TREE_HEIGHT_M, depth, 24);
        const refPx = frameFraction(ref.knownM * story.k, depth, 24);
        expect(impliedFromPixels(treePx, refPx, ref.knownM)).toBeCloseTo(impliedHeight(TREE_HEIGHT_M, story.k), 9);
      }
    }
    expect(pipsTall(1)).toBeCloseTo(TREE_HEIGHT_M / 1.05);
  });
});

describe("camera and moves", () => {
  it("every move starts on the base frame", () => {
    for (const m of ["push", "track", "arc"] as const) {
      const a = moveShot(24, m, 0);
      const b = baseShot(24);
      expect(a.position.distanceTo(b.position)).toBeLessThan(1e-9);
      expect(a.quaternion.angleTo(b.quaternion)).toBeLessThan(1e-6);
    }
  });
  it("matched framing holds the frame centre on Pip's plane for every focal length", () => {
    for (const f of [18, 35, 135]) {
      const q = project(baseShot(f), AIM);
      expect(Math.abs(q.x)).toBeLessThan(1e-6);
      expect(Math.abs(q.y)).toBeLessThan(1e-6);
    }
    expect(baseShot(135).position.distanceTo(new Vector3(AIM.x, 0, AIM.z))).toBeGreaterThan(50);
  });
  it("the arc keeps looking at Pip; push and track keep the orientation", () => {
    const arc = moveShot(24, "arc", 1);
    const q = project(arc, AIM);
    expect(Math.abs(q.x)).toBeLessThan(1e-6);
    expect(moveShot(24, "track", 1).quaternion.angleTo(baseShot(24).quaternion)).toBeLessThan(1e-9);
  });
  it("the plan view holds the camera and Pip at every focal length", () => {
    for (const f of [18, 24, 135]) {
      const b = planBounds(f, 2.6);
      const c = baseShot(f).position;
      expect(c.x).toBeGreaterThan(b.x0);
      expect(c.x).toBeLessThan(b.x1);
      expect(c.z).toBeLessThan(b.z1);
      expect(PIP.root[2]).toBeGreaterThan(b.z0);
      expect((b.x1 - b.x0) / (b.z1 - b.z0)).toBeCloseTo(2.6, 9);
    }
  });
  it("the loop goes out, holds and comes back", () => {
    expect(moveU(0)).toBe(0);
    expect(moveU(6)).toBe(1);
    expect(moveU(LOOP_S - 0.1)).toBe(0);
    expect(moveU(3)).toBeGreaterThan(0.3);
    for (const u of [0.1, 0.5, 0.9]) expect(moveU(timeForU(u))).toBeCloseTo(u, 6);
  });
});

describe("2.5D layers and parallax", () => {
  it("slices n layers with n − 1 geometric cuts covering 0..∞", () => {
    expect(sliceBounds(1)).toEqual([]);
    const b = sliceBounds(5);
    expect(b).toHaveLength(4);
    expect(b[1] / b[0]).toBeCloseTo(b[3] / b[2], 9);
    const r = layerRanges(5);
    expect(r[0].a).toBe(0);
    expect(r[4].b).toBe(Infinity);
    for (let i = 1; i < r.length; i++) expect(r[i].a).toBe(r[i - 1].b);
  });
  it("cards hang at the median depth of their pixels", () => {
    const depths = new Float32Array([1, 2, 3, 10, 11, 12, 13, 500, 900]);
    expect(medianDepth(depths, 0, 5)).toBe(2);
    expect(medianDepth(depths, 9, 20)).toBe(11.5);
    expect(medianDepth(depths, 20, 100)).toBeNull();
    const d = cardDepths(layerRanges(3), depths);
    expect(d[0]).toBeGreaterThan(0);
    expect(d[2]).toBeGreaterThan(d[1]);
  });
  it("parallax speed is ∝ 1/depth", () => {
    expect(parallaxNdc(5, 1, 24) / parallaxNdc(20, 1, 24)).toBeCloseTo(4, 10);
    expect(relativeSpeed(10, 200)).toBe(20);
    // A pure sideways move: the anchors' slide matches −x / (d · tan(hfov/2)).
    const c0 = baseShot(24);
    const right = new Vector3(1, 0, 0).applyQuaternion(c0.quaternion);
    const now: Shot = { position: c0.position.clone().addScaledVector(right, 1.5), quaternion: c0.quaternion.clone(), focalMm: 24 };
    for (const d of [3, 10, 60]) expect(anchorShift(c0, now, d).x).toBeCloseTo(parallaxNdc(d, 1.5, 24), 9);
    // 2D: every layer on one plane → identical slides (no parallax).
    const flat = [3, 10, 60].map(() => anchorShift(c0, now, 10).x);
    expect(new Set(flat.map((v) => v.toFixed(9))).size).toBe(1);
  });
  it("parallax strength squashes depths onto one plane", () => {
    expect(squashDepth(80, 10, 0)).toBe(10);
    expect(squashDepth(80, 10, 1)).toBe(80);
    expect(squashDepth(80, 10, 0.5)).toBe(45);
  });
  it("bands split foreground, midground, background", () => {
    expect(bandOf(2)).toBe("fg");
    expect(bandOf(12)).toBe("mg");
    expect(bandOf(200)).toBe("bg");
  });
});

/** A synthetic world: a wall at z = −20 and a 2 × 2 m panel at z = −5, rendered into a depth buffer. */
function synthDepth(shot: Shot, W = 96, H = 54): DepthView {
  const th = tanHalf(shot.focalMm);
  const camToWorld = new Matrix4().compose(shot.position, shot.quaternion, new Vector3(1, 1, 1));
  const depth = new Float32Array(W * H);
  const fwd = new Vector3(0, 0, -1).applyQuaternion(shot.quaternion);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const nx = ((i + 0.5) / W) * 2 - 1;
      const ny = ((j + 0.5) / H) * 2 - 1;
      const dir = new Vector3(nx * th.x, ny * th.y, -1).applyQuaternion(shot.quaternion).normalize();
      let t = (-20 - shot.position.z) / dir.z;
      const tp = (-5 - shot.position.z) / dir.z;
      const hit = shot.position.clone().addScaledVector(dir, tp);
      if (tp > 0 && Math.abs(hit.x) < 1 && Math.abs(hit.y - 1) < 1) t = tp;
      depth[j * W + i] = t * dir.dot(fwd);
    }
  return { width: W, height: H, depth, camToWorld, worldToCam: camToWorld.clone().invert(), tanX: th.x, tanY: th.y };
}

const shotAt = (pos: Vector3, target: Vector3, f = 35): Shot => ({ position: pos, quaternion: lookAtQuat(pos, target), focalMm: f });

describe("revealed area (depth reprojection)", () => {
  const p0 = new Vector3(0, 1, 0);
  const tgt = new Vector3(0, 1, -20);
  const ref = synthDepth(shotAt(p0, tgt));
  it("is zero on frame 0", () => {
    const r = revealedArea(ref, ref);
    expect(r.total).toBe(0);
  });
  it("a sideways track reveals wall behind the panel and new picture at one edge", () => {
    const r = revealedArea(synthDepth({ position: new Vector3(1.2, 1, 0), quaternion: lookAtQuat(p0, tgt), focalMm: 35 }), ref);
    expect(r.disoccluded).toBeGreaterThan(0.01);
    expect(r.edge).toBeGreaterThan(0.01);
    const b = maskBounds(r.mask, 96, 54)!;
    // The uncovered strip of wall sits beside the panel, near the middle of the frame.
    expect(b.cx).toBeGreaterThan(0.3);
    expect(b.cx).toBeLessThan(0.7);
  });
  it("a nodal pan reveals no hidden geometry, only new picture at the edge", () => {
    const r = revealedArea(synthDepth(shotAt(p0, new Vector3(4, 1, -20))), ref);
    expect(r.disoccluded).toBeLessThan(0.002);
    expect(r.edge).toBeGreaterThan(0.05);
  });
  it("an orbit around the panel reveals more than a track of the same distance", () => {
    const track = revealedArea(synthDepth(shotAt(new Vector3(2, 1, 0), new Vector3(2, 1, -20))), ref);
    const ang = 0.35;
    const orbitPos = new Vector3(Math.sin(ang) * 20, 1, -20 + Math.cos(ang) * 20);
    const orbit = revealedArea(synthDepth(shotAt(orbitPos, tgt)), ref);
    expect(orbit.total).toBeGreaterThan(track.total);
  });
  it("depth survives the RGBA8 log packing", () => {
    for (const z of [0.3, 1.7, 10.4, 63, 480, 3200]) {
      const [r, g, b] = packDepthBytes(encodeDepth01(z));
      const back = decodeDepth01(unpackDepthBytes(r, g, b));
      expect(Math.abs(back / z - 1)).toBeLessThan(2e-4);
    }
    const buf = new Uint8Array([...packDepthBytes(encodeDepth01(12)), 255, 255, 255, 255, 255]);
    const d = decodeDepthBuffer(buf);
    expect(d[0]).toBeCloseTo(12, 1);
    expect(d[1]).toBe(6000);
    expect(MASK.DISOCCLUDED).toBe(2);
  });
  it("view matrix inverts the camera pose", () => {
    const s = baseShot(24);
    const v = viewMatrix(s);
    expect(s.position.clone().applyMatrix4(v).length()).toBeLessThan(1e-9);
  });
});

describe("world layout", () => {
  it("is deterministic, keeps trunks off the path and out of the camera corridor", () => {
    const a = fillTrees(120);
    const b = fillTrees(120);
    expect(a).toEqual(b);
    for (const t of [...a]) {
      expect(Math.abs(t.x - pathCenterX(t.z))).toBeGreaterThan(PATH.halfWidthM + t.r);
      expect(inCameraCorridor(t.x, t.z)).toBe(false);
    }
    for (const t of HERO_TREES) expect(Math.abs(t.x - pathCenterX(t.z))).toBeGreaterThan(PATH.halfWidthM + t.r * 0.9);
  });
  it("keeps the scale references clear of trunks, ferns and bushes", () => {
    const trees = [...HERO_TREES, ...fillTrees()];
    const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
    for (const t of trees) expect(d(t, REF_SPOTS.cabin)).toBeGreaterThan(t.r + 4);
    for (const f of [...ferns(trees), ...bushes(trees)]) expect(d(f, REF_SPOTS.cabin)).toBeGreaterThan(5);
  });
  it("no move or lens puts the camera inside a trunk", () => {
    const trees = [...HERO_TREES, ...fillTrees()];
    for (const f of [18, 24, 50, 135])
      for (const m of ["push", "track", "arc"] as const)
        for (const size of [1, 2])
          for (let u = 0; u <= 1; u += 0.25) {
            const p = moveShot(f, m, u, size).position;
            for (const t of trees) expect(Math.hypot(p.x - t.x, p.z - t.z)).toBeGreaterThan(t.r * 1.6);
          }
  });
  it("the path is level where Pip and the camera stand", () => {
    expect(Math.abs(groundY(PIP.root[0], PIP.root[2]))).toBeLessThan(0.1);
    expect(Math.abs(groundY(0, 4))).toBeLessThan(0.1);
  });
});

describe("prompt", () => {
  const base: PromptInput = {
    construct: "3d", move: "track", moveSize: 1, parallax: 1, haze: 1, hazeColor: "blue", layers: true, scale: true,
    refs: { pip: true, cabin: false, fence: false, deer: false }, story: "giant", occlusion: true, dof: true, fStop: 1.4, focalMm: 24,
  };
  it("names the cues that are on", () => {
    const s = promptPhrase(base);
    expect(s).toContain("towering ancient forest");
    expect(s).toContain("tiny child on a mossy path for scale");
    expect(s).toContain("layered foreground ferns");
    expect(s).toContain("soft blue atmospheric haze on distant ridges");
    expect(s).toContain("slow lateral tracking shot");
    expect(s).toContain("strong parallax");
  });
  it("describes a flattened frame differently", () => {
    const s = promptPhrase({ ...base, haze: 0, layers: false, scale: false, parallax: 0, focalMm: 135, construct: "2d", move: "track" });
    expect(s).toContain("no haze");
    expect(s).toContain("scale left ambiguous");
    expect(s).toContain("135mm telephoto");
    expect(s).toContain("flat painted backdrop");
  });
  it("grades the move by its revealed area", () => {
    expect(riskOf(0.04)).toBe("safe");
    expect(riskOf(0.2)).toBe("watch");
    expect(riskOf(0.5)).toBe("risky");
    expect(guidance({ ...base, revealed: 0.42 })!.line).toContain("42%");
  });
});
