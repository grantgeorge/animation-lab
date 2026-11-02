import { beatTimes, type Phys, type Timing, type Treatment } from "./beat";
import { dropCount } from "./cartoon";
import { FPS, STEP_WORD } from "./timing";

/**
 * Deterministic Seedance prompt phrases: the same settings always give the same words. One per bucket
 * treatment, one per category demo. Words are chosen for what a video model renders reliably.
 */
export const SUBJECT = "a small red-haired child in a yellow raincoat and rain hat kicks over a metal bucket of water on a sunny wooden deck";

function gravityWords(g: number) {
  if (g < 0.7) return "floaty, slowed-down water as if in low gravity";
  if (g > 1.4) return "heavy water that slams down fast";
  return "";
}
function viscosityWords(v: number) {
  if (v > 0.66) return "thick, syrupy liquid that clings and stretches";
  if (v > 0.33) return "slightly thick water that holds together";
  return "thin, quick water";
}
function turbulenceWords(t: number, tr: Treatment) {
  if (t < 0.2) return "";
  if (tr === "drawn") return t > 0.6 ? "strong line boil" : "gentle line boil";
  return t > 0.6 ? "choppy, turbulent motion" : "a little turbulence";
}
const frames = (n: number) => `${n}-frame`;

export function treatmentPhrase(tr: Treatment, p: Phys, tm: Timing): string {
  const parts: string[] = [SUBJECT];
  const g = gravityWords(p.gravity);
  const t = turbulenceWords(p.turbulence, tr);
  if (tr === "real") {
    parts.push("photoreal fluid simulation", "the water leaves the bucket as one sheet that breaks into thousands of droplets and fine spray", viscosityWords(p.viscosity), "the puddle spreads across the boards");
    if (g) parts.push(g);
    if (t) parts.push(t);
    if (p.stylization > 0.15) parts.push(`slowed to ${Math.round((1 - 0.68 * p.stylization) * 100)}% speed around the impact, then back to real time`);
    else parts.push("physically accurate real-time timing");
    if (tm.hold > 0) parts.push(`a ${frames(tm.hold)} freeze frame on the splash`);
    if (tm.step > 1) parts.push(`stepped ${STEP_WORD[tm.step]}`);
  } else if (tr === "cartoon") {
    const n = dropCount(p);
    parts.push("3D cartoon animation", `a few big glossy water blobs with squash and stretch`, tm.antic > 0 ? `the water bulges up as the bucket rears back (${frames(tm.antic)} anticipation)` : "the bucket tips with no anticipation", p.stylization > 0.5 ? "an exaggerated splash crown" : "a splash crown", tm.hold > 0 ? `that holds for ${frames(tm.hold)} so it reads` : "that falls straight away", `${n} drops snap off on clean arcs`, "the puddle overshoots and settles", "playful, snappy timing");
    if (p.viscosity > 0.33) parts.push(viscosityWords(p.viscosity));
    if (g) parts.push(g);
    if (t) parts.push(t);
    if (tm.step > 1) parts.push(`animated ${STEP_WORD[tm.step]}`);
  } else {
    parts.push(`hand-drawn 2D effects animation ${STEP_WORD[tm.step]}`, "flat cel-shaded water with dark ink outlines", "a graphic teardrop splash crown with dotted drops", "sparkle highlights", "speed lines on the throw", p.stylization > 0.7 ? "a two-frame impact flash" : "a single-frame impact flash", tm.hold > 0 ? `the splash key pose held for ${frames(tm.hold)}` : "no hold on the key pose");
    if (t) parts.push(t);
    if (g) parts.push(g);
  }
  parts.push(characterBeat(tr, p, tm));
  return parts.join(", ");
}

function characterBeat(tr: Treatment, p: Phys, tm: Timing, flinch?: number) {
  const b = beatTimes(tr, p, tm, flinch);
  const lag = Math.round((b.recoil - b.impact) * FPS);
  if (lag < 0) return `the child flinches ${-lag} frames before the water lands`;
  if (lag > 6) return `the child flinches late, ${lag} frames after the water lands`;
  return tr === "real" ? "the child flinches back as the water hits" : "the child hops back as the water hits and holds the startled pose with the splash";
}

