import { ease } from "./bezier";
import { FLIGHT_VX, FPS, type MotionParams, TRAVEL, sanitize } from "./params";

export type Phase = "idle" | "antic" | "rise" | "fall" | "contact" | "settle" | "hold";

/** A span of the performance in (float) frames [f0, f1). Heights are the bottom of the body above the floor. */
export interface Segment {
  phase: Phase;
  f0: number;
  f1: number;
  /** Peak height of the arc this segment belongs to (rise/fall), else 0. */
  apex: number;
  /** Horizontal position at f0 and f1. */
  x0: number;
  x1: number;
  /** Arc index: 0 = the jump, 1.. = rebounds. -1 before takeoff. */
  bounce: number;
}

export interface Contact {
  /** First frame on the floor (the impact frame). */
  frame: number;
  /** Frames on the floor, including the impact frame. */
  frames: number;
  /** Vertical speed at impact, units per frame. */
  impact: number;
  /** Arc that ended in this contact. */
  bounce: number;
  /** true for the final landing that leads into the settle. */
  last: boolean;
}

export interface Arc {
  bounce: number;
  takeoff: number;
  apexFrame: number;
  land: number;
  height: number;
}

export interface Timeline {
  params: MotionParams;
  fps: number;
  segments: Segment[];
  contacts: Contact[];
  arcs: Arc[];
  totalFrames: number;
  takeoffFrame: number;
  /** Frame of the final landing. */
  landFrame: number;
  settleFrames: number;
  maxImpact: number;
  /** Highest apex in the performance. */
  maxHeight: number;
  /** Horizontal distance covered (≤ TRAVEL), centred on x = 0. */
  travel: number;
}

export interface BuildOptions {
  /** Frames standing still before the windup (default 6). */
  leadFrames?: number;
  /** Pad the end hold so the loop is at least this long. */
  minTotalFrames?: number;
}

/** Arcs lower than this (units) are not animated: the body has come to rest. */
export const MIN_ARC_HEIGHT = 0.06;
export const END_HOLD_FRAMES = 18;

/** Integer frames of an arc split into rise and fall, so every apex and every contact lands on a drawn frame. */
export function splitArc(frames: number): [number, number] {
  const rise = Math.max(1, Math.floor(frames / 2));
  return [rise, Math.max(1, frames - rise)];
}

/**
 * Build the whole performance: idle → anticipation → jump → (contact → rebound)* → settle → hold.
 * Everything is on integer frames; evaluation in between is continuous for drawing curves.
 */
export function buildTimeline(input: MotionParams, opts: BuildOptions = {}): Timeline {
  const p = sanitize(input);
  const lead = Math.max(0, Math.round(opts.leadFrames ?? 6));
  const antic = p.anticipation > 0 ? p.anticipationFrames : 0;
  const segments: Segment[] = [];
  const contacts: Contact[] = [];
  const arcs: Arc[] = [];

  // Arc list first (heights and frames), then horizontal distances: constant speed in flight, capped to the lane.
  const plan: { height: number; frames: number; vx: number }[] = [];
  let h = p.height;
  let n = p.airFrames;
  let vx = 1;
  for (let i = 0; i <= p.maxBounces; i++) {
    const frames = Math.max(2, Math.round(n));
    if (i > 0 && (h < MIN_ARC_HEIGHT || frames < 3)) break;
    plan.push({ height: h, frames, vx });
    h *= p.restitution * p.restitution;
    if (p.physicalTiming) n *= p.restitution;
    vx *= p.drift;
  }
  const dist = plan.map((a) => a.vx * a.frames);
  const totalDist = dist.reduce((s, d) => s + d, 0) || 1;
  const xScale = Math.min(FLIGHT_VX, TRAVEL / totalDist);
  const travel = totalDist * xScale;

  let f = 0;
  // Centre the performance in its lane.
  let x = -travel / 2;
  const push = (phase: Phase, len: number, apex = 0, dx = 0, bounce = -1) => {
    segments.push({ phase, f0: f, f1: f + len, apex, x0: x, x1: x + dx, bounce });
    f += len;
    x += dx;
  };

  push("idle", lead);
  if (antic > 0) push("antic", antic);
  const takeoffFrame = f;
  let maxImpact = 0;
  plan.forEach((a, i) => {
    const [r, fl] = splitArc(a.frames);
    const dx = dist[i] * xScale;
    const takeoff = f;
    push("rise", r, a.height, dx * (r / a.frames), i);
    push("fall", fl, a.height, dx * (fl / a.frames), i);
    arcs.push({ bounce: i, takeoff, apexFrame: takeoff + r, land: f, height: a.height });
    const impact = (a.height * fallSlopeAtImpact(p)) / fl;
    maxImpact = Math.max(maxImpact, impact);
    const last = i === plan.length - 1;
    contacts.push({ frame: f, frames: p.contactFrames, impact, bounce: i, last });
    // The impact frame is shared with the next rise's first sample, so the extra ground time is frames − 1.
    if (!last && p.contactFrames > 1) push("contact", p.contactFrames - 1, 0, 0, i);
  });
  const landFrame = f;
  const settleFrames = Math.round(5 + 12 * p.restitution);
  push("settle", settleFrames, 0, 0, plan.length - 1);
  const hold = Math.max(END_HOLD_FRAMES, (opts.minTotalFrames ?? 0) - f);
  push("hold", hold, 0, 0, plan.length - 1);

  return {
    params: p,
    fps: FPS,
    segments,
    contacts,
    arcs,
    totalFrames: f,
    takeoffFrame,
    landFrame,
    settleFrames,
    maxImpact,
    maxHeight: plan.reduce((m, a) => Math.max(m, a.height), 0),
    travel,
  };
}

