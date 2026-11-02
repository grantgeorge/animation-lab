import { audioSegments } from "./audio";
import { handles, runtime, starts, stats } from "./edit";
import { analyseKnows, cutsOnMovement } from "./explain";
import { FPS, REELS, SLIP, LAMPS_LIT } from "./source";
import { SHOTS, camAt } from "./shots";
import type { Clip, Edit, ReelId, ShotId } from "./types";

/* ───────────────────────── timecode ───────────────────────── */

/** Seconds → frames at FPS (nearest frame). */
export const toFrames = (s: number, fps = FPS) => Math.round(s * fps);

/** Non-drop-frame SMPTE timecode HH:MM:SS:FF. */
export function timecode(seconds: number, fps = FPS, hourOffset = 0): string {
  return framesTC(toFrames(seconds, fps), fps, hourOffset);
}

/** Frames → HH:MM:SS:FF. */
export function framesTC(frames: number, fps = FPS, hourOffset = 0): string {
  const total = frames + hourOffset * 3600 * fps;
  const ff = total % fps;
  const s = Math.floor(total / fps);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(ff)}`;
}

export function parseTimecode(tc: string, fps = FPS): number {
  const m = /^(\d\d):(\d\d):(\d\d):(\d\d)$/.exec(tc);
  if (!m) throw new Error(`bad timecode ${tc}`);
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * fps + Number(m[4]);
}

/** Source tape name per camera (≤ 8 characters, CMX3600 reel field). */
export const TAPE: Record<ShotId, string> = {
  establish: "CAM1",
  reach: "CAM2",
  reaction: "CAM3",
  glow: "CAM4",
  hesitate: "CAM5",
  reveal: "CAM6",
  kNeutral: "K_NEUT",
  kGift: "K_GIFT",
  kLantern: "K_LANT",
  cWide: "C_WIDE",
  cPeel: "C_PEEL",
  cFace: "C_FACE",
  cAway: "C_AWAY",
  mWide: "M_WIDE",
};

/* ───────────────────────── TrueStudio cut list ───────────────────────── */

export interface CutListClip {
  index: number;
  id: string;
  shot: { id: ShotId; number: number; name: string; size: string; tape: string; camera: { position: number[]; target: number[]; focalMm: number } };
  reel: ReelId;
  source: { in: number; out: number; inTC: string; outTC: string };
  record: { in: number; out: number; inTC: string; outTC: string };
  duration: number;
  frames: number;
  handles: { before: number; after: number };
  audio: { relation: "straight" | "J" | "L"; offset: number; recordIn: number; recordOut: number };
  transition: { kind: "cut" | "dissolve"; duration: number };
}

export interface CutList {
  format: "truestudio.cutlist";
  version: 1;
  title: string;
  fps: number;
  runtime: number;
  stats: { asl: number; cuts: number; clips: number };
  clips: CutListClip[];
  notes: string[];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function cutList(e: Edit, title: string, ex?: { headline: string; points: readonly { text: string }[] }): CutList {
  const s = starts(e);
  const segs = audioSegments(e);
  const st = stats(e);
  return {
    format: "truestudio.cutlist",
    version: 1,
    title,
    fps: FPS,
    runtime: runtime(e),
    stats: { asl: st.asl, cuts: st.cuts, clips: st.clips },
    clips: e.map((c, i) => {
      const def = SHOTS[c.shot];
      const cam = camAt(def.cam, c.sourceIn);
      const lead = i > 0 ? (c.audioLead ?? 0) : 0;
      return {
        index: i + 1,
        id: c.id,
        shot: { id: c.shot, number: def.number, name: def.name, size: def.size, tape: TAPE[c.shot], camera: { position: [...cam.position], target: [...cam.target], focalMm: cam.focalMm } },
        reel: def.reel,
        source: { in: c.sourceIn, out: r3(c.sourceIn + c.duration), inTC: timecode(c.sourceIn), outTC: timecode(c.sourceIn + c.duration) },
        record: { in: s[i], out: r3(s[i] + c.duration), inTC: timecode(s[i], FPS, 1), outTC: timecode(s[i] + c.duration, FPS, 1) },
        duration: c.duration,
        frames: toFrames(s[i] + c.duration) - toFrames(s[i]),
        handles: handles(c),
        audio: { relation: lead > 0 ? "J" : lead < 0 ? "L" : "straight", offset: lead, recordIn: r3(segs[i].recStart), recordOut: r3(segs[i].recEnd) },
        transition: { kind: c.dissolve && i > 0 ? "dissolve" : "cut", duration: i > 0 ? (c.dissolve ?? 0) : 0 },
      };
    }),
    notes: ex ? [ex.headline, ...ex.points.map((p) => p.text)] : [],
  };
}

/** Structural validation of a cut list (used by tests and before download). */
export function validateCutList(x: unknown): string[] {
  const errs: string[] = [];
  const c = x as CutList;
  if (!c || c.format !== "truestudio.cutlist" || c.version !== 1) return ["not a truestudio.cutlist v1"];
  if (!Array.isArray(c.clips) || !c.clips.length) errs.push("no clips");
  let t = 0;
  c.clips.forEach((k, i) => {
    if (k.index !== i + 1) errs.push(`clip ${i}: index`);
    if (Math.abs(k.record.in - t) > 1e-3) errs.push(`clip ${i}: record in ${k.record.in} ≠ ${t}`);
    if (Math.abs(k.record.out - k.record.in - k.duration) > 1e-3) errs.push(`clip ${i}: record duration`);
    if (Math.abs(k.source.out - k.source.in - k.duration) > 1e-3) errs.push(`clip ${i}: source duration`);
    if (k.source.in < -1e-6 || k.source.out > REELS[k.reel].length + 1e-6) errs.push(`clip ${i}: source outside reel`);
    if (!(k.shot.id in SHOTS)) errs.push(`clip ${i}: unknown shot`);
    if (!["straight", "J", "L"].includes(k.audio.relation)) errs.push(`clip ${i}: audio relation`);
    t = k.record.out;
  });
  if (Math.abs(t - c.runtime) > 1e-3) errs.push("runtime ≠ sum of clips");
  return errs;
}

/* ───────────────────────── CMX3600 EDL ───────────────────────── */

const line = (n: number, reel: string, track: string, trans: string, sIn: string, sOut: string, rIn: string, rOut: string) =>
  `${String(n).padStart(3, "0")}  ${reel.padEnd(8)} ${track.padEnd(5)} ${trans.padEnd(8)} ${sIn} ${sOut} ${rIn} ${rOut}`;

/**
 * A CMX3600-style EDL: record timecode starts at 01:00:00:00. Straight cuts are one "B" (audio +
 * video) event; split edits become a V event and an A event with different record ranges (plus a
 * comment); dissolves use the standard two-line C → D form.
 */
export function edl(e: Edit, title: string): string {
  const out = [`TITLE: ${title.toUpperCase().replace(/[^A-Z0-9 &\-–]/g, "")}`, "FCM: NON-DROP FRAME", ""];
  const s = starts(e);
  const segs = audioSegments(e);
  let n = 1;
  e.forEach((c, i) => {
    const def = SHOTS[c.shot];
    const tape = TAPE[c.shot];
    const recIn = s[i];
    const recOut = s[i] + c.duration;
    const g = segs[i];
    const split = Math.abs(g.recStart - recIn) > 1e-3 || Math.abs(g.recEnd - recOut) > 1e-3;
    // frame-exact: source out = source in + the record length in frames (no double rounding)
    const sTC = (x: number) => timecode(x);
    const rTC = (x: number) => timecode(x, FPS, 1);
    const sOut = (srcIn: number, a: number, b: number) => framesTC(toFrames(srcIn) + toFrames(b) - toFrames(a));
    if (c.dissolve && i > 0) {
      const prev = e[i - 1];
      const ptape = TAPE[prev.shot];
      const pOut = prev.sourceIn + prev.duration;
      out.push(line(n, ptape, "V", "C", sTC(pOut), sTC(pOut), rTC(recIn), rTC(recIn)));
      out.push(line(n, tape, "V", `D    ${String(toFrames(c.dissolve)).padStart(3, "0")}`, sTC(c.sourceIn), sOut(c.sourceIn, recIn, recOut), rTC(recIn), rTC(recOut)));
    } else {
      out.push(line(n, tape, split ? "V" : "B", "C", sTC(c.sourceIn), sOut(c.sourceIn, recIn, recOut), rTC(recIn), rTC(recOut)));
    }
    out.push(`* FROM CLIP NAME: ${def.number ? `${def.number} ` : ""}${def.name.toUpperCase()} ${def.size}`);
    n++;
    if (split) {
      const aIn = c.sourceIn + (g.recStart - recIn);
      out.push(line(n, tape, "A", "C", sTC(aIn), sOut(aIn, g.recStart, g.recEnd), rTC(g.recStart), rTC(g.recEnd)));
      const lead = i > 0 ? (c.audioLead ?? 0) : 0;
      if (lead) out.push(`* SPLIT EDIT: AUDIO ${lead > 0 ? "LEADS" : "TRAILS"} PICTURE BY ${timecode(Math.abs(lead))} (${lead > 0 ? "J-CUT" : "L-CUT"})`);
      else out.push("* SPLIT EDIT: AUDIO EXTENDED BY NEXT EVENT");
      n++;
    }
    out.push("");
  });
  return out.join("\n");
}

const EVENT_RE = /^(\d{3}) {2}(\S{1,8}) +(V|A|B|AA\/V) +(C|D {4}\d{3}) +(\d\d:\d\d:\d\d:\d\d) (\d\d:\d\d:\d\d:\d\d) (\d\d:\d\d:\d\d:\d\d) (\d\d:\d\d:\d\d:\d\d)$/;

/** Parse/validate an EDL produced above: event lines well formed, source and record lengths agree. */
export function validateEdl(text: string): { errors: string[]; events: { n: number; reel: string; track: string; recIn: number; recOut: number }[] } {
  const errors: string[] = [];
  const events: { n: number; reel: string; track: string; recIn: number; recOut: number }[] = [];
  const lines = text.split("\n");
  if (!/^TITLE: .+/.test(lines[0] ?? "")) errors.push("missing TITLE");
  if (lines[1] !== "FCM: NON-DROP FRAME") errors.push("missing FCM");
  for (const l of lines.slice(2)) {
    if (!l || l.startsWith("* ")) continue;
    const m = EVENT_RE.exec(l);
    if (!m) {
      errors.push(`bad line: ${l}`);
      continue;
    }
    const [sIn, sOut, rIn, rOut] = [m[5], m[6], m[7], m[8]].map((x) => parseTimecode(x));
    if (sOut - sIn !== rOut - rIn) errors.push(`event ${m[1]}: source ${sOut - sIn}f ≠ record ${rOut - rIn}f`);
    if (rIn < parseTimecode("01:00:00:00")) errors.push(`event ${m[1]}: record before 01:00:00:00`);
    events.push({ n: Number(m[1]), reel: m[2], track: m[3], recIn: rIn, recOut: rOut });
  }
  return { errors, events };
}

/* ───────────────────────── Seedance prompt ───────────────────────── */

type Act = { reel: ReelId; from: number; to: number; who: "pip" | "bram" | "box" | "all"; text: string };
/** What happens in the source, for prompt writing (reel-local seconds). */
const ACTIONS: Act[] = [
  { reel: "main", from: 0, to: 2.0, who: "pip", text: "Pip stares, curious, at a small carved box glowing faintly on a crate" },
  { reel: "main", from: 2.0, to: 3.1, who: "pip", text: "Pip takes a step closer to the box" },
  { reel: "main", from: 0, to: 6.0, who: "bram", text: "Bram looks away down the street, unaware" },
  { reel: "main", from: 4.5, to: 7.5, who: "pip", text: "Pip slowly reaches a hand toward the box" },
  { reel: "main", from: 4.6, to: 9.2, who: "box", text: "the box's seams brighten with a cyan glow and a rising hum" },
  { reel: "main", from: 6.0, to: 6.6, who: "bram", text: "Bram's head snaps round" },
  { reel: "main", from: 6.5, to: 10.0, who: "bram", text: "Bram's face fills with worry, he raises a hand: wait" },
  { reel: "main", from: 9.2, to: 9.6, who: "box", text: "the lid creaks open a crack, light spilling out" },
  { reel: "main", from: 10.0, to: 11.0, who: "pip", text: "Pip hesitates and pulls his hand back" },
  { reel: "main", from: 10.6, to: 12.2, who: "pip", text: "Pip looks back at Bram" },
  { reel: "main", from: 10.6, to: 12.4, who: "bram", text: "Bram shakes his head, pleading" },
  { reel: "main", from: 12.8, to: 14.2, who: "box", text: "the lid rattles, the glow pulsing" },
  { reel: "main", from: 13.0, to: 14.2, who: "pip", text: "Pip lunges and touches the lid" },
  { reel: "main", from: 14.3, to: 15.4, who: "all", text: "the lid flies open in a burst of light; Bram jumps back" },
  { reel: "main", from: 14.8, to: 22, who: "box", text: "dozens of glowing moths spiral up out of the box" },
  { reel: "main", from: 15.4, to: 22, who: "pip", text: "Pip gazes up in wonder" },
  { reel: "main", from: 15.4, to: 22, who: "bram", text: "Bram's fear melts into a relieved smile in the moth-light" },
  { reel: "kule", from: 0, to: 8, who: "bram", text: "Bram looks off-screen with a completely neutral expression" },
  { reel: "kule", from: 0, to: 8, who: "pip", text: "Pip shyly holds out a small wrapped gift" },
  { reel: "kule", from: 0, to: 8, who: "box", text: "a lantern lies broken on the cobbles, its flame guttering" },
  { reel: "slip", from: 0, to: SLIP.step, who: "bram", text: "Bram struts confidently across the square, chin up" },
  { reel: "slip", from: 0, to: SLIP.step, who: "box", text: "a banana peel lies on the cobbles" },
  { reel: "slip", from: SLIP.skid[0], to: SLIP.skid[1], who: "bram", text: "his foot hits the peel and skids" },
  { reel: "slip", from: SLIP.stare[0], to: SLIP.stare[1], who: "bram", text: "Bram freezes mid-slip and stares straight into the lens" },
  { reel: "slip", from: SLIP.fall[0], to: SLIP.fall[1] + 0.3, who: "box", text: "the peel spins through frame as we hear him land" },
  { reel: "slip", from: SLIP.sitFrom, to: SLIP.embarrassed, who: "bram", text: "Bram sits on the cobbles, motionless" },
  { reel: "slip", from: SLIP.embarrassed, to: SLIP.end, who: "bram", text: "a tiny embarrassed smile, he rubs the back of his head" },
  ...LAMPS_LIT.map((L, k) => ({ reel: "mont" as ReelId, from: L - 2, to: L + 1, who: "all" as const, text: `Bram reaches up and lights lamp ${k + 1}` })),
  { reel: "mont", from: 0, to: 60, who: "all", text: "dusk deepens into night along the street" },
];

function actionsFor(c: Clip): string[] {
  const def = SHOTS[c.shot];
  const a = c.sourceIn;
  const b = c.sourceIn + c.duration;
  const wants = (w: Act["who"]) => {
    if (def.reel === "kule") return c.shot === "kNeutral" ? w === "bram" : c.shot === "kGift" ? w === "pip" : w === "box";
    if (def.reel === "slip") return c.shot === "cPeel" || c.shot === "cAway" ? w === "box" : w === "bram";
    if (def.size === "WS") return true;
    if (def.shows.box >= 0.7 && w === "box") return true;
    if (def.shows.bramFace >= 0.5 && w === "bram") return true;
    if (def.shows.pipFace >= 0.5 && w === "pip") return true;
    return w === "all";
  };
  return ACTIONS.filter((x) => x.reel === def.reel && x.from < b - 0.15 && x.to > a + 0.15 && wants(x.who)).map((x) => x.text);
}

const tempoWord = (asl: number) => (asl < 1.4 ? "fast, urgent cutting" : asl < 2.5 ? "brisk cutting" : asl < 3.6 ? "measured, suspenseful rhythm" : "slow, lingering rhythm");

/** A Seedance-style multi-shot prompt that spells out the edit's rhythm, shot by shot. */
export function seedancePrompt(e: Edit, label: string): string {
  const st = stats(e);
  const s = starts(e);
  const k = analyseKnows(e);
  const mv = new Set(cutsOnMovement(e).map((x) => x.index));
  const order = k.reactionAt === null ? "no reaction shot" : k.reactionBeforeDanger ? "the reaction comes BEFORE the audience sees the danger" : k.reactionAfterReveal ? "the reaction comes AFTER the reveal" : "the danger is shown before the reaction";
  const head = `Multi-shot sequence, ${st.runtime.toFixed(1)} s, ${st.clips} shot${st.clips === 1 ? "" : "s"}, ${label}: ${tempoWord(st.asl)} (average shot ${st.asl.toFixed(1)} s); ${order}. Stylised 3D animation, night-time cobbled square, warm lamplight: Pip, a small boy in a yellow raincoat, and Bram, a tall man in a red coat, cap and scarf.`;
  const lines = e.map((c, i) => {
    const def = SHOTS[c.shot];
    const isHold = def.shows.bramFace >= 0.5 && k.revealAt !== null && s[i] < k.revealAt && c.duration >= 2.5;
    const what = actionsFor(c);
    const verb = isHold ? `hold on ${def.framing} ${c.duration.toFixed(1)} s before the reveal` : `${def.framing}, ${c.duration.toFixed(1)} s`;
    const trans = i === 0 ? "" : c.dissolve ? ` Dissolve in over ${c.dissolve.toFixed(1)} s.` : c.audioLead && c.audioLead > 0 ? ` J-cut: its sound starts ${c.audioLead.toFixed(1)} s before the cut.` : c.audioLead && c.audioLead < 0 ? ` L-cut: the previous sound carries ${(-c.audioLead).toFixed(1)} s over it.` : mv.has(i) ? " Cut on movement." : " Hard cut.";
    return `Shot ${i + 1} (${s[i].toFixed(1)}–${(s[i] + c.duration).toFixed(1)} s): ${verb}${what.length ? `: ${what.join("; ")}` : ""}.${trans}`;
  });
  return [head, ...lines].join("\n");
}
