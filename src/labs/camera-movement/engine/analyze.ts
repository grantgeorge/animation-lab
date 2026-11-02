import type { SceneDescriptor } from "@/engine/types";
import { classifyLens, classifyShotSize, LENS_LABEL, SHOT_SIZE_LABEL, type ShotSize } from "@/engine/classify";
import { intrinsics, projectPoint, type CameraPose } from "@/engine/projection";
import { RAD, wrapDeg, yawPitch } from "./math";
import { poseAt, samplePath, type ShotPose } from "./path";
import type { Move, SubjectFn, SubjectId } from "./types";

/** The move decomposed into the camera operator's vocabulary, measured from its two keys. */
export interface MoveAnalysis {
  /** Metres along the start view direction (horizontal); > 0 is toward the subject. */
  dollyM: number;
  /** Metres sideways (horizontal); > 0 is to the camera's right. */
  truckM: number;
  /** Metres up (> 0) or down. */
  pedestalM: number;
  /** Degrees; > 0 pans right. */
  panDeg: number;
  /** Degrees; > 0 tilts up. */
  tiltDeg: number;
  /** End focal / start focal. */
  zoomRatio: number;
  /** For orbit moves, degrees travelled around the subject; > 0 arcs right. */
  orbitDeg: number;
  durationS: number;
  startSize: ShotSize;
  endSize: ShotSize;
  /** Subject height fraction at the start and the end. */
  startFraction: number;
  endFraction: number;
  /** Ordered labels of the components that matter, e.g. ["dolly in", "pan right"]. */
  components: string[];
  speed: "slow" | "steady" | "fast" | "whip";
}

/** Full-body height fraction of a subject in a shot (0.5 = half the frame height). */
export function bodyFraction(pose: ShotPose | (CameraPose & { focalMm: number }), d: SceneDescriptor, subjects: SubjectFn, id: SubjectId, t: number): number {
  const s = subjects(id, t);
  const i = intrinsics(pose.focalMm, d.gate);
  const top = projectPoint(pose, i, [s.feet[0], s.feet[1] + s.heightM, s.feet[2]]);
  const bot = projectPoint(pose, i, s.feet);
  if (!top.inFront || !bot.inFront) return 0;
  return Math.abs(top.ndc[1] - bot.ndc[1]) / 2;
}

const T = { dolly: 0.25, truck: 0.25, pedestal: 0.25, pan: 4, tilt: 3, zoom: 1.08, orbit: 8 };

export function analyzeMove(m: Move, d: SceneDescriptor, subjects: SubjectFn): MoveAnalysis {
  const a = m.start;
  const b = m.end;
  const ya = yawPitch(a.position, a.target);
  const yb = yawPitch(b.position, b.target);
  const yaw = ya.yawDeg / RAD;
  const fwd = [Math.sin(yaw), -Math.cos(yaw)];
  const right = [Math.cos(yaw), Math.sin(yaw)];
  const dx = b.position[0] - a.position[0];
  const dz = b.position[2] - a.position[2];
  let dollyM = dx * fwd[0] + dz * fwd[1];
  let truckM = dx * right[0] + dz * right[1];
  const pedestalM = b.position[1] - a.position[1];
  let panDeg = wrapDeg(yb.yawDeg - ya.yawDeg);
  const tiltDeg = yb.pitchDeg - ya.pitchDeg;
  const zoomRatio = m.interp === "dollyZoom" ? poseAt(m, m.t1, subjects).focalMm / a.focalMm : b.focalMm / a.focalMm;
  let orbitDeg = 0;
  if (m.interp === "orbit") {
    const c = a.target;
    const bearing = (p: readonly number[]) => Math.atan2(p[0] - c[0], p[2] - c[2]) * RAD;
    orbitDeg = wrapDeg(bearing(b.position) - bearing(a.position));
    // An orbit is not a dolly+truck+pan: report it as one move.
    dollyM = 0;
    truckM = 0;
    panDeg = 0;
  }
  const durationS = Math.max(0, m.t1 - m.t0);
  const p0 = poseAt(m, m.t0, subjects);
  const p1 = poseAt(m, m.t1, subjects);
  const startFraction = bodyFraction(p0, d, subjects, m.subject, m.t0);
  const endFraction = bodyFraction(p1, d, subjects, m.subject, m.t1);

  const components: string[] = [];
  if (m.interp === "track") components.push("tracking");
  else if (m.interp === "dollyZoom") components.push(dollyM < 0 ? "dolly zoom (pull back, zoom in)" : "dolly zoom (push in, zoom out)");
  else {
    const parts: [number, string][] = [];
    if (Math.abs(orbitDeg) > T.orbit) parts.push([Math.abs(orbitDeg) / 20, orbitDeg > 0 ? "arc right" : "arc left"]);
    if (Math.abs(dollyM) > T.dolly) parts.push([Math.abs(dollyM), dollyM > 0 ? "dolly in" : "dolly out"]);
    if (Math.abs(truckM) > T.truck) parts.push([Math.abs(truckM), truckM > 0 ? "truck right" : "truck left"]);
    if (Math.abs(pedestalM) > T.pedestal) parts.push([Math.abs(pedestalM), pedestalM > 0 ? (tiltDeg < -T.tilt ? "crane up" : "pedestal up") : tiltDeg > T.tilt ? "crane down" : "pedestal down"]);
    if (Math.abs(panDeg) > T.pan) parts.push([Math.abs(panDeg) / 15, panDeg > 0 ? "pan right" : "pan left"]);
    if (Math.abs(tiltDeg) > T.tilt && !parts.some(([, l]) => l.startsWith("crane"))) parts.push([Math.abs(tiltDeg) / 15, tiltDeg > 0 ? "tilt up" : "tilt down"]);
    if (zoomRatio > T.zoom || zoomRatio < 1 / T.zoom) parts.push([Math.abs(Math.log(zoomRatio)) * 2, zoomRatio > 1 ? "zoom in" : "zoom out"]);
    parts.sort((x, y) => y[0] - x[0]);
    components.push(...parts.map(([, l]) => l));
    if (!components.length) components.push("locked off");
  }
  // Speed from the dominant rate: metres or degrees per second. Tracking and orbits travel along a
  // path whose ends can coincide, so measure the path itself.
  let travelled = Math.hypot(dollyM, truckM, pedestalM);
  if (m.interp === "track" || m.interp === "orbit") {
    const pts = samplePath(m, subjects, 64);
    travelled = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]) : 0), 0);
  }
  const linRate = (m.interp === "orbit" ? 0 : travelled) / Math.max(durationS, 0.1);
  const angRate = Math.max(Math.abs(panDeg), Math.abs(tiltDeg), Math.abs(orbitDeg)) / Math.max(durationS, 0.1);
  const speed = angRate > 90 ? "whip" : linRate > 1.4 || angRate > 35 ? "fast" : linRate > 0.45 || angRate > 12 ? "steady" : "slow";
  return {
    dollyM,
    truckM,
    pedestalM,
    panDeg,
    tiltDeg,
    zoomRatio,
    orbitDeg,
    durationS,
    startSize: classifyShotSize(startFraction),
    endSize: classifyShotSize(endFraction),
    startFraction,
    endFraction,
    components,
    speed,
  };
}

