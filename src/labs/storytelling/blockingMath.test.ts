import { describe, expect, it } from 'vitest';
import { blockingConfig as c } from '@/labs/lens-and-framing/config';
import { blockingReadout, clampMark, facingYaws, faceLabel, horizontalFov, openness, yawToward, zoneOf, type Facing } from './blockingMath';
import { checksPass, EXERCISES } from './blockingExercises';
import type { Mark } from './engine';

describe('3D blocking feedback', () => {
  it('separates the staged conversation and detects the hidden actor', () => {
    expect(blockingReadout(c.presets.Conversation.bram, c.presets.Conversation.pip, 0, 40)).toMatchObject({ overlap: false, cropped: false, collision: false });
    expect(blockingReadout(c.presets.Hidden.bram, c.presets.Hidden.pip, 0, 40).overlap).toBe(true);
  });
  it('camera rotation changes occlusion without changing floor marks', () => {
    const { bram, pip } = c.presets.Hidden;
    expect(blockingReadout(bram, pip, c.angleLimit, 40).overlap).toBe(false);
  });
  it('reports collisions and framing independently', () => {
    expect(blockingReadout(c.presets.Hidden.bram, c.presets.Hidden.bram, 0, 40).collision).toBe(true);
    const { bram, pip } = c.presets.Distance;
    const r = blockingReadout(bram, pip, 0, 65);
    expect(r.cropped).toBe(true);
    expect(r.croppedActors.length).toBeGreaterThan(0);
  });
  it('keeps dragged marks on the usable floor', () => {
    expect(clampMark({ x: 99, z: -99 })).toEqual({ x: c.bounds.x[1], z: c.bounds.z[0] });
  });
});

describe('facing and focus', () => {
  const { bram, pip } = c.presets.Profile;
  it('yaw 0 faces the default camera; partners face each other in profile', () => {
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: 5 })).toBeCloseTo(0);
    expect(yawToward({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(90);
    const y = facingYaws(bram, pip, 'partner', 0);
    expect(y.bram).toBeCloseTo(90);
    expect(Math.abs(y.pip)).toBeCloseTo(90);
    expect(Math.abs(openness(bram, y.bram, 0))).toBeLessThan(.15);
  });
  it('turning to camera opens the face fully; cheating opens it partly but keeps the partner', () => {
    const front = blockingReadout(bram, pip, 0, 40, 'front');
    expect(front.open.bram).toBeCloseTo(1);
    expect(front.engaged.bram).toBe(false);
    const cheat = blockingReadout(bram, pip, 0, 40, 'cheat');
    expect(cheat.open.bram).toBeGreaterThan(.4);
    expect(cheat.open.bram).toBeLessThan(.9);
    expect(cheat.engaged.bram && cheat.engaged.pip).toBe(true);
  });
  it('the upstage partner gets the face', () => {
    const r = blockingReadout({ x: -.8, z: -2.4 }, { x: .8, z: -4.2 }, 0, 40, 'partner');
    expect(r.open.pip).toBeGreaterThan(.5);
    expect(r.open.bram).toBeLessThan(0);
  });
  it('labels faces, distances and lens coverage', () => {
    expect(faceLabel(1)).toBe('Open');
    expect(faceLabel(.5)).toBe('Three-quarter');
    expect(faceLabel(0)).toBe('Profile');
    expect(faceLabel(-.8)).toBe('Turned away');
    expect([zoneOf(.3), zoneOf(1), zoneOf(2), zoneOf(4)]).toEqual(['Intimate', 'Personal', 'Social', 'Public']);
    expect(horizontalFov(40)).toBeCloseTo(48.46, 1);
  });
});

describe('exercises', () => {
  const solutions: Record<string, { bram?: Mark; pip?: Mark; facing?: Facing; angle?: number; played?: boolean }> = {
    reveal: { pip: { x: 1.2, z: -4 } },
    distance: { bram: { x: -.4, z: -3 }, pip: { x: .5, z: -3.2 }, played: true },
    upstage: { pip: { x: .8, z: -4.2 }, bram: { x: -.8, z: -2.4 } },
    cheat: { facing: 'cheat' },
  };
  for (const ex of EXERCISES) {
    it(`${ex.id}: starts unsolved and has a solution`, () => {
      const start = c.presets[ex.setup.preset];
      expect(checksPass(ex.checks(blockingReadout(start.bram, start.pip, 0, c.focal, ex.setup.facing), false))).toBe(false);
      const s = solutions[ex.id];
      const r = blockingReadout(s.bram ?? start.bram, s.pip ?? start.pip, s.angle ?? 0, c.focal, s.facing ?? ex.setup.facing);
      expect(ex.checks(r, s.played ?? false).filter(k => !k.ok).map(k => k.label)).toEqual([]);
    });
  }
  it('the hidden actor can also be revealed with the camera alone', () => {
    const { bram, pip } = c.presets.Hidden;
    expect(checksPass(EXERCISES[0].checks(blockingReadout(bram, pip, -c.angleLimit, c.focal, 'front'), false))).toBe(true);
  });
  it('turning both actors to camera does not solve the cheat', () => {
    const { bram, pip } = c.presets.Profile;
    expect(checksPass(EXERCISES[3].checks(blockingReadout(bram, pip, 0, c.focal, 'front'), false))).toBe(false);
  });
});
