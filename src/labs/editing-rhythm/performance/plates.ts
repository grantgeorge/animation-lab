import type { Track } from "@/scene/animation/dsl";
import { restArms } from "@/scene/animation/performances/arms";
import { MARKS } from "../engine/marks";
import { LAMPS_LIT, REELS, SLIP } from "../engine/source";
import { C, F, T, blinks, breathe, placed, walkCycle, type K } from "./tools";

/* ───────────── Kuleshov plates (8 s): Bram neutral, Pip with a gift, the lantern fallen ───────────── */

const KL = REELS.kule.length;
/** Neutral means NOTHING: no brow, no smile, a slow blink, eyes held off-screen right. */
export const bramKule: Track[] = [
  ...placed(MARKS.bram.at, MARKS.bram.yaw, KL),
  C("head", "ry", 4, KL),
  C("head", "rx", 6, KL),
  breathe(0, KL, 3.8, 0.8),
  ...restArms(KL),
  blinks(KL, [0.4, 5.6]),
];

export const pipKule: Track[] = [
  ...placed(MARKS.kule.pip, MARKS.kule.pipYaw, KL),
  C("head", "rx", 10, KL),
  T("head", "rz", [[0, 6], [3, 10], [6, 5], [KL, 6]]),
  C("torso", "rx", 6, KL),
  breathe(0, KL, 3.0, 1),
  ...restArms(KL, { elbow: -12 }),
  // both hands hold the gift out at chest height
  C("upperArmL", "rx", -44, KL),
  C("upperArmR", "rx", -44, KL),
  C("upperArmL", "rz", -6, KL),
  C("upperArmR", "rz", 6, KL),
  C("forearmL", "rx", -48, KL),
  C("forearmR", "rx", -48, KL),
  C("upperArmL", "ry", -18, KL),
  C("upperArmR", "ry", 18, KL),
  F("mouth", "py", [[0, 0.55], [KL, 0.65]]),
  C("brows", "rz", 0.35, KL),
  C("brows", "py", 0.35, KL),
  blinks(KL, [1.6, 4.4, 7.0]),
];

/* ───────────── The banana peel (16 s) ───────────── */

const SL = REELS.slip.length;
const S = MARKS.slip;
const stepX = S.peel[0] - 0.12;
const x0 = S.fromX;
const skidTo = stepX + 0.42;

