import { FPS, FRAMES } from "../timing";
import { clamp01, easeIn, easeOut, hash01, lerp } from "../rng";

/**
 * Rigid bodies: a ball smashes a stack of six crates. Simulated: a 2D position-based (Verlet) solver in
 * the camera plane. Each crate is four corner particles held rigid by six distance constraints;
 * corners collide with the floor, the other crates and the ball. Keyed: each crate gets an authored
 * arc, a squash on landing, one bounce and a held settle where the layout wants it.
 */
export const CRATE = 0.34;
export const BALL_R = 0.17;
export const HIT_T = 0.8;
const G = 9.81;
const SUB = 240;

export interface BodyPose {
  x: number;
  y: number;
  angle: number;
  /** Keyed squash (1 = rigid). */
  sy: number;
}
export interface CrateFrame {
  crates: BodyPose[];
  ball: BodyPose;
}

/** The stack: 3-2-1 pyramid, crate centres. */
export function stackLayout(): [number, number][] {
  const s = CRATE;
  const x0 = 0.35;
  return [
    [x0 - s, s / 2],
    [x0, s / 2],
    [x0 + s, s / 2],
    [x0 - s / 2, s * 1.5],
    [x0 + s / 2, s * 1.5],
    [x0, s * 2.5],
  ];
}

const BALL_START: [number, number] = [-1.9, 0.7];
function ballLaunch(impact: number): [number, number] {
  return [4.6 + 4.4 * impact, 0.9];
}

