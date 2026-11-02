import { describe, expect, it } from "vitest";
import { sampleTrack } from "@/scene/animation/dsl";
import { BUCKET, LIMITS, PHYS_DEFAULT, TIMING_DEFAULT, TREATMENTS, beatTimes, bucketFrame, bucketPose, fromCard, toCard, type Phys } from "./beat";
import { cartoonPose, dropCount } from "./cartoon";
import { drawingAt } from "./drawn";
import { BOUNDS, FluidBake, frameStats, realSimTime } from "./fluid";
import { AREA_MIN, GW, frameMetric, newGrid, pieces } from "./legibility";
import { measureTreatment } from "./measure";
import { pipClip, pipTiming } from "./pipClip";
import { categoryPhrase, syncPhrase, treatmentPhrase, type CategoryId } from "./prompt";
import { syncReading, treatmentReading } from "./reading";
import { FPS, FRAMES, drawingOf, framesOnPeak, holdRemap, holdRuns, stepped } from "./timing";
import { CrateBake, keyedCrates } from "./fx/crates";
import { ClothBake, keyedFlag, FLAG } from "./fx/cloth";
import { RippleBake } from "./fx/ripples";
import { fireParticles } from "./fx/fire";
import { keyedBall, simBall } from "./fx/impact";

const phys = (o: Partial<Phys> = {}): Phys => ({ ...PHYS_DEFAULT, ...o });
function bake(o: Partial<Phys> = {}, n = 500, seed = 1) {
  const p = phys(o);
  const b = new FluidBake({ n, gravity: p.gravity, viscosity: p.viscosity, intensity: p.intensity, turbulence: p.turbulence, seed }, beatTimes("real", p, TIMING_DEFAULT.real));
  b.bakeAll();
  return b;
}

