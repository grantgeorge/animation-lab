import type { Track } from "@/scene/animation/dsl";
import { restArms } from "@/scene/animation/performances/arms";
import { MARKS } from "../engine/marks";
import { REELS } from "../engine/source";
import { T, F, blinks, breathe } from "./tools";

/**
 * "The glowing box": one continuous 22 s take (main-reel local seconds). Every shot of the box scene
 * is a camera on this performance, so each has natural handles.
 *
 *  0–4.5   Pip studies the faintly pulsing box, steps closer; Bram gazes off down the street.
 *  4.5–7.5 Pip slowly reaches. 6.0 Bram's head snaps round; 6.5 worry; 7.2 his hand goes up: wait.
 *  9.3     the lid creaks open a crack. 10–13 Pip hesitates, pulls back, looks to Bram, who shakes his head.
 *  13–14.2 Pip lunges and touches the lid. 14.6 it flies open in a burst of light; Bram jumps.
 *  14.8–22 glowing moths spiral up; Pip's wonder, Bram's relief.
 */
const L = REELS.main.length;
const P = MARKS.pip;
const B = MARKS.bram;

export const pipMain: Track[] = [
  // placement and the two steps toward the box
  T("root", "px", [[0, P.at[0]], [2.0, P.at[0], "hold"], [3.0, P.stepTo[0]], [13.0, P.stepTo[0], "hold"], [13.45, P.lunge[0]], [14.6, P.lunge[0], "hold"], [15.0, P.at[0] - 0.06, "out"], [L, P.at[0] - 0.06, "hold"]]),
  T("root", "pz", [[0, P.at[2]], [2.0, P.at[2], "hold"], [3.0, P.stepTo[2]], [13.0, P.stepTo[2], "hold"], [13.45, P.lunge[2]], [14.6, P.lunge[2], "hold"], [15.0, P.at[2] + 0.02, "out"], [L, P.at[2] + 0.02, "hold"]]),
  T("root", "ry", [[0, P.yaw], [15.8, P.yaw, "hold"], [17.4, P.yaw + 22], [L, P.yaw + 22, "hold"]]),
  T("root", "py", [[0, 0], [2.0, 0, "hold"], [2.2, -0.02], [2.45, 0.008], [2.7, -0.02], [3.0, 0], [13.0, 0, "hold"], [13.18, -0.03], [13.45, 0], [14.6, 0, "hold"], [14.72, 0.05, "out"], [14.95, 0, "in"], [15.05, -0.015], [15.2, 0], [L, 0, "hold"]]),
  T("thighR", "rx", [[0, 0], [2.0, 0, "hold"], [2.3, -24], [2.6, 0], [13.0, 0, "hold"], [13.2, -20], [13.45, 0], [14.62, 0, "hold"], [14.8, -14, "out"], [15.0, 0], [L, 0, "hold"]]),
  T("shinR", "rx", [[0, 0], [2.0, 0, "hold"], [2.3, 32], [2.6, 0], [13.0, 0, "hold"], [13.2, 28], [13.45, 0], [L, 0, "hold"]]),
  T("thighL", "rx", [[0, 0], [2.5, 0, "hold"], [2.75, -18], [3.0, 0], [14.62, 0, "hold"], [14.8, 10, "out"], [15.0, 0], [L, 0, "hold"]]),
  T("shinL", "rx", [[0, 0], [2.5, 0, "hold"], [2.75, 26], [3.0, 0], [L, 0, "hold"]]),
  // body: lean in to study, reach, pull back, lunge, recoil, then lean back to watch the moths rise
  T("torso", "rx", [[0, 5], [2.0, 5, "hold"], [3.0, 10], [4.5, 10, "hold"], [7.0, 17], [10.0, 18], [10.8, 6], [13.0, 6, "hold"], [14.1, 22, "in"], [14.6, 22, "hold"], [14.85, -12, "out"], [16.0, -7], [L, -7, "hold"]]),
  T("torso", "ry", [[0, 0], [10.6, 0, "hold"], [11.1, -16], [12.2, -16, "hold"], [12.7, 0], [L, 0, "hold"]]),
  breathe(0, 4.4, 3.0, 1.2),
  T("head", "rx", [[0, 14], [3.0, 18], [9.9, 18, "hold"], [10.5, 6], [11.1, -10], [12.2, -10, "hold"], [12.7, 16], [14.2, 22], [14.6, 22, "hold"], [14.85, -6, "out"], [16.4, -30], [19.0, -36], [L, -28]]),
  T("head", "ry", [[0, 0], [10.6, 0, "hold"], [11.1, -34], [12.2, -34, "hold"], [12.7, 0], [14.6, 0, "hold"], [16.6, 12], [19.0, -10], [L, 2]]),
  T("head", "rz", [[0, 0], [2.6, 0, "hold"], [3.6, 9], [5.6, 4], [7.0, 0], [16.5, 0, "hold"], [18.0, 7], [L, 4]]),
  // arms on top of a relaxed rest; the LEFT hand (camera side) does the reaching
  ...restArms(L, { elbow: -12 }),
  T("upperArmL", "rx", [[0, 0], [4.5, 0, "hold"], [5.3, -22], [7.0, -74], [10.0, -78], [10.8, -30], [13.0, -30, "hold"], [14.0, -82, "out"], [14.6, -72, "hold"], [14.8, -92, "out"], [15.6, -40], [17.2, -8], [L, -8, "hold"]]),
  T("upperArmL", "rz", [[0, 0], [4.5, 0, "hold"], [7.0, 14], [14.6, 14, "hold"], [14.8, 52, "out"], [15.6, 24], [17.2, 4], [L, 4, "hold"]]),
  T("forearmL", "rx", [[0, 0], [4.5, 0, "hold"], [5.3, -26], [7.0, 6], [10.0, 9], [10.8, -34], [13.0, -34, "hold"], [14.0, 10], [14.6, 10, "hold"], [14.8, -50, "out"], [16.0, -18], [L, -8, "hold"]]),
  T("handL", "rx", [[0, 0], [6.4, 0, "hold"], [7.2, -16], [10.0, -16, "hold"], [10.8, 4], [13.8, 0], [14.1, -22], [14.6, -22, "hold"], [15.0, 0], [L, 0, "hold"]]),
  T("upperArmR", "rx", [[0, 0], [10.0, 0, "hold"], [10.8, -26], [12.7, -26, "hold"], [13.2, 0], [14.6, 0, "hold"], [14.8, -78, "out"], [15.6, -34], [17.2, -6], [L, -6, "hold"]]),
  T("upperArmR", "rz", [[0, 0], [14.6, 0, "hold"], [14.8, -48, "out"], [15.6, -20], [17.2, -4], [L, -4, "hold"]]),
  T("forearmR", "rx", [[0, 0], [10.0, 0, "hold"], [10.8, -62], [12.7, -62, "hold"], [13.2, 0], [14.6, 0, "hold"], [14.8, -52, "out"], [16.0, -16], [L, -8, "hold"]]),
  // face: curious → hopeful → hesitant → determined → startled → wonder
  F("brows", "py", [[0, 0.35], [4.5, 0.4], [7.0, 0.55], [10.0, 0.3], [13.0, 0.2], [14.55, 0.1, "hold"], [14.7, 1, "out"], [15.6, 0.7], [17.0, 0.85], [L, 0.8, "hold"]]),
  F("brows", "rz", [[0, 0], [9.9, 0, "hold"], [10.4, 0.55], [12.6, 0.55, "hold"], [13.0, -0.4], [14.5, -0.4, "hold"], [14.7, 0, "out"], [L, 0, "hold"]]),
  F("eyes", "py", [[0, 0.2], [6.0, 0.35], [9.9, 0.2], [14.55, 0.2, "hold"], [14.7, 1, "out"], [15.5, 0.5], [17.0, 0.35], [L, 0.35, "hold"]]),
  F("mouth", "py", [[0, 0.3], [4.0, 0.3, "hold"], [6.0, 0.55], [9.6, 0.3], [10.4, 0], [14.6, 0, "hold"], [15.8, 0.6], [17.0, 1], [L, 1, "hold"]]),
  F("mouth", "sy", [[0, 0], [5.6, 0, "hold"], [6.4, 0.25], [8.0, 0.2], [9.6, 0], [14.55, 0, "hold"], [14.7, 0.85, "out"], [15.5, 0.5], [17.5, 0.35], [L, 0.35, "hold"]]),
  blinks(L, [1.5, 4.1, 8.3, 11.6, 17.6, 20.6]),
];

