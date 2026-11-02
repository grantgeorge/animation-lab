import { COUNT_RANGE, IMPACT, bucketFrame, bucketPose, type BeatTimes, type Phys, type Treatment } from "./beat";
import { FPS } from "./timing";
import { clamp01, easeIn, easeOut, easeOutBack, hash01, lerp, springSettle, wobble } from "./rng";

/**
 * The cartoon 3D treatment: an authored splash. Nothing here is simulated. Every shape is a pose on a
 * timed curve: a gathered bulge (anticipation), a slab on a drawn arc, a one-frame squash, a crown that
 * pops up and holds, drops that snap off on authored arcs, a puddle that overshoots and settles.
 */
export interface Blob {
  x: number;
  y: number;
  z: number;
  r: number;
  /** Volume-preserving stretch along (dx, dy): > 1 stretched, < 1 squashed. */
  stretch: number;
  dx: number;
  dy: number;
  /** Gets a cartoon shine. */
  shine: boolean;
}

export interface Crown {
  x: number;
  z: number;
  /** Rim height, base radius, rim radius (m). */
  h: number;
  r0: number;
  r1: number;
  /** Number of points on the rim, their height as a share of h. */
  points: number;
  spike: number;
  /** Per-point height jitter (turbulence), length = points. */
  jitter: number[];
  thick: number;
}

export interface Disc {
  x: number;
  z: number;
  r: number;
  /** Edge wobble amplitude (share of r) and phase. */
  wob: number;
  phase: number;
}

export interface CartoonPose {
  phase: "rest" | "gather" | "flight" | "squash" | "rise" | "hold" | "break" | "settle";
  blobs: Blob[];
  crown: Crown | null;
  puddle: Disc | null;
  satellites: Disc[];
  ring: { x: number; z: number; r: number; alpha: number } | null;
  /** Highest point of the airborne splash (m), for curves and readouts. */
  top: number;
}

const f = (n: number) => n / FPS;
export const countNorm = (count: number) => clamp01((count - COUNT_RANGE.min) / (COUNT_RANGE.high - COUNT_RANGE.min));

/** How many drops the stylized treatments draw: fewer, bigger shapes as stylization rises. */
export function dropCount(p: Phys) {
  return Math.max(3, Math.round(lerp(4, 9, countNorm(p.count)) * (1 - 0.3 * p.viscosity) * (1 - 0.3 * p.stylization)));
}

/** Overall size of the stylized splash. */
export const splashSize = (p: Phys) => 0.8 + 0.3 * p.intensity;

/**
 * The slab's authored arc from the bucket mouth to the landing mark (shared by the cartoon and the
 * hand-drawn treatments). Returns position, unit direction and a 0..1 speed.
 */
export function slabArc(tr: Treatment, t: number, b: BeatTimes, p: Phys) {
  const fr = bucketFrame(bucketPose(tr, b.release, b));
  const S = [fr.mouth[0] + fr.dir[0] * 0.04, fr.mouth[1] + fr.dir[1] * 0.04];
  const E = [IMPACT.x, 0.06];
  const lift = (0.12 + 0.1 * p.intensity) * (0.6 + 0.8 * p.stylization);
  const C = [(S[0] + E[0]) / 2 + 0.05, Math.max(S[1], E[1]) + lift];
  const u = clamp01((t - b.release) / Math.max(1e-6, b.impact - b.release));
  // accelerating along the arc, as if gravity pulled it in (authored, not integrated)
  const v = u ** 1.55;
  const bez = (a: number, c: number, e: number, w: number) => (1 - w) * (1 - w) * a + 2 * (1 - w) * w * c + w * w * e;
  const x = bez(S[0], C[0], E[0], v);
  const y = bez(S[1], C[1], E[1], v);
  const w2 = Math.min(0.999, v + 0.02);
  let dx = bez(S[0], C[0], E[0], w2) - x;
  let dy = bez(S[1], C[1], E[1], w2) - y;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  return { x, y, dx, dy, speed: 0.35 + 0.65 * u, u };
}

/** Rim point k of the crown (angle around Y, measured from +X toward +Z). */
export function crownAngle(k: number, n: number) {
  return (k / n) * Math.PI * 2 + 0.35;
}

