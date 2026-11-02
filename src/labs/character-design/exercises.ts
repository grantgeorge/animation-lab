import type { Design, DesignReading, PresetId } from './design';
import type { SilhouetteReading } from './silhouette';

export type Check = { label: string; ok: boolean };
export interface Exercise {
  id: string;
  title: string;
  goal: string;
  setup: { preset: PresetId; patch?: Partial<Design> };
  checks: (r: DesignReading, s: SilhouetteReading | null, d: Design) => Check[];
  insight: string;
}

/** Thresholds for the self-checking exercises (teaching targets, not industry rules). */
export const TARGETS = { youngHeads: 4, youngEyeLine: 0.45, youngEyes: 0.18, villainTriangle: 0.6, villainEyes: 0.14, villainGap: 0.8, negative: 0.35, distinct: 0.3 } as const;

export const EXERCISES: readonly Exercise[] = [
  {
    id: 'younger',
    title: 'Make it read younger',
    goal: 'This is a realistic adult. Without touching the pose, make the same character read as a child.',
    setup: { preset: 'realistic' },
    checks: r => [
      { label: `Head big for the body (${TARGETS.youngHeads} heads tall or fewer)`, ok: r.heads <= TARGETS.youngHeads + 1e-6 },
      { label: 'Eyes set below the half line', ok: r.eyeLine <= TARGETS.youngEyeLine + 1e-6 },
      { label: `Big eyes (at least ${Math.round(TARGETS.youngEyes * 100)}% of the head)`, ok: r.eyeSize >= TARGETS.youngEyes - 1e-6 },
      { label: 'Reads as a child', ok: r.age === 'child' || r.age === 'baby' },
    ],
    insight: 'A big head, big eyes and a low eye line are the cues people read as young (Lorenz called them the Kindchenschema). The body didn’t get younger. The ratios did. That’s why Pip reads as a kid at any height.',
  },
  {
    id: 'villain',
    title: 'A villain in one shape',
    goal: 'Pip is all circles. Turn the same body into someone you wouldn’t trust, using shape and eyes rather than costume.',
    setup: { preset: 'pip' },
    checks: (r, _s, d) => [
      { label: `Triangles dominate (${Math.round(TARGETS.villainTriangle * 100)}% or more)`, ok: d.shape[2] >= TARGETS.villainTriangle - 1e-6 },
      { label: 'Small eyes set close together', ok: r.eyeSize <= TARGETS.villainEyes + 1e-6 && r.eyeGap <= TARGETS.villainGap + 1e-6 },
      { label: 'Reads as grown up', ok: r.age === 'adult' || r.age === 'teen' },
    ],
    insight: 'Points and diagonals read as sharp and unstable, so triangles suggest threat or energy. Small, close-set eyes read as cunning, and adult proportions take away the child’s innocence. A designer can say “don’t trust him” before he moves.',
  },
  {
    id: 'silhouette',
    title: 'Fix the silhouette',
    goal: 'Filled in black, this character is a lump: the arms disappear into the body. Make the outline say something.',
    setup: { preset: 'cartoon', patch: { thickness: 1.7 } },
    checks: (_r, s, d) => [
      { label: `Negative space at least ${Math.round(TARGETS.negative * 100)}%`, ok: !!s && s.negative >= TARGETS.negative },
      { label: 'Arms clear of the body', ok: d.pose !== 'neutral' },
    ],
    insight: 'If you can’t read it in solid black, you won’t read it in a fast cut. Limbs held away from the body and gaps of background around them (negative space) give the outline a shape. Animators check every key pose this way.',
  },
  {
    id: 'apart',
    title: 'Stand apart from Pip',
    goal: 'In a cast lineup each character should be recognisable from the outline alone. Keep the neutral pose and change the design until it couldn’t be mistaken for Pip.',
    setup: { preset: 'pip' },
    checks: (_r, s, d) => [
      { label: `Outline at least ${Math.round(TARGETS.distinct * 100)}% different from Pip’s`, ok: !!s && s.distinct >= TARGETS.distinct },
      { label: 'Same neutral pose as Pip', ok: d.pose === 'neutral' },
    ],
    insight: 'Pose was off the table, so only proportion and shape could do it. Casts are designed as a set: tall against small, round against square, so every member reads at a glance, even in a crowd or in a thumbnail.',
  },
];
