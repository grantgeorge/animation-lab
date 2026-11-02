import type { LookId, MotionId, Recipe } from './styles';
import { cadenceName, posesPerSecond } from './styles';

/** The four independent dimensions of an animation style. This lab works on the third. */
export const DIMENSIONS = [
  { id: 'technique', label: 'Technique', q: 'How it’s built', eg: '2D, 3D, stop motion, hybrid', href: '/labs/animation-camera', link: 'Animation Camera' },
  { id: 'visual', label: 'Visual style', q: 'What a still frame looks like', eg: 'painterly, anime, cartoon, comic-book', href: '/labs/painterly-textures', link: 'Painterly Textures' },
  { id: 'movement', label: 'Movement style', q: 'How characters perform', eg: 'naturalistic, cartoony, snappy, stepped', href: null, link: 'This lab' },
  { id: 'finishing', label: 'Rendering & finishing', q: 'How the final image is treated', eg: 'cel shading, grain, compositing', href: '/labs/grading-finishing', link: 'Grading & Finishing' },
] as const;

/** Eight major visual styles of modern animation, each paired with the movement it usually carries. */
export const ATLAS: { id: string; name: string; examples: string; look: string; movement: string; motion: MotionId; lookId: LookId }[] = [
  { id: 'stylized-3d', name: 'Stylized 3D', examples: 'Inside Out 2, Toy Story 4', look: 'Rounded forms, dimensional lighting, appealing proportions, polished textures.', movement: 'Smooth and expressive: strong anticipation, squash and stretch, designed acting poses.', motion: 'cartoony', lookId: 'modelled' },
  { id: 'painterly-3d', name: 'Painterly 3D', examples: 'Arcane', look: 'Hand-painted textures and graphic lighting on 3D forms.', movement: 'Cinematic and grounded, with heightened expressions and graphic action poses.', motion: 'naturalistic', lookId: 'modelled' },
  { id: 'comic-3d', name: 'Comic-book 3D hybrid', examples: 'Spider-Man: Across the Spider-Verse', look: 'Halftones, ink lines, graphic colour separation, illustrated impacts.', movement: 'Deliberately stepped, dynamic posing, smears; characters on different rhythms.', motion: 'snappy', lookId: 'toon' },
  { id: 'anime', name: 'Hand-drawn 2D / anime', examples: 'Spirited Away, The Boy and the Heron', look: 'Expressive drawings, distinctive silhouettes, painted backgrounds.', movement: 'Economical held drawings that burst into detailed motion; carefully timed action.', motion: 'limited', lookId: 'flat' },
  { id: 'flat-2d', name: 'Flat 2D', examples: 'Bluey, Hilda', look: 'Flat colour, clean shapes, minimal shading, very readable designs.', movement: 'Simple and economical, expressive posing, occasional bursts of fuller animation.', motion: 'snappy', lookId: 'flat' },
  { id: 'mixed', name: 'Mixed media, 2D over 3D', examples: 'The Mitchells vs. the Machines', look: '3D characters with hand-drawn lines, scribbles and graphic effects.', movement: 'Expressive 3D acting with 2D exaggerations, pose pops and graphic impacts.', motion: 'cartoony', lookId: 'toon' },
  { id: 'stop-motion', name: 'Stop motion', examples: 'Wallace & Gromit, Fantastic Mr. Fox', look: 'Tactile materials, handmade surfaces, real sets and light.', movement: 'Repositioned frame by frame, often keeping a slight stepped, handled feel.', motion: 'stopmotion', lookId: 'modelled' },
  { id: 'toon-3d', name: 'Toon-shaded 3D', examples: 'The Bad Guys, Puss in Boots: The Last Wish', look: 'Simplified shadow shapes, illustrated textures, graphic contours.', movement: 'Snappy and exaggerated, often stepped, with stylized smear frames.', motion: 'snappy', lookId: 'toon' },
];

