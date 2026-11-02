import features from './features.json';

/**
 * Voice, face and staging are three separate directing choices. Each maps to an emotion family; the
 * coherence rules below say how an audience reads the combination. They are authored rules of thumb
 * from acting and animation practice (see docs/labs/voice-direction.md), not a model of perception.
 */

export type Family = 'flat' | 'joy' | 'irony' | 'fear' | 'anger' | 'sorrow';
export type TakeId = 'neutral' | 'excited' | 'sarcastic' | 'nervous' | 'frustrated' | 'disappointed';
export type FaceId = 'neutral' | 'bright' | 'smirk' | 'worried' | 'tight' | 'downcast';
export type StagingId = 'square' | 'leanIn' | 'turnAway' | 'shrinkBack';
export type Distance = 'near' | 'far';

export const LINE = "Oh, that's just great.";
export const KEYWORD = 'great';

export interface TakeFeatures {
  take: string; duration: number; leadIn: number; speechEnd: number; f0Median: number; f0Range: number;
  loudnessDb: number; pauseBeforeGreat: number; greatF0Trend: number; wordsPerSecond: number; longestGap: number;
}
export const FEATURES = features.takes as Record<TakeId, TakeFeatures>;

export interface Take { id: TakeId; label: string; family: Family; /** How the delivery is built, in plain words, from the measurements. */ ear: string }
export const TAKES: readonly Take[] = [
  { id: 'neutral', label: 'Neutral', family: 'flat', ear: 'Narrowest melody of the six (91 Hz of pitch range) and even spacing: information, no attitude.' },
  { id: 'excited', label: 'Excited', family: 'joy', ear: 'Highest pitch (262 Hz median), loudest, quick, and “great” sweeps down from a peak: a real burst.' },
  { id: 'sarcastic', label: 'Sarcastic', family: 'irony', ear: 'A 0.54 s beat before “great”, then the word lands flat. The irony is in the delay, not in loudness.' },
  { id: 'nervous', label: 'Nervous', family: 'fear', ear: 'Slowest pace (1.6 words a second), gaps up to 0.6 s, and “great” rises like a question.' },
  { id: 'frustrated', label: 'Frustrated', family: 'anger', ear: 'Fastest pace and loud, with the widest pitch swings: clipped and pushed.' },
  { id: 'disappointed', label: 'Disappointed', family: 'sorrow', ear: 'Lowest and quietest, 1.2 s of silence before “Oh”, and “great” falls away.' },
];
export const take = (id: TakeId) => TAKES.find((t) => t.id === id)!;

/**
 * Face recipes in the face-rig channels (see faceRig.ts): eyes py = wide, eyes sy = −lids,
 * brows py = raise, brows rz = +sad / −angry, mouth py = smile. `mouth` scales the speech mouth and
 * `head` adds a held head pitch (degrees, + = down).
 */
export interface Face { id: FaceId; label: string; family: Family; hint: string; wide: number; lids: number; brows: number; tilt: number; smile: number; mouth: number; head: number; blinkEvery: number }
export const FACES: readonly Face[] = [
  { id: 'neutral', label: 'Neutral', family: 'flat', hint: 'relaxed, nothing given away', wide: 0, lids: 0, brows: 0, tilt: 0, smile: 0, mouth: 1, head: 0, blinkEvery: 2.6 },
  { id: 'bright', label: 'Bright', family: 'joy', hint: 'brows up, eyes open, smiling', wide: 0.35, lids: 0, brows: 0.6, tilt: 0, smile: 0.85, mouth: 1.1, head: -3, blinkEvery: 2.8 },
  { id: 'smirk', label: 'Smirk', family: 'irony', hint: 'heavy lids, a small held smile', wide: 0, lids: 0.42, brows: 0.15, tilt: -0.12, smile: 0.4, mouth: 0.8, head: -4, blinkEvery: 3.4 },
  { id: 'worried', label: 'Worried', family: 'fear', hint: 'brows up and pinched, eyes wide', wide: 0.45, lids: 0, brows: 0.65, tilt: 0.6, smile: 0, mouth: 0.9, head: 3, blinkEvery: 1.2 },
  { id: 'tight', label: 'Tight', family: 'anger', hint: 'brows down, jaw held', wide: 0.1, lids: 0.18, brows: 0, tilt: -0.75, smile: 0, mouth: 0.55, head: 2, blinkEvery: 4.2 },
  { id: 'downcast', label: 'Downcast', family: 'sorrow', hint: 'brows sad, lids low, head down', wide: 0, lids: 0.45, brows: 0.2, tilt: 0.55, smile: 0, mouth: 0.75, head: 11, blinkEvery: 2.2 },
];
export const face = (id: FaceId) => FACES.find((f) => f.id === id)!;