export const bramSlip: Track[] = [
  T("root", "px", [[0, x0], [SLIP.strutFrom, x0, "hold"], [SLIP.step, stepX, "linear"], [SLIP.skid[1], skidTo, "out"], [SLIP.fall[0], skidTo + 0.03], [SLIP.fall[1], skidTo + 0.18, "in"], [SL, skidTo + 0.18, "hold"]]),
  C("root", "pz", S.z, SL),
  T("root", "ry", [[0, S.yaw], [SLIP.sitFrom, S.yaw, "hold"], [SLIP.sitFrom + 0.4, S.yaw - 22], [SL, S.yaw - 22, "hold"]]),
  // strut, skid lift, hang, drop to the seat, a little bounce
  T("root", "py", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], 0.06, "out"], [SLIP.fall[0], 0.07], [SLIP.fall[1], -0.68, "in"], [SLIP.fall[1] + 0.12, -0.62, "out"], [SLIP.fall[1] + 0.25, -0.67, "in"], [SL, -0.67, "hold"]]),
  ...walkCycle({ t0: SLIP.strutFrom + 0.1, t1: SLIP.step, stepS: 0.5, stride: 26, armSwing: 26, bob: 0.035, knee: 46 }),
  // the skid: the lead leg shoots up, arms fling out, body tips back; held (the stare); then the seat
  T("thighR", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], -62, "out"], [SLIP.fall[0], -66], [SLIP.fall[1], -84, "in"], [SL, -84, "hold"]]),
  T("thighL", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], 14, "out"], [SLIP.fall[0], 16], [SLIP.fall[1], -80, "in"], [SL, -80, "hold"]]),
  T("shinL", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], 12, "out"], [SLIP.fall[0], 14], [SLIP.fall[1], 6, "in"], [SL, 6, "hold"]]),
  T("shinR", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], 4], [SL, 4, "hold"]]),
  T("torso", "rx", [[0, -7], [SLIP.step, -7, "hold"], [SLIP.skid[1], -24, "out"], [SLIP.fall[0], -26], [SLIP.fall[1], 6, "in"], [SLIP.fall[1] + 0.3, -8], [SL, -8, "hold"]]),
  T("torso", "ry", [[0, 0], [SLIP.skid[1], 0, "hold"], [7.0, -28], [SLIP.fall[0], -28, "hold"], [SLIP.fall[1], 0], [SL, 0, "hold"]]),
  T("head", "rx", [[0, -10], [SLIP.step, -10, "hold"], [SLIP.skid[1], 8, "out"], [7.0, 0], [SLIP.fall[0], 0, "hold"], [SLIP.fall[1], 14, "in"], [SLIP.sitFrom + 0.2, 4], [SLIP.embarrassed, 4, "hold"], [SLIP.embarrassed + 0.4, 12], [SL, 10, "hold"]]),
  T("head", "ry", [[0, -4], [SLIP.skid[1], -4, "hold"], [7.0, -46], [SLIP.fall[0], -46, "hold"], [SLIP.fall[1], -10], [SLIP.embarrassed, -10, "hold"], [SLIP.embarrassed + 0.35, 14], [SLIP.embarrassed + 0.9, 14, "hold"], [SLIP.embarrassed + 1.25, -24], [SLIP.embarrassed + 1.8, -24, "hold"], [SLIP.embarrassed + 2.2, -8], [SL, -8, "hold"]]),
  T("head", "rz", [[0, 0], [SLIP.embarrassed, 0, "hold"], [SLIP.embarrassed + 0.5, 9], [SL, 8, "hold"]]),
  ...restArms(SL),
  T("upperArmL", "rz", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], 72, "out"], [SLIP.fall[0], 76], [SLIP.fall[1], 26, "in"], [SL, 24, "hold"]]),
  T("upperArmR", "rz", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], -70, "out"], [SLIP.fall[0], -74], [SLIP.fall[1], -26, "in"], [SLIP.embarrassed, -26, "hold"], [SLIP.embarrassed + 0.6, -58], [SL, -58, "hold"]]),
  T("upperArmL", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], -24, "out"], [SLIP.fall[1], 34, "in"], [SL, 34, "hold"]]),
  T("upperArmR", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], -24, "out"], [SLIP.fall[1], 34, "in"], [SLIP.embarrassed, 34, "hold"], [SLIP.embarrassed + 0.6, -96], [SL, -96, "hold"]]),
  T("forearmL", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], -18, "out"], [SLIP.fall[1], 6], [SL, 6, "hold"]]),
  T("forearmR", "rx", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], -18, "out"], [SLIP.fall[1], 6], [SLIP.embarrassed, 6, "hold"], [SLIP.embarrassed + 0.6, -104], [SLIP.embarrassed + 0.9, -96], [SLIP.embarrassed + 1.2, -106], [SLIP.embarrassed + 1.5, -96], [SL, -100, "hold"]]),
  // face: smug strut → deadpan stare (a slow blink, then "uh-oh") → embarrassed little smile
  F("mouth", "py", [[0, 0.55], [SLIP.step, 0.55, "hold"], [SLIP.skid[1], 0, "out"], [SLIP.embarrassed, 0, "hold"], [SLIP.embarrassed + 0.6, 0.6], [SL, 0.6, "hold"]]),
  F("mouth", "sy", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], 0.45, "out"], [7.0, 0.05], [SLIP.fall[0], 0.05, "hold"], [SLIP.fall[1], 0.6], [SLIP.sitFrom + 0.4, 0], [SL, 0, "hold"]]),
  F("brows", "py", [[0, 0.3], [SLIP.step, 0.3, "hold"], [SLIP.skid[1], 1, "out"], [7.0, 0.1], [8.4, 0.1, "hold"], [8.8, 0.7], [SLIP.fall[0], 0.7, "hold"], [SLIP.sitFrom, 0.2], [SLIP.embarrassed, 0.2, "hold"], [SLIP.embarrassed + 0.5, 0.5], [SL, 0.5, "hold"]]),
  F("brows", "rz", [[0, -0.15], [SLIP.step, -0.15, "hold"], [SLIP.skid[1], 0], [8.4, 0, "hold"], [8.8, 0.7], [SLIP.fall[0], 0.7, "hold"], [SLIP.sitFrom, 0.2], [SLIP.embarrassed, 0.2, "hold"], [SLIP.embarrassed + 0.5, 0.75], [SL, 0.75, "hold"]]),
  F("eyes", "py", [[0, 0], [SLIP.step, 0, "hold"], [SLIP.skid[1], 1, "out"], [7.0, 0.3], [SLIP.fall[0], 0.3, "hold"], [SLIP.fall[1], 0.9], [SLIP.sitFrom + 0.5, 0], [SL, 0, "hold"]]),
  blinks(SL, [11.6], [
    [0.01, -0.22],
    [SLIP.step, -0.22, "hold"],
    [SLIP.step + 0.12, 0],
    [7.6, 0, "hold"],
    [7.85, -0.95, "in"],
    [8.15, -0.95, "hold"],
    [8.45, 0, "out"],
    [SLIP.embarrassed + 0.4, 0, "hold"],
    [SLIP.embarrassed + 0.7, -0.3],
    [SL - 0.02, -0.3, "hold"],
  ]),
];

