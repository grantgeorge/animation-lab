import { Quaternion, Vector3 } from "three";
import { distanceForFraction } from "@/engine/optics";
import { ease } from "@/labs/camera-movement/engine/math";
import { GATE, depthOf, ndcPersp, shot, subjects, tuple, type Shot, type Vec3 } from "./common";
import { BRAM_FORWARD } from "./lens";

/** Experiment 5: shots no physical camera can make, each paired with the closest physical version. */
export type Demo = "cheat" | "push" | "scale" | "wall" | "whip";
export const DEMOS: readonly Demo[] = ["cheat", "push", "scale", "wall", "whip"];

const G = 9.81;
const rad = (d: number) => (d * Math.PI) / 180;
const dirYaw = (deg: number): Vec3 => [Math.sin(rad(deg)), 0, Math.cos(rad(deg))];
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpLog = (a: number, b: number, u: number) => Math.exp(lerp(Math.log(a), Math.log(b), u));
const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

/** Progress through a there-and-back move: 0 before go0, 1 between go1 and back0, back to 0 after back1. */
function window2(t: number, go0: number, go1: number, back0: number, back1: number) {
  if (t < go0) return 0;
  if (t < go1) return ease("inOut", (t - go0) / (go1 - go0));
  if (t < back0) return 1;
  if (t < back1) return 1 - ease("inOut", (t - back0) / (back1 - back0));
  return 0;
}

export const E5 = {
  cheat: { wideMm: 14, teleMm: 135, box: { bottom: 1.22, top: 1.86 }, fraction: 0.8, yawDeg: 6, lookUpDeg: 8, aimY: 1.55 },
  push: { far: { distanceM: 2.6, focalMm: 35 }, near: { distanceM: 0.55, focalMm: 14 }, yawDeg: 15, times: [2.9, 3.7, 5.0, 5.8] as const, fisheyeMax: 0.42 },
  scale: { focalMm: 24, distance: [1.6, 3.2] as const, yawDeg: [70, 14] as const, lensY: 0.5, times: [2.8, 4.2, 4.7, 5.6] as const, maxScale: 2.0 },
  wall: { start: [-0.75, 1.55, -0.6] as Vec3, end: [-0.75, 1.75, -6.7] as Vec3, look: [-0.6, 2.3, -9.4] as Vec3, focalMm: 28, times: [1.0, 4.4] as const, wallZ: -5.0, halfThick: 0.12, physicalStopZ: -4.6 },
  whip: { focalMm: 40, times: [3.0, 3.25, 5.4, 5.65] as const },
} as const;

export interface DemoFrame {
  demo: Demo;
  /** The impossible shot (for the cheat: the wide background camera). */
  shot: Shot;
  /** The closest physical shot. */
  physical: Shot;
  /** Cheat only: the telephoto camera that draws Bram over the wide background. */
  charShot?: Shot;
  pipScale: number;
  fisheye: number;
  insideWall: boolean;
  /** Progress through the move (0..1) for readouts. */
  u: number;
}

/** Matched pair for the perspective cheat: wide and tele on the same ray, Bram the same size in both. */
export function cheatShots(t: number) {
  const c = E5.cheat;
  const a = subjects()("primary", t).anchor;
  const target: Vec3 = [a[0], c.aimY, a[2]];
  const dir = dirYaw(c.yawDeg);
  const at = (mm: number) => {
    const d = distanceForFraction(c.box.top - c.box.bottom, mm, c.fraction, GATE);
    const h = d * Math.cos(rad(c.lookUpDeg));
    return shot([target[0] + dir[0] * h, target[1] - d * Math.sin(rad(c.lookUpDeg)), target[2] + dir[2] * h], target, mm);
  };
  return { wide: at(c.wideMm), tele: at(c.teleMm) };
}

function pushShot(t: number) {
  const c = E5.push;
  const [g0, g1, b0, b1] = c.times;
  const u = window2(t, g0, g1, b0, b1);
  const p = subjects()("secondary", t);
  const face: Vec3 = [p.anchor[0], p.feet[1] + 0.86, p.anchor[2]];
  const dist = lerpLog(c.far.distanceM, c.near.distanceM, u);
  const dir = dirYaw(c.yawDeg);
  return { u, s: shot([face[0] + dir[0] * dist, face[1] - 0.08, face[2] + dir[2] * dist], face, lerpLog(c.far.focalMm, c.near.focalMm, u)) };
}

function scaleShot(t: number) {
  const c = E5.scale;
  const [g0, g1, b0, b1] = c.times;
  const u = window2(t, g0, g1, b0, b1);
  const p = subjects()("secondary", t);
  const dist = lerp(c.distance[0], c.distance[1], u);
  const dir = dirYaw(lerp(c.yawDeg[0], c.yawDeg[1], u));
  const pipScale = Math.min(c.maxScale, dist / c.distance[0]);
  const pos: Vec3 = [p.feet[0] + dir[0] * dist, c.lensY, p.feet[2] + dir[2] * dist];
  return { u, pipScale, physical: shot(pos, [p.feet[0], 0.62, p.feet[2]], c.focalMm), cheated: shot(pos, [p.feet[0], 0.62 * pipScale, p.feet[2]], c.focalMm) };
}