/** d(progress)/du of the fall curve at the floor: 1 for linear, 2 for gravity, 0 for a cushioned landing. */
function fallSlopeAtImpact(p: MotionParams) {
  const e = 1e-3;
  return (1 - ease(p.fall, 1 - e)) / e;
}

export function segmentAt(tl: Timeline, t: number): Segment {
  const segs = tl.segments;
  if (t <= segs[0].f0) return segs[0];
  for (const s of segs) if (t < s.f1) return s;
  return segs[segs.length - 1];
}

export interface MotionSample {
  /** Horizontal position (units, lane-relative). */
  x: number;
  /** Height of the bottom of the body above the floor (units, ≥ 0). */
  y: number;
  /** Velocity, units per frame. */
  vx: number;
  vy: number;
  seg: Segment;
  /** Normalised position inside the segment. */
  u: number;
}

function heightIn(tl: Timeline, s: Segment, u: number) {
  if (s.phase === "rise") return Math.max(0, s.apex * ease(tl.params.rise, u));
  if (s.phase === "fall") return Math.max(0, s.apex * (1 - ease(tl.params.fall, u)));
  return 0;
}

/** Position and velocity at frame time t (float frames). Velocity never crosses a segment boundary. */
export function motionAt(tl: Timeline, t: number): MotionSample {
  const s = segmentAt(tl, t);
  const len = s.f1 - s.f0;
  const u = len > 0 ? Math.min(1, Math.max(0, (t - s.f0) / len)) : 0;
  const y = heightIn(tl, s, u);
  const x = s.x0 + (s.x1 - s.x0) * u;
  let vy = 0;
  let vx = 0;
  if (len > 0 && (s.phase === "rise" || s.phase === "fall")) {
    const du = 0.01 / len;
    const a = Math.max(0, u - du);
    const b = Math.min(1, u + du);
    vy = (heightIn(tl, s, b) - heightIn(tl, s, a)) / ((b - a) * len);
    vx = (s.x1 - s.x0) / len;
  }
  return { x, y, vx, vy, seg: s, u };
}

/** The contact whose floor window [frame, frame + frames) contains t, if any. */
export function contactAt(tl: Timeline, t: number): Contact | null {
  for (const c of tl.contacts) if (t >= c.frame && t < c.frame + c.frames && !c.last) return c;
  return null;
}

/** Per-frame spacing: distance travelled by the body's centre between consecutive drawn frames. */
export function spacing(points: { cx: number; cy: number }[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) out.push(Math.hypot(points[i].cx - points[i - 1].cx, points[i].cy - points[i - 1].cy));
  return out;
}
