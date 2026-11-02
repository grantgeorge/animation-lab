import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { BRAM_BONES, PIP_BONES } from '@/scene/characters/Characters';
import { bendAngle, deltaToLocal, heat, influence, localToDelta, makeRest, poleAngle, poleDirection, rigidify, solveHinge, swing } from './rigMath';
import { JOINTS, emptyPose, fkDeltas, slidersFromDelta } from './joints';
import { EXERCISES, TOL, allOk, type Measure } from './exercises';

const DEG = Math.PI / 180;
const q = (x: number, y: number, z: number) => new Quaternion().setFromEuler(new Euler(x * DEG, y * DEG, z * DEG));
// A parent rest rotation and a bind local rotation with no special structure.
const P0 = q(10, -25, 40), L0 = q(-15, 30, 5);

describe('rest-aligned deltas (the RiggedCharacter formula)', () => {
  const forearm = makeRest(P0, L0, BRAM_BONES.forearmL);
  const upper = makeRest(P0, L0, BRAM_BONES.upperArmL);

  it('zero delta: offset applies, the hinge frame is neutral, no correction leaves the bind pose', () => {
    expect(deltaToLocal(forearm, {}, 'none').angleTo(L0)).toBeLessThan(1e-9);
    expect(deltaToLocal(upper, {}, 'none').angleTo(L0)).toBeLessThan(1e-9);
    // The upper arm's −18° offset moves it; offset-only and shipped agree at rest.
    expect(deltaToLocal(upper, {}, 'offset').angleTo(L0) * 180 / Math.PI).toBeCloseTo(18, 5);
    expect(deltaToLocal(upper, {}, 'shipped').angleTo(deltaToLocal(upper, {}, 'offset'))).toBeLessThan(1e-9);
  });

  it('the hinge frame changes how a bend lands (the "offset only" bug)', () => {
    const d = { rx: -90 };
    expect(deltaToLocal(forearm, d, 'shipped').angleTo(deltaToLocal(forearm, d, 'offset')) * 180 / Math.PI).toBeGreaterThan(10);
  });

  it('localToDelta inverts deltaToLocal in every correction mode', () => {
    for (const correction of ['none', 'offset', 'shipped'] as const) {
      for (const rest of [forearm, upper, makeRest(P0, L0, PIP_BONES.handL), makeRest(P0, L0, BRAM_BONES.head)]) {
        const d = { rx: -37, ry: 22, rz: 14 };
        const back = localToDelta(rest, deltaToLocal(rest, d, correction), correction);
        expect(deltaToLocal(rest, back, correction).angleTo(deltaToLocal(rest, d, correction))).toBeLessThan(1e-6);
      }
    }
  });
});

describe('hinge IK', () => {
  const a = 0.27, b = 0.25;
  // An ideal hinge: law of cosines (0° = straight).
  const span = (deg: number) => Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(deg * DEG));
  it('bends the hinge until the chain spans the target', () => {
    const s = solveHinge(span, 0.4);
    expect(s.reached).toBe(true);
    expect(span(s.deg)).toBeCloseTo(0.4, 6);
    expect(s.reach).toBeCloseTo(0.4 / (a + b), 9);
  });
  it('out of reach: straight, reach > 100%; too close: fully bent and flagged', () => {
    const far = solveHinge(span, 0.7);
    expect(far).toMatchObject({ deg: 0, reached: false });
    expect(far.reach).toBeGreaterThan(1);
    expect(solveHinge(span, 0.01)).toMatchObject({ deg: 165, reached: false });
  });
  it('the pole angle round-trips: 0° elbow down, 90° elbow out', () => {
    const root = new Vector3(0.2, 1.4, 0), target = new Vector3(0.4, 1.5, 0.3), out = new Vector3(1, 0, 0);
    const u = target.clone().sub(root).normalize();
    const elbowFor = (deg: number) => root.clone().addScaledVector(u, 0.15).addScaledVector(poleDirection(root, target, deg, out), 0.2);
    for (const deg of [-40, 0, 60, 90, 130]) expect(poleAngle(root, elbowFor(deg), target, out)).toBeCloseTo(deg, 6);
    expect(elbowFor(90).x).toBeGreaterThan(elbowFor(0).x);
    expect(elbowFor(0).y).toBeLessThan(elbowFor(90).y);
    expect(bendAngle(root, root.clone().addScaledVector(u, 0.2), target)).toBeCloseTo(0, 6);
  });
  it('swing points a bone along a new direction', () => {
    const from = new Vector3(0, -1, 0), to = new Vector3(1, 0, 1).normalize();
    expect(from.clone().applyQuaternion(swing(new Quaternion(), from, to)).distanceTo(to)).toBeLessThan(1e-9);
  });
});

