import { hashInt3 } from "./noise";

/**
 * Where the strokes come from on each frame, per version of the consistency test.
 * - surface: one painting, forever (offset 0).
 * - random: the screen filter with a brand-new set of strokes every 24 fps frame (naive per-frame stylisation).
 * - boil: three slightly different "drawings" held on twos and cycled (hand-drawn line boil).
 * - screen: like surface, but the strokes live on the screen (handled by the filter, not the seed).
 */
export type TestVersion = "surface" | "screen" | "random" | "boil";
export const TEST_VERSIONS: readonly TestVersion[] = ["surface", "screen", "random", "boil"];

export const FPS = 24;

/** 24 fps frame index for loop time t (small epsilon so exact frame times don't flicker). */
export const frameIndex = (t: number, fps = FPS) => Math.floor(t * fps + 1e-4);

/** Boil drawing (0, 1, 2) for a frame: each drawing held for `hold` frames, cycled in threes. */
export const boilDrawing = (frame: number, hold = 2) => Math.floor(frame / Math.max(1, hold)) % 3;

/** Stroke-space offset for a version at loop time t. Units: brush tiles. */
export function seedOffset(version: TestVersion, t: number, opts: { hold?: number; boilAmp?: number } = {}): [number, number, number] {
  const f = frameIndex(t);
  if (version === "random") return [hashInt3(f, 1, 7) * 37, hashInt3(f, 2, 7) * 37, hashInt3(f, 3, 7) * 37];
  if (version === "boil") {
    const d = boilDrawing(f, opts.hold ?? 2);
    const a = opts.boilAmp ?? 0.045;
    return [(hashInt3(d, 4, 9) - 0.5) * a * 2, (hashInt3(d, 5, 9) - 0.5) * a * 2, (hashInt3(d, 6, 9) - 0.5) * a * 2];
  }
  return [0, 0, 0];
}
