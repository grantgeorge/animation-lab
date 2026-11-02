import { blockingConfig as config } from '@/labs/lens-and-framing/config';
import type { Facing, Reading } from './blockingMath';

type Preset = keyof typeof config.presets;
export type Check = { label: string; ok: boolean };
export interface Exercise {
  id: string;
  title: string;
  goal: string;
  setup: { preset: Preset; facing: Facing; silhouette?: boolean };
  checks: (r: Reading, played: boolean) => Check[];
  /** Shown once every check passes. */
  insight: string;
}

const clean = (r: Reading): Check => ({ label: 'Both actors clear and in frame', ok: !r.overlap && !r.cropped });

export const EXERCISES: Exercise[] = [
  {
    id: 'reveal',
    title: 'Reveal the hidden actor',
    goal: 'Pip is standing directly behind Bram, so the audience can’t see him. Drag Pip on the floor plan, or swing the camera, until the two black shapes separate.',
    setup: { preset: 'Hidden', facing: 'front', silhouette: true },
    checks: r => [
      { label: 'Pip’s outline is clear of Bram’s', ok: !r.overlap },
      { label: 'Both stay inside the frame', ok: !r.cropped },
    ],
    insight: 'Two actors on one sightline become one shape. A sideways step or a new camera angle opens the gap. Animators check blocking in solid black because colour and detail hide the problem.',
  },
  {
    id: 'distance',
    title: 'Change the relationship',
    goal: 'They greet each other from across the square. Bring them to arm’s length, then play the greeting again.',
    setup: { preset: 'Distance', facing: 'partner' },
    checks: (r, played) => [
      { label: `Personal distance (under ${config.proxemics.personal} m)`, ok: r.distance < config.proxemics.personal },
      { label: 'Room left for the gesture', ok: !r.collision },
      clean(r),
      { label: 'Greeting played on the new marks', ok: played },
    ],
    insight: 'The animation never changed, only the space did. From across the square the wave is a polite acknowledgement; at arm’s length it reads as a reunion. Distance carries the relationship.',
  },
  {
    id: 'upstage',
    title: 'Give Pip the scene',
    goal: 'Side by side, both actors are in profile and neither one leads. Move Pip upstage (away from camera) until his face opens to the lens and Bram’s closes.',
    setup: { preset: 'Profile', facing: 'partner' },
    checks: r => [
      { label: 'Pip’s face reads', ok: r.open.pip >= .5 },
      { label: 'Bram gives the focus away', ok: r.open.bram <= r.open.pip - .3 },
      { label: 'Still facing each other', ok: r.engaged.bram && r.engaged.pip },
      clean(r),
    ],
    insight: 'When two actors face each other, whoever stands further from camera turns toward the lens and takes the scene. Theatre calls it upstaging. Use it to tell the audience whose moment this is.',
  },
  {
    id: 'cheat',
    title: 'Cheat it open',
    goal: 'Real people talk face to face, but on screen that leaves two profiles. Show both faces while keeping the two of them in conversation.',
    setup: { preset: 'Profile', facing: 'partner' },
    checks: r => [
      { label: 'Both faces read', ok: r.open.bram >= .4 && r.open.pip >= .4 },
      { label: 'Still playing to each other', ok: r.engaged.bram && r.engaged.pip },
      clean(r),
    ],
    insight: 'Actors “cheat” a quarter-turn toward camera. In the room it looks odd; on screen the audience reads both faces and never notices. Turning fully to camera breaks the conversation instead.',
  },
];

export const checksPass = (checks: Check[]) => checks.every(c => c.ok);
