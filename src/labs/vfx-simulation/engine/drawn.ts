import { IMPACT, bucketFrame, bucketPose, toCard, type BeatTimes, type Phys } from "./beat";
import { crownAngle, dropCount, slabArc, splashSize } from "./cartoon";
import { FPS, frameOf } from "./timing";
import { clamp01, easeOut, hash01, hashS, lerp, mulberry32, springSettle } from "./rng";

/**
 * The hand-drawn 2D treatment: graphic splash poses, the way a 2D effects animator keys them. Shapes are
 * flat fills with ink lines in card space (world x, y on a vertical card in front of the bucket) plus a
 * floor decal for the puddle (world x, z). The caller passes stepped time, so drawings hold for 2 or 3
 * frames; the impact frame is always a single frame on ones.
 */
export type Ink =
  | { kind: "fill"; pts: number[]; fill: string; line: number }
  | { kind: "stroke"; pts: number[]; color: string; width: number }
  | { kind: "star"; x: number; y: number; r: number; rot: number; fill: string };

export interface Drawing {
  /** Drawing number (changes only when a new drawing goes on screen). */
  index: number;
  phase: "rest" | "gather" | "flight" | "impact" | "breakdown" | "key" | "break" | "settle";
  card: Ink[];
  floor: Ink[];
  /** 1 on the impact frame (the whole picture flashes to two flat values). */
  impact: number;
  /** Card-space point of the impact flash. */
  flashAt: [number, number];
}

export const PAL = {
  water: "#62c6f4",
  shade: "#2f88cf",
  light: "#bfeaff",
  white: "#ffffff",
  ink: "#0f2a44",
  spark: "#fff3b8",
} as const;

const f = (n: number) => n / FPS;

/** Teardrop polygon: round head of radius r at (hx, hy), tail of length len pointing along (tx, ty). */
export function teardrop(hx: number, hy: number, r: number, tx: number, ty: number, len: number, seg = 14): number[] {
  const l = Math.hypot(tx, ty) || 1;
  const ux = tx / l;
  const uy = ty / l;
  const px = -uy;
  const py = ux;
  const pts: number[] = [];
  // head: the half circle facing away from the tail
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI / 2 + (i / seg) * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pts.push(hx + (ux * c + px * s) * r, hy + (uy * c + py * s) * r);
  }
  // flanks curving into the point
  const tipX = hx + ux * (r + len);
  const tipY = hy + uy * (r + len);
  for (let i = 1; i <= 5; i++) {
    const w = i / 6;
    const half = r * (1 - w) ** 1.6;
    pts.push(hx + ux * (len + r) * w + px * half * -1, hy + uy * (len + r) * w + py * half * -1);
  }
  pts.push(tipX, tipY);
  for (let i = 5; i >= 1; i--) {
    const w = i / 6;
    const half = r * (1 - w) ** 1.6;
    pts.push(hx + ux * (len + r) * w + px * half, hy + uy * (len + r) * w + py * half);
  }
  return pts;
}

/**
 * Bend a shape about a base point: each point rotates by an angle that grows with the square of its
 * distance from the base (a C-curve, the line of action a 2D effects animator draws through a jet).
 * Positive bends clockwise (to the right).
 */
export function bendAbout(pts: number[], bx: number, by: number, reach: number, amount: number): number[] {
  const out = pts.slice();
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i] - bx;
    const dy = pts[i + 1] - by;
    const d = Math.hypot(dx, dy) / reach;
    const a = -amount * d * d;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out[i] = bx + dx * c - dy * s;
    out[i + 1] = by + dx * s + dy * c;
  }
  return out;
}

/** A wobbly closed blob (n points) around (x, y) with radii rx, ry. */
export function blobPoly(x: number, y: number, rx: number, ry: number, n: number, wob: number, seed: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wob * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 1.7) * 0.4);
    pts.push(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
  }
  return pts;
}

/** Line boil: every new drawing redraws the line a little differently (seeded by drawing number). */
function boil(pts: number[], amount: number, seed: number) {
  if (amount <= 0) return pts;
  const rnd = mulberry32(seed);
  return pts.map((v) => v + (rnd() - 0.5) * amount);
}