describe("timing helpers", () => {
  it("holds each drawing for 2 frames on twos and 3 on threes", () => {
    expect(holdRuns(12, 1)).toEqual(new Array(12).fill(1));
    expect(holdRuns(12, 2)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(holdRuns(12, 3)).toEqual([3, 3, 3, 3]);
    for (let f = 0; f < 48; f++) {
      expect(stepped(f / FPS, 2)).toBeCloseTo((Math.floor(f / 2) * 2) / FPS, 9);
      expect(drawingOf(f, 3)).toBe(Math.floor(f / 3));
    }
  });
  it("a peak hold keeps the source on the peak for exactly the held frames, then resumes", () => {
    const peak = 1.25;
    for (const hold of [0, 4, 8, 16]) {
      const sample = (t: number) => Math.min(holdRemap(t, peak, hold / FPS), peak) - (holdRemap(t, peak, hold / FPS) > peak ? 1 : 0);
      // frames that sit exactly on the peak: the hold itself (+1 for the peak frame when it lands on a frame)
      expect(framesOnPeak(sample, peak)).toBe(hold + 1);
      expect(holdRemap(peak + hold / FPS + 0.5, peak, hold / FPS)).toBeCloseTo(peak + 0.5, 9);
    }
    expect(holdRemap(0.5, peak, 0.3)).toBe(0.5);
  });
});

describe("the beat", () => {
  it("anticipation pushes the impact later by exactly its frames; the flinch follows the splash", () => {
    const p = phys();
    const a0 = beatTimes("cartoon", p, { step: 1, hold: 6, antic: 0 });
    const a6 = beatTimes("cartoon", p, { step: 1, hold: 6, antic: 6 });
    expect(a6.impact - a0.impact).toBeCloseTo(6 / FPS, 9);
    for (const tr of TREATMENTS) {
      const b = beatTimes(tr, p, TIMING_DEFAULT[tr]);
      expect(b.kick).toBeLessThan(b.release);
      expect(b.release).toBeLessThan(b.impact);
      expect(b.impact).toBeLessThan(b.peak);
      expect(b.holdEnd - b.peak).toBeCloseTo(TIMING_DEFAULT[tr].hold / FPS, 9);
      expect(b.recoil - b.impact).toBeCloseTo(2 / FPS, 9);
      expect(beatTimes(tr, p, TIMING_DEFAULT[tr], -6).recoil - b.recoil).toBeCloseTo(-8 / FPS, 9);
    }
  });
  it("the bucket tips away from Pip and its mouth ends up pointing +X", () => {
    const b = beatTimes("cartoon", phys(), TIMING_DEFAULT.cartoon);
    const fr = bucketFrame(bucketPose("cartoon", 2.5, b));
    expect(fr.dir[0]).toBeGreaterThan(0.9);
    expect(fr.mouth[0]).toBeGreaterThan(BUCKET.x);
    expect(bucketPose("cartoon", b.kick + 3 / FPS, b).angle).toBeGreaterThan(0); // rears back first
  });
  it("card projection round-trips", () => {
    const [u, v] = toCard(0.3, 0.4, 0.05);
    const [x, y] = fromCard(u, v, 0.05);
    expect(x).toBeCloseTo(0.3, 9);
    expect(y).toBeCloseTo(0.4, 9);
  });
});

describe("realistic fluid sim", () => {
  it("is deterministic: same settings and seed give identical frames; another seed does not", () => {
    const a = bake();
    const b = bake();
    expect(a.records.length).toBe(b.records.length);
    for (const i of [0, 40, a.records.length - 1]) expect(Array.from(a.records[i])).toEqual(Array.from(b.records[i]));
    const c = bake({}, 500, 2);
    expect(Array.from(c.records[60])).not.toEqual(Array.from(a.records[60]));
  });
  it("conserves particles: none lost, none through the floor, all inside the set, none NaN once released", () => {
    const b = bake();
    const n = b.sim.n;
    expect(n).toBe(500);
    const out = new Float32Array(n * 3);
    for (const t of [1.2, 1.5, 2.2, 3.9]) {
      b.sample(t, out);
      let released = 0;
      for (let i = 0; i < n; i++) {
        const [x, y, z] = [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]];
        if (Number.isNaN(x)) continue;
        released++;
        expect(Number.isFinite(y) && Number.isFinite(z)).toBe(true);
        expect(y).toBeGreaterThanOrEqual(b.sim.radius - 1e-6);
        expect(x).toBeGreaterThanOrEqual(BOUNDS.x0);
        expect(x).toBeLessThanOrEqual(BOUNDS.x1);
      }
      if (t > 1.6) expect(released).toBe(n);
    }
    const st = frameStats(out, n, b.sim.radius);
    expect(st.airborne + st.grounded).toBe(n);
  });
  it("more gravity: the water reaches the floor sooner", () => {
    const first = [0.5, 1, 2].map((g) => bake({ gravity: g }).sim.firstContact);
    expect(first[0]).toBeGreaterThan(first[1]);
    expect(first[1]).toBeGreaterThan(first[2]);
  });
  it("more viscosity: lower spray, and the puddle travels less far", () => {
    const runs = [0, 0.5, 1].map((v) => {
      const b = bake({ viscosity: v });
      const out = new Float32Array(b.sim.n * 3);
      let spray = 0;
      for (let t = b.sim.firstContact + 0.3; t < b.sim.firstContact + 0.6; t += 1 / 60) {
        b.sample(t, out);
        spray = Math.max(spray, frameStats(out, b.sim.n, b.sim.radius).maxY);
      }
      b.sample(3.9, out);
      return { spray, reach: frameStats(out, b.sim.n, b.sim.radius).reach };
    });
    expect(runs[0].reach).toBeGreaterThan(runs[1].reach);
    expect(runs[1].reach).toBeGreaterThan(runs[2].reach);
    expect(runs[0].spray).toBeGreaterThan(runs[2].spray * 2);
  });
  it("stylization retimes around the impact without moving the start", () => {
    const b = beatTimes("real", phys(), TIMING_DEFAULT.real);
    expect(realSimTime(0.5, b, 0, 1)).toBe(0.5);
    expect(realSimTime(b.impact + 0.4, b, 0, 1)).toBeLessThan(b.impact + 0.4);
    expect(realSimTime(b.impact + 0.4, b, 0, 0)).toBeCloseTo(b.impact + 0.4, 9);
  });
});