function wallPos(t: number, physical: boolean): { u: number; pos: Vec3 } {
  const c = E5.wall;
  const u = t < c.times[0] ? 0 : t > c.times[1] ? 1 : ease("inOut", (t - c.times[0]) / (c.times[1] - c.times[0]));
  const p = lerp3(c.start, c.end, u);
  const pos: Vec3 = physical ? [p[0], p[1], Math.max(p[2], c.physicalStopZ)] : p;
  return { u, pos };
}

function whipEnds(t: number) {
  const s = subjects();
  const b = s("primary", t).anchor;
  const p = s("secondary", t).anchor;
  const start = shot([b[0] + BRAM_FORWARD[0] * 1.6, 1.55, b[2] + BRAM_FORWARD[2] * 1.6], [b[0], 1.5, b[2]], E5.whip.focalMm);
  const end = shot([p[0] + 1.45, 0.82, p[2] + 0.75], [p[0], 0.72, p[2]], E5.whip.focalMm);
  return { start, end, pipTarget: [p[0], 0.72, p[2]] as Vec3 };
}

function whipShot(t: number, physical: boolean) {
  const [g0, g1, b0, b1] = E5.whip.times;
  const u = window2(t, g0, g1, b0, b1);
  const { start, end, pipTarget } = whipEnds(t);
  if (physical) {
    // A real whip pan: the camera can rotate fast, but it stays where it is.
    const panEnd = shot(tuple(start.position), pipTarget, E5.whip.focalMm);
    return { u, s: { position: start.position.clone(), quaternion: new Quaternion().slerpQuaternions(start.quaternion, panEnd.quaternion, u), focalMm: E5.whip.focalMm } };
  }
  return { u, s: { position: new Vector3().lerpVectors(start.position, end.position, u), quaternion: new Quaternion().slerpQuaternions(start.quaternion, end.quaternion, u), focalMm: E5.whip.focalMm } };
}

export function demoFrame(demo: Demo, t: number, fisheyeMax: number = E5.push.fisheyeMax): DemoFrame {
  switch (demo) {
    case "cheat": {
      const { wide, tele } = cheatShots(t);
      return { demo, shot: wide, physical: wide, charShot: tele, pipScale: 1, fisheye: 0, insideWall: false, u: 1 };
    }
    case "push": {
      const { u, s } = pushShot(t);
      return { demo, shot: s, physical: s, pipScale: 1, fisheye: fisheyeMax * u, insideWall: false, u };
    }
    case "scale": {
      const r = scaleShot(t);
      return { demo, shot: r.cheated, physical: r.physical, pipScale: r.pipScale, fisheye: 0, insideWall: false, u: r.u };
    }
    case "wall": {
      const a = wallPos(t, false);
      const b = wallPos(t, true);
      const c = E5.wall;
      return {
        demo,
        shot: shot(a.pos, c.look, c.focalMm),
        physical: shot(b.pos, c.look, c.focalMm),
        pipScale: 1,
        fisheye: 0,
        insideWall: Math.abs(a.pos[2] - c.wallZ) < c.halfThick,
        u: a.u,
      };
    }
    case "whip": {
      const a = whipShot(t, false);
      const b = whipShot(t, true);
      return { demo, shot: a.s, physical: b.s, pipScale: 1, fisheye: 0, insideWall: false, u: a.u };
    }
  }
}

export interface PathStats {
  /** Peak linear acceleration of the camera body, in g. */
  peakG: number;
  /** Peak rotation speed, degrees per second. */
  peakDegPerS: number;
  /** Total distance travelled, metres. */
  travelM: number;
}

/** Numerical stats over one loop (sampled at 480 Hz), for the impossible and the physical path. */
export function pathStats(demo: Demo, physical: boolean, loopS = 6): PathStats {
  const h = 1 / 480;
  const at = (t: number) => {
    const f = demoFrame(demo, t);
    return physical ? f.physical : f.shot;
  };
  let peakA = 0;
  let peakW = 0;
  let travel = 0;
  let prev = at(0);
  let prev2 = prev;
  for (let i = 1; i <= loopS / h; i++) {
    const cur = at(i * h);
    travel += cur.position.distanceTo(prev.position);
    if (i >= 2) {
      const acc = cur.position.clone().addScaledVector(prev.position, -2).add(prev2.position).divideScalar(h * h).length();
      peakA = Math.max(peakA, acc);
    }
    peakW = Math.max(peakW, (cur.quaternion.angleTo(prev.quaternion) * 180) / Math.PI / h);
    prev2 = prev;
    prev = cur;
  }
  return { peakG: peakA / G, peakDegPerS: peakW, travelM: travel };
}

/** Projected nose-to-ear magnification for Bram through a shot (how "wide-lens" his face looks). */
export function faceExaggeration(s: Shot, t: number): number {
  const a = subjects()("primary", t).anchor;
  const nose: Vec3 = [a[0] + BRAM_FORWARD[0] * 0.228, 1.567, a[2] + BRAM_FORWARD[2] * 0.228];
  const ear: Vec3 = [a[0] - BRAM_FORWARD[0] * 0.05, 1.58, a[2] - BRAM_FORWARD[2] * 0.05];
  return depthOf(s, ear) / depthOf(s, nose);
}

/** Pip's on-screen height (fraction of frame) through a shot, with a scale applied about his feet. */
export function pipHeightFrac(s: Shot, t: number, scale: number): number {
  const p = subjects()("secondary", t);
  const top: Vec3 = [p.feet[0], p.feet[1] + p.heightM * scale, p.feet[2]];
  return Math.abs(ndcPersp(s, top)[1] - ndcPersp(s, p.feet)[1]) / 2;
}
