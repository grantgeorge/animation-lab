import type { Channel, Clip, Ease, Key, Track } from "@/scene/animation/dsl";
import { restArms } from "@/scene/animation/performances/arms";
import type { BeatTimes, Treatment } from "./beat";
import { FPS, LOOP_S } from "./timing";

/**
 * Pip's performance, generated from the beat so his acting is timed to the effect: the kick lands on
 * KICK_T, the flinch on the splash (plus any sync offset), and in the stylized treatments he holds the
 * startled pose for as long as the crown holds. Every gesture is its own additive layer that starts and
 * ends at 0, so an early or late flinch can overlap the kick without breaking the curves.
 */
type K = [number, number, Ease?];
const r4 = (v: number) => Number(v.toFixed(4));

function T(part: string, ch: Channel, keys: K[]): Track {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  // keep keys strictly increasing so sampling never divides by zero
  const out: Key[] = [];
  for (const [t, v, e] of sorted) {
    const tt = Math.min(LOOP_S, Math.max(0, t));
    if (out.length && tt <= out[out.length - 1][0]) continue;
    out.push([r4(tt), r4(v), e ?? "inOut"]);
  }
  return { part, ch, keys: out };
}

export const PIP_MARK = { x: -0.8, z: -0.14, yawDeg: 72 } as const;

export interface PipTiming {
  kick: number;
  recoil: number;
  /** When the startled pose lets go. */
  release: number;
  /** Kick energy (0.4–1.6), scales the wind-up and the hop. */
  intensity: number;
}

export function pipTiming(tr: Treatment, b: BeatTimes, intensity: number): PipTiming {
  const minHold = 0.3;
  const release = tr === "real" ? b.recoil + minHold : Math.max(b.recoil + minHold, b.holdEnd + 0.04);
  return { kick: b.kick, recoil: b.recoil, release: Math.min(LOOP_S - 0.7, release), intensity };
}

