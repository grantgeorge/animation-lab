/**
 * The shots the lab compares, and the drift notes a reviewer wrote for each one.
 *
 * Coverage: one scene (Bram and Pip at the lamplit doorway) as five shots, generated twice with
 * GPT Image 2.5 on fal (scripts/continuity-media/gen.mjs): once from the text description alone, once
 * with the approved painted master shot and the two character sheets attached. Retakes: the four
 * "description only" and four "with references" H3 Max takes of one shot from the /history experiment.
 *
 * Notes are honest observations against the approved references, written from full-resolution review
 * (2026-11-02). x, y are fractions of the frame (0..1, top-left origin); r is a hit radius in frame widths.
 * Pure data: no app imports, so tests and e2e can load it.
 */

export type LensId = 'identity' | 'costume' | 'lighting' | 'spatial';
export type SetId = 'master' | 'text' | 'refs' | 'retake-text' | 'retake-refs';
export type Focus = 'full' | 'face' | 'costume' | 'set';

export interface Note { id: string; x: number; y: number; r: number; lens: LensId; title: string; why: string }
export interface Shot {
  id: string;
  set: SetId;
  label: string;
  /** Shot size, as asked for in the prompt. */
  size: string;
  src: string;
  /** Points of interest for zoom: the shot's subject. Fractions of the frame. */
  focus: Record<Exclude<Focus, 'full'>, readonly [number, number]>;
  notes: Note[];
  /** Notes reviewed? Retakes carry the /history review as captions instead of pins. */
  caption?: string;
}

const L = '/labs/ai-shot-continuity';

export const MASTER: Shot = {
  id: 'master', set: 'master', label: 'Approved master', size: 'Wide', src: '/history/stills/still-multiplane.webp',
  focus: { face: [0.5, 0.45], costume: [0.5, 0.66], set: [0.66, 0.32] }, notes: [],
  caption: 'The approved painted key frame from /history. Every other shot is judged against it and the two character sheets.',
};

export const SHEETS = [
  { id: 'sheet-bram', label: 'Bram sheet', src: '/history/refs/ref-paint-bram.webp' },
  { id: 'sheet-pip', label: 'Pip sheet', src: '/history/refs/ref-paint-pip.webp' },
] as const;

const lamp = (id: string, x: number, y: number): Note => ({
  id, x, y, r: 0.08, lens: 'spatial', title: 'The wall lamp changed design',
  why: 'An ornate iron bracket lantern replaces the bare bulb that glows above the doorway in the master. Props are part of the set: a new design in every shot reads as a different street.',
});

