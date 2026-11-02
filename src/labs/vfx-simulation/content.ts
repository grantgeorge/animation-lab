import type { Treatment } from "./engine/beat";
import type { CategoryId } from "./engine/prompt";
import type { ExpId } from "./store";

export const TAGLINE = "Physical accuracy is not artistic quality.";
export const QUESTION = "How do you animate effects that feel believable, or stylized, and act with the character?";
export const LESSON =
  "Pip kicks over the same bucket three times. The realistic sim is correct to the droplet, and at true speed it reads as noise: the shape is different on every frame. The cartoon crown pops up and holds, so it reads at a glance. The hand-drawn splash is pure convention: teardrops, dotted drops, an impact frame, held on twos. Effects are animated like characters: anticipation, timing, spacing, holds and follow-through.";
export const NOTICE = [
  "Legibility is measured, not asserted: a frame counts when the splash silhouette is big enough, mostly one shape and stable against the previous frame.",
  "A freeze on the realistic sim makes it readable but dead. The cartoon uses a moving hold: the crown keeps drifting a few percent.",
  "Pip's flinch is keyed to each treatment's splash. Offset it in the In sync tab and watch both stop working.",
];

export const TREATMENT_INFO: Record<Treatment, { label: string; short: string; color: string; how: string }> = {
  real: { label: "Realistic sim", short: "Realistic", color: "#a7bccb", how: "Thousands of droplets, a particle fluid solved at 120 Hz. Nobody chose a single pose." },
  cartoon: { label: "Cartoon 3D", short: "Cartoon", color: "#4fb8ff", how: "A few big blobs on authored arcs: a gathered bulge, a crown that pops and holds, a snappy settle." },
  drawn: { label: "Hand-drawn 2D", short: "Hand-drawn", color: "#ffcf5a", how: "Graphic splash poses with ink lines, held on twos, an impact frame, sparkles and speed lines." },
};

export const EXP_INFO: Record<ExpId, { tab: string; title: string; lesson: string; try: string }> = {
  bucket: {
    tab: "The bucket",
    title: "One bucket, three treatments",
    lesson: LESSON,
    try: "On the realistic sim, push stylization (a retime) and then halve gravity, and watch the legible run: the retime alone barely helps, the two together triple it. Then take the hold off the cartoon crown.",
  },
  sync: {
    tab: "In sync",
    title: "Effect and acting sell each other",
    lesson: "The flinch is only believable if it is caused by the splash, and the splash only feels heavy if someone reacts to it. Left: Pip flinches 2 frames after the water lands, his startled pose held as long as the crown. Right: your offset. Too early reads as a premonition, too late as two separate events.",
    try: "Drag the offset to −6 and then +10. Which one still feels like the water hit him?",
  },
  fire: {
    tab: "Fire & smoke",
    title: "Fire, smoke and atmospherics",
    lesson: "Heat rises, cools and turns to smoke. A particle sim gives endless variation; a 2D effects animator draws an eight-drawing flame cycle on twos with three flat colours, and it reads better at small sizes. Wind leans both.",
    try: "Compare the stylized look on the sim (posterized particles) with the keyed flame cycle. Which reads as fire from across the room?",
  },
  water: {
    tab: "Water",
    title: "Water and fluids",
    lesson: "A height-field wave equation makes ripples that interfere and bounce off the banks: rich, but busy. Keyed rings are evenly timed and ease out, the way an animator spaces them, and the drops follow drawn arcs.",
    try: "Toggle simulated and keyframed with the stylized look on. Where does the eye go?",
  },
  rigid: {
    tab: "Rigid bodies",
    title: "Rigid bodies and destruction",
    lesson: "The solver knocks the stack over correctly, with tumbling, jitter and many small bounces, but nobody composed where the crates land. The keyed version flies each crate on a clean arc, squashes it on landing, bounces once and holds it where the layout wants it.",
    try: "Raise the impact. The sim gets more chaotic; the keyed version just gets bigger.",
  },
  cloth: {
    tab: "Cloth & hair",
    title: "Cloth, hair and soft bodies",
    lesson: "The stick is the character's action and is keyed in both versions. The simulated flag drags and flutters on its own. The keyed flag is follow-through drawn by hand: each part lags the one before and overshoots, the successive breaking of joints.",
    try: "Watch the flag's tail at the stick's hold at 1.0 s. One keeps fluttering; the other settles on purpose.",
  },
  magic: {
    tab: "Particles & magic",
    title: "Particles and magic",
    lesson: "Sparks leave the wand tip with its speed, drag to a stop and drift: thousands of small elements that no one animates individually. The keyed version places a few sparkles by hand along the arc and pops them on beat, on twos.",
    try: "Drop the density. The keyed trail still reads; the sim thins into dust.",
  },
  drawn: {
    tab: "Hand-drawn FX",
    title: "Hand-drawn and stylized effects",
    lesson: "A thrown ball: physically it moves at constant speed and bounces by the book. Animated, it anticipates, crosses in two or three frames with a smear and multiples, hits on a one-frame impact flash, holds its squash on the wall and overshoots on the rebound.",
    try: "Step through the hit with the frame buttons. The smear and the flash are single frames you can't see at speed, but you feel them.",
  },
};

export const CATEGORY_CONTROL: Record<CategoryId, string> = { fire: "Wind", water: "Drop size", rigid: "Impact", cloth: "Wind", magic: "Density", drawn: "Throw speed" };

export const RELATED: readonly { href: string; label: string; why: string }[] = [
  { href: "/labs/timing-and-spacing", label: "Timing & Spacing", why: "Holds, eases and on-twos, on a bouncing critter" },
  { href: "/labs/animation-style", label: "Animation Style", why: "The same performance in different movement styles" },
  { href: "/labs/environment-depth", label: "Environment & Depth", why: "Pip's forest: haze, leaves and fireflies" },
  { href: "/labs/painterly-textures", label: "Painterly Textures", why: "Line boil and painted looks that hold still" },
];
