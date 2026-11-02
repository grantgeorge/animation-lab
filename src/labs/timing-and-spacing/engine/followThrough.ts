import { type Timeline, motionAt } from "./timeline";

/**
 * Overlapping action for the antenna: a damped angular spring driven by the body's acceleration,
 * integrated at a fixed sub-step from rest, so the result is a pure function of the timeline.
 * Positive angle = tip bends toward +x (direction of travel). Returns one angle per frame (unit response; scale by amount).
 */
export const SUBSTEPS = 10;
const FREQ_HZ = 2.4;
const ZETA = 0.16;
/** Angular velocity kick per unit/frame of velocity change. */
const GAIN_Y = 0.55;
const GAIN_X = 0.9;
export const ANTENNA_REST = 0.22;

export function antennaTrack(tl: Timeline): Float32Array {
  const out = new Float32Array(tl.totalFrames + 1);
  const dt = 1 / SUBSTEPS; // frames
  const w = (2 * Math.PI * FREQ_HZ) / tl.fps; // rad per frame
  const k = w * w;
  const c = 2 * ZETA * w;
  let phi = 0;
  let om = 0;
  let prev = motionAt(tl, 0);
  for (let f = 0; f < tl.totalFrames; f++) {
    out[f] = phi;
    for (let s = 1; s <= SUBSTEPS; s++) {
      const t = f + s * dt;
      const m = motionAt(tl, t);
      // Velocity change this sub-step (impulse-friendly: contact reversals arrive as one kick).
      const dvy = m.vy - prev.vy;
      const dvx = m.vx - prev.vx;
      prev = m;
      // Upward kick (landing) whips the tip forward-down; braking (dvx < 0) throws it forward.
      om += GAIN_Y * dvy * Math.sin(ANTENNA_REST + 0.6) - GAIN_X * dvx;
      om += (-k * phi - c * om) * dt;
      phi += om * dt;
      if (phi > 1.2) {
        phi = 1.2;
        om = Math.min(om, 0);
      } else if (phi < -1.2) {
        phi = -1.2;
        om = Math.max(om, 0);
      }
    }
  }
  out[tl.totalFrames] = phi;
  return out;
}
