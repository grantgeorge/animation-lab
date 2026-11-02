import { describe, expect, it } from 'vitest';
import { validatePerformance, sampleClip } from '@/scene/animation/dsl';
import { BEATS, DURATION, RUN_START, doorAngle, startleClip } from './performance';
import { FPS, GRID, MOTIONS, heldFrame, motion, posesPerSecond, remap, squashScale, styleTime, wobble, type Cadence } from './styles';
import { directionText, timingWords } from './content';

describe('cadence', () => {
  it('holds each pose for N frames of a 24 fps timeline', () => {
    expect([1, 2, 3, 4].map(c => posesPerSecond(c as Cadence))).toEqual([24, 12, 8, 6]);
    const r = { ...motion('limited').recipe, holds: 0 };
    const times = Array.from({ length: 12 }, (_, f) => styleTime(f / FPS + 1e-4, r));
    expect(new Set(times).size).toBe(4); // 12 frames on threes = 4 poses
    expect(heldFrame(10 / FPS, 2)).toBe(10);
    expect(heldFrame(11 / FPS, 2)).toBe(10);
  });
  it('on ones, every frame is a new pose', () => {
    const r = motion('naturalistic').recipe;
    const times = Array.from({ length: 24 }, (_, f) => styleTime(f / FPS + 1e-4, r));
    expect(new Set(times).size).toBe(24);
  });
});

describe('pose holds', () => {
  it('is monotonic, keeps every key pose and leaves the run alone', () => {
    for (const h of [0, .3, .6, 1]) {
      let last = -1;
      for (let t = 0; t < DURATION; t += 0.01) { const m = remap(t, h); expect(m).toBeGreaterThanOrEqual(last - 1e-9); last = m; }
      for (const b of BEATS) expect(remap(b, h)).toBeCloseTo(b, 6);
      expect(remap(RUN_START + 0.5, h)).toBe(RUN_START + 0.5);
    }
  });
  it('holding means the pose stays put for the first part of a beat', () => {
    const [a, b] = [BEATS[5], BEATS[6]];
    expect(remap(a + (b - a) * .4, .85)).toBe(a);
  });
});

describe('the startle clip', () => {
  it('validates and loops for every style', () => {
    for (const m of MOTIONS) expect(validatePerformance({ id: m.id, durationS: DURATION, clips: [startleClip(m.recipe)] })).toEqual([]);
  });
  it('exaggeration pushes the take further; anticipation adds the flinch', () => {
    const peak = (k: number) => sampleClip(startleClip({ exaggeration: k, anticipation: 1, followThrough: 1 }), 1.42).get('upperArmL')!.rx!;
    expect(Math.abs(peak(1.5))).toBeGreaterThan(Math.abs(peak(1)));
    const dip = (a: number) => sampleClip(startleClip({ exaggeration: 1, anticipation: a, followThrough: 1 }), 1.24).get('root')!.py!;
    expect(dip(1.5)).toBeLessThan(dip(0));
  });
  it('the door bangs open at the cue and every style exits the same way', () => {
    expect(doorAngle(0.99)).toBe(0);
    expect(doorAngle(1.5)).toBeGreaterThan(80);
    const x = (id: (typeof GRID)[number]) => sampleClip(startleClip(motion(id).recipe), 4.6).get('root')!.px!;
    expect(new Set(GRID.map(x)).size).toBe(1);
  });
});

describe('squash and wobble', () => {
  it('preserves volume and is off for naturalistic', () => {
    const s = squashScale(1.3, motion('cartoony').recipe);
    expect(s.y).toBeGreaterThan(1.05);
    expect(s.y * s.xz * s.xz).toBeCloseTo(1, 6);
    expect(squashScale(1.3, motion('naturalistic').recipe).y).toBe(1);
  });
  it('stop-motion wobble changes only on a new pose', () => {
    const r = motion('stopmotion').recipe;
    expect(wobble(10 / FPS + 1e-4, r)).toEqual(wobble(11 / FPS + 1e-4, r));
    expect(wobble(10 / FPS + 1e-4, r)).not.toEqual(wobble(12 / FPS + 1e-4, r));
    expect(Math.abs(wobble(1, r).x)).toBeLessThanOrEqual(r.jitter);
    expect(wobble(1, motion('cartoony').recipe)).toEqual({ x: 0, z: 0, yaw: 0 });
  });
});

describe('direction', () => {
  it('describes timing from the recipe and keeps five separate parts', () => {
    expect(timingWords(motion('limited').recipe)).toContain('stepped on threes (8 poses a second)');
    expect(timingWords(motion('naturalistic').recipe)).toContain('smooth motion on ones');
    const text = directionText({ construction: 'Full 3D', appearance: 'Painterly', camera: [] }, 'Cartoony', motion('cartoony').prompt, motion('cartoony').recipe);
    expect(text.split('\n').map(l => l.split(':')[0])).toEqual(['Medium', 'Visual', 'Performance (Cartoony)', 'Timing', 'Camera & finishing']);
  });
});
