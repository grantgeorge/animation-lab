import { sampleClip, type Channel, type Clip } from "@/scene/animation/dsl";
import { doorwayWave } from "@/scene/animation/performances/doorwayWave";
import { doorwayScene as d } from "@/labs/lens-and-framing/config";

export type PartPose = Partial<Record<Channel, number>>;
export type CharPose = Record<string, PartPose>;
export interface ScenePose {
  bram: CharPose;
  pip: CharPose;
  door: CharPose;
}

export const FPS = d.timeline.fps;
export const DURATION = d.timeline.durationS;

const clip = (c: Clip["character"]) => doorwayWave.clips.find((x) => x.character === c)!;
const CLIPS = { bram: clip("bram"), pip: clip("pip"), door: clip("door") };

function toObj(c: Clip, t: number): CharPose {
  const out: CharPose = {};
  for (const [k, v] of sampleClip(c, t)) out[k] = { ...v };
  return out;
}

/** Sample the lab's authored performance (the same keyframes the 3D puppets use). */
export function poseAt(t: number): ScenePose {
  const tt = ((t % DURATION) + DURATION) % DURATION;
  return { bram: toObj(CLIPS.bram, tt), pip: toObj(CLIPS.pip, tt), door: toObj(CLIPS.door, tt) };
}

export const ch = (p: CharPose, part: string, c: Channel) => p[part]?.[c] ?? 0;

/** Parts that carry their own animation at time t (measured over one frame, not guessed). */
export function movingParts(character: keyof ScenePose, t: number, dt = 1 / FPS): Set<string> {
  const a = poseAt(t)[character];
  const b = poseAt(Math.max(0, t - dt))[character];
  const out = new Set<string>();
  for (const part of new Set([...Object.keys(a), ...Object.keys(b)])) {
    for (const c of ["px", "py", "pz", "rx", "ry", "rz", "sy"] as Channel[]) {
      const delta = Math.abs((a[part]?.[c] ?? 0) - (b[part]?.[c] ?? 0));
      const eps = c.startsWith("p") ? 0.0015 : c === "sy" ? 0.01 : 0.25;
      if (delta > eps) {
        out.add(part);
        break;
      }
    }
  }
  return out;
}

/**
 * Pose cadence on a fixed 24 fps clock. "ones": a new pose every frame. "twos": each pose is held
 * for two frames. The clock (and anything else sampled on it, like the camera) is unaffected.
 */
export function cadenceTime(t: number, mode: "ones" | "twos", fps = FPS) {
  const frame = Math.floor(t * fps + 1e-6);
  const step = mode === "twos" ? 2 : 1;
  return (Math.floor(frame / step) * step) / fps;
}

/* ---------- Lab camera projection (24 mm, 36 mm gate, camera at rail origin) ---------- */

export const FRAME = { w: 1920, h: 1080 };
export const FOCAL_MM = 24;
const F_PX = (FRAME.w * FOCAL_MM) / d.gate.widthMm; // 1280
const CAM = { x: d.rail.x, y: d.rail.y, z: 0 };

/** Project a ground point (x, z in metres) to screen: foot position and pixels-per-metre at that depth. */
export function projectGround(x: number, z: number) {
  const dist = CAM.z - z;
  return { x: FRAME.w / 2 + (F_PX * (x - CAM.x)) / dist, y: FRAME.h / 2 + (F_PX * CAM.y) / dist, s: F_PX / dist, dist };
}

/** Project an arbitrary 3D point. */
export function project(x: number, y: number, z: number) {
  const dist = CAM.z - z;
  return { x: FRAME.w / 2 + (F_PX * (x - CAM.x)) / dist, y: FRAME.h / 2 + (F_PX * (CAM.y - y)) / dist };
}

export const MARKS = {
  bram: d.characters.primary.root,
  pip: d.characters.secondary.root,
  doorZ: d.set.doorway.z,
};

/* ---------- Arm forward kinematics, projected to the front view ---------- */

type V3 = [number, number, number];
const RAD = Math.PI / 180;
/** three.js Euler "XYZ": v' = Rx · Ry · Rz · v (degrees). */
function rotXYZ(v: V3, rx: number, ry: number, rz: number): V3 {
  let [x, y, z] = v;
  const cz = Math.cos(rz * RAD), sz = Math.sin(rz * RAD);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  const cy = Math.cos(ry * RAD), sy = Math.sin(ry * RAD);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cx = Math.cos(rx * RAD), sx = Math.sin(rx * RAD);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [x, y, z];
}

/**
 * Upper-arm and forearm directions for a front-view drawing. Each segment returns its 2D angle
 * (degrees counter-clockwise from hanging straight down, y-up) and its projected length factor (0..1),
 * so an arm raised toward the camera foreshortens instead of disappearing.
 */
export function armFK(p: CharPose, side: "L" | "R", bodyYawDeg = 0) {
  const ua = p[`upperArm${side}`] ?? {};
  const fa = p[`forearm${side}`] ?? {};
  const down: V3 = [0, -1, 0];
  const yaw = (v: V3) => rotXYZ(v, 0, bodyYawDeg, 0);
  const u = yaw(rotXYZ(down, ua.rx ?? 0, ua.ry ?? 0, ua.rz ?? 0));
  const fLocal = rotXYZ(down, fa.rx ?? 0, fa.ry ?? 0, fa.rz ?? 0);
  const f = yaw(rotXYZ(fLocal, ua.rx ?? 0, ua.ry ?? 0, ua.rz ?? 0));
  const seg = (v: V3) => ({ angle: Math.atan2(v[0], -v[1]) / RAD, len: Math.hypot(v[0], v[1]), depth: v[2] });
  return { upper: seg(u), fore: seg(f) };
}
