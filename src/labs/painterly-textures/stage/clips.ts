import type { Clip } from "@/scene/animation/dsl";

/**
 * The consistency test's head turn: 6.000 s seamless loop (the Workshop timeline length).
 * Bram looks from camera left to camera right and back with short holds; the torso follows
 * a beat later. Every channel ends where it starts with a held segment.
 */
export const headTurn: Clip = {
  character: "bram",
  tracks: [
    { part: "head", ch: "ry", keys: [[0, -40], [0.35, -40, "hold"], [2.6, 40, "inOut"], [3.35, 40, "hold"], [5.6, -40, "inOut"], [6, -40, "hold"]] },
    { part: "head", ch: "rx", keys: [[0, -2], [0.35, -2, "hold"], [1.5, 5, "inOut"], [2.6, -1, "inOut"], [3.35, -1, "hold"], [4.5, 5, "inOut"], [5.6, -2, "inOut"], [6, -2, "hold"]] },
    { part: "head", ch: "rz", keys: [[0, 3], [0.35, 3, "hold"], [2.6, -3, "inOut"], [3.35, -3, "hold"], [5.6, 3, "inOut"], [6, 3, "hold"]] },
    { part: "torso", ch: "ry", keys: [[0, -12], [0.6, -12, "hold"], [2.9, 12, "inOut"], [3.6, 12, "hold"], [5.85, -12, "inOut"], [6, -12, "inOut"]] },
    { part: "torso", ch: "rx", keys: [[0, 0], [1.5, 1.5, "inOut"], [3, 0, "inOut"], [4.5, 1.5, "inOut"], [6, 0, "inOut"]] },
    { part: "upperArmL", ch: "rz", keys: [[0, 0], [3, 2, "inOut"], [6, 0, "inOut"]] },
    { part: "upperArmR", ch: "rz", keys: [[0, 0], [3, -2, "inOut"], [6, 0, "inOut"]] },
  ],
};

/** The orbit variant: Bram holds still (a slow breath only) while the camera circles him. */
export const holdStill: Clip = {
  character: "bram",
  tracks: [
    { part: "head", ch: "ry", keys: [[0, 0], [6, 0]] },
    { part: "torso", ch: "rx", keys: [[0, 0], [1.5, 1.2, "inOut"], [3, 0, "inOut"], [4.5, 1.2, "inOut"], [6, 0, "inOut"]] },
  ],
};