/* ───────────── The lamplighter (60 s): four lamps, dusk into night ───────────── */

const ML = REELS.mont.length;
const M = MARKS.mont;

function lampLighter(): Track[] {
  const px: K[] = [[0, M.enterX]];
  const ry: K[] = [[0, 90]];
  const reachRx: K[] = [[0, 0]];
  const reachRz: K[] = [[0, 0]];
  const fore: K[] = [[0, 0]];
  const headRx: K[] = [[0, 0]];
  const walks: Track[] = [];
  let x: number = M.enterX;
  LAMPS_LIT.forEach((Lk, k) => {
    const lx = M.lamps[k][0];
    const arrive = Lk - 2.0;
    const dur = Math.max(2.4, Math.abs(lx - x) / 0.46);
    const start = arrive - dur;
    px.push([start, x, "hold"], [arrive, lx, "linear"]);
    walks.push(...walkCycle({ t0: start, t1: arrive, stepS: 0.6, stride: 22, armSwing: 15, bob: 0.022 }));
    ry.push([arrive, 90, "hold"], [arrive + 0.5, 180], [Lk + 3.0, 180, "hold"], [Lk + 3.5, 90]);
    reachRx.push([Lk - 1.5, 0, "hold"], [Lk - 0.2, -150, "out"], [Lk + 1.5, -150, "hold"], [Lk + 2.5, 0]);
    reachRz.push([Lk - 1.5, 0, "hold"], [Lk - 0.2, -12, "out"], [Lk + 1.5, -12, "hold"], [Lk + 2.5, 0]);
    fore.push([Lk - 1.5, 0, "hold"], [Lk - 0.2, -18], [Lk + 1.5, -18, "hold"], [Lk + 2.5, 0]);
    headRx.push([Lk - 1.6, 0, "hold"], [Lk - 0.6, -28], [Lk + 2.2, -28, "hold"], [Lk + 3.0, -4], [Lk + 6, -10], [Lk + 8, 0]);
    x = lx;
  });
  // the last lamp lit: turn to us and look down the street, hands on hips
  ry.push([56, 90, "hold"], [56.8, 60], [ML, 60, "hold"]);
  px.push([ML, x, "hold"]);
  reachRx.push([ML, 0, "hold"]);
  reachRz.push([ML, 0, "hold"]);
  fore.push([ML, 0, "hold"]);
  headRx.push([ML, -6]);
  return [T("root", "px", px), T("root", "ry", ry), T("upperArmR", "rx", reachRx), T("upperArmR", "rz", reachRz), T("forearmR", "rx", fore), T("head", "rx", headRx), ...walks];
}

export const bramMont: Track[] = [
  C("root", "pz", M.walkZ, ML),
  ...lampLighter(),
  ...restArms(ML),
  T("upperArmL", "rz", [[0, 0], [56, 0, "hold"], [57, 30], [ML, 30, "hold"]]),
  T("forearmL", "rx", [[0, 0], [56, 0, "hold"], [57, -80], [ML, -80, "hold"]]),
  T("upperArmL", "ry", [[0, 0], [56, 0, "hold"], [57, -40], [ML, -40, "hold"]]),
  F("mouth", "py", [[0, 0.3], [ML, 0.7]]),
  ...LAMPS_LIT.map((Lk) => F("brows", "py", [[0, 0], [Lk - 0.3, 0, "hold"], [Lk + 0.2, 0.6, "out"], [Lk + 2.5, 0], [ML, 0, "hold"]])),
  blinks(ML, Array.from({ length: 16 }, (_, i) => 2.3 + i * 3.7)),
];

/** Offstage for a whole reel (behind the back wall). */
export const offstage = (who: "bram" | "pip", len: number): Track[] => placed(MARKS.offstage[who], 0, len);
