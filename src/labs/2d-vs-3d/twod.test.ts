import { describe, expect, it } from 'vitest';
import { sampleTrack, validatePerformance, type Key } from '@/scene/animation/dsl';
import { BODY, CX, PX, boil, cutoutCost, drawnCost, ik2d, offView, project, rigCost, skeleton, snapView } from './figure';
import { CHANNELS, DURATION, FPS, FRAMES, KEYS, drawingIndex, drawingsPerLoop, drawingsPerSecond, frameAt, heldFrame, hipDrop, hopClip, rigDeltas, samplePose, shownTime, squashScale } from './move';

const everyFrame = Array.from({ length: FRAMES }, (_, f) => f / FPS);

describe('the hop (one technique-neutral move)', () => {
  it('is a 2.5 s, 60-frame loop whose every channel closes', () => {
    expect(FRAMES).toBe(60);
    for (const c of CHANNELS) expect(sampleTrack(KEYS[c] as Key[], DURATION), c).toBeCloseTo(sampleTrack(KEYS[c] as Key[], 0), 9);
  });
  it('never puts the feet through the floor and leaves it only between take-off and landing', () => {
    for (const t of everyFrame) expect(samplePose(t).y).toBeGreaterThanOrEqual(0);
    expect(samplePose(0.96).y).toBeCloseTo(0.32, 2);
    expect(samplePose(0.5).y).toBe(0);
    expect(samplePose(1.5).y).toBe(0);
  });
  it('crouches before the jump and squashes on the landing (volume preserved)', () => {
    expect(samplePose(0.62).crouch).toBeCloseTo(0.85, 2);
    expect(samplePose(1.34).squash).toBeCloseTo(0.84, 2);
    const s = squashScale(0.84);
    expect(s.y * s.xz * s.xz).toBeCloseTo(1, 9);
  });
});

describe('cadence', () => {
  it('holds each drawing for its cadence', () => {
    expect(drawingsPerLoop(2)).toBe(30);
    expect(drawingsPerLoop(1)).toBe(60);
    expect(drawingsPerSecond(2)).toBe(12);
    expect(heldFrame(15 / FPS + 1e-4, 2)).toBe(14);
    expect(drawingIndex(15 / FPS + 1e-4, 2)).toBe(7);
    // On twos, frames 2k and 2k+1 show exactly the same pose.
    expect(samplePose(shownTime(16 / FPS + 1e-4, 2))).toEqual(samplePose(shownTime(17 / FPS + 1e-4, 2)));
    expect(frameAt(DURATION - 1e-6)).toBe(59);
    expect(frameAt(DURATION + 1 / FPS + 1e-4)).toBe(1);
  });
});

describe('one skeleton, three techniques', () => {
  it('keeps the feet on the ground through a crouch: 2D forward kinematics agree with the rig\'s hip drop', () => {
    for (const t of everyFrame) {
      const p = samplePose(t), sk = skeleton(p);
      expect(sk.ankle[0][1]).toBeCloseTo(p.y + BODY.ankle, 9);
      expect(rigDeltas(p).root.py).toBeCloseTo(p.y - hipDrop(p.crouch), 9);
    }
    const crouch = samplePose(0.62);
    expect(skeleton(samplePose(0)).pelvis[1] - skeleton(crouch).pelvis[1]).toBeCloseTo(hipDrop(crouch.crouch), 9);
  });
  it('bends the knee twice as far as the hip so the shin stays parallel to the thigh\'s mirror', () => {
    const d = rigDeltas(samplePose(0.62));
    expect(d.shinL.rx).toBeCloseTo(-2 * d.thighL.rx!, 9);
  });
  it('converts to a valid, closing 3D clip that matches the pose at every frame', () => {
    const clip = hopClip();
    expect(validatePerformance({ id: 'hop', durationS: DURATION, clips: [clip] })).toEqual([]);
    const tr = clip.tracks.find(k => k.part === 'upperArmL' && k.ch === 'rz')!;
    for (const f of [0, 17, 23, 32, 45]) expect(sampleTrack(tr.keys, f / FPS)).toBeCloseTo(rigDeltas(samplePose(f / FPS)).upperArmL.rz!, 6);
  });
});

describe('projection and the cut-out view library', () => {
  it('turns the camera around Pip: his left is screen right from the front, and he faces screen left from the side', () => {
    expect(project([0.2, 1, 0], 0).x).toBeGreaterThan(CX);
    expect(project([0, 1, 0.2], 90).x).toBeLessThan(CX);
    expect(project([0, 1, 0], 37).x).toBeCloseTo(CX, 9);
    expect(project([0, 1, 0], 0).y - project([0, 0, 0], 0).y).toBeCloseTo(-PX, 9);
  });
  it('snaps any requested angle to the nearest drawn view, and flags angles that would need a new set', () => {
    expect([0, 20, 23, 30, 45, 70, 90].map(snapView)).toEqual([0, 0, 45, 45, 45, 90, 90]);
    expect(offView(30)).toBe(true);
    expect(offView(45)).toBe(false);
    expect(offView(2)).toBe(false);
  });
  it('solves a rigid two-bone limb in the picture plane on the requested side', () => {
    const a = { x: 0, y: 0 }, c = { x: 0, y: 60 };
    const out = ik2d(a, c, 40, 40, 1), inn = ik2d(a, c, 40, 40, -1);
    expect(Math.hypot(out.x - a.x, out.y - a.y)).toBeCloseTo(40, 6);
    expect(Math.hypot(c.x - out.x, c.y - out.y)).toBeCloseTo(40, 6);
    expect(out.x).toBeGreaterThan(0);
    expect(inn.x).toBeLessThan(0);
    expect(ik2d(a, { x: 0, y: 100 }, 40, 40, 1).x).toBeCloseTo(0, 1); // out of reach: straight
  });
});

describe('cost and character of each technique', () => {
  it('counts what each one has to make', () => {
    expect(drawnCost(2, 1).drawings).toBe(30);
    expect(drawnCost(2, 3).drawings).toBe(90);
    expect(drawnCost(1, 1).drawings).toBe(60);
    expect(cutoutCost(3).drawings).toBe(63);
    expect(rigCost().drawings).toBe(0);
  });
  it('boils lines deterministically, within a pixel or so, differently on every drawing', () => {
    expect(boil(3, 7)).toEqual(boil(3, 7));
    expect(boil(3, 7)).not.toEqual(boil(4, 7));
    for (let i = 0; i < 50; i++) { const b = boil(i, i * 3); expect(Math.abs(b.x)).toBeLessThanOrEqual(1.1); expect(Math.abs(b.y)).toBeLessThanOrEqual(1.1); }
  });
  it('needs a smear only where the arms travel far between two drawings', () => {
    const hand = (t: number) => project(skeleton(samplePose(t)).hand[0], 0);
    const travel = (f: number) => { const a = hand((f - 2) / FPS), b = hand(f / FPS); return Math.hypot(b.x - a.x, b.y - a.y); };
    expect(travel(18)).toBeGreaterThan(70);
    expect(travel(6)).toBeLessThan(5);
    expect(travel(50)).toBeLessThan(70);
  });
});