const EASE_WORDS = { linear: "constant speed", inOut: "easing in and out", in: "accelerating", out: "settling to a stop" } as const;

const sizeWord = (s: ShotSize) => SHOT_SIZE_LABEL[s].toLowerCase();
const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");

/**
 * A one-line camera direction for an AI video prompt. Name the move first, one move per shot,
 * say where the framing starts and ends, the lens, the duration and the feel of the speed.
 */
export function movePhrase(m: Move, d: SceneDescriptor, an: MoveAnalysis): string {
  const name = d.characters[m.subject].name;
  const lens = `${Math.round(m.start.focalMm)} mm ${LENS_LABEL[classifyLens(m.start.focalMm)]}`;
  const dur = `${an.durationS.toFixed(0)}-second move`;
  const ease = EASE_WORDS[m.ease];
  const speed = an.speed === "steady" ? "steady" : an.speed;
  if (m.interp === "dollyZoom") {
    const f1 = Math.round(m.start.focalMm * an.zoomRatio);
    const pull = an.dollyM < 0;
    return `Dolly zoom on ${name}: the camera ${pull ? "pulls back" : "pushes in"} while zooming ${pull ? "in" : "out"} from ${Math.round(m.start.focalMm)} mm to ${f1} mm, keeping ${name} the same size as the background ${pull ? "looms forward" : "stretches away"}; ${dur}, ${ease}.`;
  }
  if (m.interp === "track") {
    return `${cap(speed)} tracking shot moving with ${name}, camera leading ${an.startSize === an.endSize ? `in ${article(sizeWord(an.startSize))} ${sizeWord(an.startSize)}` : `from ${article(sizeWord(an.startSize))} ${sizeWord(an.startSize)} to ${article(sizeWord(an.endSize))} ${sizeWord(an.endSize)}`}, ${lens}; ${dur}, ${ease}.`;
  }
  const [first, ...rest] = an.components;
  if (first === "locked off") return `Locked-off static shot, ${article(sizeWord(an.startSize))} ${sizeWord(an.startSize)} of ${name}, ${lens}, no camera movement.`;
  const framing =
    an.startSize === an.endSize ? `holding ${article(sizeWord(an.startSize))} ${sizeWord(an.startSize)} of ${name}` : `from ${article(sizeWord(an.startSize))} ${sizeWord(an.startSize)} to ${article(sizeWord(an.endSize))} ${sizeWord(an.endSize)} of ${name}`;
  const extra = rest.length ? ` with a slight ${rest.slice(0, 2).join(" and ")}` : "";
  return `${cap(speed)} ${first}${extra}, ${framing}, ${lens}; ${dur}, ${ease}.`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