/** The crown key pose: K teardrop spikes fanning from a cup, with detached tip drops. */
function crownShapes(cx: number, scale: number, p: Phys, k: number, boilAmt: number, seed: number, out: Ink[]) {
  const sz = splashSize(p) * scale;
  const H = (0.34 + 0.18 * p.intensity) * (0.75 + 0.5 * p.stylization) * scale;
  const cupW = 0.2 * sz;
  const spread = (68 + 10 * p.stylization) * (Math.PI / 180);
  const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => Math.abs(a - (k - 1) / 2) - Math.abs(b - (k - 1) / 2)).reverse();
  for (const i of order) {
    const a = k === 1 ? 0 : lerp(-spread, spread, i / (k - 1)) + hashS(i, 3) * 0.08;
    const len = H * (0.55 + 0.45 * Math.cos(a * 1.1)) * (0.85 + 0.3 * hash01(i, 5));
    const bx = cx + Math.sin(a) * cupW * 0.7;
    const by = 0.05 * sz;
    const dx = Math.sin(a);
    const dy = Math.cos(a);
    const r = (0.034 + 0.012 * hash01(i, 7)) * sz * (1 + 0.35 * p.stylization);
    // spike: a teardrop whose point sits in the cup and whose head is the crown tip, bent outward along a C-curve
    const bend = (Math.abs(a) < 0.12 ? 0.15 : Math.sign(a) * 0.55) * (0.8 + 0.4 * hash01(i, 9));
    const curve = (pts: number[]) => bendAbout(pts, bx, by, len * 1.6, bend);
    out.push({ kind: "fill", pts: boil(curve(teardrop(bx + dx * len, by + dy * len, r, -dx, -dy, len * 0.92)), boilAmt, seed + i), fill: PAL.water, line: 2.6 });
    // the free drop just past each tip: the classic dotted splash
    const gap = r * 1.9 + 0.012;
    out.push({ kind: "fill", pts: boil(curve(teardrop(bx + dx * (len + gap + r), by + dy * (len + gap + r), r * 0.62, -dx, -dy, r * 1.1)), boilAmt, seed + 40 + i), fill: PAL.water, line: 2.2 });
    if (Math.abs(a) > 0.3) out.push({ kind: "stroke", pts: boil(curve([bx + dx * len * 0.35 - dy * 0.012, by + dy * len * 0.35 + dx * 0.012, bx + dx * len * 0.75 - dy * 0.016, by + dy * len * 0.75 + dx * 0.016]), boilAmt * 0.5, seed + 80 + i), color: PAL.white, width: 2.2 });
  }
  // the cup: a wide, low splash body with a shaded underside
  out.push({ kind: "fill", pts: boil(blobPoly(cx, 0.045 * sz, cupW * 1.25, 0.065 * sz, 22, 0.08, seed), boilAmt, seed + 120), fill: PAL.water, line: 2.8 });
  out.push({ kind: "fill", pts: boil(blobPoly(cx + cupW * 0.25, 0.03 * sz, cupW * 0.75, 0.03 * sz, 14, 0.05, seed + 1), boilAmt, seed + 121), fill: PAL.shade, line: 0 });
  out.push({ kind: "stroke", pts: [cx - cupW * 0.9, 0.07 * sz, cx - cupW * 0.35, 0.09 * sz], color: PAL.white, width: 2.4 });
  return H;
}

function sparkles(cx: number, cy: number, spread: number, n: number, drawing: number, scale: number, out: Ink[]) {
  for (let i = 0; i < n; i++) {
    // twinkle: each sparkle is on for alternate drawings
    if ((drawing + i) % 3 === 2) continue;
    const a = hash01(i, 61) * Math.PI * 2;
    const d = spread * (0.6 + 0.5 * hash01(i, 67));
    out.push({ kind: "star", x: cx + Math.cos(a) * d, y: cy + Math.abs(Math.sin(a)) * d * 0.9, r: (0.028 + 0.02 * hash01(i + drawing, 71)) * scale, rot: hash01(i, 73) * 0.6, fill: PAL.spark });
  }
}

function speedLines(x: number, y: number, dx: number, dy: number, n: number, len: number, out: Ink[], seed: number) {
  const px = -dy;
  const py = dx;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 0.045 + hashS(i, seed) * 0.01;
    const back = 0.06 + 0.06 * hash01(i, seed + 1);
    const l = len * (0.6 + 0.4 * hash01(i, seed + 2));
    out.push({ kind: "stroke", pts: [x - dx * back + px * off, y - dy * back + py * off, x - dx * (back + l) + px * off, y - dy * (back + l) + py * off], color: PAL.ink, width: 2 });
  }
}

