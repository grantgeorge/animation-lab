import { FPS, FRAMES, LOOP_S } from "../timing";
import { easeInOut, wobble } from "../rng";

/**
 * Cloth: a flag on a stick, waved by hand. The stick is keyed in both versions (it is the character's
 * action). Simulated: a spring-mass cloth (Verlet, structural + shear + bend constraints) pinned to the
 * stick. Keyed: each column of the flag follows the stick's angle a little later than the one before
 * (drag), overshoots, and carries a travelling ripple: follow-through drawn by hand.
 */
export const FLAG = { cols: 16, rows: 10, w: 0.95, h: 0.58 } as const;
export const STICK = { hx: -0.75, hy: 0.55, len: 1.25 } as const;

/** Stick angle from vertical (rad, positive leans right): wave–hold–wave, keyed. */
const KEYS: [number, number][] = [
  [0, -0.35],
  [0.5, -0.35],
  [0.95, 0.42],
  [1.45, 0.42],
  [1.8, -0.4],
  [2.1, 0.36],
  [2.45, -0.3],
  [3.2, -0.3],
  [3.7, -0.35],
  [LOOP_S, -0.35],
];

export function stickAngle(t: number) {
  const tt = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  for (let i = 1; i < KEYS.length; i++) {
    if (tt <= KEYS[i][0]) {
      const [t0, a0] = KEYS[i - 1];
      const [t1, a1] = KEYS[i];
      return a0 + (a1 - a0) * easeInOut((tt - t0) / (t1 - t0));
    }
  }
  return KEYS[0][1];
}

/** Point along the stick at fraction s (0 hand … 1 tip). */
export function stickPoint(t: number, s: number): [number, number] {
  const a = stickAngle(t);
  return [STICK.hx + Math.sin(a) * STICK.len * s, STICK.hy + Math.cos(a) * STICK.len * s];
}

const N = FLAG.cols * FLAG.rows;
/** Pinned column: rows hang from the top 46% of the stick. */
function pinPoint(t: number, row: number): [number, number] {
  return stickPoint(t, 1 - (row / (FLAG.rows - 1)) * (FLAG.h / STICK.len));
}

/** Baked cloth: positions (x, y, z per vertex) for each frame of the loop, after a full loop of warm-up. */
export class ClothBake {
  readonly frames: Float32Array[] = [];
  constructor(wind: number) {
    const C = FLAG.cols;
    const R = FLAG.rows;
    const dx = FLAG.w / (C - 1);
    const dy = FLAG.h / (R - 1);
    const P = new Float32Array(N * 3);
    const Q = new Float32Array(N * 3);
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const [px, py] = pinPoint(0, r);
        const i = (r * C + c) * 3;
        P[i] = Q[i] = px + c * dx;
        P[i + 1] = Q[i + 1] = py;
        P[i + 2] = Q[i + 2] = 0;
      }
    const cons: [number, number, number][] = [];
    const add = (a: number, b: number, L: number) => cons.push([a, b, L]);
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        if (c < C - 1) add(i, i + 1, dx);
        if (r < R - 1) add(i, i + C, dy);
        if (c < C - 1 && r < R - 1) {
          add(i, i + C + 1, Math.hypot(dx, dy));
          add(i + 1, i + C, Math.hypot(dx, dy));
        }
        if (c < C - 2) add(i, i + 2, 2 * dx);
        if (r < R - 2) add(i, i + 2 * C, 2 * dy);
      }
    const sub = 8;
    const dt = 1 / FPS / sub;
    const g = 9.81;
    for (let f = 0; f < FRAMES * 2; f++) {
      for (let s = 0; s < sub; s++) {
        const t = (f + s / sub) / FPS;
        const gust = wind * (0.8 + 0.6 * wobble(t * 1.3, 0.2, 0, 5));
        for (let i = 0; i < N; i++) {
          const k = i * 3;
          const c = i % C;
          const flap = 0.4 * wobble(t * 7 + c * 0.6, i * 0.01, 0, 2);
          const vx = (P[k] - Q[k]) * 0.992;
          const vy = (P[k + 1] - Q[k + 1]) * 0.992;
          const vz = (P[k + 2] - Q[k + 2]) * 0.992;
          Q[k] = P[k];
          Q[k + 1] = P[k + 1];
          Q[k + 2] = P[k + 2];
          P[k] += vx + gust * 4.2 * dt * dt;
          P[k + 1] += vy - g * dt * dt;
          P[k + 2] += vz + gust * flap * 3.5 * dt * dt;
        }
        for (let it = 0; it < 10; it++) {
          for (const [a, b, L] of cons) {
            const ka = a * 3;
            const kb = b * 3;
            const ex = P[kb] - P[ka];
            const ey = P[kb + 1] - P[ka + 1];
            const ez = P[kb + 2] - P[ka + 2];
            const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-9;
            const k = ((d - L) / d) * 0.5;
            P[ka] += ex * k;
            P[ka + 1] += ey * k;
            P[ka + 2] += ez * k;
            P[kb] -= ex * k;
            P[kb + 1] -= ey * k;
            P[kb + 2] -= ez * k;
          }
          for (let r = 0; r < R; r++) {
            const [px, py] = pinPoint(t, r);
            const k = r * C * 3;
            P[k] = px;
            P[k + 1] = py;
            P[k + 2] = 0;
          }
        }
      }
      if (f >= FRAMES) this.frames.push(P.slice());
    }
  }
  at(frame: number) {
    return this.frames[((frame % FRAMES) + FRAMES) % FRAMES];
  }
}

/** Keyed follow-through: vertex positions computed from the stick's own history. */
export function keyedFlag(t: number, wind: number, out: Float32Array) {
  const C = FLAG.cols;
  const R = FLAG.rows;
  const dx = FLAG.w / (C - 1);
  for (let r = 0; r < R; r++) {
    const [px, py] = pinPoint(t, r);
    let x = px;
    let y = py;
    for (let c = 0; c < C; c++) {
      const i = (r * C + c) * 3;
      if (c > 0) {
        const u = c / (C - 1);
        // successive breaking of joints: each column shows the root's pose from a little earlier,
        // droops under its own weight, and carries a ripple that travels to the tail
        const lag = 0.2 * u;
        const aPast = stickAngle(t - lag);
        const aVel = (stickAngle(t - lag) - stickAngle(t - lag - 0.06)) / 0.06;
        const droop = (0.25 + 0.75 * u) * (0.85 - 0.6 * wind);
        const wave = (0.1 + 0.12 * wind) * (0.3 + u) * Math.sin(u * 5.5 - t * 8.5);
        const dir = Math.PI / 2 + 0.85 * aPast + droop - 0.12 * aVel * u + wave;
        x += Math.sin(dir) * dx;
        y += Math.cos(dir) * dx;
      }
      out[i] = x;
      out[i + 1] = y;
      out[i + 2] = 0.06 * (c / (C - 1)) * Math.sin(2 * Math.PI * ((c / (C - 1)) * 1.3 - t * 1.7)) * (0.5 + wind);
    }
  }
}
