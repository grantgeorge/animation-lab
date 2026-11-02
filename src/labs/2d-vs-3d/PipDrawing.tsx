'use client';

import { useId, type ReactNode } from 'react';
import { BODY, CX, FLOOR_Y, PX, VIEW, boil, facing, headPoint, ik2d, pitch, project, skeleton, type P2, type Skeleton, type V3 } from './figure';
import { squashScale, type MovePose } from './move';

/**
 * Pip as a 2D character, in two techniques that share one skeleton:
 * - drawn: every drawing is made fresh at the camera angle: true foreshortening, squash & stretch,
 *   bendy "noodle" limbs, smears on fast moves, and a little line boil from drawing to drawing;
 * - cutout: rigid paper parts drawn once per view and only rotated about pivots. Limbs can't
 *   foreshorten, so a front-view crouch splays the knees; nothing can squash; mouths are swapped.
 */
const C = {
  coat: '#F2C14E', coatShade: '#D9A12F', coatDeep: '#B9821E', band: '#E0B040',
  skin: '#F7D9C2', skinShade: '#EDBFA3', blush: '#F2A99A', hair: '#7A3B22', hairDark: '#5C2A17',
  boots: '#2F6F73', bootsDark: '#215357', trousers: '#2F3A4A', toggle: '#3A2A1F',
  ink: '#2B1810', white: '#FBFBF6', pupil: '#1E130D', iris: '#6B3E22', mouth: '#5A1E1E', tongue: '#D0646A',
};

export type DrawMode = 'drawn' | 'cutout';
export interface PipDrawingProps {
  mode: DrawMode;
  pose: MovePose;
  /** Camera turn the drawing is made at (deg). */
  turn: number;
  /** Drawing number: seeds the line boil. */
  seed?: number;
  /** Hand-drawn smear: the poses between the previous drawing and this one. */
  smear?: MovePose[];
  pivots?: boolean;
  /** Render as a flat tinted silhouette (onion skin). */
  ghost?: string;
}

type Pt = { x: number; y: number };
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const f1 = (n: number) => Math.round(n * 10) / 10;