/** Impact lines: short radial dashes around a point. */
function impactLines(x: number, y: number, r0: number, r1: number, n: number, out: Ink[]) {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / Math.max(1, n - 1));
    out.push({ kind: "stroke", pts: [x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.8, x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.8], color: PAL.ink, width: 2.4 });
  }
}

/** Star-burst splat polygon (for the impact frame and landed drops). */
export function splat(x: number, y: number, r: number, spikes: number, seed: number, flat = 0.55): number[] {
  const pts: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = Math.PI * (i / spikes) + (seed % 7) * 0.1;
    const rr = i % 2 === 0 ? r * (0.85 + 0.3 * hash01(i, seed)) : r * 0.45;
    pts.push(x + Math.cos(a) * rr, y + Math.max(-0.01, Math.sin(a) * rr * flat));
  }
  return pts;
}

/**
 * The drawing on screen at stepped time t. `rawT` is the unstepped time (the impact frame is on ones).
 */
export function drawingAt(t: number, rawT: number, b: BeatTimes, p: Phys, step: number): Drawing {
  const index = Math.floor(frameOf(t) / step);
  const d: Drawing = { index, phase: "rest", card: [], floor: [], impact: 0, flashAt: toCard(IMPACT.x, 0.12, IMPACT.z) };
  const boilAmt = p.turbulence * 0.011;
  const seed = index * 131 + 7;
  const [ix] = toCard(IMPACT.x, 0, IMPACT.z);
  const gs = 1 / Math.sqrt(p.gravity);
  const k = dropCount(p);
  const sz = splashSize(p);
  const impactFrames = p.stylization > 0.7 ? 2 : 1;
  if (rawT >= b.impact && rawT < b.impact + f(impactFrames)) {
    d.impact = 1;
    d.phase = "impact";
    d.card.push({ kind: "fill", pts: splat(ix, 0.06, 0.36 * sz, 9, 3, 0.9), fill: PAL.white, line: 0 });
    return d;
  }
  if (t < b.kick + f(1)) return d;
  // floor: the puddle and its ripples (after the impact)
  if (t >= b.impact) {
    const since = t - b.impact;
    const R = (0.27 + 0.1 * p.intensity) * (1 + 0.25 * (1 - p.viscosity)) * sz;
    const r = Math.max(0.03, R * springSettle(since / (0.6 * gs * (1 + 0.4 * p.viscosity)), 0.22, 1.9));
    d.floor.push({ kind: "fill", pts: boil(blobPoly(IMPACT.x, IMPACT.z, r * 1.15, r * 0.95, 26, 0.1, 2), boilAmt * 0.6, seed + 200), fill: PAL.water, line: 2.6 });
    d.floor.push({ kind: "fill", pts: blobPoly(IMPACT.x + r * 0.2, IMPACT.z - r * 0.15, r * 0.55, r * 0.4, 16, 0.08, 5), fill: PAL.light, line: 0 });
    d.floor.push({ kind: "stroke", pts: [IMPACT.x - r * 0.75, IMPACT.z - r * 0.3, IMPACT.x - r * 0.35, IMPACT.z - r * 0.62], color: PAL.white, width: 3 });
    const ringU = (t - b.collapse + 0.1) / 0.6;
    if (ringU > 0 && ringU < 1) {
      const rr = r * lerp(0.5, 1.15, easeOut(ringU));
      d.floor.push({ kind: "stroke", pts: blobPoly(IMPACT.x, IMPACT.z, rr, rr * 0.85, 26, 0.04, 9).concat(blobPoly(IMPACT.x, IMPACT.z, rr, rr * 0.85, 26, 0.04, 9).slice(0, 2)), color: PAL.white, width: 2.4 });
    }
  }
  if (t < b.release) {
    // gather: a dome of water humps over the lip
    const fr = bucketFrame(bucketPose("drawn", t, b));
    const u = clamp01((t - b.kick) / Math.max(f(2), b.release - b.kick));
    const [mx, my] = toCard(fr.mouth[0], fr.mouth[1], 0);
    d.phase = "gather";
    d.card.push({ kind: "fill", pts: boil(blobPoly(mx + fr.dir[0] * 0.03, my + fr.dir[1] * 0.03, 0.1 * sz * easeOut(u), 0.06 * sz * easeOut(u), 16, 0.12, 4), boilAmt, seed), fill: PAL.water, line: 2.4 });
    return d;
  }
  if (t < b.impact) {
    // flight: one bold teardrop on the arc, tail trailing, with speed lines
    const a = slabArc("drawn", t, b, p);
    const [x, y] = toCard(a.x, a.y, IMPACT.z * a.u);
    const r = 0.1 * sz;
    const len = (0.16 + 0.22 * p.stylization) * a.speed * sz;
    d.phase = "flight";
    speedLines(x, y, a.dx, a.dy, 3, 0.22 + 0.15 * p.stylization, d.card, 11);
    d.card.push({ kind: "fill", pts: boil(teardrop(x, y, r, -a.dx, -a.dy, len), boilAmt, seed), fill: PAL.water, line: 2.8 });
    d.card.push({ kind: "stroke", pts: [x - a.dy * r * 0.45 - a.dx * r * 0.2, y + a.dx * r * 0.45 - a.dy * r * 0.2, x - a.dy * r * 0.2 + a.dx * r * 0.3, y + a.dx * r * 0.2 + a.dy * r * 0.3], color: PAL.white, width: 2.6 });
    return d;
  }
  if (t < b.holdEnd) {
    // rise: one breakdown drawing (small crown) then the key pose, held
    const breakdown = t < b.impact + f(1) + (b.peak - b.impact - f(1)) * 0.5;
    d.phase = breakdown ? "breakdown" : "key";
    const H = crownShapes(ix, breakdown ? 0.55 : 1, p, k, boilAmt, seed, d.card);
    if (!breakdown) {
      sparkles(ix, H * 0.55, H * 0.85, 2 + Math.round(3 * p.stylization), index, sz, d.card);
      impactLines(ix, 0.04, 0.32 * sz, 0.44 * sz, 5, d.card);
    }
    return d;
  }
  // break: spikes retract, tip drops fly out as teardrops and land as little splats
  const brk = t - b.holdEnd;
  const shrink = clamp01(brk / f(6));
  d.phase = "break";
  if (shrink < 1) crownShapes(ix, 1 - 0.75 * shrink, p, k, boilAmt, seed, d.card);
  let any = shrink < 1;
  const H = (0.34 + 0.18 * p.intensity) * (0.75 + 0.5 * p.stylization);
  for (let i = 0; i < k; i++) {
    const a = crownAngle(i, k);
    const side = Math.cos(a) >= 0 ? 1 : -1;
    const sx = ix + side * (0.08 + 0.12 * Math.abs(Math.cos(a))) * sz;
    const sy = H * (0.65 + 0.3 * hash01(i, 5));
    const dist = (0.22 + 0.22 * p.intensity) * (0.7 + 0.6 * hash01(i, 17)) * sz;
    const lx = sx + side * dist;
    const dur = 0.34 * gs * (0.85 + 0.3 * hash01(i, 29)) * (1 + 0.3 * p.viscosity);
    const apex = (0.06 + 0.1 * p.intensity) * (0.7 + 0.6 * hash01(i, 23));
    const v = brk / dur;
    const r = (0.03 + 0.012 * hash01(i, 7)) * sz * (1 + 0.35 * p.stylization);
    if (v < 1) {
      any = true;
      const x = lerp(sx, lx, v);
      const y = lerp(sy, r, v) + 4 * apex * v * (1 - v);
      const vx = lx - sx;
      const vy = r - sy + 4 * apex * (1 - 2 * v);
      d.card.push({ kind: "fill", pts: boil(teardrop(x, y, r, -vx, -vy, r * (1.3 + 1.4 * p.stylization)), boilAmt, seed + i), fill: PAL.water, line: 2.2 });
    } else if (brk - dur < f(4)) {
      any = true;
      d.card.push({ kind: "fill", pts: splat(lx, 0.012, r * 1.6, 4, i), fill: PAL.water, line: 2 });
    }
  }
  if (any) sparkles(ix, H * 0.4, H * 0.9, 2 + Math.round(2 * p.stylization), index, sz * (1 - shrink * 0.5), d.card);
  else {
    d.phase = "settle";
    // two last sparkles twinkle on the puddle, on threes, then stop
    if (t < b.settle + 0.5) sparkles(ix, 0.08, 0.25, 2, Math.floor(index / 1.5), sz * 0.8, d.card);
  }
  return d;
}

/** All the filled shapes of a drawing in card space (for the legibility raster). */
export function drawingFills(dw: Drawing): number[][] {
  return dw.card.filter((s): s is Extract<Ink, { kind: "fill" }> => s.kind === "fill").map((s) => s.pts);
}
