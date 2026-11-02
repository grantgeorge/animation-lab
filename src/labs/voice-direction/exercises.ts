import { readCombo, type Picks } from './direction';
import { LISTEN_WINDOW, reactionVerdict } from './timing';

export interface Check { label: string; ok: boolean }
export interface Exercise { id: string; title: string; task: string; setup: Partial<Picks>; checks: (p: Picks) => Check[]; insight: string }

export const EXERCISES: readonly Exercise[] = [
  {
    id: 'sarcasm',
    title: 'Sarcasm without the sarcastic take',
    task: 'Bram means it: delighted voice, bright face. Make “great” mean its opposite, but you may not use the sarcastic recording.',
    setup: { voice: 'excited', face: 'bright', staging: 'square' },
    checks: (p) => {
      const r = readCombo(p.voice, p.face, p.staging);
      return [
        { label: 'Not the sarcastic take', ok: p.voice !== 'sarcastic' },
        { label: 'Reads as sarcasm', ok: r.family === 'irony' },
        { label: 'One clear meaning, not mixed signals', ok: r.kind !== 'mixed' },
      ];
    },
    insight: 'Sarcasm is a contradiction between the words and everything else. The words “that’s just great” are positive, so any channel that disagrees with them (a smirk, turning away, a flat voice under a knowing face) flips the meaning. Deadpan, a flat voice with the face doing the work, is often the driest version.',
  },
  {
    id: 'tense',
    title: 'Make the neutral take tense',
    task: 'Keep the neutral recording exactly as it is. Using only the face and the blocking, make the line feel tense.',
    setup: { voice: 'neutral', face: 'neutral', staging: 'square', distance: 'near' },
    checks: (p) => {
      const r = readCombo(p.voice, p.face, p.staging);
      return [
        { label: 'Neutral take', ok: p.voice === 'neutral' },
        { label: 'Reads as anger or fear held in', ok: r.family === 'anger' || r.family === 'fear' },
        { label: 'One clear meaning', ok: r.kind !== 'mixed' },
      ];
    },
    insight: 'Tension is energy being held back. A level voice over a tight face reads as more dangerous than shouting, because the audience watches him hold it in. Animators lean on this constantly: the same dialogue track can carry very different scenes when the face and body change.',
  },
  {
    id: 'reaction',
    title: 'Make Pip’s reaction land',
    task: 'Pip reacts on top of the line, as if he knew it was coming. Set the reaction delay so he is visibly listening, then play it.',
    setup: { reaction: 0, overlap: false, voice: 'sarcastic', face: 'smirk', staging: 'turnAway' },
    checks: (p) => {
      const [lo, hi] = p.overlap ? LISTEN_WINDOW.overlap : LISTEN_WINDOW.after;
      const v = reactionVerdict(p.reaction, p.overlap);
      return [
        { label: `Not before the line lands (≥ ${lo.toFixed(2)} s)`, ok: v !== 'early' },
        { label: `No dead air (≤ ${hi.toFixed(2)} s)`, ok: v !== 'late' },
      ];
    },
    insight: 'A listener needs a beat to take the meaning in: roughly a fifth to half a second after it lands. React sooner and the character seems to know the script; later and it reads as dead air. Overlap (reacting as “great” lands, before the line has finished) feels more alive, so it tolerates a shorter delay.',
  },
];

export const allOk = (c: Check[]) => c.length > 0 && c.every((x) => x.ok);