/** Smooth closed/open path through points (quadratic through midpoints). */
function smooth(pts: Pt[], closed = false) {
  if (pts.length < 3) return `M${pts.map(p => `${f1(p.x)},${f1(p.y)}`).join(' L')}`;
  const mid = (a: Pt, b: Pt) => lerp(a, b, 0.5);
  if (!closed) {
    let d = `M${f1(pts[0].x)},${f1(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i++) { const m = mid(pts[i], pts[i + 1]); d += ` Q${f1(pts[i].x)},${f1(pts[i].y)} ${f1(m.x)},${f1(m.y)}`; }
    const l = pts[pts.length - 1];
    return `${d} L${f1(l.x)},${f1(l.y)}`;
  }
  const n = pts.length;
  const s = mid(pts[n - 1], pts[0]);
  let d = `M${f1(s.x)},${f1(s.y)}`;
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); d += ` Q${f1(pts[i].x)},${f1(pts[i].y)} ${f1(m.x)},${f1(m.y)}`; }
  return `${d} Z`;
}

/** Projection for one drawing: drawn applies squash about the feet and boil; cut-out is exact. */
function makeProjector(mode: DrawMode, pose: MovePose, turn: number, seed: number) {
  const sq = mode === 'drawn' ? squashScale(pose.squash) : { y: 1, xz: 1 };
  const feetY = FLOOR_Y - pose.y * PX;
  const amp = mode === 'drawn' ? 1.1 : 0;
  return {
    sx: sq.xz, sy: sq.y,
    P(v: V3, id = 0): P2 {
      const p = project(v, turn);
      const b = amp && id ? boil(seed, id, amp) : { x: 0, y: 0 };
      return { x: CX + (p.x - CX) * sq.xz + b.x, y: feetY + (p.y - feetY) * sq.y + b.y, d: p.d };
    },
  };
}

export function PipDrawing({ mode, pose, turn, seed = 0, smear, pivots = false, ghost }: PipDrawingProps) {
  const sk = skeleton(pose);
  const pr = makeProjector(mode, pose, turn, seed);
  const s = Math.sin((turn * Math.PI) / 180);
  const drawn = mode === 'drawn';
  const W = drawn ? 2.6 + boil(seed, 99, 0.3).x : 1.2; // ink weight
  const ink = drawn ? C.ink : '#00000038';
  const paper = drawn ? undefined : 'url(#td-paper)';

  // ---- limbs ----
  const sh = sk.shoulder.map((v, i) => pr.P(v, 10 + i));
  const el = sk.elbow.map((v, i) => pr.P(v, 12 + i));
  const hd = sk.hand.map((v, i) => pr.P(v, 14 + i));
  const hp = sk.hip.map((v, i) => pr.P(v, 16 + i));
  const kn = sk.knee.map((v, i) => pr.P(v, 18 + i));
  const an = sk.ankle.map((v, i) => pr.P(v, 20 + i));
  const toe = sk.ankle.map((v, i) => pr.P([v[0], v[1] - 0.03, v[2] + 0.085], 22 + i));
  const heel = sk.ankle.map((v, i) => pr.P([v[0], v[1] - 0.03, v[2] - 0.02], 24 + i));
  const cosT = Math.cos((turn * Math.PI) / 180);

  // Cut-out: rigid lengths in the picture plane (no foreshortening).
  if (!drawn) {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const bendX = -s + side * 0.8 * cosT;
      const k = ik2d(hp[i], an[i], BODY.thigh * PX, BODY.shin * PX, bendX);
      kn[i] = { ...kn[i], ...k };
      const rigid = (a: P2, b: P2, len: number, fallback: Pt) => {
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
        const u = l > 2 ? { x: dx / l, y: dy / l } : fallback;
        return { ...b, x: a.x + u.x * len, y: a.y + u.y * len };
      };
      el[i] = rigid(sh[i], el[i], BODY.upper * PX, { x: 0, y: 1 });
      hd[i] = rigid(el[i], hd[i], BODY.fore * PX, { x: (el[i].x - sh[i].x) / (BODY.upper * PX), y: (el[i].y - sh[i].y) / (BODY.upper * PX) });
    }
  }

  const limbW = (m: number) => m * PX * pr.sx;
  const noodle = (a: Pt, m: Pt, b: Pt) => { const c = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 }; return `M${f1(a.x)},${f1(a.y)} Q${f1(c.x)},${f1(c.y)} ${f1(b.x)},${f1(b.y)}`; };

  const leg = (i: number) => {
    const sw = limbW(0.072);
    const bootTop = lerp(an[i], kn[i], 0.42);
    if (drawn) return <g key={`leg${i}`}>
      <path d={noodle(hp[i], kn[i], an[i])} stroke={ink} strokeWidth={sw + W * 2} fill="none" strokeLinecap="round" />
      <path d={noodle(hp[i], kn[i], an[i])} stroke={C.trousers} strokeWidth={sw} fill="none" strokeLinecap="round" />
      <path d={`M${f1(bootTop.x)},${f1(bootTop.y)} L${f1(an[i].x)},${f1(an[i].y)}`} stroke={ink} strokeWidth={limbW(0.074) + W * 2} strokeLinecap="round" />
      <path d={`M${f1(heel[i].x)},${f1(heel[i].y)} L${f1(toe[i].x)},${f1(toe[i].y)}`} stroke={ink} strokeWidth={limbW(0.064) + W * 2} strokeLinecap="round" />
      <path d={`M${f1(bootTop.x)},${f1(bootTop.y)} L${f1(an[i].x)},${f1(an[i].y)}`} stroke={C.boots} strokeWidth={limbW(0.074)} strokeLinecap="round" />
      <path d={`M${f1(heel[i].x)},${f1(heel[i].y)} L${f1(toe[i].x)},${f1(toe[i].y)}`} stroke={C.boots} strokeWidth={limbW(0.064)} strokeLinecap="round" />
    </g>;
    return <g key={`leg${i}`}>
      <Capsule a={hp[i]} b={kn[i]} w={limbW(0.072)} fill={C.trousers} paper={paper} />
      <Capsule a={kn[i]} b={an[i]} w={limbW(0.068)} fill={C.trousers} paper={paper} />
      <Capsule a={bootTop} b={an[i]} w={limbW(0.074)} fill={C.boots} paper={paper} />
      <Capsule a={heel[i]} b={toe[i]} w={limbW(0.064)} fill={C.boots} paper={paper} />
    </g>;
  };

  const arm = (i: number) => {
    const sw = limbW(0.066);
    const cuff = lerp(el[i], hd[i], 0.78);
    const hand = <circle cx={f1(hd[i].x)} cy={f1(hd[i].y)} r={f1(BODY.handR * PX * (drawn ? (pr.sx + pr.sy) / 2 : 1))} fill={C.skin} stroke={ink} strokeWidth={W} filter={paper} />;
    if (drawn) return <g key={`arm${i}`}>
      <path d={noodle(sh[i], el[i], cuff)} stroke={ink} strokeWidth={sw + W * 2} fill="none" strokeLinecap="round" />
      {hand}
      <path d={noodle(sh[i], el[i], cuff)} stroke={C.coat} strokeWidth={sw} fill="none" strokeLinecap="round" />
      <circle cx={f1(cuff.x)} cy={f1(cuff.y)} r={f1(sw * 0.5)} fill={C.band} />
    </g>;
    return <g key={`arm${i}`}>
      <Capsule a={sh[i]} b={el[i]} w={sw} fill={C.coat} paper={paper} />
      {hand}
      <Capsule a={el[i]} b={cuff} w={sw * 0.95} fill={C.coat} paper={paper} />
    </g>;
  };

  // ---- coat (a lathe around the pitched torso axis) ----
  const rings = BODY.coat.map(([h, r], j) => ({ c: pr.P([0, sk.pelvis[1] + pitch([0, h, 0], sk.torsoPitch)[1], pitch([0, h, 0], sk.torsoPitch)[2]], 30 + j), r: r * PX * pr.sx, h, rm: r }));
  const left = rings.map(g => ({ x: g.c.x - g.r, y: g.c.y })), right = rings.map(g => ({ x: g.c.x + g.r, y: g.c.y }));
  const hem = rings[0], hemRy = hem.r * 0.16;
  const coatPts = [...left.slice(1).reverse(), { x: hem.c.x - hem.r, y: hem.c.y }, { x: hem.c.x - hem.r * 0.7, y: hem.c.y + hemRy }, { x: hem.c.x, y: hem.c.y + hemRy * 1.15 }, { x: hem.c.x + hem.r * 0.7, y: hem.c.y + hemRy }, { x: hem.c.x + hem.r, y: hem.c.y }, ...right.slice(1)];
  const coatPath = `${smooth(coatPts, false)} Z`;
  const toggles = [-0.02, 0.08, 0.18].map((h, k) => {
    const r = BODY.coat.reduce((acc, [hh, rr], j, arr) => (h >= hh && j < arr.length - 1 && h <= arr[j + 1][0] ? rr + (arr[j + 1][1] - rr) * ((h - hh) / (arr[j + 1][0] - hh)) : acc), 0.17);
    const n = pitch([0, 0, 1], sk.torsoPitch);
    const base = pitch([0, h, 0], sk.torsoPitch);
    const v: V3 = [n[0] * r, sk.pelvis[1] + base[1] + n[1] * r, base[2] + n[2] * r];
    return { p: pr.P(v, 40 + k), f: facing(n, turn) };
  });
  const coat = <g key="coat" filter={paper}>
    <path d={coatPath} fill={C.coat} stroke={ink} strokeWidth={W} strokeLinejoin="round" />
    {drawn && <path d={smooth([...rings.slice(0, 5).map(g => ({ x: g.c.x + g.r * 0.97, y: g.c.y })).reverse(), ...rings.slice(0, 5).map((g, j) => ({ x: g.c.x + g.r * (0.5 + j * 0.06), y: g.c.y + (j === 0 ? hemRy : 0) }))], true)} fill={C.coatShade} opacity={0.7} />}
    <path d={`M${f1(hem.c.x - hem.r * 0.97)},${f1(hem.c.y + hemRy * 0.15)} Q${f1(hem.c.x)},${f1(hem.c.y + hemRy * 2.3)} ${f1(hem.c.x + hem.r * 0.97)},${f1(hem.c.y + hemRy * 0.15)}`} fill="none" stroke={C.band} strokeWidth={limbW(0.02)} strokeLinecap="round" />
    {toggles.map((t, k) => t.f > 0.12 && <g key={k}>
      <rect x={f1(t.p.x - 0.022 * PX * t.f * pr.sx)} y={f1(t.p.y - 0.007 * PX)} width={f1(0.044 * PX * t.f * pr.sx)} height={f1(0.014 * PX)} rx={2.5} fill={C.toggle} />
      <path d={`M${f1(t.p.x - 0.03 * PX * t.f)},${f1(t.p.y - 0.008 * PX)} q${f1(-0.012 * PX * t.f)},${f1(0.008 * PX)} 0,${f1(0.016 * PX)}`} stroke={C.toggle} strokeWidth={1.3} fill="none" />
    </g>)}
    <ellipse cx={f1(rings[5].c.x)} cy={f1(rings[5].c.y + 2)} rx={f1(rings[5].r * 1.25)} ry={f1(rings[5].r * 0.42)} fill={C.coatShade} stroke={ink} strokeWidth={W * 0.8} />
  </g>;

  // ---- head, face, hair, hat ----
  const head = <Head key="head" sk={sk} turn={turn} pose={pose} pr={pr} drawn={drawn} ink={ink} W={W} paper={paper} s={s} />;

  // ---- order: far arms, legs, coat, head, near arms ----
  const armDepth = sk.shoulder.map(v => project(v, turn).d);
  const far = [0, 1].filter(i => armDepth[i] < -0.03), near = [0, 1].filter(i => armDepth[i] >= -0.03);
  const legOrder = [0, 1].sort((a, b) => project(sk.hip[a], turn).d - project(sk.hip[b], turn).d);

  const smearShapes = drawn && smear && smear.length > 1 ? <Smear poses={[...smear, pose]} turn={turn} seed={seed} W={W} /> : null;
  const shadowR = BODY.coat[0][1] * PX * 1.25 * Math.max(0.45, 1 - pose.y * 1.6);
  const body = <>
    <ellipse cx={CX} cy={FLOOR_Y + 2} rx={f1(shadowR)} ry={f1(shadowR * 0.16)} fill="#000" opacity={drawn ? 0.12 : 0.18} />
    {smearShapes}
    {far.map(arm)}
    {legOrder.map(leg)}
    {coat}
    {head}
    {near.map(arm)}
    {pivots && !drawn && <Pivots pts={[...sh, ...el, ...hp, ...kn, ...an, pr.P(sk.neck), pr.P(sk.pelvis)]} />}
  </>;
  if (ghost) return <g filter={`url(#td-ghost-${ghost.replace('#', '')})`} opacity={0.5}>{body}</g>;
  return <g data-testid={`pip-${mode}`}>{body}</g>;
}

function Head({ sk, turn, pose, pr, drawn, ink, W, paper, s }: { sk: Skeleton; turn: number; pose: MovePose; pr: ReturnType<typeof makeProjector>; drawn: boolean; ink: string; W: number; paper?: string; s: number }) {
  // Drawn heads are re-drawn in perspective; a cut-out head is one drawing rotated in the picture plane.
  const clipId = useId().replace(/:/g, '');
  const pitchDeg = drawn ? sk.headPitch : 0;
  const rot = drawn ? 0 : sk.headPitch * s * -1;
  const hk: Skeleton = { ...sk, headPitch: pitchDeg };
  const c = pr.P(sk.head, 50);
  const base = project(sk.head, turn);
  const L = (v: V3): Pt => { const p = project(v, turn); return { x: (p.x - base.x) * pr.sx, y: (p.y - base.y) * pr.sy }; };
  const R = BODY.headR * PX;
  const feat = (lon: number, lat: number, r: number = BODY.headR) => { const h = headPoint(hk, lon, lat, r); return { at: L(h.p), f: facing(h.n, turn) }; };

  const eyes = [22, -22].map(lon => feat(lon, -7));
  const wide = 1 + pose.wide * 0.16;
  const er = 0.037 * PX * wide;
  const curls = [] as { at: Pt; f: number; r: number }[];
  for (const [lon, lat, r] of [[-48, 9, 0.022], [-24, 12, 0.024], [0, 13, 0.024], [24, 12, 0.024], [48, 9, 0.022], [-108, -6, 0.026], [108, -6, 0.026], [-128, -16, 0.026], [128, -16, 0.026], [-140, 0, 0.028], [140, 0, 0.028], [-162, -12, 0.028], [162, -12, 0.028], [180, 2, 0.028]] as const) {
    curls.push({ ...feat(lon, lat, BODY.headR * 1.01), r: r * PX });
  }
  // The sou'wester: a bell crown on a brim that droops at the sides and back. Rings are built in
  // the head's space, pitched with the head, and drawn as silhouettes, so they hold up at any angle.
  const RADc = Math.PI / 180;
  const across: V3 = [Math.cos(turn * RADc), 0, -Math.sin(turn * RADc)];
  const hat = (v: V3) => add3(sk.head, pitch(v, pitchDeg));
  const ring = (n: number, fn: (phi: number) => { r: number; y: number }) => Array.from({ length: n }, (_, k) => {
    const phi = (k / n) * Math.PI * 2, { r, y } = fn(phi);
    const v = hat([Math.sin(phi) * r, y, Math.cos(phi) * r]);
    return { ...L(v), d: project(v, turn).d - base.d };
  });
  const back = (phi: number) => (1 - Math.cos(phi)) / 2;
  const outer = ring(48, phi => ({ r: 0.2 + 0.065 * back(phi), y: 0.035 - 0.05 * back(phi) }));
  const inner = ring(48, () => ({ r: 0.15, y: 0.05 }));
  const arc = (pts: { x: number; y: number; d: number }[]) => {
    const n = pts.length, st = pts.findIndex((p, k) => p.d >= 0 && pts[(k + n - 1) % n].d < 0);
    const outA: Pt[] = [];
    for (let k = 0; k < n && st >= 0; k++) { const p = pts[(st + k) % n]; if (p.d >= 0) outA.push(p); else break; }
    return outA;
  };
  const fo = arc(outer), fi = arc(inner);
  const brimFront = fo.length > 2 && fi.length > 1 ? `${smooth(fo)} L${f1(fi[fi.length - 1].x)},${f1(fi[fi.length - 1].y)} ${fi.slice().reverse().map(p => `L${f1(p.x)},${f1(p.y)}`).join(' ')} Z` : null;
  // Crown profile [radius, height above the head centre]: bell-shaped, rounded on top.
  const crownProfile = [[0.15, 0.05], [0.152, 0.1], [0.135, 0.155], [0.095, 0.195], [0.04, 0.214]] as const;
  const crownRings = crownProfile.map(([r, y]) => { const c0 = L(hat([0, y, 0])); const e = L(add3(hat([0, y, 0]), mul3(pitch(across, pitchDeg), r))); return { c: c0, v: { x: e.x - c0.x, y: e.y - c0.y } }; });
  const topPt = L(hat([0, 0.218, 0]));
  const crown = smooth([...crownRings.map(g => ({ x: g.c.x - g.v.x, y: g.c.y - g.v.y })), topPt, ...crownRings.slice().reverse().map(g => ({ x: g.c.x + g.v.x, y: g.c.y + g.v.y }))]) + ' Z';
  const bandPts = fi.map(p => ({ x: p.x, y: p.y - 0.014 * PX }));

  const nose = feat(0, -16, BODY.headR * 1.07);
  const mouth = feat(0, -33);
  const blush = [40, -40].map(lon => feat(lon, -22));
  const brows = [22, -22].map(lon => feat(lon, 6 + pose.wide * 4));
  // Cut-outs swap between three mouth drawings; the drawn mouth is drawn to any shape.
  const open = drawn ? pose.mouth : pose.mouth < 0.25 ? 0 : pose.mouth < 0.65 ? 0.5 : 1;

  // Eyes: solid shapes, not outlined rings. The drawing can also add lids (a squint on the squash
  // frames); the cut-out only has its two eye drawings (open and wide).
  const lid = drawn ? Math.min(0.5, Math.max(0, (1 - pose.squash) * 2.6)) : 0;
  const eyesEl = <>{eyes.map((e, i) => {
    if (e.f <= 0.05) return null;
    const rx = er * Math.max(0.2, e.f) * pr.sx, ry = er * 1.1 * pr.sy, look = s > 0.5 ? -er * 0.22 : 0;
    const yL = e.at.y - ry + lid * 2 * ry, hw = rx * Math.sqrt(Math.max(0, 1 - ((yL - e.at.y) / ry) ** 2));
    return <g key={i}>
      <ellipse cx={f1(e.at.x)} cy={f1(e.at.y)} rx={f1(rx)} ry={f1(ry)} fill={C.white} stroke="#3a241860" strokeWidth={0.9} />
      <ellipse cx={f1(e.at.x + look)} cy={f1(e.at.y + er * 0.12)} rx={f1(rx * 0.8 / wide)} ry={f1(ry * 0.82 / wide)} fill={C.iris} />
      <ellipse cx={f1(e.at.x + look * 1.15)} cy={f1(e.at.y + er * 0.16)} rx={f1(rx * 0.52 / wide)} ry={f1(ry * 0.56 / wide)} fill={C.pupil} />
      <circle cx={f1(e.at.x + look + er * 0.26 * e.f)} cy={f1(e.at.y - er * 0.2)} r={f1(er * 0.24)} fill="#fff" />
      <circle cx={f1(e.at.x + look - er * 0.2 * e.f)} cy={f1(e.at.y + er * 0.34)} r={f1(er * 0.1)} fill="#fff" opacity={0.8} />
      {lid > 0.02 && <path data-testid="lid" d={`M${f1(e.at.x - hw)},${f1(yL)} A${f1(rx)},${f1(ry)} 0 0 1 ${f1(e.at.x + hw)},${f1(yL)} Q${f1(e.at.x)},${f1(yL + ry * 0.18)} ${f1(e.at.x - hw)},${f1(yL)} Z`} fill={C.skinShade} stroke={C.ink} strokeWidth={W * 0.6} strokeLinejoin="round" />}
    </g>;
  })}</>;
  const browsEl = <>{brows.map((b, i) => b.f > 0.1 && <path key={i} d={`M${f1(b.at.x - 0.028 * PX * b.f)},${f1(b.at.y + 2)} q${f1(0.028 * PX * b.f)},${f1(-4 - pose.wide * 3)} ${f1(0.056 * PX * b.f)},0`} stroke={C.hairDark} strokeWidth={W * 1.05} fill="none" strokeLinecap="round" />)}</>;
  const mouthEl = <>{mouth.f > 0.15 && (open < 0.05
      ? <path d={`M${f1(mouth.at.x - 0.026 * PX * mouth.f)},${f1(mouth.at.y - 2)} q${f1(0.026 * PX * mouth.f)},8 ${f1(0.052 * PX * mouth.f)},0`} stroke={C.ink} strokeWidth={W * 0.85} fill="none" strokeLinecap="round" />
      : <g>
        <ellipse cx={f1(mouth.at.x)} cy={f1(mouth.at.y + open * 3)} rx={f1(0.028 * PX * mouth.f * (1 - open * 0.15))} ry={f1(0.008 * PX + open * 0.028 * PX)} fill={C.mouth} stroke={C.ink} strokeWidth={W * 0.75} />
        <ellipse cx={f1(mouth.at.x)} cy={f1(mouth.at.y + open * 3 + open * 0.016 * PX)} rx={f1(0.015 * PX * mouth.f)} ry={f1(0.009 * PX * open)} fill={C.tongue} />
      </g>)}</>;

  return <g transform={`translate(${f1(c.x)} ${f1(c.y)}) rotate(${f1(rot)})`} filter={paper} data-mouth={drawn ? undefined : open}>
    <path d={smooth(outer, true)} fill={C.coatShade} stroke={ink} strokeWidth={W} strokeLinejoin="round" />
    {curls.filter(k => k.f < -0.05).map((k, i) => <circle key={`b${i}`} cx={f1(k.at.x)} cy={f1(k.at.y)} r={f1(k.r)} fill={C.hairDark} stroke={ink} strokeWidth={W * 0.6} />)}
    <clipPath id={clipId}><ellipse cx={0} cy={0} rx={f1(R * pr.sx)} ry={f1(R * 1.04 * pr.sy)} /></clipPath>
    <ellipse cx={0} cy={0} rx={f1(R * pr.sx)} ry={f1(R * 1.04 * pr.sy)} fill={C.skin} stroke={ink} strokeWidth={W} />
    <g clipPath={`url(#${clipId})`}>
    {drawn && <path d={`M${f1(R * 0.92 * pr.sx)},${f1(-R * 0.1)} A${f1(R * pr.sx)},${f1(R * pr.sy)} 0 0 1 ${f1(-R * 0.2)},${f1(R * pr.sy * 1.02)} Q${f1(R * 0.75)},${f1(R * 0.6)} ${f1(R * 0.92 * pr.sx)},${f1(-R * 0.1)} Z`} fill={C.skinShade} opacity={0.5} />}
    {blush.map((b, i) => b.f > 0.1 && <ellipse key={i} cx={f1(b.at.x)} cy={f1(b.at.y)} rx={f1(0.03 * PX * b.f)} ry={f1(0.019 * PX)} fill={C.blush} opacity={0.75} />)}
    {eyesEl}{browsEl}{mouthEl}
    </g>
    {curls.filter(k => k.f >= -0.05).map((k, i) => <circle key={`f${i}`} cx={f1(k.at.x)} cy={f1(k.at.y)} r={f1(k.r)} fill={C.hair} stroke={ink} strokeWidth={W * 0.6} />)}
    {nose.f > -0.3 && <ellipse cx={f1(nose.at.x)} cy={f1(nose.at.y)} rx={f1(0.022 * PX)} ry={f1(0.019 * PX)} fill={C.skinShade} stroke={ink} strokeWidth={W * 0.45} />}
    <path d={crown} fill={C.coat} stroke={ink} strokeWidth={W} strokeLinejoin="round" />
    {drawn && <path d={smooth(crownRings.slice(1).map(g => ({ x: g.c.x + g.v.x * 0.62, y: g.c.y + g.v.y * 0.62 })))} fill="none" stroke={C.coatShade} strokeWidth={5} strokeLinecap="round" opacity={0.8} />}
    {bandPts.length > 1 && <path d={smooth(bandPts)} fill="none" stroke={C.coatDeep} strokeWidth={0.024 * PX} strokeLinecap="butt" opacity={0.75} />}
    {brimFront && <path d={brimFront} fill={C.coat} stroke={ink} strokeWidth={W} strokeLinejoin="round" />}
  </g>;
}

const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** A hand-drawn smear: the area the forearm sweeps between two drawings, drawn as one shape. */
function Smear({ poses, turn, seed, W }: { poses: MovePose[]; turn: number; seed: number; W: number }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < 2; i++) {
    const pts = poses.map(p => { const pr = makeProjector('drawn', p, turn, seed); const k = skeleton(p); return { h: pr.P(k.hand[i]), e: pr.P(k.elbow[i]) }; });
    const travel = pts.slice(1).reduce((acc, p, k) => acc + Math.hypot(p.h.x - pts[k].h.x, p.h.y - pts[k].h.y), 0);
    if (travel < 70) continue;
    // A tapered ribbon along the hand's path (thin where the arm was, full width where it arrives),
    // with "multiples": faint extra hands along the way.
    const n = pts.length, A: Pt[] = [], B: Pt[] = [];
    pts.forEach((p, k) => {
      const a = pts[Math.max(0, k - 1)].h, b = pts[Math.min(n - 1, k + 1)].h;
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, w = 0.034 * PX * (0.4 + 0.6 * (k / (n - 1)) ** 0.7);
      A.push({ x: p.h.x - (dy / l) * w, y: p.h.y + (dx / l) * w }); B.push({ x: p.h.x + (dy / l) * w, y: p.h.y - (dx / l) * w });
    });
    out.push(<g key={i} data-testid="smear">
      <path d={smooth([...A, ...B.reverse()], true)} fill={C.coat} stroke={C.ink} strokeWidth={W * 0.7} strokeLinejoin="round" />
      {[0.35, 0.65].map(k => { const p = pts[Math.round((n - 1) * k)].h; return <circle key={k} cx={f1(p.x)} cy={f1(p.y)} r={f1(BODY.handR * PX * 0.8)} fill={C.skin} stroke={C.ink} strokeWidth={W * 0.6} opacity={0.55} />; })}
    </g>);
  }
  return <>{out}</>;
}

/** A rigid paper part between two pivots. */
function Capsule({ a, b, w, fill, paper }: { a: Pt; b: Pt; w: number; fill: string; paper?: string }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y), ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return <g transform={`translate(${f1(a.x)} ${f1(a.y)}) rotate(${f1(ang)})`} filter={paper}>
    <rect x={f1(-w / 2)} y={f1(-w / 2)} width={f1(len + w)} height={f1(w)} rx={f1(w / 2)} fill={fill} stroke="#00000030" strokeWidth={1} />
  </g>;
}

function Pivots({ pts }: { pts: Pt[] }) {
  return <g data-testid="pivots" pointerEvents="none">
    {pts.map((p, i) => <g key={i} transform={`translate(${f1(p.x)} ${f1(p.y)})`}>
      <circle r={4.5} fill="#ffffffd0" stroke="#d6453d" strokeWidth={1.4} />
      <path d="M-7,0 H7 M0,-7 V7" stroke="#d6453d" strokeWidth={1} />
    </g>)}
  </g>;
}

/** Shared SVG defs: paper drop shadow for cut-out parts, onion-skin tints. */
export function DrawingDefs() {
  const tint = (id: string, r: number, g: number, b: number) => <filter id={`td-ghost-${id}`} key={id}><feColorMatrix type="matrix" values={`0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0`} /></filter>;
  return <defs>
    <filter id="td-paper" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.1" floodColor="#000" floodOpacity="0.35" /></filter>
    {tint('d6453d', 0.84, 0.27, 0.24)}
    {tint('2f8f6f', 0.18, 0.56, 0.44)}
  </defs>;
}

export const VIEWBOX = `0 0 ${VIEW} ${VIEW}`;
