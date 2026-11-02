import type { MoveId } from "./camera";
import type { RefId, StoryId } from "./scale";
import type { HazeColorId } from "./haze";

/** Deterministic Seedance phrase from the lab state, plus how risky the move is for AI video. */
export type Construct = "2d" | "25d" | "3d";

export interface PromptInput {
  construct: Construct;
  move: MoveId;
  moveSize: number;
  parallax: number;
  haze: number;
  hazeColor: HazeColorId;
  layers: boolean;
  scale: boolean;
  refs: Record<RefId, boolean>;
  story: StoryId;
  occlusion: boolean;
  dof: boolean;
  fStop: number;
  focalMm: number;
  /** Revealed fraction at the end of the move (0..1), when measured. */
  revealed?: number | null;
}

const HAZE_WORDS: Record<HazeColorId, string> = { blue: "soft blue", gold: "warm golden", green: "cool green", violet: "dusky violet" };

export type Risk = "safe" | "watch" | "risky";

/** Thresholds on the revealed fraction at the end of the move. */
export const RISK = { safe: 0.1, watch: 0.28 } as const;

export function riskOf(revealed: number): Risk {
  if (revealed < RISK.safe) return "safe";
  if (revealed < RISK.watch) return "watch";
  return "risky";
}

function subject(p: PromptInput) {
  const on = p.scale ? p.refs : { pip: false, cabin: false, fence: false, deer: false };
  const forest = p.story === "giant" ? "towering ancient forest of giant redwoods" : p.story === "ordinary" ? "quiet woodland" : "small young wood of slender trees";
  const bits: string[] = [];
  if (on.pip) bits.push(p.story === "giant" ? "a tiny child on a mossy path for scale" : p.story === "ordinary" ? "a child on a mossy path" : "a giant child as tall as the trees");
  if (on.cabin) bits.push(p.story === "giant" ? "a small log cabin dwarfed by the trunks" : "a log cabin among the trees");
  if (on.deer) bits.push(p.story === "giant" ? "a deer no taller than the roots" : "a deer grazing");
  if (on.fence) bits.push("a split-rail fence along the path");
  if (!bits.length) return `${forest}, no people or familiar objects (scale left ambiguous)`;
  return `${forest}, ${bits.join(", ")}`;
}

function lens(f: number) {
  if (f <= 28) return `${Math.round(f)}mm wide-angle, trunks converging upward`;
  if (f <= 60) return `${Math.round(f)}mm normal lens`;
  return `${Math.round(f)}mm telephoto, compressed stacked trunks`;
}

function move(p: PromptInput) {
  const slow = p.moveSize <= 1.05 ? "slow" : "sweeping";
  const parallax = p.parallax > 0.5 ? " with strong parallax" : p.parallax > 0.1 ? " with gentle parallax" : "";
  if (p.construct === "2d") return p.move === "push" ? "slow zoom into a flat matte painting" : p.move === "track" ? "slow pan across a flat painted backdrop" : "camera swings past a flat painted backdrop";
  const base = p.move === "push" ? `${slow} push-in along the path` : p.move === "track" ? `${slow} lateral tracking shot behind the foreground ferns` : `${slow} orbiting arc around a giant trunk`;
  if (p.construct === "25d") return `${base}, multiplane 2.5D parallax layers`;
  return `${base}${parallax}`;
}

/** The one-line prompt phrase. */
export function promptPhrase(p: PromptInput) {
  const parts = [subject(p)];
  if (p.layers) parts.push("layered foreground ferns framing the shot");
  if (p.occlusion) parts.push("overlapping trunks receding into depth");
  else parts.push("flat cut-out silhouettes");
  if (p.haze > 0.55) parts.push(`${HAZE_WORDS[p.hazeColor]} atmospheric haze on distant ridges`);
  else if (p.haze > 0.15) parts.push(`light ${HAZE_WORDS[p.hazeColor]} haze in the distance`);
  else parts.push("crisp clear air, no haze");
  parts.push(lens(p.focalMm));
  if (p.dof) parts.push(p.fStop <= 2.8 ? "shallow depth of field, focus on the subject" : "deep focus");
  parts.push(move(p));
  return parts.join(", ");
}

export interface Guidance {
  risk: Risk;
  line: string;
}

/** What the measured reveal means for an AI video model. */
export function guidance(p: PromptInput): Guidance | null {
  if (p.revealed == null) return null;
  const pct = Math.round(p.revealed * 100);
  const r = riskOf(p.revealed);
  const what = p.move === "arc" ? "Orbits uncover the far side of trunks" : p.move === "track" ? "Tracks bring in new picture at one edge and behind the foreground" : "Push-ins mostly crop what is already visible";
  const verdict = r === "safe" ? "Safe: the model mostly re-renders what it has already shown." : r === "watch" ? "Watch it: the model must invent and hold new geometry consistent." : "Risky: a large share of the frame has to be invented, so expect trunks to morph or jump.";
  return { risk: r, line: `${what}: ${pct}% of the end frame was hidden in the first frame. ${verdict}` };
}

/** Short prompting notes, independent of state. */
export const PROMPT_NOTES: readonly { cue: string; words: string; note: string }[] = [
  { cue: "Atmosphere", words: "blue atmospheric haze on distant ridges", note: "The single strongest word for distance; models render it reliably." },
  { cue: "Layering", words: "foreground ferns, midground child, background ridges", note: "Name all three bands; models otherwise drop the foreground." },
  { cue: "Scale", words: "a tiny child for scale", note: "One familiar object sets the size of everything else." },
  { cue: "Lens", words: "24mm wide-angle / 135mm telephoto", note: "Focal length words change perspective more than 'epic' does." },
  { cue: "Move", words: "slow push-in, slow lateral track", note: "Small moves that reveal little stay coherent; wide orbits invite morphing trunks." },
];
