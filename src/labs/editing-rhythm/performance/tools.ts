import type { Channel, Ease, Key, Track } from "@/scene/animation/dsl";
import { REELS } from "../engine/source";
import type { ReelId, V3 } from "../engine/types";

export type K = [number, number, Ease?];
const round = (v: number) => Number(v.toFixed(4));

/** A track from [t, v, ease] keys (ease defaults to inOut). */
export const T = (part: string, ch: Channel, keys: K[]): Track => ({ part, ch, keys: keys.map(([t, v, e]) => [round(t), round(v), e ?? "inOut"] as Key) });

/** A face track (eyes sy = −blink, eyes py = wide, brows py = up, brows rz = +sad/−angry, mouth py = smile, mouth sy = open). */
export const F = (part: "eyes" | "brows" | "mouth", ch: "sy" | "py" | "rz", keys: K[]) => T(part, ch, keys);

/** Constant value for a whole reel. */
export const C = (part: string, ch: Channel, v: number, len: number): Track => T(part, ch, [[0, v], [len, v, "hold"]]);

/** Blink keys (merge into one eyes.sy track). */
export const blink = (t: number, depth = 0.95, hold = 0.03): K[] => [
  [t, 0, "hold"],
  [t + 0.05, -depth, "in"],
  [t + 0.05 + hold, -depth, "hold"],
  [t + 0.13 + hold, 0, "out"],
];

export function blinks(len: number, at: number[], extra: K[] = []): Track {
  const keys: K[] = [[0, 0]];
  for (const t of at) keys.push(...blink(t));
  keys.push(...extra, [len, 0, "hold"]);
  keys.sort((a, b) => a[0] - b[0]);
  return T("eyes", "sy", keys);
}

/** Root placement: a fixed mark and yaw for a whole reel. */
export function placed(at: V3, yaw: number, len: number): Track[] {
  return [C("root", "px", at[0], len), C("root", "pz", at[2], len), C("root", "ry", yaw, len)];
}

/** Gentle idle breathing on the torso (sums with other torso tracks). */
export function breathe(t0: number, t1: number, period = 3.4, amp = 1.2): Track {
  const keys: K[] = [[t0, 0]];
  for (let t = t0 + period / 2; t < t1 - period / 4; t += period / 2) keys.push([t, keys.length % 2 ? amp : 0]);
  keys.push([t1, 0]);
  return T("torso", "rx", keys);
}

/**
 * A walk cycle as DSL keys (contacts every `stepS`): legs swing in counter-phase, the passing knee
 * folds, opposite arms swing and the body bobs twice per cycle. Starts and ends at 0 so it layers.
 */
export function walkCycle(o: { t0: number; t1: number; stepS: number; stride?: number; armSwing?: number; bob?: number; knee?: number }): Track[] {
  const { t0, t1, stepS } = o;
  const stride = o.stride ?? 24;
  const arm = o.armSwing ?? 16;
  const bob = o.bob ?? 0.025;
  const knee = o.knee ?? 42;
  const n = Math.max(1, Math.round((t1 - t0) / stepS));
  const step = (t1 - t0) / n;
  const keys: Record<string, K[]> = {};
  const push = (part: string, ch: Channel, t: number, v: number, e: Ease = "inOut") => (keys[`${part}.${ch}`] ??= []).push([t, v, e]);
  const ramp = (i: number) => Math.min(1, (i + 0.5) / 1.2, (n - i + 0.5) / 1.2);
  for (let i = 0; i <= n; i++) {
    const t = t0 + i * step;
    const side = i % 2 === 0 ? 1 : -1;
    const a = i === 0 || i === n ? 0 : ramp(i);
    push("thighL", "rx", t, -stride * side * a);
    push("thighR", "rx", t, stride * side * a);
    push("shinL", "rx", t, (side > 0 ? 4 : 14) * a);
    push("shinR", "rx", t, (side > 0 ? 14 : 4) * a);
    push("upperArmL", "rx", t, arm * side * a);
    push("upperArmR", "rx", t, -arm * side * a);
    push("root", "py", t, 0, "in");
    if (i < n) {
      const tm = t + step / 2;
      const am = ramp(i);
      push("thighL", "rx", tm, (side > 0 ? 0 : -6) * am);
      push("thighR", "rx", tm, (side > 0 ? -6 : 0) * am);
      push("shinL", "rx", tm, (side > 0 ? knee : 8) * am);
      push("shinR", "rx", tm, (side > 0 ? 8 : knee) * am);
      push("upperArmL", "rx", tm, 0);
      push("upperArmR", "rx", tm, 0);
      push("root", "py", tm, bob * am, "out");
    }
  }
  return Object.entries(keys).map(([id, k]) => {
    const [part, ch] = id.split(".") as [string, Channel];
    return T(part, ch, k);
  });
}

/**
 * Lift a reel's local tracks into master source time: shifted by the reel start and forced to 0
 * outside the reel (a 0.1 s step in the dead time either side), so reels can simply be summed.
 */
export function inReel(reel: ReelId, tracks: Track[]): Track[] {
  const { start, length } = REELS[reel];
  const end = start + length;
  return tracks.map((tr) => {
    const ks = tr.keys.filter(([t]) => t >= 0 && t <= length + 1e-6);
    if (!ks.length) return { ...tr, keys: [] };
    const first = ks[0][1];
    const last = ks[ks.length - 1][1];
    const keys: Key[] = [[round(start - 0.6), 0, "linear"], [round(start - 0.5), first, "linear"], ...ks.map(([t, v, e]) => [round(start + t), v, e] as Key), [round(end + 0.5), last, "linear"], [round(end + 0.6), 0, "linear"]];
    return { ...tr, keys };
  });
}
