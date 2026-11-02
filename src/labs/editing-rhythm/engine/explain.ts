import { clipAt, runtime, stats } from "./edit";
import { PRESET_INFO } from "./presets";
import { BEATS, boxGlow, movementAt } from "./source";
import { SHOTS } from "./shots";
import type { Clip, Edit, EditPresetId } from "./types";

/**
 * The explanation layer: plain-language storytelling consequences computed from the edit's
 * structure. Deterministic and rule-based (no model): the same edit always gets the same words.
 */

const STEP = 1 / 24;
/** Perceived danger = glow × how readable the box is in that framing. */
export const DANGER_THRESHOLD = 0.4;
/** Main-local time from which Bram's face reads as reacting (worry, then startle, then relief). */
const REACT_FROM = BEATS.bramWorried - 0.2;
const LID_OPEN = BEATS.reveal + 0.15;

export type ReactionKind = "worry" | "startle" | "relief";
export interface Span {
  from: number;
  to: number;
}
/** What the audience knows, when (record seconds). */
export interface Knows {
  dangerAt: number | null;
  reactionAt: number | null;
  revealAt: number | null;
  danger: Span[];
  reaction: (Span & { kind: ReactionKind })[];
  reveal: Span[];
  /** Bram's fear seen before the audience has seen its cause. */
  reactionBeforeDanger: boolean;
  /** Any reaction shot after the reveal. */
  reactionAfterReveal: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const s1 = (v: number) => `${v.toFixed(1)} s`;

function pushSpan<T extends Span>(list: T[], t: number, extra: Omit<T, "from" | "to">) {
  const last = list.at(-1);
  if (last && Math.abs(last.to - t) < STEP * 1.5 && JSON.stringify({ ...last, from: 0, to: 0 }) === JSON.stringify({ ...extra, from: 0, to: 0 })) last.to = r2(t + STEP);
  else list.push({ ...(extra as object), from: r2(t), to: r2(t + STEP) } as T);
}

/** Sample the edit frame by frame and record what is on screen. Only box-scene shots carry story facts. */
export function analyseKnows(e: Edit): Knows {
  const T = runtime(e);
  const k: Knows = { dangerAt: null, reactionAt: null, revealAt: null, danger: [], reaction: [], reveal: [], reactionBeforeDanger: false, reactionAfterReveal: false };
  for (let t = 0; t < T - 1e-6; t += STEP) {
    const at = clipAt(e, t);
    if (!at) break;
    const def = SHOTS[at.clip.shot];
    if (def.reel !== "main") continue;
    const L = at.local;
    if (L < LID_OPEN && def.shows.box * boxGlow(L) >= DANGER_THRESHOLD) {
      pushSpan(k.danger, t, {});
      k.dangerAt ??= r2(t);
    }
    if (L >= LID_OPEN && def.shows.box >= 0.4) {
      pushSpan(k.reveal, t, {});
      k.revealAt ??= r2(t);
    }
    // a reaction SHOT: Bram's face is the subject (his jump in a wide doesn't count)
    if (def.shows.bramFace >= 0.9 && L >= REACT_FROM) {
      const kind: ReactionKind = L < BEATS.reveal ? "worry" : L < 16.2 ? "startle" : "relief";
      pushSpan(k.reaction, t, { kind });
      k.reactionAt ??= r2(t);
    }
  }
  const firstCause = k.dangerAt ?? k.revealAt;
  k.reactionBeforeDanger = k.reactionAt !== null && (firstCause === null || k.reactionAt < firstCause);
  k.reactionAfterReveal = k.revealAt !== null && k.reaction.some((r) => r.from >= k.revealAt! - 1e-6);
  return k;
}

export type RuleId =
  | "order.reaction-first"
  | "order.danger-first"
  | "order.surprise"
  | "order.no-reaction"
  | "reaction.punchline"
  | "reaction.payoff"
  | "tempo.fast"
  | "tempo.brisk"
  | "tempo.measured"
  | "tempo.slow"
  | "cuts.movement"
  | "cuts.still"
  | "time.stretch"
  | "time.ellipsis"
  | "coverage.no-establish"
  | "coverage.repeat"
  | "coverage.no-insert"
  | "hold.longer"
  | "hold.shorter"
  | "audio.j"
  | "audio.l";

export interface Point {
  id: RuleId;
  text: string;
}

export interface Explanation {
  /** One sentence about the most recent change (or the edit's core idea when nothing changed). */
  headline: string;
  points: Point[];
  knows: Knows;
  /** Which treatment the structure reads closest to, and its scores. */
  reads: EditPresetId;
  scores: Record<EditPresetId, number>;
  /** Cuts that land inside a movement, out of all cuts. */
  onMovement: number;
}

/** Cuts whose incoming in-point (or outgoing out-point) sits inside a visible movement. */
export function cutsOnMovement(e: Edit): { index: number; what: string }[] {
  const out: { index: number; what: string }[] = [];
  for (let i = 1; i < e.length; i++) {
    const a = e[i - 1];
    const b = e[i];
    if (SHOTS[b.shot].reel !== "main") continue;
    const what = movementAt(b.sourceIn) ?? (SHOTS[a.shot].reel === "main" ? movementAt(a.sourceIn + a.duration) : null);
    if (what) out.push({ index: i, what });
  }
  return out;
}

/** Time structure: overlaps (the same moment shown twice: time stretches) and jumps forward (ellipses). */
export function timeStructure(e: Edit): { stretch: number; ellipsis: number; jumps: { index: number; skipped: number }[] } {
  let stretch = 0;
  let ellipsis = 0;
  const jumps: { index: number; skipped: number }[] = [];
  for (let i = 1; i < e.length; i++) {
    const a = e[i - 1];
    const b = e[i];
    if (SHOTS[a.shot].reel !== SHOTS[b.shot].reel) continue;
    const gap = b.sourceIn - (a.sourceIn + a.duration);
    if (gap < -0.15) stretch += -gap;
    if (gap > 0.6) {
      ellipsis += gap;
      jumps.push({ index: i, skipped: r2(gap) });
    }
  }
  return { stretch: r2(stretch), ellipsis: r2(ellipsis), jumps };
}

const NAME = (c: Clip) => SHOTS[c.shot].name.toLowerCase();
const isReaction = (c: Clip) => SHOTS[c.shot].shows.bramFace >= 0.5;

/** Score how strongly the structure matches each treatment's recipe. */
export function scoreTreatments(e: Edit, k: Knows = analyseKnows(e)): Record<EditPresetId, number> {
  const st = stats(e);
  const mv = cutsOnMovement(e).length;
  const ts = timeStructure(e);
  const T = st.runtime || 1;
  const faceTime = e.reduce((a, c) => a + (SHOTS[c.shot].size === "CU" || SHOTS[c.shot].size === "MCU" ? c.duration : 0), 0);
  const revealIdx = e.findIndex((c) => c.shot === "reveal");
  const afterReveal = revealIdx >= 0 ? e.slice(revealIdx + 1).filter(isReaction) : [];
  const preReveal = revealIdx > 0 ? e[revealIdx - 1] : null;
  const scores: Record<EditPresetId, number> = { suspense: 0, comedy: 0, action: 0, emotion: 0 };
  if (k.reactionBeforeDanger) scores.suspense += 2;
  if (st.asl >= 2.5 && st.asl < 3.6) scores.suspense += 1;
  if (k.dangerAt !== null && k.dangerAt > T * 0.5) scores.suspense += 1;
  if (ts.stretch > 0.5) scores.suspense += 1;
  if (afterReveal.length && e[revealIdx + 1] && isReaction(e[revealIdx + 1]) && !k.reactionBeforeDanger) scores.comedy += 2;
  if (st.asl >= 1.4 && st.asl < 2.5) scores.comedy += 1;
  if (ts.ellipsis > 1.5) scores.comedy += 1;
  if (preReveal && preReveal.duration >= 2 && preReveal.duration >= st.asl * 1.2) scores.comedy += 1;
  if (st.asl < 1.4) scores.action += 2;
  if (st.cuts && mv / st.cuts >= 0.6) scores.action += 1;
  if (!e.some((c) => c.shot === "establish")) scores.action += 1;
  if (st.asl >= 3.5) scores.emotion += 2;
  if (faceTime / T >= 0.4) scores.emotion += 1;
  if (afterReveal.some((c) => c.duration >= 3)) scores.emotion += 1;
  if (st.cuts <= 4 && st.cuts > 0) scores.emotion += 1;
  return scores;
}

const ORDER: EditPresetId[] = ["suspense", "comedy", "action", "emotion"];
export const closest = (scores: Record<EditPresetId, number>): EditPresetId => ORDER.reduce((best, id) => (scores[id] > scores[best] ? id : best), ORDER[0]);

/** The standing analysis of an edit: one point per rule that fires. */
export function analysePoints(e: Edit, baseline: Edit | null, k: Knows = analyseKnows(e)): Point[] {
  const pts: Point[] = [];
  const st = stats(e);
  // 1. information order
  if (k.reactionAt === null) {
    pts.push({ id: "order.no-reaction", text: "Nobody reacts on screen. The audience has to decide how to feel on their own, so the moment plays cooler and more observational." });
  } else if (k.reactionBeforeDanger) {
    const cause = k.dangerAt ?? k.revealAt;
    pts.push({
      id: "order.reaction-first",
      text: cause === null ? "We see Bram's fear but never its cause. The audience is left uneasy, filling the gap with their own imagination." : `Bram's fear arrives ${s1(cause - k.reactionAt)} before its cause. The audience feels the threat before they can name it: that gap is suspense.`,
    });
  } else if (k.dangerAt !== null) {
    pts.push({ id: "order.danger-first", text: `The audience sees the glowing box ${s1(Math.max(0, k.reactionAt - k.dangerAt))} before Bram reacts. They know more than he does, so they wait for him to catch up: anticipation.` });
  }
  if (k.revealAt !== null && k.dangerAt === null) pts.push({ id: "order.surprise", text: "The box is never shown glowing before it opens, so the reveal is a surprise, not suspense: a short jolt instead of a long dread (Hitchcock's bomb under the table)." });
  // 2. where the reaction sits around the reveal
  if (k.reactionAfterReveal && k.revealAt !== null) {
    const after = k.reaction.find((r) => r.from >= k.revealAt! - 1e-6)!;
    const len = k.reaction.filter((r) => r.from >= k.revealAt! - 1e-6).reduce((a, r) => a + r.to - r.from, 0);
    if (len >= 3 || after.kind === "relief") pts.push({ id: "reaction.payoff", text: `After the reveal we stay with Bram for ${s1(len)}. The reaction becomes the payoff: we feel the moment through him.` });
    else pts.push({ id: "reaction.punchline", text: "The reaction comes straight after the reveal, so it lands like a punchline: first the surprise, then his response to it." });
  }
  // 3. tempo
  if (st.asl < 1.4) pts.push({ id: "tempo.fast", text: `Average shot ${s1(st.asl)}: fast cutting. The eye barely settles, which reads as urgency and energy, but also gives the audience less time to feel.` });
  else if (st.asl < 2.5) pts.push({ id: "tempo.brisk", text: `Average shot ${s1(st.asl)}: brisk. Quick enough to keep momentum, long enough for each beat to read.` });
  else if (st.asl < 3.6) pts.push({ id: "tempo.measured", text: `Average shot ${s1(st.asl)}: measured. The audience has time to study faces and wait for what comes next.` });
  else pts.push({ id: "tempo.slow", text: `Average shot ${s1(st.asl)}: slow and patient. Long holds let feelings build inside a shot rather than between shots.` });
  // 4. cutting on movement
  const mv = cutsOnMovement(e);
  if (st.cuts) {
    if (mv.length / st.cuts >= 0.5) pts.push({ id: "cuts.movement", text: `${mv.length} of ${st.cuts} cuts land on movement (${mv[0].what}${mv.length > 1 ? ", …" : ""}). Motion hides the cut and carries energy across it.` });
    else if (mv.length === 0) pts.push({ id: "cuts.still", text: "No cut lands on movement: each cut is a deliberate pause between still moments, calm and noticeable." });
  }
  // 5. time
  const ts = timeStructure(e);
  if (ts.stretch > 0.5) pts.push({ id: "time.stretch", text: `Shots overlap by ${s1(ts.stretch)} of action: the same moment is seen from two angles, so screen time stretches longer than real time.` });
  if (ts.ellipsis > 1) pts.push({ id: "time.ellipsis", text: `${s1(ts.ellipsis)} of action is cut out between shots. The audience doesn't miss it: ellipsis keeps only the beats that matter.` });
  // 6. coverage choices
  if (e.length && !e.some((c) => c.shot === "establish") && e.every((c) => SHOTS[c.shot].reel === "main")) pts.push({ id: "coverage.no-establish", text: "There is no establishing shot: the audience is dropped into the middle of the action without the geography, which feels urgent and slightly disorienting." });
  const counts = new Map<string, number>();
  for (const c of e) counts.set(c.shot, (counts.get(c.shot) ?? 0) + 1);
  const rep = [...counts.entries()].find(([, n]) => n > 1);
  if (rep) pts.push({ id: "coverage.repeat", text: `You return to the ${SHOTS[rep[0] as Clip["shot"]].name.toLowerCase()} shot ${rep[1]} times: repetition makes it an anchor the audience keeps checking.` });
  // 7. holds against the treatment's own cut
  if (baseline) {
    const diffs: { c: Clip; d: number }[] = [];
    for (const c of e) {
      const b = baseline.find((x) => x.id === c.id);
      if (b && Math.abs(c.duration - b.duration) >= 0.3) diffs.push({ c, d: c.duration - b.duration });
    }
    diffs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    for (const { c, d } of diffs.slice(0, 2)) {
      pts.push(
        d > 0
          ? { id: "hold.longer", text: `The ${NAME(c)} is held ${s1(d)} longer than the treatment's cut: more weight on that beat, and the audience has more time to read it.` }
          : { id: "hold.shorter", text: `The ${NAME(c)} is ${s1(-d)} shorter than the treatment's cut: the beat flashes past and the rhythm tightens.` },
      );
    }
  }
  // 8. split edits
  e.forEach((c, i) => {
    if (i === 0 || !c.audioLead) return;
    if (c.audioLead > 0) pts.push({ id: "audio.j", text: `J-cut into ${NAME(c)}: its sound arrives ${s1(c.audioLead)} before the picture, pulling the audience across the cut.` });
    else pts.push({ id: "audio.l", text: `L-cut into ${NAME(c)}: the previous sound lingers ${s1(-c.audioLead)} over the new picture, so the earlier moment echoes into this one.` });
  });
  return pts;
}

export type Change =
  | { kind: "preset"; preset: EditPresetId }
  | { kind: "duration"; id: string; from: number; to: number }
  | { kind: "move"; id: string; from: number; to: number }
  | { kind: "trim"; id: string; side: "head" | "tail" | "slip" }
  | { kind: "tempo"; factor: number }
  | { kind: "split"; id: string; lead: number }
  | { kind: "none" };

/** Infer what changed between two edits (for the headline). */
export function diffEdits(prev: Edit | null, next: Edit): Change {
  if (!prev) return { kind: "none" };
  if (prev.length === next.length) {
    const moved = next.findIndex((c, i) => c.id !== prev[i].id);
    if (moved >= 0) {
      // find the clip that travelled furthest
      let best = { id: next[moved].id, from: 0, to: 0, dist: -1 };
      next.forEach((c, i) => {
        const j = prev.findIndex((p) => p.id === c.id);
        if (j >= 0 && Math.abs(j - i) > best.dist) best = { id: c.id, from: j, to: i, dist: Math.abs(j - i) };
      });
      return { kind: "move", id: best.id, from: best.from, to: best.to };
    }
    const changed = next.filter((c, i) => c.duration !== prev[i].duration || c.sourceIn !== prev[i].sourceIn || (c.audioLead ?? 0) !== (prev[i].audioLead ?? 0));
    if (changed.length > 1 && changed.length === next.length) return { kind: "tempo", factor: runtime(next) / Math.max(1e-6, runtime(prev)) };
    if (changed.length >= 1) {
      const c = changed[0];
      const p = prev.find((x) => x.id === c.id)!;
      if ((c.audioLead ?? 0) !== (p.audioLead ?? 0)) return { kind: "split", id: c.id, lead: c.audioLead ?? 0 };
      if (c.sourceIn !== p.sourceIn) return { kind: "trim", id: c.id, side: Math.abs(c.sourceIn + c.duration - (p.sourceIn + p.duration)) < 1e-3 ? "head" : c.duration === p.duration ? "slip" : "head" };
      return { kind: "duration", id: c.id, from: p.duration, to: c.duration };
    }
  }
  return { kind: "none" };
}

/** The headline: what the latest change did to the story. */
export function headlineFor(change: Change, e: Edit, k: Knows, prevKnows: Knows | null): string {
  const clip = (id: string) => e.find((c) => c.id === id);
  const orderFlip = prevKnows && prevKnows.reactionBeforeDanger !== k.reactionBeforeDanger && k.reactionAt !== null;
  switch (change.kind) {
    case "preset":
      return `${PRESET_INFO[change.preset].label} cut: ${PRESET_INFO[change.preset].recipe} The audience should feel ${PRESET_INFO[change.preset].feel}.`;
    case "duration": {
      const c = clip(change.id);
      if (!c) break;
      const longer = change.to > change.from;
      if (isReaction(c) && k.reactionBeforeDanger && longer) return `You held the reaction shot longer before revealing the box. The audience now experiences Bram's fear for ${s1(c.duration)} before discovering its cause.`;
      if (isReaction(c) && k.reactionBeforeDanger) return `You shortened the reaction before the reveal. Bram's fear is now a glimpse (${s1(c.duration)}), so the reveal arrives sooner and the dread has less time to grow.`;
      if (isReaction(c) && k.reactionAfterReveal) return longer ? `You let the reaction after the reveal play longer (${s1(c.duration)}). The audience lives in Bram's response, so the moment turns from shock to feeling.` : `You clipped the reaction after the reveal to ${s1(c.duration)}. It snaps like a punchline instead of lingering.`;
      if (c.shot === "glow") return longer ? `You held the glowing box ${s1(c.duration)}. The longer the danger sits on screen, the more the audience waits for someone to notice it.` : `The glowing box now flashes by in ${s1(c.duration)}: the danger is registered but not dwelt on.`;
      if (c.shot === "hesitate") return longer ? `A longer hesitation (${s1(c.duration)}) is a held breath: the pause before the reveal is where tension (or the comic beat) lives.` : `A shorter hesitation (${s1(c.duration)}) rushes Pip's decision; the reveal comes before the audience has braced for it.`;
      if (c.shot === "establish") return longer ? `A longer establishing shot (${s1(c.duration)}) gives the audience the geography and a calm before the storm.` : `A shorter establishing shot (${s1(c.duration)}) gets us into the story faster, at the cost of orientation.`;
      return `You made the ${NAME(c)} ${longer ? "longer" : "shorter"} (${s1(change.from)} → ${s1(change.to)}): ${longer ? "more weight and more time to read it" : "less weight, a quicker rhythm"}.`;
    }
    case "move": {
      const c = clip(change.id);
      if (!c) break;
      const dir = change.to < change.from ? "earlier" : "later";
      if (orderFlip && k.reactionBeforeDanger) return `You moved the ${NAME(c)} ${dir}. Now Bram reacts before the audience sees the danger: we share his fear first and discover its cause after (suspense).`;
      if (orderFlip && !k.reactionBeforeDanger) return `You moved the ${NAME(c)} ${dir}. Now the box is revealed before Bram reacts: the audience discovers the danger first and watches him catch up.`;
      if (prevKnows && !prevKnows.reactionAfterReveal && k.reactionAfterReveal) return `You moved the ${NAME(c)} ${dir}, so a reaction now follows the reveal: it plays as the response, or the punchline.`;
      if (prevKnows && prevKnows.revealAt !== k.revealAt && k.revealAt !== null) return `You moved the ${NAME(c)} ${dir}. The reveal now lands at ${s1(k.revealAt)} instead of ${prevKnows.revealAt === null ? "never" : s1(prevKnows.revealAt)}.`;
      return `You moved the ${NAME(c)} ${dir} (slot ${change.from + 1} → ${change.to + 1}). The information order is unchanged, but the rhythm of faces and objects shifts.`;
    }
    case "trim": {
      const c = clip(change.id);
      if (!c) break;
      const mv = movementAt(c.sourceIn);
      return change.side === "slip" ? `You slipped the ${NAME(c)} to a different moment of the take (from ${s1(c.sourceIn)}). Same length, different performance.` : `You trimmed the ${NAME(c)} to start at ${s1(c.sourceIn)} of the take${mv ? `, on movement (${mv}): the cut will feel smoother and faster` : ", on a still moment: the cut will feel deliberate"}.`;
    }
    case "tempo":
      return change.factor < 1 ? `You tightened every shot (×${change.factor.toFixed(2)}). The same beats in less time: the scene feels more urgent and less thoughtful.` : `You loosened every shot (×${change.factor.toFixed(2)}). The same beats with more air: the scene feels calmer and more deliberate.`;
    case "split": {
      const c = clip(change.id);
      if (!c) break;
      return change.lead > 0 ? `J-cut: the ${NAME(c)}'s sound now starts ${s1(change.lead)} before its picture. The audience hears what's coming and their attention leads the cut.` : change.lead < 0 ? `L-cut: the previous sound now carries ${s1(-change.lead)} into the ${NAME(c)}. The last moment lingers over the new image.` : `Straight cut into the ${NAME(c)}: sound and picture change together, a cleaner but harder transition.`;
    }
    case "none":
      break;
  }
  if (k.reactionBeforeDanger && k.reactionAt !== null) return "Bram reacts before the audience sees the danger: we share his fear first, then discover its cause.";
  if (k.dangerAt !== null && k.reactionAt !== null) return "The audience sees the danger before Bram does: they wait, ahead of him, for his reaction.";
  if (k.revealAt !== null && k.dangerAt === null) return "The box is never shown glowing before it opens, so the reveal is pure surprise.";
  return "Every cut decides what the audience sees, when, and for how long.";
}

/** Full explanation of an edit, given the treatment's own cut and the edit before the latest change. */
export function explain(e: Edit, opts: { baseline?: Edit | null; previous?: Edit | null; change?: Change } = {}): Explanation {
  const knows = analyseKnows(e);
  const prevKnows = opts.previous ? analyseKnows(opts.previous) : null;
  const change = opts.change ?? diffEdits(opts.previous ?? null, e);
  const scores = scoreTreatments(e, knows);
  return {
    headline: headlineFor(change, e, knows, prevKnows),
    points: analysePoints(e, opts.baseline ?? null, knows),
    knows,
    reads: closest(scores),
    scores,
    onMovement: cutsOnMovement(e).length,
  };
}