export const COVERAGE: Shot[] = [
  {
    id: 'text-wide', set: 'text', label: 'Wide', size: 'Wide', src: `${L}/text-wide.webp`,
    focus: { face: [0.42, 0.14], costume: [0.43, 0.4], set: [0.68, 0.3] },
    notes: [
      lamp('tw-lamp', 0.58, 0.13),
      { id: 'tw-door', x: 0.73, y: 0.45, r: 0.12, lens: 'spatial', title: 'A different doorway', why: 'A stone-arched door with a ring knocker set in a stone house. The master’s doorway is a plain arch cut into a warm plaster wall.' },
      { id: 'tw-town', x: 0.2, y: 0.25, r: 0.13, lens: 'spatial', title: 'A town appears behind', why: 'Gothic spires and houses fill the left of frame, where the master has the red brick wall and one clock tower.' },
      { id: 'tw-hall', x: 0.7, y: 0.36, r: 0.07, lens: 'lighting', title: 'The doorway glows', why: 'A lit hallway behind the door adds a second warm source. In the master the doorway is dark, so the lamp is the only key.' },
      { id: 'tw-face', x: 0.42, y: 0.13, r: 0.07, lens: 'identity', title: 'Bram’s face is longer and narrower', why: 'The sheet’s Bram has a broad round face, big white eyes and a huge round red nose. Here the face is long, the eyes small and the nose modest.' },
    ],
  },
  {
    id: 'text-pip', set: 'text', label: 'Pip close', size: 'Medium close-up', src: `${L}/text-pip.webp`,
    focus: { face: [0.6, 0.45], costume: [0.62, 0.8], set: [0.34, 0.15] },
    notes: [
      { id: 'tp-face', x: 0.6, y: 0.47, r: 0.1, lens: 'identity', title: 'Pip reads older', why: 'Smaller brown eyes, a longer face and a wide open grin. The sheet’s Pip has huge round dark eyes in a small, round face: a much younger child.' },
      { id: 'tp-collar', x: 0.62, y: 0.67, r: 0.07, lens: 'costume', title: 'A dark turtleneck', why: 'A navy turtleneck shows under the raincoat. The sheet shows a light knit collar.' },
      { id: 'tp-hall', x: 0.58, y: 0.15, r: 0.1, lens: 'lighting', title: 'A lit room behind Pip', why: 'A warm hallway with framed pictures glows through the door. The master’s doorway is dark.' },
      lamp('tp-lamp', 0.34, 0.08),
      { id: 'tp-town', x: 0.2, y: 0.3, r: 0.12, lens: 'spatial', title: 'A second street lantern and a town', why: 'A lit lantern post and spires sit behind the wall. Neither exists in the master.' },
    ],
  },
  {
    id: 'text-bram', set: 'text', label: 'Bram close', size: 'Medium close-up', src: `${L}/text-bram.webp`,
    focus: { face: [0.46, 0.22], costume: [0.42, 0.7], set: [0.82, 0.4] },
    notes: [
      { id: 'tb-face', x: 0.47, y: 0.22, r: 0.1, lens: 'identity', title: 'Bram’s face drifts again', why: 'Small dot eyes and a narrower orange nose, with no rosy roundness. The sheet’s Bram has big white eyes and a huge round red nose. It also differs from the wide shot’s Bram.' },
      lamp('tb-lamp', 0.79, 0.07),
      { id: 'tb-door', x: 0.86, y: 0.62, r: 0.1, lens: 'spatial', title: 'The stone arch is back', why: 'A heavy stone-arched door with a ring knocker, not the master’s plain arch in plaster.' },
      { id: 'tb-town', x: 0.18, y: 0.3, r: 0.12, lens: 'spatial', title: 'Spires and rooftops behind', why: 'The background is an invented town; the master shows the brick wall and one clock tower.' },
    ],
  },
  {
    id: 'text-ots', set: 'text', label: 'Over the shoulder', size: 'Over the shoulder', src: `${L}/text-ots.webp`,
    focus: { face: [0.54, 0.57], costume: [0.31, 0.6], set: [0.55, 0.3] },
    notes: [
      { id: 'to-scarf', x: 0.31, y: 0.62, r: 0.08, lens: 'costume', title: 'The scarf end hangs down his back', why: 'The bible says one fringed end hangs down Bram’s chest. Here a fringed end hangs down his back.' },
      { id: 'to-hair', x: 0.33, y: 0.2, r: 0.08, lens: 'identity', title: 'Longer hair and sideburns', why: 'Reddish-brown hair falls to the collar with a bushy sideburn. The sheet shows short brown hair under the cap.' },
      { id: 'to-street', x: 0.83, y: 0.32, r: 0.14, lens: 'spatial', title: 'The street opens up on the right', why: 'Looking past Bram at the doorway, we should see the same plaster wall as the master. Instead the frame opens onto a lit town, a clock tower and a canal of cobbles.' },
      { id: 'to-hall', x: 0.52, y: 0.38, r: 0.07, lens: 'lighting', title: 'Light spills from inside', why: 'The doorway is lit from within, again. The master keeps it dark.' },
      lamp('to-lamp', 0.55, 0.07),
    ],
  },
  {
    id: 'text-boots', set: 'text', label: 'Insert', size: 'Close-up insert', src: `${L}/text-boots.webp`,
    focus: { face: [0.66, 0.12], costume: [0.37, 0.82], set: [0.27, 0.35] },
    notes: [
      { id: 'tx-cross', x: 0.6, y: 0.42, r: 0.15, lens: 'spatial', title: 'It crossed the line', why: 'Bram is now on the right and the doorway on the left. The master and every other shot keep Bram screen left and the doorway screen right, so cutting here flips the geography.' },
      { id: 'tx-insert', x: 0.37, y: 0.83, r: 0.1, lens: 'spatial', title: 'The insert never happened', why: 'The prompt asked for a close-up of the boots on the cobbles. It returned a full two-shot, with the boots tiny in frame.' },
      { id: 'tx-face', x: 0.65, y: 0.11, r: 0.06, lens: 'identity', title: 'Yet another Bram', why: 'A narrow face with a small nose, different again from the wide and the close-up.' },
      lamp('tx-lamp', 0.48, 0.08),
    ],
  },
  {
    id: 'refs-wide', set: 'refs', label: 'Wide', size: 'Wide', src: `${L}/refs-wide.webp`,
    focus: { face: [0.48, 0.38], costume: [0.48, 0.6], set: [0.72, 0.25] }, notes: [],
  },
  {
    id: 'refs-pip', set: 'refs', label: 'Pip close', size: 'Medium close-up', src: `${L}/refs-pip.webp`,
    focus: { face: [0.54, 0.45], costume: [0.5, 0.8], set: [0.18, 0.4] }, notes: [],
  },
  {
    id: 'refs-bram', set: 'refs', label: 'Bram close', size: 'Medium close-up', src: `${L}/refs-bram.webp`,
    focus: { face: [0.46, 0.33], costume: [0.42, 0.75], set: [0.75, 0.4] }, notes: [],
  },
  {
    id: 'refs-ots', set: 'refs', label: 'Over the shoulder', size: 'Over the shoulder', src: `${L}/refs-ots.webp`,
    focus: { face: [0.64, 0.5], costume: [0.12, 0.6], set: [0.6, 0.3] },
    notes: [
      { id: 'ro-scarf', x: 0.1, y: 0.62, r: 0.1, lens: 'costume', title: 'The scarf end still hangs down his back', why: 'References fixed the face, set and light, but both sheets show the front only. The model had never seen Bram from behind, so it invented the back of the scarf. A turnaround (front, side, back) would have covered it.' },
    ],
  },
  {
    id: 'refs-boots', set: 'refs', label: 'Insert', size: 'Close-up insert', src: `${L}/refs-boots.webp`,
    focus: { face: [0.48, 0.1], costume: [0.5, 0.55], set: [0.18, 0.25] }, notes: [],
  },
];

