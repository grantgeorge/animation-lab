/**
 * "What should a director control?": the comparison matrix and the shot-breakdown exercise.
 * Opinions here are production rules of thumb, written to be argued with.
 */
export type MethodId = 'key' | 'phys' | 'proc' | 'ai';
export type BucketId = MethodId | 'hybrid';

export const METHODS: readonly { id: MethodId; n: string; label: string; short: string; who: string }[] = [
  { id: 'key', n: '01', label: 'Keyframed', short: 'Keyframe', who: 'An animator sets every pose and every frame.' },
  { id: 'phys', n: '02', label: 'Physics', short: 'Physics', who: 'Forces and springs decide; nobody poses it.' },
  { id: 'proc', n: '03', label: 'Procedural', short: 'Procedural', who: 'Rules read the scene and write the pose.' },
  { id: 'ai', n: '04', label: 'AI synthesis', short: 'AI video', who: 'A video model invents the whole shot from a prompt.' },
];

export const BUCKETS: readonly { id: BucketId; label: string }[] = [
  ...METHODS.map((m) => ({ id: m.id as BucketId, label: m.short })),
  { id: 'hybrid', label: 'Hybrid: key + sim' },
];

export const MATRIX: readonly { row: string; key: string; phys: string; proc: string; ai: string }[] = [
  { row: 'Timing', key: 'Exact, frame by frame', phys: 'Emerges from mass, speed and gravity', proc: 'Set by rules, tunable', ai: 'Whatever the model chooses' },
  { row: 'Pose & acting', key: 'Full intent: the look down, the ta-da', phys: 'None: nobody decided anything', proc: 'Generic intent the rules encode', ai: 'Plausible, unrepeatable, hard to steer' },
  { row: 'Contact accuracy', key: 'Exact, for the set it was keyed on', phys: 'Exact by construction', proc: 'Exact: feet are planted by rule', ai: 'Often cheats: sliding, floating feet' },
  { row: 'Adapts to changes', key: 'No: re-key by hand', phys: 'Instantly', proc: 'Instantly', ai: 'Re-prompt and regenerate' },
  { row: 'Variation', key: 'Only what you animate', phys: 'Change an input', proc: 'Free: a new seed', ai: 'Every take differs, wanted or not' },
  { row: 'Repeatability', key: 'Perfect', phys: 'Perfect (deterministic)', proc: 'Perfect per seed', ai: 'Low' },
  { row: 'Iteration cost', key: 'Hours of an animator per change', phys: 'Seconds, plus setup', proc: 'Seconds, after building the rules', ai: 'Minutes and money per take' },
  { row: 'What you art-direct', key: 'Everything', phys: 'Inputs and limits, not the result', proc: 'The rules and their ranges', ai: 'The words and the first frame' },
];

export interface ShotElement { id: string; label: string; detail: string; accept: BucketId[]; best: BucketId; why: string }

export const ELEMENTS: readonly ShotElement[] = [
  { id: 'hero', label: 'Hero acting beat', detail: 'Close-up: Pip realises the crate is too high', accept: ['key'], best: 'key', why: 'The story lives in this beat. Only an animator can place the thought, the hesitation and the look on the exact frames the director wants.' },
  { id: 'crowd', label: 'Crowd walk cycles', detail: '200 villagers crossing the square', accept: ['proc'], best: 'proc', why: 'Nobody keys 200 walks. Rules pick cycles, avoid collisions and vary each extra with a seed; animators key the few cycles the rules choose from.' },
  { id: 'cape', label: 'Cape in the wind', detail: 'On the hero, all through the chase', accept: ['hybrid', 'phys'], best: 'hybrid', why: 'Cloth is simulated, then art-directed: the sim does the folds, an animator keys or pins the hero silhouettes the shot needs. Pure sim is acceptable; pure keys rarely look right.' },
  { id: 'splash', label: 'The splash', detail: 'A bucket of water tips over', accept: ['phys', 'hybrid'], best: 'phys', why: 'Fluids are where physics earns its keep: thousands of droplets nobody could pose. Directors shape it with the inputs (and sometimes keyed guide shapes).' },
  { id: 'birds', label: 'Background birds', detail: 'A flock wheeling over the rooftops', accept: ['proc'], best: 'proc', why: 'Flocking is the classic procedural rule set: separate, align, cohere. Cheap, endless and never a distraction.' },
  { id: 'stunt', label: 'Stunt fall', detail: 'A guard tumbles down the stairs', accept: ['hybrid', 'phys'], best: 'hybrid', why: 'Key the start and the landing pose for story, let a ragdoll do the tumble in between, then clean up. All-sim works if the result happens to read.' },
  { id: 'pitch', label: 'Pitch mood clip', detail: 'A five-second vibe for Friday’s pitch', accept: ['ai'], best: 'ai', why: 'Speed over control: nobody will hold it to frame-accurate timing or a model sheet, and it will be thrown away. That is where AI synthesis shines today.' },
];

export type Assignments = Partial<Record<string, BucketId>>;

export function score(a: Assignments) {
  const results = ELEMENTS.map((e) => ({ id: e.id, placed: a[e.id] ?? null, ok: a[e.id] ? e.accept.includes(a[e.id]!) : false }));
  const placed = results.filter((r) => r.placed).length;
  const correct = results.filter((r) => r.ok).length;
  return { results, placed, correct, total: ELEMENTS.length, solved: correct === ELEMENTS.length };
}
