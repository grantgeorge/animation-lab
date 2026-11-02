import type { Performance } from "../dsl";
import { hopArms, hold, restArms, walkSwing, wave, waveForward } from "./arms";

/**
 * "doorway-wave", 6.000 s seamless loop.
 * The door swings inward; Pip peeks round the jamb, steps out, waves three times, hops and goes back in.
 * Bram hears it, turns (head, then body, then hips), waves back and settles.
 * Every channel returns to its start value at 6.0 s with a held or eased end segment (zero seam velocity).
 */
const blink = (t: number) =>
  [
    [t, 0, "hold"],
    [t + 0.05, -0.92, "in"],
    [t + 0.08, -0.92, "hold"],
    [t + 0.14, 0, "out"],
  ] as const;

type FK = [number, number, ("inOut" | "in" | "out" | "hold")?];
/** A face channel track (parts: eyes sy = −blink, eyes py = wide, brows py = up, brows rz = +sad/−angry, mouth py = smile, mouth sy = open). */
const f = (part: "eyes" | "brows" | "mouth", ch: "sy" | "py" | "rz", keys: FK[]) => ({ part, ch, keys: keys.map(([t, v, e]) => [t, v, e ?? "inOut"] as const) });

/** Bram: ears prick at the sound, curious brows, then warm smiling eyes as he waves back. */
const bramFace = [
  f("brows", "py", [[0, 0], [1.62, 0, "hold"], [1.8, 0.55, "out"], [2.6, 0.45], [3.2, 0.65], [4.7, 0.55, "hold"], [5.5, 0], [6, 0, "hold"]]),
  f("eyes", "py", [[0, 0], [1.62, 0, "hold"], [1.78, 0.35, "out"], [2.3, 0.1], [3.0, 0], [6, 0, "hold"]]),
  f("brows", "rz", [[0, 0], [2.7, 0, "hold"], [3.1, 0.3], [4.8, 0.3, "hold"], [5.5, 0], [6, 0, "hold"]]),
  f("eyes", "sy", [[0, 0], [3.2, 0, "hold"], [3.45, -0.3], [4.6, -0.3, "hold"], [5.0, 0], [6, 0, "hold"]]),
];
/** Pip: curious peek, a big open grin for the wave, wide-eyed joy on the hop. */
const pipFace = [
  f("brows", "py", [[0, 0], [1.25, 0, "hold"], [1.6, 0.85, "out"], [2.6, 0.5], [4.5, 0.5, "hold"], [4.62, 0.9, "out"], [4.9, 0.4], [5.6, 0], [6, 0, "hold"]]),
  f("eyes", "py", [[0, 0], [1.25, 0, "hold"], [1.6, 0.5, "out"], [2.2, 0.15], [4.55, 0.15, "hold"], [4.64, 0.6, "out"], [4.9, 0], [6, 0, "hold"]]),
  f("mouth", "py", [[0, 0], [1.5, 0, "hold"], [1.9, 0.35], [2.6, 0.75], [2.9, 1], [4.6, 1, "hold"], [5.1, 0.5], [5.8, 0], [6, 0, "hold"]]),
  f("mouth", "sy", [[0, 0], [2.75, 0, "hold"], [2.95, 0.65, "out"], [4.1, 0.55], [4.6, 0.9, "out"], [4.85, 0.2], [5.3, 0], [6, 0, "hold"]]),
  f("eyes", "sy", [[0, 0], [2.9, 0, "hold"], [3.1, -0.22], [4.1, -0.22, "hold"], [4.4, 0], [6, 0, "hold"]]),
];
export const doorwayWave: Performance = {
  id: "doorway-wave-v1",
  durationS: 6,
  clips: [
    {
      character: "door",
      tracks: [{ part: "leaf", ch: "ry", keys: [[0, 0], [0.6, 0, "hold"], [0.75, -3, "in"], [1.4, 72, "out"], [5.55, 72, "hold"], [5.95, 0, "inOut"], [6, 0, "hold"]] }],
    },
    {
      character: "bram",
      tracks: [
        { part: "head", ch: "ry", keys: [[0, 0], [1.6, 0, "hold"], [1.72, 6, "out"], [2.2, 6, "hold"], [2.3, 2, "in"], [2.65, 62, "inOut"], [4.3, 62, "hold"], [5.4, 0, "inOut"], [6, 0, "hold"]] },
        { part: "head", ch: "rx", keys: [[0, 0], [2.3, 0, "hold"], [2.65, 4, "inOut"], [3.1, -12, "inOut"], [4.3, -12, "hold"], [5.4, 0, "inOut"], [6, 0, "hold"]] },
        { part: "brow", ch: "py", keys: [[0, 0], [2.2, 0, "hold"], [2.5, 0.022, "out"], [4.2, 0.01, "inOut"], [5.4, 0, "inOut"], [6, 0, "hold"]] },
        { part: "torso", ch: "ry", keys: [[0, 0], [2.55, 0, "hold"], [2.7, -5, "in"], [3.3, 42, "inOut"], [4.6, 42, "hold"], [5.5, 0, "inOut"], [6, 0, "hold"]] },
        { part: "pelvis", ch: "ry", keys: [[0, 0], [2.75, 0, "hold"], [3.35, 26, "inOut"], [4.7, 26, "hold"], [5.55, 0, "inOut"], [6, 0, "hold"]] },
        { part: "footR", ch: "ry", keys: [[0, 0], [2.8, 0, "hold"], [3.1, 30, "out"], [5.1, 30, "hold"], [5.45, 0, "inOut"], [6, 0, "hold"]] },
        { part: "footR", ch: "py", keys: [[0, 0], [2.8, 0, "hold"], [2.95, 0.03, "out"], [3.1, 0, "in"], [6, 0, "hold"]] },
        { part: "cap", ch: "py", keys: [[0, 0], [3.5, 0, "hold"], [3.75, 0.05, "out"], [3.95, 0.05, "hold"], [4.3, 0, "back"], [6, 0, "hold"]] },
        { part: "cap", ch: "rz", keys: [[0, 0], [3.5, 0, "hold"], [3.75, -12, "out"], [3.95, -12, "hold"], [4.3, 0, "back"], [6, 0, "hold"]] },
        { part: "upperArmR", ch: "rz", keys: [[0, 0], [2.6, 0, "hold"], [3.3, -10, "inOut"], [5.5, 0, "inOut"], [6, 0, "hold"]] },
        { part: "eyes", ch: "sy", keys: [[0, 0], ...blink(0.9), ...blink(2.45), ...blink(4.7), [6, 0, "hold"]] },
        ...restArms(6),
        ...bramFace,
        // The hand nearest Pip keeps the greeting clear of Bram's face in the film camera.
        ...waveForward("L", 3.15, 4.85, { cycles: 2 }),
      ],
    },
    {
      character: "pip",
      tracks: [
        // root deltas from his mark (0.72, 0, −4.7); hidden inside the doorway at (0.42, −5.5)
        { part: "root", ch: "px", keys: [[0, -0.3], [1.2, -0.3, "hold"], [1.95, -0.2, "out"], [2.0, -0.2, "hold"], [2.7, 0, "inOut"], [4.9, 0, "hold"], [5.6, -0.3, "inOut"], [6, -0.3, "hold"]] },
        { part: "root", ch: "pz", keys: [[0, -0.8], [1.2, -0.8, "hold"], [1.95, -0.4, "out"], [2.0, -0.4, "hold"], [2.7, 0, "inOut"], [4.9, 0, "hold"], [5.6, -0.8, "inOut"], [6, -0.8, "hold"]] },
        { part: "root", ch: "ry", keys: [[0, 0], [2.7, 0, "hold"], [3.0, -22, "inOut"], [4.9, -22, "hold"], [5.2, 150, "inOut"], [5.6, 180, "inOut"], [5.95, 0, "hold"], [6, 0, "hold"]] },
        {
          part: "root",
          ch: "py",
          keys: [[0, 0], [2.0, 0, "hold"], [2.15, 0.04, "out"], [2.3, 0, "in"], [2.45, 0.04, "out"], [2.6, 0, "in"], [4.5, 0, "hold"], [4.62, 0.07, "out"], [4.78, 0, "in"], [5.05, 0.04, "out"], [5.2, 0, "in"], [5.35, 0.04, "out"], [5.5, 0, "in"], [6, 0, "hold"]],
        },
        { part: "head", ch: "rz", keys: [[0, 0], [1.2, 0, "hold"], [1.95, -15, "out"], [2.7, 0, "inOut"], [6, 0, "hold"]] },
        { part: "head", ch: "ry", keys: [[0, 0], [1.2, 0, "hold"], [1.95, -28, "out"], [2.7, -10, "inOut"], [4.9, -10, "hold"], [5.2, 0, "inOut"], [6, 0, "hold"]] },
        { part: "thighL", ch: "rx", keys: [[0, 0], [2.0, 0, "hold"], [2.15, -35, "out"], [2.3, 0, "in"], [5.05, 0, "hold"], [5.2, -35, "out"], [5.35, 0, "in"], [6, 0, "hold"]] },
        { part: "thighR", ch: "rx", keys: [[0, 0], [2.3, 0, "hold"], [2.45, -35, "out"], [2.6, 0, "in"], [5.35, 0, "hold"], [5.5, -35, "out"], [5.65, 0, "in"], [6, 0, "hold"]] },
        { part: "hat", ch: "py", keys: [[0, 0], [4.78, 0, "hold"], [4.86, 0.03, "out"], [5.0, 0, "back"], [6, 0, "hold"]] },
        { part: "eyes", ch: "sy", keys: [[0, 0], ...blink(1.9), ...blink(2.12), ...blink(3.95), [6, 0, "hold"]] },
        ...restArms(6, { elbow: -12 }),
        ...pipFace,
        ...walkSwing([2.15, 2.45], "L"),
        ...wave("L", 2.7, 4.5, { cycles: 3, height: 92, forward: -34, inner: -72, outer: -30 }),
        // the other arm stays alive: a little lift and bend, sympathetic to the wave
        ...hold(2.75, 3.1, 4.4, 4.9, { upperArmR: { rz: -5, rx: -10 }, forearmR: { rx: -26 }, handR: { rx: -10 } }),
        ...hopArms(4.62, 4.78),
        ...walkSwing([5.2, 5.5], "L", 14),
      ],
    },
  ],
};
