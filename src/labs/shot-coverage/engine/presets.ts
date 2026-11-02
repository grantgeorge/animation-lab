import type { SceneDescriptor } from "@/engine/types";
import { intrinsics, projectPoint } from "@/engine/projection";
import { lookAtPose } from "@/labs/camera-movement/engine/math";
import { axisAt, reflectAcross, sideOf, type Axis, type V2 } from "./axis";
import { aimPoint, facePoint } from "./shots";
import { WHO_ID, type CamId, type CamSpec, type Cams, type PresetKind, type SubjectFn, type Vec3, type Who } from "./types";

/**
 * Per-scene coverage staging: the reference time the presets are solved at (both characters on
 * their conversation marks) and the floor region a camera may stand in (inside the set's walls).
 */
export interface CoverageScene {
  tRef: number;
  zone: { x: readonly [number, number]; z: readonly [number, number]; y: readonly [number, number] };
}

export const COVERAGE_SCENES: Record<string, CoverageScene> = {
  doorway: { tRef: 3.6, zone: { x: [-4.6, 4.6], z: [-4.75, 5.5], y: [0.3, 4.5] } },
  alley: { tRef: 4.2, zone: { x: [-1.85, 1.45], z: [-18.5, 6], y: [0.3, 4.5] } },
  workshop: { tRef: 4.0, zone: { x: [-2.15, 1.85], z: [-5.3, 5], y: [0.3, 3.2] } },
};

export const coverageFor = (d: SceneDescriptor): CoverageScene => COVERAGE_SCENES[d.scene.id] ?? COVERAGE_SCENES.doorway;

export const inZone = (z: CoverageScene["zone"], p: Vec3) => p[0] >= z.x[0] && p[0] <= z.x[1] && p[2] >= z.z[0] && p[2] <= z.z[1];

export function clampToZone(z: CoverageScene["zone"], p: Vec3): Vec3 {
  const c = (v: number, r: readonly [number, number]) => Math.min(r[1], Math.max(r[0], v));
  return [c(p[0], z.x), c(p[1], z.y), c(p[2], z.z)];
}

export const PRESET_LABEL: Record<PresetKind, string> = {
  master: "Wide master",
  ots: "Over-the-shoulder",
  single: "Medium single",
  closeup: "Close-up reaction",
};

/** Target body-height fractions per preset (see SHOT_SIZE_BOUNDS: WS < 0.65 ≤ FS < 1.15 ≤ MS < 2 ≤ MCU < 3.5 ≤ CU < 7). */
const FRACTION: Record<PresetKind, number> = { master: 0.55, ots: 1.35, single: 1.5, closeup: 4.6 };

/** The side the set is open to (where the audience and the overview camera are): coverage starts here. */
export function frontSide(d: SceneDescriptor, ax: Axis): 1 | -1 {
  return sideOf(ax, d.observer.presets.overview.position, 0) >= 0 ? 1 : -1;
}

const add = (p: V2, v: V2, k: number): V2 => [p[0] + v[0] * k, p[1] + v[1] * k];
const rot = (v: V2, toward: V2, deg: number): V2 => {
  const a = (deg * Math.PI) / 180;
  return [v[0] * Math.cos(a) + toward[0] * Math.sin(a), v[1] * Math.cos(a) + toward[1] * Math.sin(a)];
};
const unit = (v: V2): V2 => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r1 = (v: number) => Math.round(v * 1000) / 1000;
const round3 = (p: Vec3): Vec3 => [r1(p[0]), r1(p[1]), r1(p[2])];

/** Focal length (mm) that makes a subject of `heightM` fill `fraction` of the frame height at `distM`. */
export function focalForFraction(d: SceneDescriptor, fraction: number, distM: number, heightM: number): number {
  const f = (fraction * distM * d.gate.heightMm) / heightM;
  return Math.round(Math.min(d.focal.max, Math.max(d.focal.min, f)));
}

/**
 * A coverage camera from a preset, solved against the axis at the scene's reference time.
 * `side` +1 puts it on the front side of the line, −1 across it. Pure and deterministic.
 */
