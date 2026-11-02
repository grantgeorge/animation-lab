import { describe, expect, it } from 'vitest';
import { designConfig } from '@/labs/lens-and-framing/config';
import { PRESETS, RANGES, ageBand, blendProfile, buildFigure, castDesign, dominantShape, headsTall, normBary, preset, radiusAt, readDesign, systemOf, youthCues, type Design } from './design';
import { EXERCISES, TARGETS } from './exercises';
import { area, convexHull, hullArea, iou, maskFromRGBA, polygonArea, readSilhouette, type Mask } from './silhouette';
import { baryToPoint, pointToBary } from './ShapePad';
import { briefText } from './content';
import { SHEET_MARGIN, sheetLayout } from './sheet';

const H = designConfig.heightM;

describe('proportions', () => {
  it('measures the cast from its own numbers', () => {
    const pip = castDesign('pip'), bram = castDesign('bram');
    expect(headsTall(pip)).toBeCloseTo(1.05 / 0.298, 6);
    expect(headsTall(pip)).toBeGreaterThan(3.4);
    expect(headsTall(pip)).toBeLessThan(3.6);
    expect(headsTall(bram)).toBeCloseTo(1.74 / 0.372, 6);
    expect(pip.eyeLine).toBeCloseTo(0.433, 2);
    expect(pip.eyeGap).toBeCloseTo((0.1 - 0.07) / 0.07, 6);
    expect(bram.eyeGap).toBeCloseTo(0.65, 6);
    expect(headsTall(bram)).toBeGreaterThan(headsTall(pip));
  });
  it('names the proportion system by head count', () => {
    expect(systemOf(2.5)).toBe('chibi');
    expect(systemOf(3.5)).toBe('cartoon');
    expect(systemOf(5)).toBe('stylised');
    expect(systemOf(7.5)).toBe('realistic');
    expect(systemOf(8.5)).toBe('heroic');
    for (const p of PRESETS) expect(headsTall(p.design), p.id).toBeGreaterThan(2);
  });
  it('reads age from baby-schema cues, monotonically', () => {
    expect(readDesign(preset('realistic').design).age).toBe('adult');
    expect(readDesign(preset('heroic').design).age).toBe('adult');
    expect(readDesign(preset('chibi').design).age).toBe('baby');
    expect(['child', 'baby']).toContain(readDesign(preset('pip').design).age);
    const d = preset('realistic').design;
    let last = -1;
    for (let heads = 8; heads >= 2.5; heads -= 0.5) { const y = youthCues({ ...d, head: 1 / heads }).youth; expect(y).toBeGreaterThanOrEqual(last); last = y; }
    expect(youthCues({ ...d, eyeLine: 0.35 }).youth).toBeGreaterThan(youthCues(d).youth);
    expect(youthCues({ ...d, eyeSize: 0.25 }).youth).toBeGreaterThan(youthCues(d).youth);
    expect(ageBand(0)).toBe('adult');
    expect(ageBand(1)).toBe('baby');
  });
  it('blends shape language barycentrically', () => {
    expect(normBary([2, 2, -1])).toEqual([0.5, 0.5, 0]);
    expect(dominantShape([0.7, 0.2, 0.1])).toBe('circle');
    expect(dominantShape([0.4, 0.35, 0.25])).toBe('mixed');
    const head = { circle: [[0, 0], [1, 1]] as const, square: [[0, 0], [2, 1]] as const, triangle: [[0, 0], [3, 1]] as const };
    expect(blendProfile(head, [1, 0, 0])[1][0]).toBe(1);
    expect(blendProfile(head, [0, 0.5, 0.5])[1][0]).toBe(2.5);
    expect(radiusAt([[0, 0], [1, 1]], 0.25)).toBe(0.25);
  });
  it('maps the shape pad corners and back', () => {
    for (const b of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.2, 0.3, 0.5]] as const) {
      const [x, y] = baryToPoint(b);
      pointToBary(x, y).forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
    }
    const outside = pointToBary(-500, 400);
    expect(outside.every(v => v >= 0)).toBe(true);
    expect(outside.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
});

describe('construction', () => {
  const each = (fn: (d: Design, id: string) => void) => { for (const p of PRESETS) for (const pose of ['neutral', 'open', 'action'] as const) fn({ ...p.design, pose }, `${p.id}/${pose}`); };
  it('every design stands exactly the configured height, head on top', () => {
    each((d, id) => {
      const f = buildFigure(d);
      expect(f.head.y + f.head.h, id).toBeCloseTo(H, 9);
      expect(f.head.h / H, id).toBeCloseTo(d.head, 9);
      expect(f.torso.y + f.torso.h, id).toBeLessThan(f.head.y + 1e-9);
      expect(f.drop, id).toBeGreaterThanOrEqual(0);
    });
  });
  it('keeps the eyes on the face and the legs under the hips', () => {
    each((d, id) => {
      const f = buildFigure(d);
      expect(f.eyes.y, id).toBeGreaterThan(f.head.y);
      expect(f.eyes.y, id).toBeLessThan(f.head.y + f.head.h);
      expect(f.eyes.x, id).toBeLessThanOrEqual(f.head.w * radiusAt(f.head.profile, d.eyeLine) * 0.82 + 1e-9);
      expect(f.legs[0].y, id).toBeCloseTo(f.torso.y, 9);
      expect(f.legs[0].upper + f.legs[0].lower, id).toBeLessThan(f.torso.y);
    });
  });
  it('wider eye spacing moves the eyes apart; longer limbs lengthen the legs', () => {
    const d = preset('cartoon').design;
    expect(buildFigure({ ...d, eyeGap: 1.6 }).eyes.x).toBeGreaterThan(buildFigure({ ...d, eyeGap: 0.6 }).eyes.x);
    expect(buildFigure({ ...d, limbs: 0.6 }).legs[0].upper).toBeGreaterThan(buildFigure({ ...d, limbs: 0.4 }).legs[0].upper);
  });
  it('presets sit inside the slider ranges', () => {
    for (const p of PRESETS) for (const k of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
      expect(p.design[k], `${p.id}.${k}`).toBeGreaterThanOrEqual(RANGES[k][0] - 1e-9);
      expect(p.design[k], `${p.id}.${k}`).toBeLessThanOrEqual(RANGES[k][1] + 1e-9);
    }
  });
  it('writes a brief that carries the proportions', () => {
    const d = preset('chibi').design;
    const text = briefText(d, readDesign(d));
    expect(text).toContain('2.5 heads tall (chibi proportions)');
    expect(text).toContain('circle shape language');
    expect(text).toContain('large eyes');
  });
});

const rect = (w: number, h: number, fill: (x: number, y: number) => boolean): Mask => {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fill(x, y) ? 1 : 0;
  return { w, h, data };
};

describe('silhouette metrics', () => {
  it('a solid block has no negative space', () => {
    const m = rect(20, 20, (x, y) => x >= 5 && x < 15 && y >= 2 && y < 18);
    expect(area(m)).toBe(160);
    expect(hullArea(m)).toBeCloseTo(160, 6);
    expect(readSilhouette(m, m)).toEqual({ solidity: 1, negative: 0, distinct: 0 });
  });
  it('limbs held away from the body add negative space', () => {
    const body = (x: number, y: number) => x >= 8 && x < 12 && y >= 4 && y < 20;
    const lump = rect(20, 20, body);
    const arms = rect(20, 20, (x, y) => body(x, y) || ((y === 6 || y === 7) && x >= 2 && x < 18));
    expect(readSilhouette(arms, lump).negative).toBeGreaterThan(readSilhouette(lump, lump).negative + 0.3);
  });
  it('IoU, hull and the readPixels flip', () => {
    const a = rect(4, 4, x => x < 2), b = rect(4, 4, x => x >= 2);
    expect(iou(a, a)).toBe(1);
    expect(iou(a, b)).toBe(0);
    expect(polygonArea(convexHull([[0, 0], [2, 0], [2, 2], [0, 2], [1, 1]]))).toBe(4);
    const rgba = new Uint8Array(2 * 2 * 4).fill(255);
    rgba[0] = 0; // bottom-left pixel in GL order
    expect([...maskFromRGBA(rgba, 2, 2).data]).toEqual([0, 0, 1, 0]);
  });
});

describe('exercises', () => {
  const solved = { solidity: 0.6, negative: 0.4, distinct: 0.5 }, unsolved = { solidity: 0.9, negative: 0.1, distinct: 0.05 };
  it('start unsolved from their own setup', () => {
    for (const ex of EXERCISES) {
      const d = { ...preset(ex.setup.preset).design, ...ex.setup.patch };
      expect(ex.checks(readDesign(d), unsolved, d).every(c => c.ok), ex.id).toBe(false);
    }
  });
  it('each one can be solved with the controls on the page', () => {
    const answers: Record<string, Design> = {
      younger: { ...preset('realistic').design, head: 1 / TARGETS.youngHeads, eyeLine: 0.42, eyeSize: 0.2 },
      villain: { ...preset('pip').design, shape: [0, 0.2, 0.8], eyeSize: 0.12, eyeGap: 0.6, head: 1 / 6 },
      silhouette: { ...preset('cartoon').design, thickness: 1.7, pose: 'open' },
      apart: { ...preset('pip').design, shape: [0, 0.3, 0.7], head: 1 / 7 },
    };
    for (const ex of EXERCISES) {
      const d = answers[ex.id];
      expect(ex.checks(readDesign(d), solved, d).filter(c => !c.ok).map(c => c.label), ex.id).toEqual([]);
    }
  });
});

describe('turnaround sheet', () => {
  const views = [{ minX: -0.6, maxX: 0.6 }, { minX: -0.4, maxX: 0.3 }, { minX: -0.15, maxX: 0.2 }];
  it('uses one scale, sizes each tile to its own view and fills the panel width', () => {
    const l = sheetLayout({ minY: 0, maxY: 1.5, views }, 460, 440);
    expect(l.tiles.reduce((a, t) => a + t.w, 0)).toBeCloseTo(460, 6);
    expect(l.tiles[0].w).toBeGreaterThan(l.tiles[1].w);
    expect(l.tiles[1].w).toBeGreaterThan(l.tiles[2].w);
    l.tiles.forEach((t, i) => expect(t.w / l.scale).toBeGreaterThanOrEqual(views[i].maxX - views[i].minX));
    expect(l.tiles[1].cx).toBeCloseTo(-0.05, 9);
    expect(l.bottom).toBeCloseTo(-1.5 * SHEET_MARGIN.bottom, 9);
    expect(l.top).toBeGreaterThanOrEqual(1.5 * (1 + SHEET_MARGIN.top) - 1e-9);
  });
  it('a slim figure is height-limited and fills the height', () => {
    const slim = sheetLayout({ minY: 0, maxY: 1.5, views: views.map(() => ({ minX: -0.1, maxX: 0.1 })) }, 460, 440);
    expect(slim.top - slim.bottom).toBeCloseTo(1.5 * (1 + SHEET_MARGIN.top + SHEET_MARGIN.bottom), 9);
  });
});
