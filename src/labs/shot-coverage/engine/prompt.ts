import type { SceneDescriptor } from "@/engine/types";
import { ANGLE_LABEL, LENS_LABEL, SHOT_SIZE_LABEL } from "@/engine/classify";
import { axisAt, sideOf } from "./axis";
import { describeShot, type Look, type ShotDescription } from "./shots";
import { segments } from "./edit";
import type { Cams, Edit, SubjectFn, SubjectId } from "./types";

const NAME: Record<SubjectId, string> = { primary: "Bram", secondary: "Pip" };
const OTHER: Record<SubjectId, SubjectId> = { primary: "secondary", secondary: "primary" };
const size = (s: ShotDescription) => SHOT_SIZE_LABEL[s.size].toLowerCase();
const sec = (t: number) => t.toFixed(1);

const LOOK: Record<Look, string> = { left: "looks screen-left", right: "looks screen-right", toward: "looks toward the lens", away: "looks away from the lens" };

/** One shot in an editor's words: framing, subject, angle and lens. */
export function shotPhrase(s: ShotDescription): string {
  const lens = `${Math.round(s.focalMm)} mm ${LENS_LABEL[s.lens]}`;
  const angle = ANGLE_LABEL[s.angle];
  if (s.subject === "both") {
    const what = s.kind === "master" ? `wide master, ${size(s)} of Bram and Pip` : `two-shot, ${size(s)} of Bram and Pip`;
    return `${what}, ${angle}, ${lens}`;
  }
  const who = NAME[s.subject];
  if (s.kind === "ots" && s.foreground) {
    return `over-the-shoulder ${size(s)} on ${who}, past ${NAME[s.foreground.id]}'s shoulder frame-${s.foreground.edge}, ${angle}, ${lens}`;
  }
  if (s.size === "CU" || s.size === "ECU") return `${size(s)} reaction shot of ${who}, ${angle}, ${lens}`;
  if (s.kind === "two-shot") return `${size(s)} of ${who} with ${NAME[OTHER[s.subject]]} in frame, ${angle}, ${lens}`;
  return `${size(s)} single on ${who}, ${angle}, ${lens}`;
}

/** Screen direction in one shot: who is where, and which way the eyelines run. */
export function directionPhrase(s: ShotDescription): string {
  const b = s.info.primary;
  const p = s.info.secondary;
  if (s.subject === "both" || s.kind === "two-shot") return `Bram screen-${b.side === "L" ? "left" : "right"}, Pip screen-${p.side === "L" ? "left" : "right"}`;
  const id = s.subject;
  const me = s.info[id];
  const look = me.look === "left" || me.look === "right" ? `${LOOK[me.look]} toward ${NAME[OTHER[id]]}` : `${LOOK[me.look]}`;
  return `${NAME[id]} ${look}`;
}

/**
 * A deterministic multi-shot prompt for an AI video model (Seedance-style): a header with the
 * scene, then one line per shot with its time range, framing, angle, lens and screen direction,
 * then a continuity note that states the screen geography (and names any shot that breaks it).
 */
export function buildMultiShotPrompt(edit: Edit, cams: Cams, d: SceneDescriptor, subjects: SubjectFn, T: number): string {
  const segs = segments(edit, T);
  const lines: string[] = [];
  lines.push(`Multi-shot sequence, ${sec(T)} s, ${segs.length} shot${segs.length === 1 ? "" : "s"}, hard cuts. ${d.scene.title} (${d.scene.genre.toLowerCase()}): ${d.scene.logline}`);
  const sides: number[] = [];
  segs.forEach((g, k) => {
    const tm = (g.t0 + g.t1) / 2;
    const s = describeShot(cams[g.cam], d, subjects, tm);
    sides.push(sideOf(axisAt(subjects, tm), cams[g.cam].position));
    const ph = shotPhrase(s);
    lines.push(`Shot ${k + 1} (${sec(g.t0)}–${sec(g.t1)} s): ${ph.charAt(0).toUpperCase()}${ph.slice(1)}; ${directionPhrase(s)}.`);
  });
  const ref = sides.find((v) => v !== 0) ?? 1;
  const geo = (side: number) => (side >= 0 ? "Bram screen-left and Pip screen-right" : "Bram screen-right and Pip screen-left");
  const looks = (side: number) => (side >= 0 ? "Bram looks screen-right, Pip looks screen-left" : "Bram looks screen-left, Pip looks screen-right");
  const breaks = sides.map((v, i) => (v !== 0 && v !== ref ? i + 1 : 0)).filter(Boolean);
  if (!breaks.length) lines.push(`Continuity: keep ${geo(ref)} in every shot (180-degree rule); eyelines match: ${looks(ref)}.`);
  else
    lines.push(
      `Continuity: ${geo(ref)}; shot${breaks.length > 1 ? "s" : ""} ${breaks.join(", ")} deliberately cross${breaks.length > 1 ? "" : "es"} the line, flipping to ${geo(-ref)} (a jolt of disorientation).`,
    );
  lines.push("Locked-off cameras, no camera movement; same lighting, wardrobe and performance across all shots.");
  return lines.join("\n");
}

