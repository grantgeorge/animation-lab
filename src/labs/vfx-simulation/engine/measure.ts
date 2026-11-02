import { beatTimes, type Phys, type Timing, type Treatment } from "./beat";
import { cartoonPose, crownAngle, type CartoonPose } from "./cartoon";
import { drawingAt, drawingFills } from "./drawn";
import { frameStats, realSimTime, type FluidBake } from "./fluid";
import { cardToWorld, measure, rasterParticles, rasterPrims, type Legibility, type Prim } from "./legibility";
import { FPS, FRAMES, frameOf, stepped } from "./timing";

/** Side-on silhouette of a cartoon pose: blobs as ellipses, the crown as a cup with a spiky rim. */
export function cartoonPrims(pose: CartoonPose): Prim[] {
  const out: Prim[] = [];
  for (const b of pose.blobs) {
    const rx = b.r * b.stretch;
    const ry = b.r / Math.sqrt(Math.max(0.05, b.stretch));
    out.push({ kind: "ellipse", cx: b.x, cy: b.y, rx, ry, rot: Math.atan2(b.dy, b.dx) });
  }
  const c = pose.crown;
  if (c && c.h > 0.005) {
    const pts: number[] = [c.x - c.r0, 0, c.x - c.r1, c.h];
    const w = c.r1 * 0.35;
    for (let i = 0; i <= 24; i++) {
      const x = -c.r1 + (2 * c.r1 * i) / 24;
      let bonus = 0;
      for (let k = 0; k < c.points; k++) {
        const xk = Math.cos(crownAngle(k, c.points)) * c.r1;
        bonus = Math.max(bonus, c.h * c.spike * (1 + c.jitter[k]) * Math.max(0, 1 - Math.abs(x - xk) / w) ** 1.5);
      }
      pts.push(c.x + x, c.h + bonus);
    }
    pts.push(c.x + c.r1, c.h, c.x + c.r0, 0);
    out.push({ kind: "poly", pts });
  }
  return out;
}

/** Output time → the time each treatment actually samples (stepping on twos / threes). */
export const sampleTime = (t: number, tm: Timing) => stepped(t, tm.step);

export interface TreatmentCurve {
  /** Splash top (m) per frame. */
  top: number[];
  legibility: Legibility;
  impactFrame: number;
  peakFrame: number;
}

/** Legibility and the splash-height curve of one treatment over the loop. Realistic needs a finished bake. */
export function measureTreatment(tr: Treatment, p: Phys, tm: Timing, bake: FluidBake | null): TreatmentCurve | null {
  const b = beatTimes(tr, p, tm);
  const top: number[] = new Array(FRAMES).fill(0);
  let buf: Float32Array | null = null;
  if (tr === "real") {
    if (!bake || !bake.done) return null;
    buf = new Float32Array(bake.sim.n * 3);
  }
  const legibility = measure(
    FRAMES,
    (f, grid) => {
      const raw = f / FPS;
      const t = sampleTime(raw, tm);
      if (tr === "real" && bake && buf) {
        bake.sample(realSimTime(t, b, tm.hold, p.stylization), buf);
        rasterParticles(buf, bake.sim.n, grid);
        top[f] = frameStats(buf, bake.sim.n, bake.sim.radius).maxY;
      } else if (tr === "cartoon") {
        const pose = cartoonPose(t, b, p);
        rasterPrims(cartoonPrims(pose), grid);
        top[f] = pose.phase === "rest" || pose.phase === "gather" ? 0 : pose.top;
      } else {
        const dw = drawingAt(t, raw, b, p, tm.step);
        const prims = cardToWorld(drawingFills(dw));
        rasterPrims(prims, grid);
        let m = 0;
        if (dw.phase !== "rest" && dw.phase !== "gather") for (const pr of prims) if (pr.kind === "poly") for (let i = 1; i < pr.pts.length; i += 2) m = Math.max(m, pr.pts[i]);
        top[f] = m;
      }
    },
    frameOf(b.impact),
  );
  return { top, legibility, impactFrame: frameOf(b.impact), peakFrame: frameOf(b.peak) };
}
