import { sampleClip, type Channel, type Clip, type PoseDelta } from "./dsl";

/**
 * Deterministic motion smoothing + overlap for keyframed performances.
 * - Overlap: joints further out the chain sample the clip slightly in the past (hands trail forearms,
 *   forearms trail upper arms), which is the drag/follow-through animators add by hand.
 * - Smoothing: each sample is a 3-tap filter over ±SPAN, which rounds off sharp key transitions
 *   (hold → out snaps) without changing the timing of the performance.
 * Pure function of t, so pausing, scrubbing and multiple views stay exact. Times wrap on the loop.
 */
export const OVERLAP_S: Record<string, number> = {
  root: 0,
  pelvis: 0,
  torso: 0.01,
  head: 0.03,
  shoulderL: 0.015,
  shoulderR: 0.015,
  upperArmL: 0.025,
  upperArmR: 0.025,
  forearmL: 0.05,
  forearmR: 0.05,
  handL: 0.085,
  handR: 0.085,
  brows: 0.02,
  mouth: 0.01,
};
/** Parts that must keep their snap (blinks). */
const RAW = new Set(["eyes"]);
const SPAN = 0.045;
const TAPS: readonly (readonly [number, number])[] = [
  [-SPAN, 0.25],
  [0, 0.5],
  [SPAN, 0.25],
];

const scratch: PoseDelta = new Map();

export function sampleClipSmoothed(clip: Clip, t: number, loopS: number | undefined, out: PoseDelta = new Map()): PoseDelta {
  out.clear();
  const wrap = (x: number) => (loopS ? ((x % loopS) + loopS) % loopS : Math.max(0, x));
  // raw pose first (also defines which parts exist)
  sampleClip(clip, wrap(t), scratch);
  const parts = [...scratch.keys()];
  for (const part of parts) {
    if (RAW.has(part)) out.set(part, { ...scratch.get(part) });
    else out.set(part, {});
  }
  // group parts by overlap so each lag is sampled once per tap
  const byLag = new Map<number, string[]>();
  for (const part of parts) {
    if (RAW.has(part)) continue;
    const lag = OVERLAP_S[part] ?? 0.02;
    const list = byLag.get(lag) ?? [];
    list.push(part);
    byLag.set(lag, list);
  }
  for (const [lag, list] of byLag) {
    for (const [dt, w] of TAPS) {
      sampleClip(clip, wrap(t - lag + dt), scratch);
      for (const part of list) {
        const src = scratch.get(part);
        if (!src) continue;
        const dst = out.get(part)!;
        for (const ch of Object.keys(src) as Channel[]) dst[ch] = (dst[ch] ?? 0) + (src[ch] ?? 0) * w;
      }
    }
  }
  return out;
}