describe("stylized treatments", () => {
  it("the cartoon crown holds (a moving hold) for the hold length, then the drops snap off", () => {
    const p = phys();
    const tm = TIMING_DEFAULT.cartoon;
    const b = beatTimes("cartoon", p, tm);
    const atPeak = cartoonPose(b.peak, b, p);
    const late = cartoonPose(b.holdEnd - 0.5 / FPS, b, p);
    expect(atPeak.phase).toBe("hold");
    expect(late.phase).toBe("hold");
    expect(late.crown!.h / atPeak.crown!.h).toBeGreaterThan(1);
    expect(late.crown!.h / atPeak.crown!.h).toBeLessThan(1.08);
    expect(cartoonPose(b.holdEnd + 2 / FPS, b, p).phase).toBe("break");
    expect(cartoonPose(b.impact + 0.2 / FPS, b, p).phase).toBe("squash");
  });
  it("hand-drawn: drawings change only on their step, and the impact frame is one frame on ones", () => {
    const p = phys();
    const tm = TIMING_DEFAULT.drawn;
    const b = beatTimes("drawn", p, tm);
    const idx = Array.from({ length: FRAMES }, (_, f) => drawingAt(stepped(f / FPS, 2), f / FPS, b, p, 2).index);
    for (let f = 0; f < FRAMES; f += 2) expect(idx[f]).toBe(idx[f + 1]);
    const flashes = Array.from({ length: FRAMES }, (_, f) => drawingAt(stepped(f / FPS, 2), f / FPS, b, p, 2).impact).filter(Boolean);
    expect(flashes.length).toBe(1);
  });
  it("fewer, bigger drops as stylization or viscosity rise", () => {
    expect(dropCount(phys({ stylization: 1 }))).toBeLessThan(dropCount(phys({ stylization: 0 })));
    expect(dropCount(phys({ viscosity: 1 }))).toBeLessThan(dropCount(phys({ viscosity: 0 })));
  });
});

describe("legibility (measured)", () => {
  it("a held cartoon crown stays legible far longer than the physical sim", () => {
    const p = phys({ count: 1200, stylization: 0 });
    const real = measureTreatment("real", p, TIMING_DEFAULT.real, bake({ stylization: 0 }, 1200))!;
    const cart = measureTreatment("cartoon", p, TIMING_DEFAULT.cartoon, null)!;
    const drawn = measureTreatment("drawn", p, TIMING_DEFAULT.drawn, null)!;
    expect(cart.legibility.longestRun).toBeGreaterThanOrEqual(real.legibility.longestRun + 6);
    expect(drawn.legibility.longestRun).toBeGreaterThan(real.legibility.longestRun);
  });
  it("a longer hold gives a longer legible run", () => {
    const p = phys();
    const runs = [0, 6, 12].map((hold) => measureTreatment("cartoon", p, { step: 1, hold, antic: 3 }, null)!.legibility.longestRun);
    expect(runs[1]).toBeGreaterThan(runs[0]);
    expect(runs[2]).toBeGreaterThan(runs[1]);
  });
  it("frame metric: area, grouping and stability", () => {
    const g = newGrid();
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) g[j * GW + i + 10] = 1;
    const m = frameMetric(g, g);
    expect(m.area).toBe(36);
    expect(m.area).toBeGreaterThanOrEqual(AREA_MIN);
    expect(m.iou).toBe(1);
    expect(m.legible).toBe(true);
    const dots = newGrid();
    for (let i = 0; i < 30; i++) dots[(i % 10) * 4 * GW + Math.floor(i / 10) * 7 + 2] = 1;
    expect(pieces(dots).count).toBe(30);
  });
});

describe("Pip's performance is generated from the beat", () => {
  it("keys are sorted and finite, and the hop lands on the recoil", () => {
    const p = phys();
    for (const tr of TREATMENTS) {
      const b = beatTimes(tr, p, TIMING_DEFAULT[tr], tr === "cartoon" ? -10 : 2);
      const clip = pipClip(pipTiming(tr, b, p.intensity));
      for (const track of clip.tracks) {
        for (let i = 0; i < track.keys.length; i++) {
          expect(Number.isFinite(track.keys[i][1])).toBe(true);
          if (i) expect(track.keys[i][0]).toBeGreaterThan(track.keys[i - 1][0]);
        }
      }
      const pz = clip.tracks.find((t) => t.part === "root" && t.ch === "pz")!;
      expect(sampleTrack(pz.keys, b.recoil - 0.05)).toBe(0);
      expect(sampleTrack(pz.keys, b.recoil + 0.3)).toBeLessThan(-0.1);
    }
  });
});