/** Baked Verlet sim: one pose per frame of the loop. */
export class CrateBake {
  readonly frames: CrateFrame[] = [];
  constructor(impact: number) {
    const lay = stackLayout();
    const nb = lay.length;
    const P: number[] = []; // x, y per corner
    const Q: number[] = [];
    for (const [cx, cy] of lay) {
      const h = CRATE / 2 - 0.0005;
      for (const [dx, dy] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
        P.push(cx + dx, cy + dy);
        Q.push(cx + dx, cy + dy);
      }
    }
    const rest: [number, number, number][] = [];
    for (let b = 0; b < nb; b++) {
      const o = b * 4;
      const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
      for (const [i, j] of pairs) rest.push([o + i, o + j, Math.hypot(P[(o + i) * 2] - P[(o + j) * 2], P[(o + i) * 2 + 1] - P[(o + j) * 2 + 1])]);
    }
    const ball = { x: BALL_START[0], y: BALL_START[1], px: BALL_START[0], py: BALL_START[1], spin: 0, launched: false };
    const dt = 1 / SUB;
    const nc = nb * 4;
    const corner = (b: number, k: number) => (b * 4 + k) * 2;
    let t = 0;
    const record = () => {
      const crates: BodyPose[] = [];
      for (let b = 0; b < nb; b++) {
        const a = corner(b, 0);
        const c = corner(b, 2);
        const e = corner(b, 1);
        crates.push({ x: (P[a] + P[c]) / 2, y: (P[a + 1] + P[c + 1]) / 2, angle: Math.atan2(P[e + 1] - P[a + 1], P[e] - P[a]), sy: 1 });
      }
      this.frames.push({ crates, ball: { x: ball.x, y: ball.y, angle: ball.spin, sy: 1 } });
    };
    const stepsPerFrame = SUB / FPS;
    for (let f = 0; f < FRAMES; f++) {
      record();
      for (let s = 0; s < stepsPerFrame; s++) {
        t += dt;
        // integrate
        for (let i = 0; i < nc; i++) {
          const x = P[i * 2];
          const y = P[i * 2 + 1];
          const vx = (x - Q[i * 2]) * 0.9995;
          const vy = (y - Q[i * 2 + 1]) * 0.9995;
          Q[i * 2] = x;
          Q[i * 2 + 1] = y;
          P[i * 2] = x + vx;
          P[i * 2 + 1] = y + vy - G * dt * dt;
        }
        if (t >= HIT_T - 0.42 && !ball.launched) {
          ball.launched = true;
          const [vx, vy] = ballLaunch(impact);
          ball.px = ball.x - vx * dt;
          ball.py = ball.y - vy * dt;
        }
        if (ball.launched) {
          const vx = (ball.x - ball.px) * 0.9995;
          const vy = ball.y - ball.py;
          ball.px = ball.x;
          ball.py = ball.y;
          ball.x += vx;
          ball.y += vy - G * dt * dt;
          ball.spin -= vx / BALL_R;
        }
        for (let it = 0; it < 6; it++) {
          // rigid crates
          for (const [i, j, L] of rest) {
            const dx = P[j * 2] - P[i * 2];
            const dy = P[j * 2 + 1] - P[i * 2 + 1];
            const d = Math.hypot(dx, dy) || 1e-9;
            const k = ((d - L) / d) * 0.5;
            P[i * 2] += dx * k;
            P[i * 2 + 1] += dy * k;
            P[j * 2] -= dx * k;
            P[j * 2 + 1] -= dy * k;
          }
          // crate vs crate: separating-axis test; penetrating corners are pushed out along the axis
          for (let a = 0; a < nb; a++)
            for (let b = a + 1; b < nb; b++) {
              let depth = Infinity;
              let nx = 0;
              let ny = 0;
              for (const box of [a, b]) {
                for (let e = 0; e < 2; e++) {
                  const i0 = corner(box, e);
                  const i1 = corner(box, e + 1);
                  const ex = P[i1] - P[i0];
                  const ey = P[i1 + 1] - P[i0 + 1];
                  const el = Math.hypot(ex, ey) || 1e-9;
                  const ax = ey / el;
                  const ay = -ex / el;
                  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
                  for (let k = 0; k < 4; k++) {
                    const pa = corner(a, k);
                    const pb = corner(b, k);
                    const da = P[pa] * ax + P[pa + 1] * ay;
                    const db = P[pb] * ax + P[pb + 1] * ay;
                    a0 = Math.min(a0, da);
                    a1 = Math.max(a1, da);
                    b0 = Math.min(b0, db);
                    b1 = Math.max(b1, db);
                  }
                  const o = Math.min(a1 - b0, b1 - a0);
                  if (o <= 0) {
                    depth = -1;
                    break;
                  }
                  if (o < depth) {
                    depth = o;
                    // axis from a toward b
                    const sgn = a1 - b0 < b1 - a0 ? 1 : -1;
                    nx = ax * sgn;
                    ny = ay * sgn;
                  }
                }
                if (depth < 0) break;
              }
              if (depth <= 0 || depth === Infinity) continue;
              // which corners are inside the other box (deepest along the axis)
              const push = (box: number, sx: number, sy: number) => {
                let lo = Infinity;
                const d: number[] = [];
                for (let k = 0; k < 4; k++) {
                  const pi = corner(box, k);
                  const v = P[pi] * sx + P[pi + 1] * sy;
                  d.push(v);
                  lo = Math.min(lo, v);
                }
                let moved = 0;
                for (let k = 0; k < 4; k++) {
                  if (d[k] - lo > depth * 1.01 + 1e-5) continue;
                  moved++;
                }
                for (let k = 0; k < 4; k++) {
                  if (d[k] - lo > depth * 1.01 + 1e-5) continue;
                  const pi = corner(box, k);
                  P[pi] += (sx * depth * 0.5) / Math.max(1, moved * 0.5);
                  P[pi + 1] += (sy * depth * 0.5) / Math.max(1, moved * 0.5);
                  // contact friction: drag the corner's sliding motion (this is what makes crates tip and tumble)
                  const tx = -sy;
                  const ty = sx;
                  const slide = (P[pi] - Q[pi]) * tx + (P[pi + 1] - Q[pi + 1]) * ty;
                  P[pi] -= tx * slide * 0.03;
                  P[pi + 1] -= ty * slide * 0.03;
                }
              };
              // corners of a nearest b move back along −n; corners of b nearest a move along +n
              push(a, -nx, -ny);
              push(b, nx, ny);
            }
          // ball vs crate edges (the ball is much heavier than a corner)
          if (ball.launched)
            for (let b = 0; b < nb; b++) {
              for (let e = 0; e < 4; e++) {
                const i0 = corner(b, e);
                const i1 = corner(b, (e + 1) % 4);
                const ex = P[i1] - P[i0];
                const ey = P[i1 + 1] - P[i0 + 1];
                const w = clamp01(((ball.x - P[i0]) * ex + (ball.y - P[i0 + 1]) * ey) / (ex * ex + ey * ey));
                const cx = P[i0] + ex * w;
                const cy = P[i0 + 1] + ey * w;
                const dx = ball.x - cx;
                const dy = ball.y - cy;
                const d = Math.hypot(dx, dy) || 1e-9;
                if (d >= BALL_R) continue;
                const pen = BALL_R - d;
                const nx = dx / d;
                const ny = dy / d;
                ball.x += nx * pen * 0.15;
                ball.y += ny * pen * 0.15;
                P[i0] -= nx * pen * 0.85 * (1 - w);
                P[i0 + 1] -= ny * pen * 0.85 * (1 - w);
                P[i1] -= nx * pen * 0.85 * w;
                P[i1 + 1] -= ny * pen * 0.85 * w;
              }
            }
          // floor (position only; friction once per substep below)
          for (let i = 0; i < nc; i++) if (P[i * 2 + 1] < 0) P[i * 2 + 1] = 0;
          if (ball.y < BALL_R) ball.y = BALL_R;
        }
        // kinetic friction on resting corners, a lossy bounce for the ball
        for (let i = 0; i < nc; i++) if (P[i * 2 + 1] <= 1e-4) P[i * 2] = Q[i * 2] + (P[i * 2] - Q[i * 2]) * 0.975;
        if (ball.y <= BALL_R + 1e-4) {
          const vy = ball.y - ball.py;
          if (vy < 0) ball.py = ball.y + vy * 0.45;
          ball.px = ball.x - (ball.x - ball.px) * 0.993;
        }
      }
    }
  }
  at(frame: number): CrateFrame {
    return this.frames[Math.max(0, Math.min(this.frames.length - 1, frame))];
  }
}

