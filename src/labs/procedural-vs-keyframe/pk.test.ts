import { describe, expect, it } from 'vitest';
import { proceduralConfig as cfg } from '@/labs/lens-and-framing/config';
import { DURATION, bakeClip, contact, crouchForDrop, hipDrop, rigDeltas, MAX_DROP } from './move';
import { DEFAULT_KEYED_M, DEFAULT_TIMES, gravityFeel, impliedGravity, keyframePose, retime } from './keyframe';
import { PHYS_DEFAULT, simulate } from './physics';
import { PROC_DEFAULT, generate, rng } from './procedural';
import { ELEMENTS, score } from './director';

const crates = [cfg.crate.minM, 0.3, 0.45, cfg.crate.maxM];

describe('shared move', () => {
  it('crouch and hip drop invert each other; the feet stay where y says', () => {
    for (const c of [0, 0.3, 0.7, 1]) expect(crouchForDrop(hipDrop(c))).toBeCloseTo(c, 5);
    const d = rigDeltas({ z: 0.2, y: 0.3, crouch: 0.5, lean: 0, head: 0, armUp: 0, armFwd: 0, elbow: 8 });
    expect(d.root.py).toBeCloseTo(0.3 - hipDrop(0.5), 6);
    expect(d.thighL.rx! + d.shinL.rx! + d.footL.rx!).toBeCloseTo(0, 6); // soles stay flat
  });
  it('bakes any pose function into a valid sorted clip', () => {
    const clip = bakeClip(keyframePose(DEFAULT_TIMES, 0.3));
    for (const tr of clip.tracks) for (let i = 1; i < tr.keys.length; i++) expect(tr.keys[i][0]).toBeGreaterThan(tr.keys[i - 1][0]);
    expect(clip.tracks.find((t) => t.part === 'root' && t.ch === 'pz')).toBeTruthy();
  });
});

describe('keyframed', () => {
  it('is exact on the crate it was keyed on and breaks on any other', () => {
    expect(contact(keyframePose(DEFAULT_TIMES, 0.3), 0.3).error).toBeLessThan(1e-9);
    const higher = contact(keyframePose(DEFAULT_TIMES, 0.3), 0.45);
    expect(higher.start).toBeCloseTo(-0.15, 6); // feet inside the crate
    expect(contact(keyframePose(DEFAULT_TIMES, 0.3), 0.15).start).toBeCloseTo(0.15, 6); // floating
    expect(contact(keyframePose(DEFAULT_TIMES, 0.45), 0.45).error).toBeLessThan(1e-9); // re-keyed
  });
  it('retiming keeps the keys ordered with minimum gaps', () => {
    let k = retime(DEFAULT_TIMES, 'contact', 0.2);
    expect(k.contact).toBeCloseTo(k.launch + 0.15, 6);
    k = retime(k, 'recover', 99);
    expect(k.recover).toBeCloseTo(DURATION - 0.6, 6);
    k = retime(k, 'crouch', 5);
    expect(k.crouch).toBeLessThan(k.launch);
    expect(k.crouch).toBeLessThan(k.contact);
  });
  it('implied gravity reads the airtime: default natural, stretched floaty, squeezed snappy', () => {
    expect(gravityFeel(impliedGravity(DEFAULT_TIMES, DEFAULT_KEYED_M))).toBe('natural');
    expect(gravityFeel(impliedGravity(retime(DEFAULT_TIMES, 'contact', 1.75), DEFAULT_KEYED_M))).toBe('floaty');
    expect(gravityFeel(impliedGravity(retime(DEFAULT_TIMES, 'contact', 1.2), DEFAULT_KEYED_M))).toBe('snappy');
  });
});

describe('physics', () => {
  it('lands on the floor for every crate, with physical airtime', () => {
    for (const h of crates) {
      const s = simulate(PHYS_DEFAULT, h);
      const c = contact(s.pose, h);
      expect(c.error, `crate ${h}`).toBeLessThan(0.002);
      const vy = PHYS_DEFAULT.speed * Math.sin((42 * Math.PI) / 180);
      const air = (vy + Math.sqrt(vy * vy + 2 * PHYS_DEFAULT.gravity * h)) / PHYS_DEFAULT.gravity;
      expect(s.airtime).toBeCloseTo(air, 2);
    }
  });
  it('a softer, heavier body compresses more; too soft bottoms out', () => {
    const stiff = simulate(PHYS_DEFAULT, 0.3), soft = simulate({ ...PHYS_DEFAULT, stiffness: 1500, mass: 30 }, 0.3);
    expect(soft.peak).toBeGreaterThan(stiff.peak);
    expect(simulate({ ...PHYS_DEFAULT, stiffness: 800, mass: 40, damping: 20 }, 0.6).bottomed).toBe(true);
    expect(soft.peak).toBeLessThanOrEqual(MAX_DROP + 1e-9);
  });
  it('has no anticipation and no look unless asked', () => {
    const s = simulate(PHYS_DEFAULT, 0.3);
    expect(s.pose(0.9).crouch).toBeLessThan(0.01);
    expect(Math.abs(s.pose(0.5).head)).toBeLessThan(0.01);
    expect(simulate({ ...PHYS_DEFAULT, anticipation: true }, 0.3).pose(0.9).crouch).toBeGreaterThan(0.3);
  });
});

describe('procedural', () => {
  it('plants the feet on the crate and the floor for any height, seed and energy', () => {
    for (const h of crates) for (const seed of [1, 2, 7]) for (const energy of [0, 0.5, 1]) {
      const g = generate({ energy, seed }, h);
      expect(contact(g.pose, h).error).toBeLessThan(1e-6);
      expect(g.contactT).toBeLessThan(DURATION - 0.8);
      expect(g.pose(g.contactT + 0.01).y).toBe(0);
    }
  });
  it('a bigger drop gives a deeper crouch, a longer flight and a farther landing', () => {
    const lo = generate(PROC_DEFAULT, 0.15), hi = generate(PROC_DEFAULT, 0.6);
    expect(hi.crouch).toBeGreaterThan(lo.crouch);
    expect(hi.airtime).toBeGreaterThan(lo.airtime);
    expect(hi.landZ).toBeGreaterThan(lo.landZ);
  });
  it('seeds vary the take deterministically', () => {
    expect(generate({ ...PROC_DEFAULT, seed: 3 }, 0.3).landZ).toBe(generate({ ...PROC_DEFAULT, seed: 3 }, 0.3).landZ);
    expect(generate({ ...PROC_DEFAULT, seed: 3 }, 0.3).landZ).not.toBe(generate({ ...PROC_DEFAULT, seed: 4 }, 0.3).landZ);
    const r = rng(9); const v = Array.from({ length: 50 }, r);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0); expect(Math.max(...v)).toBeLessThan(1);
  });
});

describe('director exercise', () => {
  it('scores placements against the accepted methods', () => {
    expect(score({}).placed).toBe(0);
    const all = Object.fromEntries(ELEMENTS.map((e) => [e.id, e.best]));
    expect(score(all).solved).toBe(true);
    expect(score({ ...all, hero: 'ai' }).solved).toBe(false);
    expect(score({ ...all, cape: 'phys' }).solved).toBe(true); // an accepted alternative
    for (const e of ELEMENTS) expect(e.accept).toContain(e.best);
  });
});
