import { beatTimes, type Phys, type Timing, type Treatment } from "./beat";
import { dropCount } from "./cartoon";
import { FPS, STEP_WORD } from "./timing";
import type { CategoryId, Look, Motion } from "./prompt";

/** Plain-language readings of the current settings: what an animator would say about them. */
export const TREATMENT_LABEL: Record<Treatment, string> = { real: "Realistic sim", cartoon: "Cartoon 3D", drawn: "Hand-drawn 2D" };

const sec = (frames: number) => `${(frames / FPS).toFixed(2)} s`;

function physWords(p: Phys) {
  const bits: string[] = [];
  if (p.gravity < 0.75) bits.push(`gravity at ${p.gravity.toFixed(1)} g makes everything float, which gives the eye more time`);
  else if (p.gravity > 1.35) bits.push(`gravity at ${p.gravity.toFixed(1)} g makes the water slam down before you can see it`);
  if (p.viscosity > 0.6) bits.push("high viscosity keeps the water in a few thick, slow shapes");
  else if (p.viscosity < 0.1) bits.push("almost no viscosity, so the water breaks up freely");
  if (p.turbulence > 0.6) bits.push("strong turbulence adds detail that changes on every frame");
  return bits;
}

export function treatmentReading(tr: Treatment, p: Phys, tm: Timing): string {
  const b = beatTimes(tr, p, tm);
  const s: string[] = [];
  if (tr === "real") {
    s.push(`${Math.round(p.count).toLocaleString("en-US")} droplets, solved at 120 steps a second with nobody choosing a single pose.`);
    s.push(p.stylization > 0.15 ? `An art-directed retime slows the sim to ${Math.round((1 - 0.68 * p.stylization) * 100)}% around the impact, the usual first move to make a real sim readable. Slower is not the same as clearer: the spray still changes shape on every frame.` : "It plays at true physical speed: the whole splash is over in about a quarter of a second.");
    if (tm.hold > 0) s.push(`A ${tm.hold}-frame freeze on the peak makes the shape readable, but a frozen sim reads as a stopped video, not a held pose.`);
  } else if (tr === "cartoon") {
    s.push(tm.antic > 0 ? `The bucket rears back for ${tm.antic} frames while the water bulges over the lip: the audience is told where to look before anything happens.` : "No anticipation: the bucket goes straight over, so the first frames of the splash catch the eye unprepared.");
    s.push(`The crown pops up in ${Math.round((b.peak - b.impact) * FPS)} frames and ${tm.hold > 0 ? `holds for ${tm.hold} frames (${sec(tm.hold)}) with a slight drift, a moving hold` : "falls at once, so it barely registers"}. Then ${dropCount(p)} drops snap off on authored arcs and the puddle overshoots and settles.`);
    if (p.stylization > 0.7) s.push("Stylization is high: a taller crown and stronger squash and stretch.");
    else if (p.stylization < 0.25) s.push("Stylization is low: the shapes stay close to life-size and squash very little.");
  } else {
    s.push(`Drawn ${STEP_WORD[tm.step]}: every drawing stays on screen for ${tm.step} frame${tm.step > 1 ? "s" : ""}${tm.step > 1 ? ", so motion steps and the shapes have time to register" : ", smooth but busier"}.`);
    s.push(`One impact frame flashes the whole picture, then a breakdown and the key splash pose, ${tm.hold > 0 ? `held ${tm.hold} frames` : "not held"}. Teardrop spikes, dotted drops and sparkles are graphic conventions, not physics.`);
    if (p.turbulence > 0.2) s.push("Each new drawing boils a little, as if traced by hand.");
  }
  s.push(...physWords(p).map((w) => w[0].toUpperCase() + w.slice(1) + "."));
  return s.join(" ");
}

