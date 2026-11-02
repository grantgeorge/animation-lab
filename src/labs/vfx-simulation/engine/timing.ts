/** Frame-rate maths for effects animation: on ones / twos / threes, freeze holds, moving holds. */

export const FPS = 24;
/** Every experiment in the lab is one 4 s loop (96 frames at 24 fps). */
export const LOOP_S = 4;
export const FRAMES = LOOP_S * FPS;

export type Step = 1 | 2 | 3;
export const STEPS: readonly Step[] = [1, 2, 3];
export const STEP_WORD: Record<Step, string> = { 1: "on ones", 2: "on twos", 3: "on threes" };

/** Frame index (0-based) on screen at time t. */
export const frameOf = (t: number) => Math.floor(t * FPS + 1e-6);

/** Time of the drawing on screen at t when animating on `step`s: each drawing is held `step` frames. */
export const stepped = (t: number, step: Step) => (Math.floor((t * FPS) / step + 1e-6) * step) / FPS;

/** Drawing number on screen at frame f. */
export const drawingOf = (frame: number, step: Step) => Math.floor(frame / step);

/**
 * Freeze-frame hold: output time → source time with `holdS` of stillness inserted at `peakT`.
 * Before the peak, time passes; during the hold the source stays on the peak; after it, the source
 * resumes from the peak (everything after is pushed later by the hold).
 */
export function holdRemap(t: number, peakT: number, holdS: number): number {
  if (t < peakT || holdS <= 0) return t;
  if (t < peakT + holdS) return peakT;
  return t - holdS;
}

/** Lengths of the runs of identical drawings across `frames` frames (for the test suite and Inspect). */
export function holdRuns(frames: number, step: Step): number[] {
  const runs: number[] = [];
  let last = -1;
  for (let f = 0; f < frames; f++) {
    const d = drawingOf(f, step);
    if (d === last) runs[runs.length - 1]++;
    else runs.push(1);
    last = d;
  }
  return runs;
}

/** How many frames a value sampled through `holdRemap` stays exactly on the peak value. */
export function framesOnPeak(sample: (t: number) => number, peakValue: number, frames = FRAMES): number {
  let n = 0;
  for (let f = 0; f < frames; f++) if (Math.abs(sample(f / FPS) - peakValue) < 1e-9) n++;
  return n;
}
