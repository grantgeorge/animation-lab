import type { SceneId } from "@/labs/lens-and-framing/config";
import { NEUTRAL_GRADE, resolveGrade } from "../engine/grade";
import { autoMatch, mismatch, processPixels, sigDistance, signature, type Signature } from "../engine/match";
import { SHOTS, getShot, type ShowStep } from "../engine/shots";
import { shotResidual } from "../engine/showlook";
import type { GFState } from "../store";
import { platePixels } from "./plates";

const cleanSigs = new Map<SceneId, Signature>();
const cleanSig = (id: SceneId) => {
  let s = cleanSigs.get(id);
  const px = platePixels(id);
  if (!s && px) {
    s = signature(px);
    cleanSigs.set(id, s);
  }
  return s ?? null;
};

export interface ShowMetric {
  /** Cross-shot drift of the raw clips. */
  raw: number;
  /** Cross-shot drift at the current step. */
  now: number;
  /** Each shot's leftover drift at the current step. */
  perShot: Record<string, number>;
}

let memo: { key: unknown[]; value: ShowMetric | null } = { key: [], value: null };

/**
 * Cross-shot drift: how much the shots' unintended differences disagree (engine/showlook.ts
 * shotResidual, engine/match.ts mismatch). Computed on the CPU from 96×54 copies of the stills,
 * through the same engine the shader mirrors.
 */
export function showMetric(s: Pick<GFState, "look" | "shots" | "step" | "platesReady" | "nodes">, step: ShowStep = s.step): ShowMetric | null {
  if (!s.platesReady) return null;
  const key = [s.look.grade, s.shots, step, s.nodes.grade];
  if (memo.key.length && key.every((k, i) => k === memo.key[i])) return memo.value;
  const look = s.nodes.grade ? s.look : { ...s.look, grade: NEUTRAL_GRADE };
  const deltas: Signature[] = [];
  const rawDeltas: Signature[] = [];
  const perShot: Record<string, number> = {};
  for (const shot of SHOTS) {
    const px = platePixels(shot.id);
    if (!px) return null;
    const d = shotResidual(px, shot.id, step, look, s.shots[shot.id]);
    deltas.push(d);
    perShot[shot.id] = sigDistance(d, [0, 0, 0, 0, 0]);
    rawDeltas.push(shotResidual(px, shot.id, "raw", look, s.shots[shot.id]));
  }
  const value = { raw: mismatch(rawDeltas), now: mismatch(deltas), perShot };
  memo = { key, value };
  return value;
}

/** Auto-balance one shot back to its clean reference. */
export function autoBalance(id: SceneId) {
  const px = platePixels(id);
  const ref = cleanSig(id);
  if (!px || !ref) return null;
  const drifted = processPixels(px, [resolveGrade({ ...NEUTRAL_GRADE, ...getShot(id).drift })]);
  return autoMatch(drifted, ref);
}