export const bramMain: Track[] = [
  T("root", "px", [[0, B.at[0]], [12.8, B.at[0], "hold"], [13.6, B.at[0] + 0.16], [14.6, B.at[0] + 0.16, "hold"], [14.95, B.at[0] + 0.1, "out"], [L, B.at[0] + 0.1, "hold"]]),
  T("root", "pz", [[0, B.at[2]], [12.8, B.at[2], "hold"], [13.6, B.at[2] + 0.17], [14.6, B.at[2] + 0.17, "hold"], [14.95, B.at[2] + 0.1, "out"], [L, B.at[2] + 0.1, "hold"]]),
  T("root", "ry", [[0, B.yaw], [L, B.yaw, "hold"]]),
  // the startle hop
  T("root", "py", [[0, 0], [12.8, 0, "hold"], [13.1, -0.02], [13.35, 0.01], [13.6, 0], [14.6, 0, "hold"], [14.66, -0.04, "in"], [14.8, 0.13, "out"], [14.98, 0, "in"], [15.08, -0.03, "out"], [15.25, 0], [L, 0, "hold"]]),
  T("thighR", "rx", [[0, 0], [12.8, 0, "hold"], [13.1, -16], [13.4, 0], [14.66, 0, "hold"], [14.8, -18, "out"], [15.0, 0], [L, 0, "hold"]]),
  T("shinR", "rx", [[0, 0], [12.8, 0, "hold"], [13.1, 22], [13.4, 0], [14.66, 0, "hold"], [14.8, 26, "out"], [15.0, 0], [L, 0, "hold"]]),
  T("thighL", "rx", [[0, 0], [14.66, 0, "hold"], [14.8, -10, "out"], [15.0, 0], [L, 0, "hold"]]),
  // idle weight shift, then the head snaps round at 6.0
  T("pelvis", "rz", [[0, 0], [1.5, 2], [3.5, -1.5], [5.6, 1], [6.0, 0], [L, 0, "hold"]]),
  T("head", "ry", [[0, -52], [2.2, -46], [4.0, -56], [5.95, -54, "hold"], [6.35, 6, "out"], [10.7, 2], [11.0, -9], [11.3, 8], [11.6, -7], [11.9, 4], [12.3, 0], [14.6, 0, "hold"], [15.6, 6], [17.0, -6], [19.5, 8], [L, 2]]),
  T("head", "rx", [[0, -6], [5.95, -6, "hold"], [6.35, 10, "out"], [10.0, 12], [12.8, 10], [14.6, 10, "hold"], [14.85, -16, "out"], [16.4, -26], [19.0, -30], [L, -20]]),
  T("head", "rz", [[0, 0], [7.0, 0, "hold"], [8.0, -5], [10.0, -5, "hold"], [11.0, 0], [16.5, 0, "hold"], [18.0, 6], [L, 5]]),
  T("torso", "ry", [[0, -6], [5.95, -6, "hold"], [6.6, 8, "out"], [L, 8, "hold"]]),
  T("torso", "rx", [[0, 0], [6.5, 0, "hold"], [8.0, 8], [10.0, 9], [12.8, 7], [13.6, 14], [14.6, 14, "hold"], [14.85, -10, "out"], [16.4, -6], [L, -4, "hold"]]),
  breathe(0, 6.0, 3.6, 1.5),
  breathe(16.5, L, 3.6, 1.2),
  ...restArms(L),
  // "wait!": the right hand (camera side) rises, palm out
  T("upperArmR", "rx", [[0, 0], [7.15, 0, "hold"], [7.8, -52, "out"], [10.0, -48], [12.8, -44], [13.6, -60], [14.6, -60, "hold"], [14.8, -42, "out"], [15.6, -20], [16.8, -2], [L, 0, "hold"]]),
  T("upperArmR", "rz", [[0, 0], [7.15, 0, "hold"], [7.8, -16, "out"], [14.6, -16, "hold"], [14.8, -68, "out"], [15.6, -40], [16.8, -6], [L, -4, "hold"]]),
  T("forearmR", "rx", [[0, 0], [7.15, 0, "hold"], [7.8, -46, "out"], [12.8, -40], [13.6, -24], [14.6, -24, "hold"], [14.8, -58, "out"], [16.0, -30], [17.4, -66], [L, -70, "hold"]]),
  T("handR", "rx", [[0, 0], [7.4, 0, "hold"], [7.9, 32, "out"], [12.8, 26], [14.6, 26, "hold"], [15.0, 0], [L, 0, "hold"]]),
  T("upperArmR", "ry", [[0, 0], [16.4, 0, "hold"], [17.4, -40], [L, -42, "hold"]]),
  T("upperArmL", "rx", [[0, 0], [12.8, 0, "hold"], [13.6, -30], [14.6, -30, "hold"], [14.8, -40, "out"], [15.6, -16], [16.8, 0], [L, 0, "hold"]]),
  T("upperArmL", "rz", [[0, 0], [14.6, 0, "hold"], [14.8, 66, "out"], [15.6, 34], [16.8, 4], [L, 2, "hold"]]),
  T("forearmL", "rx", [[0, 0], [12.8, 0, "hold"], [13.6, -30], [14.6, -30, "hold"], [14.8, -54, "out"], [16.0, -12], [L, 0, "hold"]]),
  // face: absent-minded → alarm → worry → pleading → startle → relief
  F("brows", "py", [[0, 0], [5.95, 0, "hold"], [6.25, 0.9, "out"], [7.0, 0.6], [10.0, 0.65], [12.4, 0.75], [14.6, 0.7, "hold"], [14.72, 1, "out"], [15.6, 0.7], [17.0, 0.35], [L, 0.35, "hold"]]),
  F("brows", "rz", [[0, 0], [6.3, 0, "hold"], [7.0, 0.7], [12.4, 0.85], [14.6, 0.8, "hold"], [14.8, 0.1, "out"], [16.5, 0], [L, 0, "hold"]]),
  F("eyes", "py", [[0, 0], [5.95, 0, "hold"], [6.25, 0.85, "out"], [7.2, 0.45], [12.8, 0.5], [14.6, 0.5, "hold"], [14.72, 1, "out"], [15.8, 0.4], [16.8, 0], [L, 0, "hold"]]),
  F("mouth", "sy", [[0, 0], [5.95, 0, "hold"], [6.3, 0.35, "out"], [7.2, 0.2], [10.6, 0.15], [11.6, 0.3], [12.4, 0.15], [14.6, 0.2, "hold"], [14.72, 0.9, "out"], [15.6, 0.5], [16.6, 0.1], [L, 0.1, "hold"]]),
  F("mouth", "py", [[0, 0.15], [5.95, 0.15, "hold"], [6.3, 0], [16.2, 0, "hold"], [17.4, 0.75], [L, 0.8, "hold"]]),
  blinks(L, [2.1, 4.9, 9.1, 12.9, 16.3, 19.4]),
];