/** Drop k's landing distance and arc. */
function dropArc(k: number, n: number, p: Phys, gs: number) {
  const h = hash01(k, 17);
  return {
    dist: (0.2 + 0.2 * p.intensity) * (0.75 + 0.5 * h) * splashSize(p),
    apex: (0.08 + 0.12 * p.intensity) * (0.7 + 0.6 * hash01(k, 23)) * (0.7 + 0.6 * p.stylization),
    dur: 0.34 * gs * (0.85 + 0.3 * hash01(k, 29)) * (1 + 0.3 * p.viscosity),
    a: crownAngle(k, n) + (hash01(k, 31) - 0.5) * 0.3,
  };
}

/** Crown dimensions at its peak. */
export function crownPeak(p: Phys) {
  const sz = splashSize(p);
  return {
    h: (0.16 + 0.12 * p.intensity) * (0.7 + 0.6 * p.stylization),
    r0: 0.13 * sz,
    flare: (0.12 + 0.1 * p.stylization) * sz,
    spike: 0.45 + 0.45 * p.stylization,
    thick: 0.022 + 0.02 * p.viscosity,
  };
}

export function cartoonPose(t: number, b: BeatTimes, p: Phys): CartoonPose {
  const gs = 1 / Math.sqrt(p.gravity);
  const sz = splashSize(p);
  const styl = p.stylization;
  const sq = 1 - 0.5 * p.viscosity;
  const turb = p.turbulence;
  const n = dropCount(p);
  const out: CartoonPose = { phase: "rest", blobs: [], crown: null, puddle: null, satellites: [], ring: null, top: 0 };
  if (t < b.kick + f(1)) return out;
  // 1. gather: the water bulges out of the mouth while the bucket rears back
  if (t < b.release) {
    const fr = bucketFrame(bucketPose("cartoon", t, b));
    const u = clamp01((t - b.kick) / Math.max(f(2), b.release - b.kick));
    // a wide dome swelling over the lip (squashed along the bucket's axis), not a ball
    const r = 0.13 * sz * (0.35 + 0.65 * easeOut(u));
    const st = 0.42 + 0.28 * u * sq;
    out.phase = "gather";
    out.blobs.push({ x: fr.mouth[0] - fr.dir[0] * r * 0.05, y: fr.mouth[1] - fr.dir[1] * r * 0.05, z: 0, r, stretch: st, dx: fr.dir[0], dy: fr.dir[1], shine: true });
    out.top = fr.mouth[1] + r * st;
    return out;
  }
  // 2. flight: the slab on its drawn arc, stretched by speed, two smaller blobs trailing
  if (t < b.impact) {
    out.phase = "flight";
    const rs = [0.11, 0.075, 0.05];
    const lags = [0, 0.2, 0.38];
    for (let i = 0; i < 3; i++) {
      const a = slabArc("cartoon", t - lags[i] * (b.impact - b.release), b, p);
      if (t - lags[i] * (b.impact - b.release) < b.release) continue;
      const wob = turb * 0.012 * wobble(t * 9, i, 0, 3);
      out.blobs.push({ x: a.x + wob, y: a.y, z: IMPACT.z * a.u, r: rs[i] * sz, stretch: 1 + (0.25 + 0.55 * styl) * a.speed * sq, dx: a.dx, dy: a.dy, shine: i === 0 });
      out.top = Math.max(out.top, a.y + rs[i] * sz);
    }
    return out;
  }
  const since = t - b.impact;
  // puddle: overshoots past its rest radius and settles (snappy settle)
  const R = (0.27 + 0.1 * p.intensity) * (1 + 0.25 * (1 - p.viscosity)) * sz;
  const pu = springSettle(since / (0.6 * gs * (1 + 0.4 * p.viscosity)), 0.22, 1.9);
  out.puddle = { x: IMPACT.x, z: IMPACT.z, r: Math.max(0.02, R * pu), wob: (0.05 + 0.12 * turb) * Math.exp(-since * 1.5) + 0.03, phase: since * (2 + 6 * turb) };
  // 3. squash: one frame of pancake on contact
  if (t < b.impact + f(1)) {
    out.phase = "squash";
    out.blobs.push({ x: IMPACT.x, y: 0.045 * sz, z: IMPACT.z, r: 0.14 * sz, stretch: 0.42 + 0.1 * p.viscosity, dx: 0, dy: 1, shine: true });
    out.top = 0.09 * sz;
    return out;
  }
  const pk = crownPeak(p);
  const jitter = Array.from({ length: n }, (_, k) => turb * 0.25 * wobble(k * 3.1, t * (1 + 4 * turb), 0, 7));
  const crown: Crown = { x: IMPACT.x, z: IMPACT.z, h: 0, r0: pk.r0, r1: pk.r0, points: n, spike: pk.spike, jitter, thick: pk.thick };
  const tipOf = (k: number, c: Crown, lift = 0): [number, number, number] => {
    const a = crownAngle(k, c.points);
    const th = c.h * (1 + c.spike * (1 + c.jitter[k])) + lift;
    return [c.x + Math.cos(a) * c.r1 * 1.12, th, c.z + Math.sin(a) * c.r1 * 1.12];
  };
  const tipR = (k: number) => (0.026 + 0.012 * hash01(k, 41)) * sz * (1 + 0.35 * styl);
  if (t < b.holdEnd) {
    // 4. rise (fast, overshooting) and 5. a moving hold on the peak
    const rising = t < b.peak;
    const u = rising ? (t - b.impact - f(1)) / Math.max(1e-6, b.peak - b.impact - f(1)) : 1;
    const drift = rising ? 0 : (t - b.peak) / Math.max(f(1), b.holdEnd - b.peak);
    out.phase = rising ? "rise" : "hold";
    crown.h = pk.h * easeOutBack(u, 1.2) * (1 + 0.05 * drift);
    crown.r0 = pk.r0 * (0.7 + 0.3 * easeOut(u));
    crown.r1 = crown.r0 + pk.flare * easeOut(u) * (1 + 0.08 * drift);
    out.crown = crown;
    for (let k = 0; k < n; k++) {
      const [x, y, z] = tipOf(k, crown, 0.045 + 0.02 * drift);
      out.blobs.push({ x, y, z, r: tipR(k) * easeOut(u), stretch: 1 + 0.35 * sq * (1 - drift * 0.5), dx: 0, dy: 1, shine: false });
      out.top = Math.max(out.top, y + tipR(k));
    }
    return out;
  }
  // 6. break: drops snap off on authored arcs; the crown falls in on itself
  const brk = t - b.holdEnd;
  const cu = clamp01(brk / f(5));
  if (cu < 1) {
    crown.h = pk.h * (1 - easeIn(cu)) * 1.05;
    crown.r0 = pk.r0;
    crown.r1 = pk.r0 + pk.flare * (1 + 0.5 * cu);
    crown.spike = pk.spike * (1 - cu);
    crown.thick = pk.thick * (1 + cu);
    out.crown = crown;
    out.top = crown.h * (1 + crown.spike);
  }
  const peakCrown: Crown = { ...crown, h: pk.h * 1.05, r0: pk.r0, r1: pk.r0 + pk.flare * 1.08, spike: pk.spike };
  let flying = 0;
  for (let k = 0; k < n; k++) {
    const d = dropArc(k, n, p, gs);
    const [sx, sy, sz0] = tipOf(k, peakCrown, 0.035);
    const lx = IMPACT.x + Math.cos(d.a) * (peakCrown.r1 + d.dist);
    const lz = IMPACT.z + Math.sin(d.a) * (peakCrown.r1 + d.dist) * 0.8;
    const v = brk / d.dur;
    const r = tipR(k);
    if (v < 1) {
      flying++;
      const y = lerp(sy, r * 0.8, v) + 4 * d.apex * v * (1 - v);
      const vy = sy * -1 + r + 4 * d.apex * (1 - 2 * v);
      const vx = (lx - sx) / 1;
      const l = Math.hypot(vx, vy) || 1;
      const speed = Math.min(1, Math.abs(vy) / 0.8 + 0.3);
      out.blobs.push({ x: lerp(sx, lx, v) + turb * 0.02 * wobble(v * 5, k, 1, 5), y, z: lerp(sz0, lz, v), r, stretch: 1 + (0.4 + 1.1 * styl) * speed * sq, dx: vx / l, dy: vy / l, shine: k % 2 === 0 });
      out.top = Math.max(out.top, y + r);
    } else {
      // land: a two-frame squash, then a blot that joins the puddle
      const after = brk - d.dur;
      if (after < f(2)) out.blobs.push({ x: lx, y: r * 0.35, z: lz, r: r * 1.15, stretch: 0.45, dx: 0, dy: 1, shine: false });
      out.satellites.push({ x: lx, z: lz, r: r * 1.5 * springSettle(after / 0.25, 0.25, 2), wob: 0.08, phase: k });
    }
  }
  out.phase = cu < 1 || flying > 0 ? "break" : "settle";
  // 7. settle: one ring runs out across the puddle
  const ringU = (t - b.collapse + 0.1) / 0.6;
  if (ringU > 0 && ringU < 1) out.ring = { x: IMPACT.x, z: IMPACT.z, r: R * lerp(0.35, 1.25, easeOut(ringU)), alpha: 1 - ringU };
  return out;
}