/**
 * Bram's blocking. yaw: body turn from facing the lens toward Pip (+). headYaw turns the head back
 * toward Pip. lean: torso pitch (+ forward). step: metres toward (+) or away from (−) Pip.
 */
export interface Staging { id: StagingId; label: string; hint: string; yaw: number; headYaw: number; lean: number; step: number; shoulders: number }
export const STAGINGS: readonly Staging[] = [
  { id: 'square', label: 'Square off', hint: 'faces Pip, upright', yaw: 42, headYaw: 8, lean: 0, step: 0, shoulders: 0 },
  { id: 'leanIn', label: 'Lean in', hint: 'closes the gap, chest forward', yaw: 50, headYaw: 6, lean: 12, step: 0.22, shoulders: 0 },
  { id: 'turnAway', label: 'Turn away', hint: 'body turned off, line over the shoulder', yaw: -38, headYaw: 46, lean: 0, step: 0, shoulders: 0 },
  { id: 'shrinkBack', label: 'Shrink back', hint: 'steps back, shoulders up', yaw: 26, headYaw: 6, lean: -7, step: -0.22, shoulders: 1 },
];
export const staging = (id: StagingId) => STAGINGS.find((s) => s.id === id)!;

/** How well each staging supports an emotion read: +1 reinforces, 0 neutral, −1 undercuts. */
const STAGING_FIT: Record<Family, Record<StagingId, -1 | 0 | 1>> = {
  flat: { square: 0, leanIn: 0, turnAway: 0, shrinkBack: 0 },
  joy: { square: 1, leanIn: 1, turnAway: -1, shrinkBack: -1 },
  irony: { square: 0, leanIn: 0, turnAway: 1, shrinkBack: -1 },
  fear: { square: 0, leanIn: -1, turnAway: 0, shrinkBack: 1 },
  anger: { square: 1, leanIn: 1, turnAway: 0, shrinkBack: -1 },
  sorrow: { square: 0, leanIn: 0, turnAway: 1, shrinkBack: 1 },
};
/** What a flat take with neutral face reads as, from staging alone. */
const STAGING_ALONE: Record<StagingId, { family: Family; read: string }> = {
  square: { family: 'flat', read: 'Plain statement' },
  leanIn: { family: 'flat', read: 'Earnest, a little pointed' },
  turnAway: { family: 'irony', read: 'Dismissive' },
  shrinkBack: { family: 'fear', read: 'Uneasy' },
};

export type Kind = 'matched' | 'subtext' | 'mixed';
export interface Reading { kind: Kind; family: Family; read: string; why: string; stagingFit: -1 | 0 | 1 }

