import { presetCurves } from "./bezier";
import { type MotionParams, applyWeight } from "./params";
import { type Timeline, buildTimeline } from "./timeline";

export type ComparisonId = "easing" | "weight" | "anticipation" | "squash";

export interface Comparison {
  id: ComparisonId;
  key: string;
  title: string;
  /** Short labels for the two sides. */
  a: string;
  b: string;
  /** What the side-by-side shows, 1–2 sentences. */
  why: string;
  /** What to look for in AI-generated motion. */
  aiTip: string;
  /** Where to look in the three views. */
  lookAt: string;
  /** Parameters fixed by the comparison (their controls are locked while it is on). */
  locks: readonly (keyof MotionParams)[];
  variants: (base: MotionParams) => [MotionParams, MotionParams];
}

export const COMPARISONS: readonly Comparison[] = [
  {
    id: "easing",
    key: "1",
    title: "Linear vs eased",
    a: "Linear",
    b: "Eased (gravity)",
    why: "Equal spacing feels mechanical. Gravity spacing slows at the top and speeds into the floor, with the same time in the air.",
    aiTip: "Watch the apex and the impact. Robotic generated motion has even spacing and V-shaped turnarounds; a believable body hangs a beat at the top and accelerates into the ground. Slowing down just before landing reads as cushioned and fake.",
    lookAt: "Trajectory: evenly spaced dots (A) vs dots bunched at the top (B).",
    locks: ["rise", "fall", "linkCurves"],
    variants: (base) => [
      { ...base, ...presetCurves("linear") },
      { ...base, ...presetCurves("gravity") },
    ],
  },
  {
    id: "weight",
    key: "2",
    title: "Heavy vs light",
    a: "Heavy",
    b: "Light",
    why: "Short, firm bounces suggest weight. Longer airtime and softer rebounds suggest lightness. These stylized presets change timing, rebound and shape together.",
    aiTip: "Without air resistance, mass alone does not change the rate of falling. In animation, compare the material, rebound, deformation and chosen hang time to judge whether the weight feels right.",
    lookAt: "Curve: steep narrow arcs that die fast (A) vs tall wide arcs that keep going (B).",
    locks: ["weight", "height", "airFrames", "restitution", "contactFrames", "drift", "squash"],
    variants: (base) => [applyWeight(base, "bowling"), applyWeight(base, "beach")],
  },
  {
    id: "anticipation",
    key: "3",
    title: "Prepare the jump",
    a: "No windup",
    b: "Anticipation",
    why: "A crouch gives the eye time to prepare. Both characters leave the floor together; only B winds up first.",
    aiTip: "Look for preparation before big actions: a crouch before a jump, a pull-back before a throw or a punch. Generated characters often move instantly with no windup, which reads weightless and hard to follow, so ask for it.",
    lookAt: "Character: B sinks and squints before the launch; A just pops up. Both leave the floor on the same frame.",
    locks: ["anticipation", "anticipationFrames"],
    variants: (base) => [
      { ...base, anticipation: 0 },
      { ...base, anticipation: Math.max(0.8, base.anticipation), anticipationFrames: Math.max(10, base.anticipationFrames) },
    ],
  },
  {
    id: "squash",
    key: "4",
    title: "Rigid vs springy",
    a: "Rigid",
    b: "Springy",
    why: "Squash at contact and stretch at speed suggest softness. The volume stays the same; the amount is a choice about material and style.",
    aiTip: "In stylised clips, check that shapes deform on impact and stretch at speed while keeping their volume. Shapes that shrink or swell, or rubbery deformation in realistic footage, both read as wrong.",
    lookAt: "Trajectory ghosts and the squash channel: flat line (A) vs squash spikes on every contact (B).",
    locks: ["squash"],
    variants: (base) => [
      { ...base, squash: 0 },
      { ...base, squash: 1 },
    ],
  },
];

export const comparison = (id: ComparisonId | null) => COMPARISONS.find((c) => c.id === id) ?? null;

export interface Variant {
  id: "main" | "A" | "B";
  label: string;
  params: MotionParams;
  timeline: Timeline;
}

/** Timelines for free play (one) or a comparison (two of equal length, takeoffs on the same frame). */
export function buildVariants(base: MotionParams, id: ComparisonId | null): Variant[] {
  const c = comparison(id);
  if (!c) return [{ id: "main", label: "", params: base, timeline: buildTimeline(base) }];
  const [pa, pb] = c.variants(base);
  const ant = (p: MotionParams) => (p.anticipation > 0 ? p.anticipationFrames : 0);
  const maxAnt = Math.max(ant(pa), ant(pb));
  const lead = (p: MotionParams) => 6 + maxAnt - ant(p);
  const first = [buildTimeline(pa, { leadFrames: lead(pa) }), buildTimeline(pb, { leadFrames: lead(pb) })];
  const total = Math.max(first[0].totalFrames, first[1].totalFrames);
  return [
    { id: "A", label: c.a, params: pa, timeline: buildTimeline(pa, { leadFrames: lead(pa), minTotalFrames: total }) },
    { id: "B", label: c.b, params: pb, timeline: buildTimeline(pb, { leadFrames: lead(pb), minTotalFrames: total }) },
  ];
}
