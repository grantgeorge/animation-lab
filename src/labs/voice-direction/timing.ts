import takes from '@/labs/character-acting/takes.json';
import { KEYWORD, type TakeId } from './direction';

/** The published ElevenLabs takes (shared with Character Acting): audio, word stamps and a 60 Hz loudness envelope. */
export interface Word { text: string; start: number; end: number }
export interface TakeAudio { url: string; duration: number; words: Word[]; envelope: { hz: number; values: number[] } }
export const AUDIO = (takes as unknown as { takes: Record<TakeId, TakeAudio> }).takes;

export const LIMITS = { pause: [0, 1.5], rate: [0.85, 1.15], reaction: [0, 1] } as const;
/** How long Pip's reaction plays before the shot ends, and the tail after it. */
export const REACTION_HOLD = 1.7;
export const TAIL = 0.35;

export interface Schedule {
  /** Scene seconds. The line starts after the pause; audio time runs `rate` times faster than its recording. */
  lineStart: number;
  /** End of the last spoken word. */
  lineEnd: number;
  /** End of the audio file (room tone after the last word). */
  audioEnd: number;
  /** Onset and end of the keyword, “great”. */
  keyStart: number;
  keyEnd: number;
  /** When Pip starts reacting, and what it is measured from. */
  reactionStart: number;
  anchor: number;
  words: Word[];
  total: number;
}

export function schedule(id: TakeId, pause: number, rate: number, reaction: number, overlap: boolean): Schedule {
  const a = AUDIO[id];
  const at = (s: number) => pause + s / rate;
  const words = a.words.map((w) => ({ text: w.text, start: at(w.start), end: at(w.end) }));
  const key = words.find((w) => w.text.toLowerCase().startsWith(KEYWORD)) ?? words[words.length - 1];
  const lineEnd = words[words.length - 1].end;
  const anchor = overlap ? key.start : lineEnd;
  const reactionStart = anchor + reaction;
  const audioEnd = at(a.duration);
  return { lineStart: pause, lineEnd, audioEnd, keyStart: key.start, keyEnd: key.end, reactionStart, anchor, words, total: Math.max(audioEnd, reactionStart + REACTION_HOLD) + TAIL };
}

/** Loudness envelope (0..1) at scene time t, or 0 outside the line. Linear between 60 Hz samples. */
export function envelopeAt(id: TakeId, s: Schedule, rate: number, t: number): number {
  const { hz, values } = AUDIO[id].envelope;
  const audioT = (t - s.lineStart) * rate;
  if (audioT < 0) return 0;
  const x = audioT * hz, i = Math.floor(x);
  if (i >= values.length - 1) return 0;
  return values[i] + (values[i + 1] - values[i]) * (x - i);
}

/**
 * Envelope → jaw. A compressive curve (quiet syllables still open the mouth), scaled by the face's
 * mouth gain (a tight face talks through a held jaw), and capped below a full gape.
 */
export function mouthOpen(env: number, gain = 1): number {
  if (env <= 0.02) return 0;
  return Math.min(0.85, Math.pow(env, 0.6) * 0.8 * gain);
}

/** Pip's reaction timing, judged against the moment the line lands. */
export const LISTEN_WINDOW = { overlap: [0.12, 0.5], after: [0.2, 0.6] } as const;
export type ReactionVerdict = 'early' | 'listening' | 'late';
export function reactionVerdict(reaction: number, overlap: boolean): ReactionVerdict {
  const [lo, hi] = overlap ? LISTEN_WINDOW.overlap : LISTEN_WINDOW.after;
  return reaction < lo ? 'early' : reaction > hi ? 'late' : 'listening';
}