/** Voice × face → the read before staging. Keys are `${voice}:${face}` families. */
const PAIRS: Partial<Record<`${Family}:${Family}`, Omit<Reading, 'stagingFit'>>> = {
  'joy:joy': { kind: 'matched', family: 'joy', read: 'Genuine delight', why: 'Voice and face say the same thing, so the words mean what they say.' },
  'irony:irony': { kind: 'matched', family: 'irony', read: 'Open sarcasm', why: 'The beat before “great” and the knowing face agree: the words mean their opposite.' },
  'fear:fear': { kind: 'matched', family: 'fear', read: 'Anxious', why: 'Rising “great” and a worried face: he is asking, not stating.' },
  'anger:anger': { kind: 'matched', family: 'anger', read: 'Angry', why: 'Clipped, loud and tight-faced: “great” is an accusation.' },
  'sorrow:sorrow': { kind: 'matched', family: 'sorrow', read: 'Let down', why: 'Low, quiet, falling, with a downcast face: the hope has gone out of it.' },
  'flat:flat': { kind: 'matched', family: 'flat', read: 'Plain statement', why: 'Nothing in voice or face colours the words, so staging and context decide.' },
  // A flat voice lets the face set the meaning: deadpan.
  'flat:joy': { kind: 'subtext', family: 'joy', read: 'Quiet pleasure', why: 'The voice gives nothing, the face gives it away: understated, private delight.' },
  'flat:irony': { kind: 'subtext', family: 'irony', read: 'Dry sarcasm', why: 'A flat voice under a knowing face is deadpan: the face tells us the words are a joke.' },
  'flat:fear': { kind: 'subtext', family: 'fear', read: 'Quiet worry', why: 'He keeps the voice level, but the face shows the worry he is holding down.' },
  'flat:anger': { kind: 'subtext', family: 'anger', read: 'Suppressed anger', why: 'A level voice over a tight face reads as anger under control: tense, and more threatening than shouting.' },
  'flat:sorrow': { kind: 'subtext', family: 'sorrow', read: 'Resigned', why: 'Flat voice, downcast face: he has given up arguing.' },
  // A neutral face lets the voice lead: a poker face.
  'joy:flat': { kind: 'subtext', family: 'joy', read: 'Cheerful, held in', why: 'The voice is delighted but the face stays still, so it reads as contained or polite.' },
  'irony:flat': { kind: 'subtext', family: 'irony', read: 'Deadpan sarcasm', why: 'A straight face with a sarcastic delivery is the classic deadpan: the timing does the work.' },
  'fear:flat': { kind: 'subtext', family: 'fear', read: 'Covering nerves', why: 'The voice wobbles while the face tries to stay calm: he is hiding it, badly.' },
  'anger:flat': { kind: 'subtext', family: 'anger', read: 'Cold anger', why: 'A pushed voice behind a blank face reads colder than both together.' },
  'sorrow:flat': { kind: 'subtext', family: 'sorrow', read: 'Putting a brave face on it', why: 'The voice is sad; the face refuses to show it.' },
  // A positive voice under a negative face: masking.
  'joy:irony': { kind: 'subtext', family: 'irony', read: 'Sarcasm, played big', why: 'An over-bright voice with a knowing face: he is performing enthusiasm he does not feel.' },
  'joy:sorrow': { kind: 'subtext', family: 'sorrow', read: 'Forced cheer', why: 'The voice says delighted, the face says crushed. Audiences believe the face: he is masking.' },
  'joy:anger': { kind: 'subtext', family: 'anger', read: 'Through gritted teeth', why: 'Bright words and a bright voice through a tight face: fury being smiled through.' },
  'joy:fear': { kind: 'subtext', family: 'fear', read: 'Nervous cheer', why: 'An eager voice over worried eyes: he wants it to be fine and is not sure it is.' },
  'irony:joy': { kind: 'subtext', family: 'joy', read: 'Teasing', why: 'Sarcastic timing with a real smile is affectionate ribbing, not a jab.' },
  'sorrow:joy': { kind: 'subtext', family: 'sorrow', read: 'Smiling through it', why: 'A sad voice under a smile: he is being kind about bad news.' },
  'anger:irony': { kind: 'matched', family: 'irony', read: 'Bitter sarcasm', why: 'Anger in the voice, contempt in the face: sarcasm with an edge.' },
  'irony:anger': { kind: 'matched', family: 'irony', read: 'Bitter sarcasm', why: 'The sarcastic beat plus a tight face sharpens the joke into a jab.' },
  'sorrow:irony': { kind: 'subtext', family: 'irony', read: 'Wry', why: 'A deflated voice with a knowing look: rueful, laughing at his own luck.' },
  'irony:sorrow': { kind: 'subtext', family: 'sorrow', read: 'Rueful', why: 'Sarcastic timing on a downcast face turns the joke on himself.' },
  'fear:sorrow': { kind: 'matched', family: 'sorrow', read: 'Dread', why: 'Worried voice, downcast face: neighbours on the emotion map, so they read as one feeling.' },
  'sorrow:fear': { kind: 'matched', family: 'fear', read: 'Dread', why: 'Sad voice, worried face: close enough to read as one feeling.' },
  'anger:sorrow': { kind: 'subtext', family: 'sorrow', read: 'Hurt', why: 'Anger in the voice, sadness in the face: the anger is covering hurt.' },
  'sorrow:anger': { kind: 'subtext', family: 'anger', read: 'Smouldering', why: 'A low voice with a hard face: quiet resentment.' },
};
/** Pairs not listed contradict on energy and valence: excited voice with worried face reads, but anger with fear does not. */
const MIXED: Omit<Reading, 'stagingFit'> = { kind: 'mixed', family: 'flat', read: 'Mixed signals', why: 'Voice and face pull in opposite directions with no single story that explains both, so the audience is unsure what he feels.' };