/** Authored landing marks and spins, composed for the frame (x, turns of 90°). */
const MARKS: { x: number; turns: number; hitDelay: number; onTop?: boolean }[] = [
  { x: 0.95, turns: -1, hitDelay: 0.07 },
  { x: 1.45, turns: -2, hitDelay: 0.05 },
  { x: 1.95, turns: -2, hitDelay: 0.03 },
  { x: 2.45, turns: -3, hitDelay: 0.0 },
  { x: 1.45, turns: -2, hitDelay: 0.02, onTop: true },
  { x: 1.95, turns: -3, hitDelay: 0.06, onTop: true },
];

/** Keyed version of the same beat. */
export function keyedCrates(t: number, impact: number): CrateFrame {
  const lay = stackLayout();
  const crates: BodyPose[] = lay.map(([x0, y0], i) => {
    const m = MARKS[i];
    const t0 = HIT_T + m.hitDelay;
    if (t < t0) {
      // a two-frame shudder as the ball connects: the stack anticipates the break
      const sh = t > HIT_T - 2 / FPS ? 0.012 * Math.sin(t * 90) : 0;
      return { x: x0 + sh, y: y0, angle: 0, sy: 1 };
    }
    const dur = (0.5 + 0.14 * hash01(i, 3)) * (1.15 - 0.25 * impact);
    const apex = (0.35 + 0.35 * hash01(i, 5)) * (0.7 + 0.5 * impact) + (y0 - CRATE / 2) * 0.4;
    // two crates land on top of others: restacked by design, an arrangement nobody would get from a solver
    const landY = m.onTop ? CRATE * 1.5 : CRATE / 2;
    const u = (t - t0) / dur;
    if (u < 1) {
      const e = easeOut(u * 0.6 + 0.4 * u * u);
      return { x: lerp(x0, m.x, e), y: lerp(y0, landY, u) + 4 * apex * u * (1 - u), angle: (m.turns * Math.PI) / 2 * easeOut(u), sy: 1 + 0.12 * Math.sin(Math.PI * u) };
    }
    const after = t - t0 - dur;
    // land: two frames of squash, one small bounce, then a dead hold
    const sq = after < 2 / FPS ? 0.78 : after < 4 / FPS ? 1.08 : 1;
    const bounce = after < 0.24 ? 0.07 * Math.sin((Math.PI * after) / 0.24) * (after > 2 / FPS ? 1 : 0) : 0;
    return { x: m.x, y: landY + bounce - (1 - sq) * CRATE * 0.5, angle: (m.turns * Math.PI) / 2, sy: sq };
  });
  // ball: an authored arc into the stack, a dead stop, then it drops and rolls a little
  let bx: number, by: number;
  const ta = HIT_T - 0.32;
  if (t < ta) {
    bx = BALL_START[0];
    by = BALL_START[1];
  } else if (t < HIT_T) {
    const u = (t - ta) / (HIT_T - ta);
    bx = lerp(BALL_START[0], lay[0][0] - CRATE / 2 - BALL_R, easeIn(u * 0.4 + 0.6 * u));
    by = lerp(BALL_START[1], 0.36, u) + 0.15 * Math.sin(Math.PI * u);
  } else {
    const u = clamp01((t - HIT_T) / 0.7);
    bx = lerp(lay[0][0] - CRATE / 2 - BALL_R, 0.4 + 0.2 * impact, easeOut(u));
    by = BALL_R + Math.max(0, 0.36 - BALL_R) * (1 - easeIn(Math.min(1, u * 2.2))) + 0.06 * Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u);
  }
  return { crates, ball: { x: bx, y: by, angle: -bx / BALL_R, sy: 1 } };
}
