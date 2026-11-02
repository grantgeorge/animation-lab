import type { Performance } from "../dsl";
import { runCycle } from "./cycles";
import { hold, restArms, wave, waveForward } from "./arms";

/**
 * "alley-run", 8.000 s seamless loop.
 * Pip waits at the far end of the alley, sprints ~11 m toward the camera, skids to a stop beside Bram,
 * waves, then turns and races back to his start. Bram hears him coming, looks over his shoulder,
 * turns to wave back as he arrives and watches him go.
 * Root deltas are from Pip's mark (0.2, 0, −4.4); his start is 10.92 m further down the alley.
 * The run velocities are matched across key segments (≈ 5.7 m/s) so the sprint has no speed pops.
 */
const blink = (t: number) =>
  [
    [t, 0, "hold"],
    [t + 0.05, -0.92, "in"],
    [t + 0.08, -0.92, "hold"],
    [t + 0.14, 0, "out"],
  ] as const;

const START_Z = -10.92;
const START_X = -0.25;

type FK = [number, number, ("inOut" | "in" | "out" | "hold")?];
/** A face channel track (parts: eyes sy = −blink, eyes py = wide, brows py = up, brows rz = +sad/−angry, mouth py = smile, mouth sy = open). */
const f = (part: "eyes" | "brows" | "mouth", ch: "sy" | "py" | "rz", keys: FK[]) => ({ part, ch, keys: keys.map(([t, v, e]) => [t, v, e ?? "inOut"] as const) });

