import type { Channel, Key, Track } from "../dsl";

/**
 * Procedural run cycle, emitted as ordinary DSL keys so it validates, samples and loops like any
 * hand-keyed track. Each step is one contact-to-contact half cycle; legs and opposite arms swing
 * in counter-phase, the knee folds on the passing pose, and the body bobs twice per cycle.
 * Values are deltas from rest. Swing ramps in over the first step and out over the last.
 * Every track starts and ends at 0, so it can be layered with other tracks on the same channel
 * (sampleClip sums tracks per part/channel).
 */
export function runCycle(opts: { t0: number; t1: number; stepS: number; stride?: number; armSwing?: number; lean?: number; bob?: number }): Track[] {
  const { t0, t1, stepS } = opts;
  const stride = opts.stride ?? 38;
  const armSwing = opts.armSwing ?? 42;
  const lean = opts.lean ?? 14;
  const bob = opts.bob ?? 0.05;
  const n = Math.max(1, Math.round((t1 - t0) / stepS));
  const step = (t1 - t0) / n;
  const keys: Record<string, Key[]> = {};
  const push = (part: string, ch: Channel, t: number, v: number, e: Key[2] = "inOut") => {
    const k = (keys[`${part}.${ch}`] ??= []);
    k.push([Number(t.toFixed(4)), Number(v.toFixed(4)), e]);
  };
  const ramp = (i: number) => Math.min(1, (i + 0.5) / 1.5, (n - i + 0.5) / 1.5);
  // Contact poses at i·step; passing poses halfway.
  for (let i = 0; i <= n; i++) {
    const t = t0 + i * step;
    const side = i % 2 === 0 ? 1 : -1;
    const a = i === 0 || i === n ? 0 : ramp(i);
    push("thighL", "rx", t, -stride * side * a);
    push("thighR", "rx", t, stride * side * a);
    push("shinL", "rx", t, (side > 0 ? 8 : 40) * a);
    push("shinR", "rx", t, (side > 0 ? 40 : 8) * a);
    push("upperArmL", "rx", t, armSwing * side * a);
    push("upperArmR", "rx", t, -armSwing * side * a);
    push("root", "py", t, 0, "in");
    if (i < n) {
      const tm = t + step / 2;
      const am = ramp(i);
      push("thighL", "rx", tm, 0);
      push("thighR", "rx", tm, 0);
      // the leg that just pushed off folds high behind on the passing pose
      push("shinL", "rx", tm, (side > 0 ? 75 : 20) * am);
      push("shinR", "rx", tm, (side > 0 ? 20 : 75) * am);
      push("upperArmL", "rx", tm, 0);
      push("upperArmR", "rx", tm, 0);
      push("root", "py", tm, bob * am, "out");
    }
  }
  const tracks: Track[] = Object.entries(keys).map(([id, k]) => {
    const [part, ch] = id.split(".") as [string, Channel];
    return { part, ch, keys: k };
  });
  // Elbows stay bent while running; torso leans into the run.
  const holdIn = (part: string, ch: Channel, v: number): Track => ({
    part,
    ch,
    keys: [
      [t0 - 0.12, 0, "hold"],
      [t0 + step * 0.8, v, "out"],
      [t1 - step * 0.8, v, "hold"],
      [t1 + 0.12, 0, "inOut"],
    ],
  });
  tracks.push(holdIn("forearmL", "rx", -85), holdIn("forearmR", "rx", -85), holdIn("torso", "rx", lean));
  // arms carried slightly out from the body so the pumping hands clear the coat
  tracks.push(holdIn("upperArmL", "rz", 9), holdIn("upperArmR", "rz", -9));
  return tracks;
}
