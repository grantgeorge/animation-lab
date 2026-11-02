import type { Clip } from "@/scene/animation/dsl";

/** Pip stands on the path and looks up and around at the giant trees (one 12 s loop). */
export const PIP_LOOK_UP: Clip = {
  character: "pip",
  tracks: [
    { part: "head", ch: "rx", keys: [[0, -20], [2.5, -26, "inOut"], [5.5, -15, "inOut"], [8.5, -24, "inOut"], [12, -20, "inOut"]] },
    { part: "head", ch: "ry", keys: [[0, 6], [3, 26, "inOut"], [6.2, 30, "inOut"], [9.2, -14, "inOut"], [12, 6, "inOut"]] },
    { part: "torso", ch: "rx", keys: [[0, -4], [6, -6, "inOut"], [12, -4, "inOut"]] },
    { part: "torso", ch: "ry", keys: [[0, 2], [6, 8, "inOut"], [9.5, -4, "inOut"], [12, 2, "inOut"]] },
    { part: "upperArmR", ch: "rz", keys: [[0, 4], [6, 8, "inOut"], [12, 4, "inOut"]] },
    { part: "upperArmL", ch: "rz", keys: [[0, -4], [6, -8, "inOut"], [12, -4, "inOut"]] },
    { part: "eyes", ch: "py", keys: [[0, 0.35], [6, 0.5, "inOut"], [12, 0.35, "inOut"]] },
    { part: "mouth", ch: "sy", keys: [[0, 0.25], [6, 0.4, "inOut"], [12, 0.25, "inOut"]] },
  ],
};
