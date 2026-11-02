import type { CamId } from "./engine/types";

/** One colour per coverage camera, used on the stage, the plan, the monitors and the timeline. */
export const CAM_COLOR: Record<CamId, string> = { A: "#5FE3FF", B: "#C9A7FF", C: "#8EF0C3" };
/** Dark tints of the same (segment fills). */
export const CAM_TINT: Record<CamId, string> = { A: "rgb(95 227 255 / 0.22)", B: "rgb(201 167 255 / 0.24)", C: "rgb(142 240 195 / 0.22)" };
export const BRAM_COLOR = "#FF9478";
export const PIP_COLOR = "#FFD95A";
export const AXIS_COLOR = "#FFB547";
export const CROSS_COLOR = "#FF6B6B";