export function presetCamera(kind: PresetKind, who: Who, d: SceneDescriptor, subjects: SubjectFn, side: 1 | -1 = 1): CamSpec {
  const cov = coverageFor(d);
  const t = cov.tRef;
  const ax = axisAt(subjects, t);
  const s = frontSide(d, ax) * side;
  const n: V2 = [ax.n[0] * s, ax.n[1] * s];
  const X = WHO_ID[who];
  const Y = who === "bram" ? "secondary" : "primary";
  const sx = subjects(X, t);
  const sy = subjects(Y, t);
  const cx = d.characters[X];
  const cy = d.characters[Y];
  const fx: V2 = [sx.feet[0], sx.feet[2]];
  const fy: V2 = [sy.feet[0], sy.feet[2]];
  const toY = unit([fy[0] - fx[0], fy[1] - fx[1]]);
  const zone = cov.zone;
  const pick = (cands: Vec3[]) => cands.find((p) => inZone(zone, p)) ?? clampToZone(zone, cands[0]);

  if (kind === "master") {
    const spec: CamSpec = { position: [0, 0, 0], aim: "both", target: [0, 0, 0], focalMm: 28, preset: "master" };
    const tgt = aimPoint(spec, d, subjects, t);
    const mid: V2 = [tgt[0], tgt[2]];
    const hMax = Math.max(sx.feet[1] + cx.landmarks.capTop, sy.feet[1] + cy.landmarks.capTop);
    const y = tgt[1] + 0.2;
    const cands: Vec3[] = [];
    const D = Math.max(3.8, 2.4 + 1.2 * ax.length);
    for (const k of [1, 0.8, 0.62, 0.5])
      for (const a of [0, 15, -15, 30, -30, 45, -45, 60, -60]) {
        const dir = a >= 0 ? rot(n, [-ax.u[0], -ax.u[1]], a) : rot(n, ax.u, -a);
        const p = add(mid, dir, D * k);
        cands.push([p[0], y, p[1]]);
      }
    const position = pick(cands);
    return { ...spec, position: round3(position), target: round3(tgt), focalMm: focalForFraction(d, FRACTION.master, dist3(position, tgt), hMax) };
  }

  const spec: CamSpec = { position: [0, 0, 0], aim: who, target: [0, 0, 0], focalMm: 50, preset: `${kind}-${who}` };
  const tgt = facePoint(d, subjects, X, t);
  const h = cx.landmarks.capTop;
  const cands: Vec3[] = [];
  if (kind === "ots") {
    // Over Y's shoulder: on the line from X's face past a point beside Y's shoulder, a little behind Y.
    // Solve the lateral offset so Y's head sits on the frame edge (NDC ≈ 1.05: a third of the frame is shoulder) for the lens this
    // distance needs; wider offsets are fallbacks when the set's walls are in the way.
    // Over a shorter foreground character the lens looks past the top of their head; over a taller one, past the shoulder.
    const y = sy.feet[1] + (sy.feet[1] + cy.landmarks.capTop < tgt[1] ? cy.landmarks.capTop - 0.03 : cy.landmarks.eyes - 0.02);
    const eyeY: Vec3 = [sy.feet[0], sy.feet[1] + cy.landmarks.eyes, sy.feet[2]];
    const at = (l: number, b: number): Vec3 => {
      const yp = add(fy, n, l);
      const dir = unit([yp[0] - fx[0], yp[1] - fx[1]]);
      const p = add(yp, dir, b);
      return [p[0], y, p[1]];
    };
    const ndcOfY = (p: Vec3) => {
      const f = focalForFraction(d, FRACTION.ots, dist3(p, tgt), h);
      const pose = lookAtPose(p, tgt);
      return Math.abs(projectPoint(pose, intrinsics(f, d.gate), eyeY).ndc[0]);
    };
    for (const b of [1.5, 1.2, 0.9, 0.65]) {
      let lo = 0.01;
      let hi = 2.5;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (ndcOfY(at(mid, b)) < 1.05) lo = mid;
        else hi = mid;
      }
      cands.push(at(lo, b));
    }
    // No room behind Y (a wall, a doorway): an honest eye-level single beats a cramped fake OTS.
    if (!cands.some((p) => inZone(zone, p))) return { ...presetCamera("single", who, d, subjects, side), preset: `single-${who}` };
  } else {
    // Singles: in front of X on the + side, angled off the eyeline toward the camera side. The sets
    // are built to be seen looking down −z, so prefer an angle whose view runs into the set.
    const angle = kind === "closeup" ? 28 : 40;
    const D = kind === "closeup" ? 0.95 * h + 0.25 : 1.6 * h;
    const y = sx.feet[1] + cx.landmarks.eyes;
    const intoSet: Vec3[] = [];
    for (const k of [1, 0.85, 0.7, 0.55])
      for (const a of [angle, angle + 15, angle + 30, angle + 45, angle - 12]) {
        const dir = rot(toY, n, a);
        const p = add(fx, dir, D * k);
        cands.push([p[0], y, p[1]]);
        if (-dir[1] <= -0.15) intoSet.push([p[0], y, p[1]]);
      }
    cands.unshift(...intoSet);
  }
  const position = pick(cands);
  return { ...spec, position: round3(position), target: round3(tgt), focalMm: focalForFraction(d, FRACTION[kind], dist3(position, tgt), h) };
}

/** The default coverage set: A = wide master, B = OTS on Bram, C = OTS on Pip, all on the front side. */
export function defaultCoverage(d: SceneDescriptor, subjects: SubjectFn): Cams {
  return {
    A: presetCamera("master", "bram", d, subjects),
    B: presetCamera("ots", "bram", d, subjects),
    C: presetCamera("ots", "pip", d, subjects),
  };
}

/**
 * Cross the line: mirror the camera across the axis at the reference time. Aim mode and lens are
 * kept, so the shot is the same size and angle, seen from the other side. A free aim point mirrors too.
 */
export function crossLine(cam: CamSpec, d: SceneDescriptor, subjects: SubjectFn): CamSpec {
  const cov = coverageFor(d);
  const ax = axisAt(subjects, cov.tRef);
  const position = round3(clampToZone(cov.zone, reflectAcross(ax, cam.position)));
  const target = cam.aim === "free" ? round3(reflectAcross(ax, cam.target)) : cam.target;
  return { ...cam, position, target };
}

/** Which side of the line (at the reference time) each camera is on, relative to the front side. */
export function camSides(cams: Cams, d: SceneDescriptor, subjects: SubjectFn): Record<CamId, -1 | 0 | 1> {
  const ax = axisAt(subjects, coverageFor(d).tRef);
  const f = frontSide(d, ax);
  const one = (c: CamSpec) => (sideOf(ax, c.position) * f) as -1 | 0 | 1;
  return { A: one(cams.A), B: one(cams.B), C: one(cams.C) };
}

/** True when the cameras are not all on one side of the line (neutral cameras on the line don't count). */
export function isCrossed(cams: Cams, d: SceneDescriptor, subjects: SubjectFn): boolean {
  const s = Object.values(camSides(cams, d, subjects)).filter((v) => v !== 0);
  return s.some((v) => v !== s[0]);
}