/** Bram: hears footsteps, surprise as Pip barrels in, warm eyes for the greeting, fond as he leaves. */
const bramFace = [
  f("brows", "py", [[0, 0], [1.0, 0, "hold"], [1.15, 0.45, "out"], [1.85, 0.9, "out"], [3.0, 0.6], [4.8, 0.6, "hold"], [6.2, 0.3], [7.8, 0], [8, 0, "hold"]]),
  f("eyes", "py", [[0, 0], [1.8, 0, "hold"], [1.95, 0.55, "out"], [2.9, 0.2], [3.3, 0], [8, 0, "hold"]]),
  f("brows", "rz", [[0, 0], [3.0, 0, "hold"], [3.4, 0.3], [4.8, 0.3, "hold"], [6.2, 0.45], [7.6, 0.45, "hold"], [8, 0]]),
  f("eyes", "sy", [[0, 0], [3.3, 0, "hold"], [3.5, -0.28], [4.7, -0.28, "hold"], [5.0, 0], [8, 0, "hold"]]),
];
/** Pip: a determined frown and open-mouthed panting on the sprint, a grin on arrival, determined again on the way back. */
const pipFace = [
  f("brows", "rz", [[0, 0], [0.2, -0.55], [2.9, -0.55, "hold"], [3.1, 0.2, "out"], [4.9, 0.2, "hold"], [5.3, -0.45], [7.5, -0.45, "hold"], [7.95, 0], [8, 0, "hold"]]),
  f("brows", "py", [[0, 0], [3.0, 0, "hold"], [3.15, 0.65, "out"], [4.9, 0.5], [5.3, 0], [8, 0, "hold"]]),
  f("mouth", "sy", [[0, 0], [0.35, 0.45], [2.9, 0.45, "hold"], [3.1, 0.6, "out"], [3.4, 0.35], [3.6, 0.55], [3.8, 0.3], [4.9, 0.3, "hold"], [5.4, 0.4], [7.5, 0.4, "hold"], [7.95, 0], [8, 0, "hold"]]),
  f("mouth", "py", [[0, 0], [0.3, 0.15], [2.9, 0.15, "hold"], [3.2, 1, "out"], [4.9, 1, "hold"], [5.3, 0.15], [7.5, 0.15, "hold"], [7.95, 0], [8, 0, "hold"]]),
  f("eyes", "sy", [[0, 0], [3.6, 0, "hold"], [3.8, -0.25], [4.8, -0.25, "hold"], [5.0, 0], [8, 0, "hold"]]),
];
export const alleyRun: Performance = {
  id: "alley-run-v1",
  durationS: 8,
  clips: [
    {
      character: "pip",
      tracks: [
        {
          part: "root",
          ch: "pz",
          keys: [[0, START_Z], [0.35, START_Z, "hold"], [0.95, START_Z + 1.12, "in"], [2.55, -0.84, "linear"], [3.0, 0, "out"], [5.35, 0, "hold"], [5.8, -0.85, "in"], [7.2, -10.1, "linear"], [7.6, START_Z, "out"], [8, START_Z, "hold"]],
        },
        { part: "root", ch: "px", keys: [[0, START_X], [0.35, START_X, "hold"], [2.6, -0.05, "inOut"], [3.0, 0, "out"], [5.35, 0, "hold"], [7.6, START_X, "inOut"], [8, START_X, "hold"]] },
        { part: "root", ch: "ry", keys: [[0, 0], [3.25, 0, "hold"], [3.6, -28, "inOut"], [4.85, -28, "hold"], [5.3, -180, "inOut"], [7.6, -180, "hold"], [7.95, 0, "inOut"], [8, 0, "hold"]] },
        // ready crouch before the start, skid dip on arrival
        { part: "root", ch: "py", keys: [[0, 0], [0.12, 0, "hold"], [0.32, -0.06, "inOut"], [0.45, 0, "out"], [2.95, 0, "hold"], [3.05, -0.07, "out"], [3.3, 0, "inOut"], [8, 0, "hold"]] },
        ...runCycle({ t0: 0.4, t1: 2.92, stepS: 0.18, stride: 40, armSwing: 46, lean: 16, bob: 0.05 }),
        ...runCycle({ t0: 5.4, t1: 7.55, stepS: 0.18, stride: 40, armSwing: 46, lean: 16, bob: 0.05 }),
        // skid: lean back, arms flung out for balance
        { part: "torso", ch: "rx", keys: [[0, 0], [2.85, 0, "hold"], [3.05, -14, "out"], [3.4, 0, "inOut"], [8, 0, "hold"]] },
        // skid: both arms fling out for balance, then the wave
        ...hold(2.9, 3.05, 3.1, 3.4, { upperArmL: { rz: 42, rx: -20 }, upperArmR: { rz: -42, rx: -20 }, forearmL: { rx: -30 }, forearmR: { rx: -30 } }),
        ...wave("L", 3.5, 5.05, { cycles: 2, height: 92, forward: -34, inner: -72, outer: -30 }),
        ...hold(3.55, 3.9, 4.75, 5.15, { upperArmR: { rz: -5, rx: -10 }, forearmR: { rx: -26 }, handR: { rx: -10 } }),
        ...restArms(8, { elbow: -12 }),
        ...pipFace,
        // panting on arrival
        { part: "torso", ch: "rx", keys: [[0, 0], [3.4, 0, "hold"], [3.55, 6, "inOut"], [3.7, 0, "inOut"], [3.85, 5, "inOut"], [4.0, 0, "inOut"], [8, 0, "hold"]] },
        { part: "head", ch: "ry", keys: [[0, 0], [3.3, 0, "hold"], [3.6, -14, "inOut"], [4.9, -14, "hold"], [5.2, 0, "inOut"], [8, 0, "hold"]] },
        { part: "head", ch: "rx", keys: [[0, 0], [3.3, 0, "hold"], [3.6, -10, "inOut"], [4.9, -10, "hold"], [5.2, 0, "inOut"], [8, 0, "hold"]] },
        { part: "hat", ch: "py", keys: [[0, 0], [3.0, 0, "hold"], [3.08, 0.03, "out"], [3.25, 0, "back"], [8, 0, "hold"]] },
        { part: "eyes", ch: "sy", keys: [[0, 0], ...blink(0.2), ...blink(3.45), ...blink(4.75), [8, 0, "hold"]] },
      ],
    },
    {
      character: "bram",
      tracks: [
        // hears footsteps, looks over his left shoulder down the alley, follows Pip in
        { part: "head", ch: "ry", keys: [[0, 0], [1.0, 0, "hold"], [1.12, 8, "out"], [1.5, 8, "hold"], [1.85, 58, "inOut"], [5.4, 58, "hold"], [6.2, 40, "inOut"], [7.3, 40, "hold"], [7.95, 0, "inOut"], [8, 0, "hold"]] },
        { part: "head", ch: "rx", keys: [[0, 0], [1.5, 0, "hold"], [1.85, -6, "inOut"], [2.9, -2, "inOut"], [3.3, 8, "inOut"], [5.2, 8, "hold"], [6.2, -4, "inOut"], [7.3, -4, "hold"], [7.95, 0, "inOut"], [8, 0, "hold"]] },
        { part: "torso", ch: "ry", keys: [[0, 0], [2.2, 0, "hold"], [2.35, -4, "in"], [2.9, 36, "inOut"], [5.6, 36, "hold"], [7.6, 0, "inOut"], [8, 0, "hold"]] },
        { part: "pelvis", ch: "ry", keys: [[0, 0], [2.4, 0, "hold"], [3.0, 22, "inOut"], [5.7, 22, "hold"], [7.7, 0, "inOut"], [8, 0, "hold"]] },
        { part: "footR", ch: "ry", keys: [[0, 0], [2.45, 0, "hold"], [2.75, 26, "out"], [7.4, 26, "hold"], [7.75, 0, "inOut"], [8, 0, "hold"]] },
        { part: "footR", ch: "py", keys: [[0, 0], [2.45, 0, "hold"], [2.6, 0.03, "out"], [2.75, 0, "in"], [8, 0, "hold"]] },
        { part: "upperArmR", ch: "rz", keys: [[0, 0], [2.6, 0, "hold"], [3.3, -10, "inOut"], [7.6, 0, "inOut"], [8, 0, "hold"]] },
        ...restArms(8),
        ...bramFace,
        // Use the hand nearest Pip; the open arm pose keeps Bram's face readable as he turns.
        ...waveForward("L", 3.2, 4.95, { cycles: 2 }),
        { part: "eyes", ch: "sy", keys: [[0, 0], ...blink(1.25), ...blink(3.1), ...blink(6.4), [8, 0, "hold"]] },
      ],
    },
  ],
};