export function readCombo(voice: TakeId, faceId: FaceId, stagingId: StagingId): Reading {
  const v = take(voice).family, f = face(faceId).family;
  let base = PAIRS[`${v}:${f}`] ?? MIXED;
  if (v === 'flat' && f === 'flat') {
    const alone = STAGING_ALONE[stagingId];
    base = { ...base, family: alone.family, read: alone.read, why: stagingId === 'square' ? base.why : `With voice and face neutral, the blocking carries the meaning: ${staging(stagingId).hint} reads as ${alone.read.toLowerCase()}.` };
    return { ...base, kind: stagingId === 'square' ? 'matched' : 'subtext', stagingFit: stagingId === 'square' ? 0 : 1 };
  }
  const fit = base.kind === 'mixed' ? 0 : STAGING_FIT[base.family][stagingId];
  if (fit >= 0) return { ...base, stagingFit: fit, why: fit > 0 ? `${base.why} The blocking (${staging(stagingId).label.toLowerCase()}) backs it up.` : base.why };
  // Blocking that undercuts the read adds a layer: matched becomes subtext, subtext becomes mixed.
  const s = staging(stagingId).label.toLowerCase();
  if (base.kind === 'matched') return { ...base, kind: 'subtext', stagingFit: -1, read: `${base.read}, held back`, why: `${base.why} But the body (${s}) disagrees, so it reads as something he is not fully committing to.` };
  return { ...MIXED, stagingFit: -1, why: `Voice and face already disagree, and the body (${s}) adds a third story. Three channels, three meanings: the audience stops reading him.` };
}

/** Each reading's playable intention: an actable verb, not a result. */
export const INTENTION: Record<Family, { verb: string; result: string }> = {
  flat: { verb: 'to report it', result: 'be neutral' },
  joy: { verb: 'to share the win', result: 'be happy' },
  irony: { verb: 'to needle him', result: 'be sarcastic' },
  fear: { verb: 'to check it is all right', result: 'be nervous' },
  anger: { verb: 'to make him pay for it', result: 'be angry' },
  sorrow: { verb: 'to let it go', result: 'be sad' },
};

export interface Picks { voice: TakeId; face: FaceId; staging: StagingId; distance: Distance; pause: number; rate: number; reaction: number; overlap: boolean }

/** A direction note for a voice actor or TTS, plus the animator's notes, generated from the picks. */
export function directionNote(p: Picks): string {
  const r = readCombo(p.voice, p.face, p.staging);
  const f = FEATURES[p.voice], fc = face(p.face), st = staging(p.staging);
  const intention = INTENTION[r.family];
  const pace = p.rate < 0.97 ? `a touch slower (${p.rate.toFixed(2)}×)` : p.rate > 1.03 ? `a touch quicker (${p.rate.toFixed(2)}×)` : 'at the recorded pace';
  return [
    `Line: “${LINE}” — reads as ${r.read.toLowerCase()} (${r.kind === 'mixed' ? 'mixed signals' : r.kind}).`,
    `Intention: ${intention.verb}. (Not “${intention.result}”: give the actor a verb to play, not a result.)`,
    `Voice: the ${take(p.voice).label.toLowerCase()} read, ${pace}; ${f.pauseBeforeGreat >= 0.4 ? `keep the ${f.pauseBeforeGreat.toFixed(2)} s beat before “great”` : `“great” lands ${f.greatF0Trend > 40 ? 'rising' : f.greatF0Trend < -40 ? 'falling' : 'level'}`}.`,
    `Timing: ${p.pause > 0.05 ? `hold ${p.pause.toFixed(1)} s before he speaks` : 'he speaks straight away'}; Pip reacts ${p.reaction.toFixed(2)} s after ${p.overlap ? '“great” begins, overlapping the end of the line' : 'the line ends'}.`,
    `Face: ${fc.label.toLowerCase()} (${fc.hint}). Blocking: ${st.label.toLowerCase()}, ${st.hint}, ${p.distance === 'near' ? 'close' : 'at a distance'}.`,
  ].join('\n');
}