export function pipClip(p: PipTiming): Clip {
  const k = p.kick;
  const R = p.recoil;
  const H = Math.max(R + 0.25, p.release);
  const s = 0.7 + 0.3 * p.intensity;
  const end = LOOP_S - 0.07;
  const L = LOOP_S;
  const f2 = 2 / FPS;
  const tracks: Track[] = [
    ...restArms(L, { elbow: -12, out: 2 }),
    // base: eyes on the bucket, a mischievous look before the kick
    T("head", "rx", [[0, 15], [k - 0.2, 18], [k + 0.1, 13], [L, 15]]),
    T("head", "ry", [[0, 8], [k - 0.3, 4], [L, 8]]),
    T("eyes", "py", [[0, 0.2], [L, 0.2, "hold"]]),
    T("mouth", "py", [[0, 0.45], [k, 0.55], [R - 0.02, 0.45], [R + 0.05, 0, "out"], [L, 0, "hold"]]),
    T("brows", "rz", [[0, -0.25], [k + 0.05, -0.35], [R - 0.02, -0.3], [R + 0.05, 0], [L, 0, "hold"]]),
    // kick layer: wind back, swing through, follow through
    T("thighR", "rx", [[0.32, 0], [k - 0.16, 22 * s, "out"], [k - 0.01, -40 * s, "in"], [k + 0.1, -33 * s, "out"], [k + 0.42, 0], [L, 0, "hold"]]),
    T("shinR", "rx", [[0.32, 0], [k - 0.16, 52, "out"], [k - 0.04, 18], [k + 0.06, 6], [k + 0.42, 0], [L, 0, "hold"]]),
    T("torso", "rx", [[0.32, 0], [k - 0.16, -6 * s, "out"], [k, 7 * s], [k + 0.42, 0], [L, 0, "hold"]]),
    T("root", "py", [[0.32, 0], [k - 0.16, -0.014], [k, 0.006], [k + 0.3, 0], [L, 0, "hold"]]),
    T("upperArmL", "rx", [[0.32, 0], [k - 0.16, -20 * s, "out"], [k, 16 * s], [k + 0.45, 0], [L, 0, "hold"]]),
    T("upperArmR", "rx", [[0.36, 0], [k - 0.13, 18 * s, "out"], [k + 0.03, -14 * s], [k + 0.48, 0], [L, 0, "hold"]]),
    T("upperArmL", "rz", [[0.32, 0], [k, 14], [k + 0.45, 0], [L, 0, "hold"]]),
    T("upperArmR", "rz", [[0.32, 0], [k, -12], [k + 0.45, 0], [L, 0, "hold"]]),
    // flinch layer: a two-frame crouch, a hop back with the arms flung up, hold, then the sheepish settle
    T("root", "py", [[R - f2 - 0.06, 0], [R - 0.01, -0.024 * s, "out"], [R + 0.1, 0.065 * s, "out"], [R + 0.22, 0, "in"], [R + 0.29, -0.018, "out"], [R + 0.42, 0], [L, 0, "hold"]]),
    T("root", "pz", [[R - 0.02, 0], [R + 0.22, -0.15 * s, "out"], [end, -0.15 * s, "hold"], [L, 0]]),
    T("thighL", "rx", [[R - 0.02, 0], [R + 0.11, -16], [R + 0.25, 0], [L, 0, "hold"]]),
    T("thighR", "rx", [[R + 0.01, 0], [R + 0.13, -12], [R + 0.27, 0], [L, 0, "hold"]]),
    T("shinL", "rx", [[R - 0.02, 0], [R + 0.11, 24], [R + 0.25, 0], [L, 0, "hold"]]),
    T("torso", "rx", [[R - 0.06, 0], [R + 0.08, -17, "out"], [H, -13], [H + 0.42, 9], [end, 9, "hold"], [L, 0]]),
    T("head", "rx", [[R - 0.05, 0], [R + 0.08, -20, "out"], [H, -15], [H + 0.45, 9], [end, 9, "hold"], [L, 0]]),
    T("head", "rz", [[R, 0], [R + 0.1, -5], [H, -4], [H + 0.5, 6], [end, 6, "hold"], [L, 0]]),
    T("upperArmL", "rx", [[R - 0.04, 0], [R + 0.1, -70, "out"], [H, -62], [H + 0.45, -6], [end, -6, "hold"], [L, 0]]),
    T("upperArmL", "rz", [[R - 0.04, 0], [R + 0.1, 40, "out"], [H, 35], [H + 0.45, 4], [end, 4, "hold"], [L, 0]]),
    T("forearmL", "rx", [[R - 0.04, 0], [R + 0.12, -52, "out"], [H, -46], [H + 0.45, -16], [end, -16, "hold"], [L, 0]]),
    T("upperArmR", "rx", [[R - 0.02, 0], [R + 0.13, -60, "out"], [H + 0.03, -54], [H + 0.5, -4], [end, -4, "hold"], [L, 0]]),
    T("upperArmR", "rz", [[R - 0.02, 0], [R + 0.13, -36, "out"], [H + 0.03, -31], [H + 0.5, -4], [end, -4, "hold"], [L, 0]]),
    T("forearmR", "rx", [[R - 0.02, 0], [R + 0.15, -48, "out"], [H + 0.03, -42], [H + 0.5, -14], [end, -14, "hold"], [L, 0]]),
    T("brows", "py", [[R - 0.04, 0], [R + 0.06, 1, "out"], [H, 0.85], [H + 0.4, 0.45], [end, 0.45, "hold"], [L, 0]]),
    T("brows", "rz", [[H + 0.2, 0], [H + 0.6, 0.5], [end, 0.5, "hold"], [L, 0]]),
    T("eyes", "py", [[R - 0.04, 0], [R + 0.05, 0.8, "out"], [H, 0.6], [H + 0.4, 0.1], [end, 0.1, "hold"], [L, 0]]),
    T("mouth", "sy", [[R - 0.04, 0], [R + 0.06, 0.85, "out"], [H, 0.7], [H + 0.35, 0.08], [end, 0.08, "hold"], [L, 0]]),
    T("mouth", "py", [[H + 0.3, 0], [H + 0.7, 0.42], [end, 0.42, "hold"], [L, 0]]),
    T("eyes", "sy", [[0, 0], [0.25, 0, "hold"], [0.3, -0.95, "in"], [0.34, -0.95, "hold"], [0.42, 0, "out"], [H + 0.55, 0, "hold"], [H + 0.6, -0.95, "in"], [H + 0.63, -0.95, "hold"], [H + 0.71, 0, "out"], [L, 0, "hold"]]),
  ];
  return { character: "pip", tracks };
}