/** The Sync experiment's phrase: the flinch against the splash (lag in frames after the water lands). */
export function syncPhrase(p: Phys, tm: Timing, lag: number): string {
  return [SUBJECT, "3D cartoon animation", "a splash crown that holds", characterBeat("cartoon", p, tm, lag)].join(", ");
}

export type CategoryId = "fire" | "water" | "rigid" | "cloth" | "magic" | "drawn";
export type Look = "real" | "stylized";
export type Motion = "sim" | "keyed";

const CAT_SUBJECT: Record<CategoryId, string> = {
  fire: "a small campfire in a ring of stones at dusk",
  water: "a pebble drops into a still pond",
  rigid: "a heavy ball smashes into a stack of wooden crates",
  cloth: "a child's flag on a stick is waved back and forth",
  magic: "a magic wand sweeps a looping trail through the air",
  drawn: "a rubber ball is thrown hard into a brick wall",
};

const LOOK_WORDS: Record<CategoryId, Record<Look, string>> = {
  fire: { real: "photoreal fire with glowing embers, rising heat and soft grey smoke", stylized: "stylized cartoon flames in three flat colours with dark outlines and round puff smoke" },
  water: { real: "photoreal water surface with reflections and expanding ripples", stylized: "toon-shaded water with clean white ripple rings and teardrop splash drops" },
  rigid: { real: "realistic rigid-body physics, crates tumble, collide and settle", stylized: "cartoon crates with outlines, dust puffs on landing" },
  cloth: { real: "realistic cloth with soft folds and wrinkles", stylized: "flat-coloured cartoon flag with bold outlines" },
  magic: { real: "glowing particles with soft bloom drifting like fireflies", stylized: "four-point cartoon sparkles that pop and twinkle" },
  drawn: { real: "photographic motion blur, a realistic bounce", stylized: "classic 2D effects: a smear frame, multiples, speed lines, an impact star and a one-frame impact flash" },
};

const MOTION_WORDS: Record<CategoryId, Record<Motion, string>> = {
  fire: { sim: "turbulent, ever-changing motion", keyed: "a hand-animated looping flame cycle on twos" },
  water: { sim: "ripples that interfere and bounce off the banks", keyed: "evenly timed rings that ease out and fade" },
  rigid: { sim: "chaotic tumbling with many small bounces and jitter", keyed: "clean authored arcs, squash on landing, one bounce, a held settle" },
  cloth: { sim: "simulated cloth that ripples and flutters", keyed: "hand-keyed follow-through, the flag's tail overlapping the stick's moves" },
  magic: { sim: "particles that drift on air currents and fall away", keyed: "sparkles placed by hand along the arc, popping on beat" },
  drawn: { sim: "constant speed, physically accurate timing", keyed: "anticipation, a fast throw with wide spacing, a held squash on the wall, overshoot on the rebound" },
};

export function categoryPhrase(cat: CategoryId, look: Look, motion: Motion): string {
  return [CAT_SUBJECT[cat], LOOK_WORDS[cat][look], MOTION_WORDS[cat][motion]].join(", ");
}

/** Short prompting notes for effects, independent of state. */
export const PROMPT_NOTES: readonly { what: string; words: string; note: string }[] = [
  { what: "Timing", words: "splash crown holds for a beat", note: "Name the hold. Models default to real-time splashes that read as noise." },
  { what: "Style", words: "3D cartoon / hand-drawn 2D effects", note: "Say the medium before the effect: 'cartoon splash' alone often comes out photoreal." },
  { what: "Shape", words: "teardrop drops, a crown of droplets", note: "Shape words survive generation better than physics words." },
  { what: "Coupling", words: "flinches as the water hits", note: "Tie the character's beat to the effect or the model times them separately." },
  { what: "Frame rate", words: "animated on twos", note: "Models honour 'on twos' unevenly; expect to retime in the edit." },
];
