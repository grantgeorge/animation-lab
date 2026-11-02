import { antennaTrack } from "./followThrough";
import { BODY_HEIGHT } from "./params";
import { type Deform, deform, halfHeight, impactSquash, speedStretch } from "./squash";
import { type Phase, type Timeline, contactAt, motionAt } from "./timeline";

/** Everything a renderer needs to draw the character on one frame. */
export interface Pose {
  frame: number;
  phase: Phase;
  bounce: number;
  /** Lane-relative horizontal position of the body centre. */
  x: number;
  /** Lowest point of the deformed body above the floor. */
  y: number;
  /** Centre of the deformed body. */
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  deform: Deform;
  /** Whole-body tilt (radians, + leans toward travel), for the anticipation lean-back. */
  lean: number;
  /** Pupil direction, each in [-1, 1]. */
  lookX: number;
  lookY: number;
  /** Eyelid closure 0..1. */
  blink: number;
  /** Mouth openness 0..1. */
  mouth: number;
  /** Antenna bend (radians), already scaled by follow-through. */
  antenna: number;
  /** On the floor this frame. */
  grounded: boolean;
  /** This is an impact frame. */
  impact: boolean;
}

export interface PoseContext {
  tl: Timeline;
  antenna: Float32Array;
}

export function poseContext(tl: Timeline): PoseContext {
  return { tl, antenna: antennaTrack(tl) };
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Crouch depth through the windup: sink over the first 70 %, hold (and sink a hair more) to the launch. */
export function crouchCurve(u: number) {
  return u < 0.7 ? smooth(u / 0.7) : 1 + 0.06 * ((u - 0.7) / 0.3);
}

export function poseAt(ctx: PoseContext, t: number): Pose {
  const { tl } = ctx;
  const p = tl.params;
  const m = motionAt(tl, t);
  const phase0 = m.seg.phase;
  let stretch = 1;
  let axis = 0;
  let lean = 0;
  let blink = 0;
  let mouth = 0;
  let lookX = 0.35;
  let lookY = -0.05;
  let phase: Phase = phase0;
  let impact = false;
  const speed = Math.hypot(m.vx, m.vy);

  const contact = contactAt(tl, t);
  if (contact) {
    phase = "contact";
    const k = t - contact.frame;
    impact = k < 1;
    const prof = Math.cos(Math.min(1, k / contact.frames) * (Math.PI / 2));
    stretch = 1 - (1 - impactSquash(p.squash, contact.impact)) * prof;
    blink = k < 1 ? 1 : k < 2 ? 0.55 : 0;
    lookY = -0.6;
    mouth = 0.15;
  } else if (phase0 === "rise" || phase0 === "fall") {
    stretch = speedStretch(p.squash, speed);
    axis = Math.atan2(m.vx, m.vy);
    if (m.vy < 0) axis = Math.atan2(-m.vx, -m.vy); // the axis is a line: keep it within ±90° of vertical
    const dir = speed > 1e-6 ? speed : 1;
    lookX = clamp((m.vx / dir) * 0.9, -1, 1);
    lookY = clamp((m.vy / dir) * 0.95, -1, 1);
    if (phase0 === "fall") mouth = clamp(-m.vy / 0.35, 0, 1) * 0.8;
  } else if (phase0 === "antic") {
    const c = crouchCurve(m.u);
    stretch = 1 - p.anticipation * 0.42 * c;
    lean = -0.16 * p.anticipation * Math.min(1, c);
    blink = 0.35 * Math.min(1, c); // a determined squint
    lookX = 0.55;
    lookY = 0.45 * Math.min(1, c); // eyes on the target
  } else if (phase0 === "settle") {
    const last = tl.contacts[tl.contacts.length - 1];
    const k = t - m.seg.f0;
    const n = m.seg.f1 - m.seg.f0;
    const peak = 1 - impactSquash(p.squash, last.impact);
    const env = Math.exp((-3 * k) / n) * (1 - k / n);
    stretch = 1 - peak * env * Math.cos((Math.PI * k) / Math.max(2, n / 2.5));
    impact = k < 1;
    blink = k < 1 ? 1 : k < 2 ? 0.55 : 0;
    lookY = k < 3 ? -0.5 : -0.1;
    mouth = k < 3 ? 0.15 : 0;
  } else if (phase0 === "hold") {
    // One deterministic blink a few frames into the hold.
    const k = t - m.seg.f0;
    if (k >= 9 && k < 11) blink = 1;
    lookX = 0.15;
    lookY = 0;
  }

  const d = deform(stretch, axis);
  const hh = halfHeight(d);
  // The body's lowest point follows the height curve; on the floor it squashes from its feet.
  const cy = m.y + hh;
  const grounded = m.y <= 1e-6;
  const raw = ctx.antenna[Math.min(ctx.antenna.length - 1, Math.max(0, Math.floor(t)))] ?? 0;
  return {
    frame: t,
    phase,
    bounce: m.seg.bounce,
    x: m.x,
    y: m.y,
    cx: m.x,
    cy,
    vx: m.vx,
    vy: m.vy,
    deform: d,
    lean,
    lookX,
    lookY,
    blink,
    mouth,
    antenna: clamp(raw * p.followThrough, -1.1, 1.1),
    grounded,
    impact,
  };
}

/** Pose of every drawn frame. On twos, odd frames repeat the previous drawing (impact frames are always drawn). */
export function sampleFrames(ctx: PoseContext, onTwos = ctx.tl.params.onTwos): Pose[] {
  const out: Pose[] = [];
  let held: Pose | null = null;
  const impacts = new Set(ctx.tl.contacts.map((c) => c.frame));
  for (let f = 0; f < ctx.tl.totalFrames; f++) {
    if (onTwos && f % 2 === 1 && held && !impacts.has(f)) {
      out.push({ ...held, frame: f });
      continue;
    }
    held = poseAt(ctx, f);
    out.push(held);
  }
  return out;
}

/** Rest centre height (body standing still). */
export const REST_CY = BODY_HEIGHT / 2;
