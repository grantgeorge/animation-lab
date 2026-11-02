import { DURATION, REST, clamp, crouchForDrop, MAX_DROP, smooth, type Pose, type PoseFn } from './move';

/**
 * The simulated hop. Nothing is posed: at take-off the body is given a velocity, gravity does the
 * arc, a spring-damper (the legs) absorbs the landing, and the arms, head and torso are passive
 * springs pushed around by the body's accelerations. Plausible and exact for any crate, but with
 * no intent: no look at the landing spot, and no anticipation unless one is keyed in by hand.
 */
export interface PhysicsParams {
  /** kg */
  mass: number;
  /** Take-off speed, m/s, at LAUNCH_ANGLE above horizontal. */
  speed: number;
  /** m/s² */
  gravity: number;
  /** Leg spring, N/m. */
  stiffness: number;
  /** Leg damper, N·s/m. */
  damping: number;
  /** Hybrid: key an anticipation crouch before the simulated take-off. */
  anticipation: boolean;
}
export const PHYS_DEFAULT: PhysicsParams = { mass: 18, speed: 1.7, gravity: 9.81, stiffness: 4000, damping: 220, anticipation: false };
export const PHYS_RANGES = {
  mass: [8, 40, 1], speed: [0.6, 3, 0.05], gravity: [1.6, 25, 0.1], stiffness: [800, 9000, 100], damping: [20, 700, 10],
} as const;
export const LAUNCH_T = 1.0;
export const LAUNCH_ANGLE = 42;
const DT = 1 / 600;
const REC = 1 / 120;

/** A passive angular spring (degrees). */
class Spring {
  v = 0;
  constructor(public x: number, readonly rest: number, readonly w: number, readonly zeta: number) {}
  step(dt: number) { this.v += (-this.w * this.w * (this.x - this.rest) - 2 * this.zeta * this.w * this.v) * dt; this.x += this.v * dt; }
}

export interface PhysicsResult {
  pose: PoseFn;
  launchT: number;
  contactT: number;
  airtime: number;
  /** Downward speed at contact, m/s. */
  impact: number;
  landZ: number;
  /** Deepest leg compression (m) and whether it hit the knees' limit. */
  peak: number;
  bottomed: boolean;
}

export function simulate(p: PhysicsParams, crateM: number): PhysicsResult {
  const a = (LAUNCH_ANGLE * Math.PI) / 180;
  const k = p.stiffness / p.mass, c = p.damping / p.mass;
  let z = 0, y = crateM, vz = 0, vy = 0;
  let phase: 'stand' | 'air' | 'land' = 'stand';
  let x = 0, xv = 0, peak = 0, bottomed = false;
  let contactT = DURATION, impact = 0;
  const lean = new Spring(0, 0, 9, 0.3), head = new Spring(0, 0, 13, 0.28);
  const armUp = new Spring(0, 0, 8, 0.22), armFwd = new Spring(0, 0, 7, 0.2);
  const rec: Pose[] = [];
  let nextRec = 0;
  const antic = (t: number) => (p.anticipation ? 0.55 * smooth((t - 0.62) / 0.24) * (1 - smooth((t - LAUNCH_T + 0.03) / 0.06)) : 0);
  for (let i = 0; ; i++) {
    const t = i * DT;
    if (t >= nextRec - 1e-9) {
      const crouch = Math.max(antic(t), crouchForDrop(x));
      rec.push({ z, y, crouch, lean: lean.x + crouch * 18, head: head.x, armUp: armUp.x, armFwd: armFwd.x, elbow: REST.elbow + Math.abs(armFwd.x) * 0.3 });
      nextRec += REC;
      if (t >= DURATION) break;
    }
    if (phase === 'stand' && t >= LAUNCH_T) {
      phase = 'air';
      vz = p.speed * Math.cos(a); vy = p.speed * Math.sin(a);
      // The body jumps; the loose parts lag behind it.
      armUp.v -= 70 * vy; armFwd.v -= 90 * vz; head.v -= 50 * vy; lean.v -= 40 * vz;
    }
    if (phase === 'air') {
      vy -= p.gravity * DT; z += vz * DT; y += vy * DT;
      if (y <= 0) {
        y = 0; phase = 'land'; contactT = t; impact = -vy;
        xv = impact;
        // The feet stop; momentum throws everything above them forward and down.
        armFwd.v += 140 * vz; armUp.v += 60 * impact; head.v += 70 * impact + 40 * vz; lean.v += 110 * vz;
      }
    }
    if (phase === 'land') {
      vz *= Math.exp(-DT / 0.05); z += vz * DT;
      xv += (-k * x - c * xv) * DT; x += xv * DT;
      if (x > MAX_DROP) { x = MAX_DROP; xv = Math.min(0, xv); bottomed = true; }
      if (x < 0) { x = 0; xv = Math.max(0, xv); }
      peak = Math.max(peak, x);
    }
    lean.step(DT); head.step(DT); armUp.step(DT); armFwd.step(DT);
    armUp.x = clamp(armUp.x, -10, 150); head.x = clamp(head.x, -40, 45);
  }
  const pose: PoseFn = (t) => {
    const f = clamp(t, 0, DURATION) / REC, i = Math.min(rec.length - 2, Math.floor(f)), u = f - i;
    const A = rec[i], B = rec[i + 1];
    const out = { ...A };
    for (const key of Object.keys(A) as (keyof Pose)[]) out[key] = A[key] + (B[key] - A[key]) * u;
    return out;
  };
  return { pose, launchT: LAUNCH_T, contactT, airtime: contactT - LAUNCH_T, impact, landZ: rec[rec.length - 1].z, peak, bottomed };
}