describe("prompt phrases and readings", () => {
  it("are deterministic and differ by treatment", () => {
    const p = phys();
    const phrases = TREATMENTS.map((tr) => treatmentPhrase(tr, p, TIMING_DEFAULT[tr]));
    expect(phrases.map((s, i) => treatmentPhrase(TREATMENTS[i], p, TIMING_DEFAULT[TREATMENTS[i]]))).toEqual(phrases);
    expect(new Set(phrases).size).toBe(3);
    expect(phrases[0]).toContain("photoreal fluid simulation");
    expect(phrases[1]).toContain("holds for 7-frame");
    expect(phrases[2]).toContain("on twos");
    expect(treatmentPhrase("drawn", p, { ...TIMING_DEFAULT.drawn, step: 3 })).toContain("on threes");
    expect(treatmentPhrase("real", phys({ gravity: LIMITS.gravity[0] }), TIMING_DEFAULT.real)).toContain("low gravity");
    expect(treatmentPhrase("real", phys({ viscosity: 1 }), TIMING_DEFAULT.real)).toContain("syrupy");
  });
  it("name the sync offset, and readings follow the settings", () => {
    const p = phys();
    expect(syncPhrase(p, TIMING_DEFAULT.cartoon, -6)).toContain("flinches 6 frames before");
    expect(syncPhrase(p, TIMING_DEFAULT.cartoon, 12)).toContain("late, 12 frames after");
    expect(syncReading(-3).verdict).toBe("early");
    expect(syncReading(2).verdict).toBe("tight");
    expect(syncReading(5).verdict).toBe("late");
    expect(syncReading(10).verdict).toBe("disconnected");
    expect(treatmentReading("drawn", p, { step: 3, hold: 8, antic: 3 })).toContain("on threes");
    const cats: CategoryId[] = ["fire", "water", "rigid", "cloth", "magic", "drawn"];
    const all = cats.flatMap((c) => [categoryPhrase(c, "real", "sim"), categoryPhrase(c, "stylized", "keyed")]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("category sims", () => {
  it("crates: deterministic, finite, and the keyed version lands where it was laid out", () => {
    const a = new CrateBake(0.6);
    const b = new CrateBake(0.6);
    expect(a.at(60)).toEqual(b.at(60));
    for (const c of a.at(95).crates) expect(Number.isFinite(c.x) && Number.isFinite(c.angle)).toBe(true);
    const k = keyedCrates(3.9, 0.6);
    expect(k.crates[0].x).toBeCloseTo(0.95, 6);
    expect(k.crates[0].sy).toBe(1);
  });
  it("cloth stays finite and attached; the keyed flag lags the stick", () => {
    const c = new ClothBake(0.5);
    for (const v of c.at(40)) expect(Number.isFinite(v)).toBe(true);
    const out = new Float32Array(FLAG.cols * FLAG.rows * 3);
    keyedFlag(1.0, 0.5, out);
    expect(out.every(Number.isFinite)).toBe(true);
  });
  it("ripples are deterministic; fire and the ball are pure functions of time", () => {
    expect(Array.from(new RippleBake(0.5).heightAt(50))).toEqual(Array.from(new RippleBake(0.5).heightAt(50)));
    const a = new Float32Array(7 * 300);
    const b = new Float32Array(7 * 300);
    fireParticles(1.234, 300, 0.4, a);
    fireParticles(1.234 + 4, 300, 0.4, b);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], 4);
    expect(simBall(1.5, 0.5)).toEqual(simBall(1.5, 0.5));
    expect(keyedBall(0.7 + 3 / FPS + 0.01, 0.5).impactFrame).toBe(true);
  });
});