/** Nine movement styles, for the vocabulary table. */
export const VOCABULARY = [
  ['Naturalistic', 'Believable weight, acceleration, balance, subtle gestures', 'Arcane, realistic CGI'],
  ['Cartoony', 'Big reactions, squash and stretch, elastic limbs', 'Classic Disney, Pixar'],
  ['Snappy, pose to pose', 'Strong silhouettes, fast transitions, abrupt holds', 'Spider-Verse, stylized 3D'],
  ['Limited', 'Long holds; only mouths, eyes or an arm move', 'TV anime, 2D television'],
  ['Fluid, full', 'Frequent pose changes, continuous articulated motion', 'Disney feature animation'],
  ['Stepped', 'Deliberate discontinuities between poses', 'Puppet animation, stylized CGI'],
  ['Sakuga', 'Dramatic key poses, perspective distortion, bursts of elaborate motion', 'Action anime'],
  ['Motion capture', 'Captured human timing, posture and nuance', 'Realistic CGI, game cinematics'],
  ['Rubber hose', 'Flexible limbs, bouncy rhythm, elastic silhouettes', '1930s-inspired cartoons'],
] as const;

/** One line per recipe dial: what the principle controls. */
export const PRINCIPLES: Record<'cadence' | 'exaggeration' | 'anticipation' | 'followThrough' | 'squash' | 'holds', string> = {
  cadence: 'How many frames each pose is held on a 24 fps timeline.',
  exaggeration: 'How far each pose is pushed beyond what a person would do.',
  anticipation: 'The preparatory move before an action: the flinch before the jump, the lean before the run.',
  followThrough: 'Parts that overshoot and settle after the body stops.',
  squash: 'How much the body deforms under force.',
  holds: 'Pose-to-pose timing: hold each key pose, then move late and fast to the next.',
};

/** The five independent specifications of an animation direction. */
export const SPECS = [
  { id: 'construction', n: '01', label: 'Construction', title: 'Animation medium', options: ['2D hand-drawn', '2D rigged', '2.5D', 'Full 3D', 'Hybrid 2D/3D', 'Stop-motion look'] },
  { id: 'appearance', n: '02', label: 'Appearance', title: 'Visual language', options: ['Painterly', 'Cel-shaded', 'Photoreal', 'Flat graphic', 'Comic-book', 'Watercolour', 'Clay'] },
  { id: 'performance', n: '03', label: 'Performance', title: 'Motion language', options: [] },
  { id: 'timing', n: '04', label: 'Timing', title: 'Cadence and acting', options: [] },
  { id: 'camera', n: '05', label: 'Camera & finishing', title: 'Camera and final look', options: ['35 mm, restrained dolly', 'Wide lens, handheld energy', 'Long lens, locked off', 'Warm bloom, fine grain', 'Clean, no grain', 'High contrast, halation'] },
] as const;

export type Picks = { construction: string; appearance: string; camera: string[] };

export function timingWords(r: Recipe) {
  const cad = r.cadence === 1 ? 'smooth motion on ones (24 poses a second)' : `stepped on ${cadenceName(r.cadence)} (${posesPerSecond(r.cadence)} poses a second)`;
  const holds = r.holds >= 0.6 ? 'long pose holds with sudden transitions' : r.holds >= 0.15 ? 'brief holds on key poses' : 'continuous movement between poses';
  const ant = r.anticipation >= 1.1 ? 'big anticipation' : r.anticipation >= 0.5 ? 'clear anticipation' : 'minimal anticipation';
  const fol = r.followThrough >= 1.1 ? 'generous overshoot and settle' : r.followThrough >= 0.4 ? 'natural follow-through' : 'little follow-through';
  return `${cad}; ${holds}; ${ant}; ${fol}`;
}

export function directionText(p: Picks, motionLabel: string, motionPrompt: string, r: Recipe) {
  return [
    `Medium: ${p.construction}.`,
    `Visual: ${p.appearance}.`,
    `Performance (${motionLabel}): ${motionPrompt}.`,
    `Timing: ${timingWords(r)}.`,
    `Camera & finishing: ${p.camera.length ? p.camera.join('; ') : 'cinematic 35 mm perspective'}.`,
  ].join('\n');
}