describe('skin weights', () => {
  const idx = [0, 1, 2, 3, 4, 5, 0, 0];
  const w = [0.5, 0.3, 0.2, 0, 0.1, 0.6, 0.3, 0];
  it('rigid binding gives each vertex one bone at full weight', () => {
    expect(Array.from(rigidify(w))).toEqual([1, 0, 0, 0, 0, 1, 0, 0]);
  });
  it('influence sums the weights of a bone set', () => {
    expect(Array.from(influence(idx, w, new Set([1, 2])))).toEqual([expect.closeTo(0.5), 0]);
    expect(Array.from(influence(idx, w, new Set([5])))).toEqual([0, expect.closeTo(0.6)]);
  });
  it('the heat ramp runs blue → red', () => {
    const lo = heat(0), hi = heat(1);
    expect(lo[2]).toBeGreaterThan(lo[0]);
    expect(hi[0]).toBeGreaterThan(hi[2]);
  });
});

describe('joints and sliders', () => {
  it('positive slider values are the natural direction (clip conventions in arms.ts)', () => {
    const d = fkDeltas({ ...emptyPose(), shoulder: { rx: 30, rz: 40 }, elbow: { rx: 60 }, hips: { rz: 10 }, knees: { rx: 45 } });
    expect(d.get('upperArmL')).toMatchObject({ rx: -30, rz: 40 }); // forward swing is rx < 0
    expect(d.get('forearmL')).toMatchObject({ rx: -60 }); // elbow bend is rx < 0
    expect(d.get('thighL')).toMatchObject({ rz: 10 });
    expect(d.get('thighR')).toMatchObject({ rz: -10 }); // right side mirrors
    expect(d.get('shinR')).toMatchObject({ rx: 45 });
  });
  it('sliders round-trip through deltas and clamp to joint limits', () => {
    const d = fkDeltas({ ...emptyPose(), elbow: { rx: 72, ry: -20 } });
    expect(slidersFromDelta('elbow', d.get('forearmL')!)).toEqual({ rx: 72, ry: -20 });
    expect(slidersFromDelta('elbow', { rx: 50 })).toEqual({ rx: 0, ry: 0 });
  });
  it('every joint has a handle bone and sensible limits', () => {
    for (const j of JOINTS) for (const a of j.axes) expect(a.min).toBeLessThan(a.max);
    expect(JOINTS.map((j) => j.id)).toEqual(['spine', 'head', 'shoulder', 'elbow', 'wrist', 'hips', 'knees']);
  });
});

describe('exercises', () => {
  const base: Measure = { markDist: 0.3, reach: 0, reached: true, shoulderDeg: 0, elbowDeg: 0, poleDeg: 0, hipDrop: 0, footSink: 0, footSlide: 0, legLength: 0.68, armLength: 0.52, arm: 'fk', wrist: [0, 0, 0], mark: [0, 0, 0] };
  const run = (id: string, m: Partial<Measure>, arm: 'fk' | 'ik' = 'fk', legs: 'fk' | 'ik' = 'fk', reachedWith = { fk: false, ik: false }) =>
    allOk(EXERCISES.find((e) => e.id === id)!.checks({ m: { ...base, ...m }, arm, legs, reachedWith }));
  it('reach needs the wrist on the mark with both FK and IK', () => {
    expect(run('reach', { markDist: 0.02 }, 'ik', 'fk', { fk: false, ik: true })).toBe(false);
    expect(run('reach', { markDist: 0.02 }, 'ik', 'fk', { fk: true, ik: true })).toBe(true);
  });
  it('squat: deep enough, no sinking, no sliding', () => {
    expect(run('squat', { hipDrop: 0.21, footSink: 0.21 })).toBe(false);
    expect(run('squat', { hipDrop: 0.21, footSink: 0.002, footSlide: 0.004 }, 'fk', 'ik')).toBe(true);
    expect(run('squat', { hipDrop: 0.1 }, 'fk', 'ik')).toBe(false);
  });
  it('elbow: IK, on the mark, pole out', () => {
    expect(run('elbow', { markDist: 0.01, poleDeg: TOL.elbowOut + 1 }, 'ik')).toBe(true);
    expect(run('elbow', { markDist: 0.01, poleDeg: 20 }, 'ik')).toBe(false);
    expect(run('elbow', { markDist: 0.01, poleDeg: 80 }, 'fk')).toBe(false);
  });
});
