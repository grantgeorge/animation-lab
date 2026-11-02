import { FPS } from "../timing";
import { clamp01, easeIn, easeOut, hash01, lerp } from "../rng";

/**
 * Hand-drawn effects: a ball thrown hard into a wall. Simulated: constant speed and a by-the-book
 * bounce (every frame evenly spaced). Keyed: anticipation, a throw with wide spacing and a smear frame,
 * a one-frame impact flash, a squash held on the wall, an overshoot on the rebound.
 */
export const WALL_X = 1.25;
export const BALL = 0.17;
const G = 9.81;
const START: [number, number] = [-1.55, 0.62];

export interface BallPose {
  x: number;
  y: number;
  /** Scale along and across the direction of motion. */
  along: number;
  across: number;
  /** Direction of motion (rad). */
  dir: number;
  /** Stylized extras. */
  smear: number;
  multiples: [number, number][];
  speedLines: boolean;
  impactFrame: boolean;
  star: number;
  /** Physical: velocity for motion blur (m/s). */
  vx: number;
  vy: number;
  hit: boolean;
}

const blank = (x: number, y: number): BallPose => ({ x, y, along: 1, across: 1, dir: 0, smear: 0, multiples: [], speedLines: false, impactFrame: false, star: 0, vx: 0, vy: 0, hit: false });

/** Physical throw: released at 0.7 s, constant speed, restitution 0.55, floor bounces. */
export function simBall(t: number, speed: number): BallPose {
  const v = 5 + 6 * speed;
  const tr = 0.7;
  if (t < tr) return blank(START[0], START[1]);
  const tHit = tr + (WALL_X - BALL - START[0]) / v;
  if (t < tHit) {
    const a = t - tr;
    return { ...blank(START[0] + v * a, START[1] - 0.5 * G * a * a * 0.3), vx: v, vy: -G * a * 0.3 };
  }
  const yHit = START[1] - 0.5 * G * (tHit - tr) ** 2 * 0.3;
  // rebound and floor bounces (simple ballistic with restitution)
  let x = WALL_X - BALL;
  let y = yHit;
  let vx = -v * 0.55;
  let vy = 0;
  let tt = tHit;
  const dt = 1 / 240;
  while (tt + dt <= t) {
    vy -= G * dt;
    x += vx * dt;
    y += vy * dt;
    if (y < BALL) {
      y = BALL;
      vy = -vy * 0.55;
      vx *= 0.85;
    }
    vx *= 0.999;
    tt += dt;
  }
  return { ...blank(x, y), vx, vy, hit: t - tHit < 1 / FPS };
}

/** Keyed throw: the animator's spacing chart. */
export function keyedBall(t: number, speed: number): BallPose {
  const f = (n: number) => n / FPS;
  const ant0 = 0.3;
  const ant1 = 0.7;
  const throwF = speed > 0.66 ? 2 : speed > 0.33 ? 3 : 4;
  const tHit = ant1 + f(throwF);
  const target = WALL_X - BALL;
  if (t < ant0) return blank(START[0], START[1]);
  if (t < ant1) {
    // anticipation: drawn back and squashed against the direction of the throw
    const u = easeOut((t - ant0) / (ant1 - ant0));
    return { ...blank(START[0] - 0.3 * u, START[1] + 0.05 * u), along: 1 - 0.22 * u, across: 1 + 0.18 * u };
  }
  if (t < tHit) {
    // the throw: wide spacing; the middle frame is a smear with multiples and speed lines
    const k = Math.floor((t - ant1) * FPS);
    const u = (k + 1) / (throwF + 1);
    const x0 = START[0] - 0.3;
    const x = lerp(x0, target, easeIn(u * 0.5 + 0.5 * u));
    const y = lerp(START[1] + 0.05, START[1] - 0.04, u);
    const mult: [number, number][] = [];
    for (let m = 1; m <= 3; m++) mult.push([x - m * 0.22, y + 0.004 * m]);
    return { ...blank(x, y), along: 1 + 1.8 * (0.6 + 0.4 * speed), across: 0.72, smear: 0.9 + 0.5 * speed, multiples: mult, speedLines: true };
  }
  const since = t - tHit;
  if (since < f(1)) return { ...blank(target + BALL * 0.35, START[1] - 0.04), impactFrame: true, along: 0.45, across: 1.55, star: 1, hit: true };
  const hold = f(4);
  if (since < f(1) + hold) {
    // the squash, held on the wall so the hit reads
    return { ...blank(target + BALL * 0.35, START[1] - 0.04), along: 0.5, across: 1.45, star: 1 - (since - f(1)) / hold, speedLines: false, dir: 0 };
  }
  // rebound: stretch back out, overshoot, arc down, bounce, settle with a squash
  const u = since - f(1) - hold;
  const dur = 0.7;
  if (u < dur) {
    const w = u / dur;
    const x = lerp(target, 0.15, easeOut(w));
    const y = lerp(START[1] - 0.04, BALL, easeIn(w)) + 0.32 * Math.sin(Math.PI * w) * (1 - w);
    const st = w < 0.25 ? 1.4 - w * 1.6 : 1 + 0.15 * (1 - w);
    return { ...blank(x, y), along: st, across: 1 / Math.sqrt(st), dir: Math.PI + 0.4 * (1 - 2 * w) };
  }
  const v = u - dur;
  const bounce = 0.18 * Math.abs(Math.sin(Math.min(v, 0.45) * Math.PI / 0.45)) * clamp01(1 - v / 0.45);
  const squash = v < f(2) ? 0.7 : 1;
  return { ...blank(0.15 - 0.15 * easeOut(clamp01(v / 0.8)), BALL + bounce - (1 - squash) * BALL * 0.5), along: 1 / squash, across: squash, dir: Math.PI / 2 };
}

/** Physical debris from the wall: small chips, ballistic, seeded. */
export function debris(t: number, tHit: number, n: number) {
  const out: [number, number, number][] = [];
  const a = t - tHit;
  if (a < 0 || a > 1.2) return out;
  for (let i = 0; i < n; i++) {
    const vx = -(0.6 + 1.6 * hash01(i, 3));
    const vy = 0.4 + 2.2 * hash01(i, 5);
    const vz = (hash01(i, 7) - 0.5) * 1.2;
    const y = Math.max(0.01, 0.6 + vy * a - 0.5 * G * a * a);
    out.push([WALL_X + vx * a, y, vz * a]);
  }
  return out;
}

/** Wall-hit time of the physical throw. */
export const simHitTime = (speed: number) => 0.7 + (WALL_X - BALL - START[0]) / (5 + 6 * speed);
export const keyedHitTime = (speed: number) => 0.7 + (speed > 0.66 ? 2 : speed > 0.33 ? 3 : 4) / FPS;
