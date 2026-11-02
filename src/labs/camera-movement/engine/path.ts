import { Vector3 } from "three";
import type { CameraPose } from "@/engine/projection";
import { clamp01, ease, lerp, lerp3, lookAtPose, rotateAboutY, RAD, v3 } from "./math";
import type { Move, SubjectFn, Vec3 } from "./types";

export interface ShotPose extends CameraPose {
  focalMm: number;
  target: Vec3;
}

/** Eased progress of the move at loop time t (0 before t0, 1 after t1). */
export function progress(m: Move, t: number): number {
  if (m.t1 <= m.t0) return t >= m.t0 ? 1 : 0;
  return ease(m.ease, clamp01((t - m.t0) / (m.t1 - m.t0)));
}

const depthTo = (pose: CameraPose, p: Vec3) => v3(p).sub(pose.position).dot(new Vector3(0, 0, -1).applyQuaternion(pose.quaternion));

/** The camera at loop time t. Pure: same inputs, same pose. */
export function poseAt(m: Move, t: number, subjects: SubjectFn): ShotPose {
  const u = progress(m, t);
  const { start: a, end: b } = m;
  let position: Vec3;
  let target: Vec3;
  let focalMm = Math.exp(lerp(Math.log(a.focalMm), Math.log(b.focalMm), u));
  switch (m.interp) {
    case "orbit": {
      // Arc around the subject (its anchor at this moment), lerping bearing, radius and height.
      const s = subjects(m.subject, t).anchor;
      const bearing = (p: Vec3, c: Vec3) => Math.atan2(p[0] - c[0], p[2] - c[2]) * RAD;
      const ca = m.start.target;
      const cb = m.end.target;
      const r0 = Math.hypot(a.position[0] - ca[0], a.position[2] - ca[2]);
      const r1 = Math.hypot(b.position[0] - cb[0], b.position[2] - cb[2]);
      const b0 = bearing(a.position, ca);
      let b1 = bearing(b.position, cb);
      while (b1 - b0 > 180) b1 -= 360;
      while (b1 - b0 < -180) b1 += 360;
      const br = lerp(b0, b1, u) / RAD;
      const r = lerp(r0, r1, u);
      position = [s[0] + Math.sin(br) * r, lerp(a.position[1], b.position[1], u), s[2] + Math.cos(br) * r];
      target = s;
      break;
    }
    case "track": {
      const s0 = subjects(m.subject, m.t0);
      const s1 = subjects(m.subject, m.t1);
      const st = subjects(m.subject, t);
      const off0 = v3(a.position).sub(v3(s0.feet));
      const off1 = v3(b.position).sub(v3(s1.feet));
      const off = off0.lerp(off1, u);
      position = [st.feet[0] + off.x, st.feet[1] + off.y, st.feet[2] + off.z];
      target = st.anchor;
      break;
    }
    default: {
      position = lerp3(a.position, b.position, u);
      target = lerp3(a.target, b.target, u);
    }
  }
  const pose = lookAtPose(position, target);
  if (m.interp === "dollyZoom") {
    // Keep the subject the same size: focal ∝ depth of the subject along the view axis.
    const startPose = lookAtPose(a.position, a.target);
    const d0 = depthTo(startPose, a.target);
    const dt = depthTo(pose, target);
    focalMm = (a.focalMm * dt) / Math.max(1e-6, d0);
  }
  return { ...pose, focalMm, target };
}

/** Positions sampled along the move window (for drawing the path). */
export function samplePath(m: Move, subjects: SubjectFn, n = 48): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = m.t0 + ((m.t1 - m.t0) * i) / n;
    const p = poseAt(m, t, subjects).position;
    out.push([p.x, p.y, p.z]);
  }
  return out;
}

export { rotateAboutY };