export function legibilityReading(tr: Treatment, run: number, legible: number, firstAfterImpact: number, impactFrame: number): string {
  if (run === 0) return `${TREATMENT_LABEL[tr]}: no frame holds a readable splash shape. The eye sees motion, not a splash.`;
  const t = sec(run);
  const late = firstAfterImpact < 0 ? "and never after the impact" : firstAfterImpact - impactFrame > 3 ? `first ${firstAfterImpact - impactFrame} frames after the impact` : "right from the impact";
  return `${TREATMENT_LABEL[tr]}: the splash reads as one shape for ${run} frames in a row (${t}), ${legible} legible frames in all, ${late}.`;
}

export function syncReading(lag: number): { verdict: "early" | "tight" | "late" | "disconnected"; text: string } {
  if (lag < 0)
    return { verdict: "early", text: `Pip flinches ${-lag} frame${lag === -1 ? "" : "s"} before the water lands. He reacts to something that hasn't happened, so it reads as fear of the splash or a premonition, not as being hit.` };
  if (lag <= 3) return { verdict: "tight", text: `Pip flinches ${lag} frame${lag === 1 ? "" : "s"} after the water lands. Cause and effect read as one event: the splash sells the flinch and the flinch sells the splash.` };
  if (lag <= 7) return { verdict: "late", text: `Pip flinches ${lag} frames after the water lands. Still connected, but he reads slow or dazed. That can be a choice (a delayed take) if you mean it.` };
  return { verdict: "disconnected", text: `Pip flinches ${lag} frames late. The splash is over before he reacts, so the two read as separate events and neither one feels like it had weight.` };
}

const CAT_READ: Record<CategoryId, (look: Look, motion: Motion, v: number) => string> = {
  fire: (look, motion, v) =>
    `${motion === "sim" ? "Hundreds of particles rise on buoyancy and turbulence; no two frames repeat." : "A hand-made flame cycle of eight drawings on twos, the way 2D effects animators loop fire."} ${look === "real" ? "Additive glow and a soft smoke trail." : "Three flat colours and an ink line."} Wind at ${Math.round(v * 100)}% leans the flames ${v > 0.5 ? "hard" : "gently"}.`,
  water: (look, motion, v) =>
    `${motion === "sim" ? "A height-field wave equation: ripples spread, interfere and bounce off the banks." : "Evenly timed rings, each easing out and fading, keyed like a 2D ripple."} ${look === "real" ? "Lit and reflective." : "Toon bands with white crest lines."} Drop size ${Math.round(v * 100)}%.`,
  rigid: (look, motion, v) =>
    `${motion === "sim" ? "A position-based solver: every crate collides, slides and jitters until friction stops it. Correct, but nobody composed the landing." : "Authored arcs: each crate flies on a clean path, squashes on landing, bounces once and holds where the layout wants it."} Impact ${Math.round(v * 100)}%.${look === "stylized" ? " Outlines and dust puffs sell the hits." : ""}`,
  cloth: (look, motion, v) =>
    `${motion === "sim" ? "A spring-mass cloth: the flag drags behind the stick and flutters on its own." : "Keyed follow-through: each column of the flag lags the stick a little more, the overlap an animator draws by hand."} Wind ${Math.round(v * 100)}%.${look === "stylized" ? " Flat colour with a bold outline." : ""}`,
  magic: (look, motion, v) =>
    `${motion === "sim" ? "Sparks leave the wand tip with its speed, drag to a stop and drift on air currents." : "Sparkles placed by hand along the arc, popping on and twinkling on twos."} ${look === "real" ? "Soft additive glow." : "Four-point stars with an ink line."} Density ${Math.round(v * 100)}%.`,
  drawn: (look, motion, v) =>
    `${motion === "sim" ? "The ball moves at constant speed and bounces by the book: every frame evenly spaced." : "Anticipation, a throw with wide spacing, a squash held on the wall, an overshoot on the rebound."} ${look === "real" ? "Motion blur stands in for speed." : "A smear frame, multiples, speed lines and a one-frame impact flash stand in for speed."} Speed ${Math.round(v * 100)}%.`,
};

export function categoryReading(cat: CategoryId, look: Look, motion: Motion, v: number) {
  return CAT_READ[cat](look, motion, v);
}