/** The /history experiment's takes of ONE shot: drift between retakes. Captions quote its human-reviewed notes. */
const P = '/history/posters';
export const RETAKES: Shot[] = [
  { id: 'exp-text-1', set: 'retake-text', label: 'Take 1', size: 'Wide', src: `${P}/exp-text-1.webp`, focus: { face: [0.37, 0.26], costume: [0.37, 0.55], set: [0.65, 0.45] }, notes: [], caption: 'A portlier Bram in a long double-breasted coat, hands in pockets; an invented stone-arched green door.' },
  { id: 'exp-text-2', set: 'retake-text', label: 'Take 2', size: 'Wide', src: `${P}/exp-text-2.webp`, focus: { face: [0.39, 0.26], costume: [0.39, 0.55], set: [0.65, 0.45] }, notes: [], caption: 'The same redesigned Bram, now standing further right; the same invented door and street.' },
  { id: 'exp-text-3', set: 'retake-text', label: 'Take 3', size: 'Wide', src: `${P}/exp-text-3.webp`, focus: { face: [0.41, 0.26], costume: [0.41, 0.55], set: [0.55, 0.45] }, notes: [], caption: 'A heavier Bram; the door gains a lit, curtained window beside it.' },
  { id: 'exp-text-4', set: 'retake-text', label: 'Take 4', size: 'Wide', src: `${P}/exp-text-4.webp`, focus: { face: [0.4, 0.26], costume: [0.4, 0.5], set: [0.6, 0.45] }, notes: [], caption: 'A dark waistcoat and tie appear under the open coat. Nobody asked for them.' },
  { id: 'exp-refs-1', set: 'retake-refs', label: 'Take 1', size: 'Wide', src: `${P}/exp-refs-1.webp`, focus: { face: [0.5, 0.42], costume: [0.5, 0.7], set: [0.6, 0.45] }, notes: [], caption: 'Bram and Pip match the references, including relative height; the set matches the key frame.' },
  { id: 'exp-refs-2', set: 'retake-refs', label: 'Take 2', size: 'Wide', src: `${P}/exp-refs-2.webp`, focus: { face: [0.5, 0.42], costume: [0.5, 0.7], set: [0.6, 0.45] }, notes: [], caption: 'Matches the references throughout.' },
  { id: 'exp-refs-3', set: 'retake-refs', label: 'Take 3', size: 'Wide', src: `${P}/exp-refs-3.webp`, focus: { face: [0.5, 0.42], costume: [0.5, 0.7], set: [0.6, 0.45] }, notes: [], caption: 'Nearly identical to takes 1 and 2: consistency at the cost of choice.' },
  { id: 'exp-refs-4', set: 'retake-refs', label: 'Take 4', size: 'Wide', src: `${P}/exp-refs-4.webp`, focus: { face: [0.5, 0.42], costume: [0.5, 0.7], set: [0.6, 0.45] }, notes: [], caption: 'Matches the references.' },
];

export const ALL_SHOTS: Shot[] = [MASTER, ...COVERAGE, ...RETAKES];
export const shotById = (id: string): Shot => ALL_SHOTS.find((s) => s.id === id) ?? MASTER;

export const SET_LABEL: Record<SetId, string> = {
  master: 'Approved',
  text: 'Prompt only',
  refs: 'With references',
  'retake-text': 'Retakes · prompt only',
  'retake-refs': 'Retakes · with references',
};
