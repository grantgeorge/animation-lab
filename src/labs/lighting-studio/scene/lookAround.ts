import type { Performance } from "@/scene/animation/dsl";

/**
 * "look-around", 7.000 s seamless loop for the Lighting Studio.
 * Bram slowly turns his head from camera left to camera right and back, so the key light sweeps
 * across his face: the shadow side, the terminator and the rim all move. The torso follows a beat
 * later and he breathes. Every channel ends where it starts with a held segment (zero seam velocity).
 */
export const lookAround: Performance = {
  id: "lighting-look-around-v1",
  durationS: 7,
  clips: [
    {
      character: "bram",
      tracks: [
        { part: "head", ch: "ry", keys: [[0, -30], [0.7, -30, "hold"], [2.8, 28, "inOut"], [3.9, 28, "hold"], [6.1, -30, "inOut"], [7, -30, "hold"]] },
        { part: "head", ch: "rx", keys: [[0, -3], [0.7, -3, "hold"], [1.75, 4, "inOut"], [2.8, -2, "inOut"], [3.9, -2, "hold"], [5.0, 4, "inOut"], [6.1, -3, "inOut"], [7, -3, "hold"]] },
        { part: "head", ch: "rz", keys: [[0, 2], [0.7, 2, "hold"], [2.8, -3, "inOut"], [3.9, -3, "hold"], [6.1, 2, "inOut"], [7, 2, "hold"]] },
        { part: "torso", ch: "ry", keys: [[0, -9], [1.0, -9, "hold"], [3.2, 8, "inOut"], [4.2, 8, "hold"], [6.4, -9, "inOut"], [7, -9, "hold"]] },
        { part: "torso", ch: "rx", keys: [[0, 0], [1.75, 1.6, "inOut"], [3.5, 0, "inOut"], [5.25, 1.6, "inOut"], [7, 0, "inOut"]] },
        { part: "pelvis", ch: "ry", keys: [[0, -3], [1.2, -3, "hold"], [3.4, 3, "inOut"], [4.4, 3, "hold"], [6.6, -3, "inOut"], [7, -3, "hold"]] },
        { part: "upperArmL", ch: "rz", keys: [[0, 0], [3.5, 2.5, "inOut"], [7, 0, "inOut"]] },
        { part: "upperArmR", ch: "rz", keys: [[0, 0], [3.5, -2.5, "inOut"], [7, 0, "inOut"]] },
        { part: "forearmL", ch: "rz", keys: [[0, 6], [3.5, 9, "inOut"], [7, 6, "inOut"]] },
        { part: "forearmR", ch: "rz", keys: [[0, -6], [3.5, -9, "inOut"], [7, -6, "inOut"]] },
      ],
    },
  ],
};
