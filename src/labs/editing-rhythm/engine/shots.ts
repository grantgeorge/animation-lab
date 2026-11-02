import { MARKS } from "./marks";
import type { ReelId, ShotId, V3 } from "./types";

/** A locked-off camera: position, aim point, lens. `push` dollies in (m/s) along the view over the reel. */
export interface CamSpec {
  position: V3;
  target: V3;
  focalMm: number;
  push?: number;
}

export type ShotSize = "WS" | "MS" | "MCU" | "CU" | "INS";

/** What a shot lets the audience see. Salience 0..1: how readable that thing is in this framing. */
export interface Shows {
  box: number;
  bramFace: number;
  pipFace: number;
  hand: number;
}

export interface ShotDef {
  id: ShotId;
  reel: ReelId;
  /** 1–6 for the box scene's coverage; 0 for experiment plates. */
  number: number;
  name: string;
  size: ShotSize;
  color: string;
  cam: CamSpec;
  shows: Shows;
  /** Short camera description for prompts and the EDL clip name. */
  framing: string;
}

const NONE: Shows = { box: 0, bramFace: 0, pipFace: 0, hand: 0 };
const B = MARKS.box;
const P = MARKS.pip.stepTo;
const R = MARKS.bram.at;

/** The six shots of the box scene. Every camera sits on the front side of the Bram–Pip line. */
export const SHOTS: Record<ShotId, ShotDef> = {
  establish: {
    id: "establish",
    reel: "main",
    number: 1,
    name: "Establish",
    size: "WS",
    color: "#5E88A8",
    cam: { position: [-1.3, 1.38, 1.3], target: [-0.3, 0.86, -3.5], focalMm: 34 },
    shows: { box: 0.4, bramFace: 0.25, pipFace: 0.25, hand: 0.2 },
    framing: "wide establishing shot of the night square, Pip, Bram and the box on its crate",
  },
  reach: {
    id: "reach",
    reel: "main",
    number: 2,
    name: "Reach",
    size: "MCU",
    color: "#C38B5F",
    cam: { position: [0.08, 0.74, -1.5], target: [-0.04, 0.7, -2.92], focalMm: 38, push: 0.006 },
    shows: { box: 0.6, bramFace: 0, pipFace: 0.75, hand: 1 },
    framing: "close-up of Pip's hand reaching toward the box",
  },
  reaction: {
    id: "reaction",
    reel: "main",
    number: 3,
    name: "Reaction",
    size: "CU",
    color: "#9A6FB0",
    cam: { position: [-0.3, 1.58, -2.38], target: [R[0] + 0.02, 1.56, R[2]], focalMm: 66, push: 0.006 },
    shows: { box: 0, bramFace: 1, pipFace: 0, hand: 0 },
    framing: "close-up of Bram's face",
  },
  glow: {
    id: "glow",
    reel: "main",
    number: 4,
    name: "Glowing box",
    size: "INS",
    color: "#3FA392",
    cam: { position: [B[0] - 0.46, B[1] + 0.3, B[2] + 0.66], target: [B[0] + 0.06, B[1] + 0.07, B[2]], focalMm: 48, push: 0.004 },
    shows: { box: 1, bramFace: 0, pipFace: 0, hand: 0.5 },
    framing: "insert of the carved box, its seams glowing",
  },
  hesitate: {
    id: "hesitate",
    reel: "main",
    number: 5,
    name: "Hesitation",
    size: "CU",
    color: "#C0727F",
    cam: { position: [-0.46, 0.74, -3.46], target: [P[0] + 0.02, 0.84, P[2]], focalMm: 42, push: 0.004 },
    shows: { box: 0, bramFace: 0, pipFace: 1, hand: 0.2 },
    framing: "close-up of Pip's face",
  },
  reveal: {
    id: "reveal",
    reel: "main",
    number: 6,
    name: "Reveal",
    size: "WS",
    color: "#C9A54E",
    cam: { position: [-0.1, 0.55, -0.45], target: [-0.4, 1.2, -3.5], focalMm: 24 },
    shows: { box: 0.8, bramFace: 0.5, pipFace: 0.45, hand: 0.3 },
    framing: "low wide shot looking up past both characters",
  },
  kNeutral: {
    id: "kNeutral",
    reel: "kule",
    number: 0,
    name: "Bram (neutral)",
    size: "CU",
    color: "#8C7FA6",
    cam: { position: [-0.32, 1.56, -2.42], target: [R[0] + 0.02, 1.52, R[2]], focalMm: 75 },
    shows: { ...NONE, bramFace: 1 },
    framing: "close-up of Bram, neutral expression",
  },
  kGift: {
    id: "kGift",
    reel: "kule",
    number: 0,
    name: "Pip's gift",
    size: "MCU",
    color: "#D0866A",
    cam: { position: [-0.62, 0.92, -1.72], target: [0.14, 0.76, -3.02], focalMm: 48 },
    shows: { ...NONE, pipFace: 0.8 },
    framing: "Pip shyly holding out a wrapped gift",
  },
  kLantern: {
    id: "kLantern",
    reel: "kule",
    number: 0,
    name: "Fallen lantern",
    size: "INS",
    color: "#7E8A96",
    cam: { position: [0.05, 0.46, 0.25], target: [-0.95, 0.1, -1.05], focalMm: 34 },
    shows: NONE,
    framing: "insert of a lantern lying broken on the cobbles, its flame guttering",
  },
  cWide: {
    id: "cWide",
    reel: "slip",
    number: 0,
    name: "Wide",
    size: "WS",
    color: "#5E88A8",
    cam: { position: [-1.75, 1.25, 1.45], target: [-1.5, 0.85, -3.3], focalMm: 34 },
    shows: { ...NONE, bramFace: 0.3 },
    framing: "wide shot of Bram crossing the square",
  },
  cPeel: {
    id: "cPeel",
    reel: "slip",
    number: 0,
    name: "Peel insert",
    size: "INS",
    color: "#D9B640",
    cam: { position: [0.02, 0.17, -2.4], target: [-0.66, 0.03, -3.26], focalMm: 40 },
    shows: NONE,
    framing: "low insert of a banana peel on the cobbles",
  },
  cFace: {
    id: "cFace",
    reel: "slip",
    number: 0,
    name: "Stare",
    size: "CU",
    color: "#9A6FB0",
    cam: { position: [-0.5, 1.42, -1.35], target: [-0.58, 1.56, -3.3], focalMm: 52 },
    shows: { ...NONE, bramFace: 1 },
    framing: "close-up of Bram frozen mid-slip, staring into the lens",
  },
  cAway: {
    id: "cAway",
    reel: "slip",
    number: 0,
    name: "Cut-away",
    size: "INS",
    color: "#C0727F",
    cam: { position: [0.12, 0.26, -1.85], target: [0.78, 0.14, -3.1], focalMm: 40 },
    shows: NONE,
    framing: "cut-away: the peel spins through frame as we hear the fall",
  },
  mWide: {
    id: "mWide",
    reel: "mont",
    number: 0,
    name: "Street wide",
    size: "WS",
    color: "#C9A54E",
    cam: { position: [0.0, 1.65, 3.4], target: [0.0, 1.2, -4.0], focalMm: 22 },
    shows: NONE,
    framing: "locked-off wide of the street of lamps",
  },
};

/** The six coverage shots in script order. */
export const COVERAGE: readonly ShotId[] = ["establish", "reach", "reaction", "glow", "hesitate", "reveal"];

export const shotDef = (id: ShotId) => SHOTS[id];

/** Camera position and aim at reel-local time t (the push is a slow dolly along the view). */
export function camAt(cam: CamSpec, local: number): { position: V3; target: V3; focalMm: number } {
  if (!cam.push) return cam;
  const d = [cam.target[0] - cam.position[0], cam.target[1] - cam.position[1], cam.target[2] - cam.position[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  const k = (cam.push * Math.max(0, local)) / len;
  return { position: [cam.position[0] + d[0] * k, cam.position[1] + d[1] * k, cam.position[2] + d[2] * k], target: cam.target, focalMm: cam.focalMm };
}
