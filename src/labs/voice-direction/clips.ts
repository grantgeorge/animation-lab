import type { Clip, Ease, Key, Track } from '@/scene/animation/dsl';
import { restArms } from '@/scene/animation/performances/arms';
import { face, staging, type Family, type FaceId, type StagingId, type TakeId } from './direction';
import { envelopeAt, mouthOpen, type Schedule } from './timing';

/**
 * The two performances, rebuilt from the picks. Times are scene seconds from the start of the shot.
 * Bram's attitude (face, posture) is held for the whole shot: it is blocking, not a reaction. His jaw
 * follows the take's loudness envelope; a beat nod lands on “great”. Pip listens, then reacts at
 * `reactionStart` with whatever the combination reads as.
 */

type K = [number, number, Ease?];
const tr = (part: string, ch: Track['ch'], keys: K[]): Track => ({ part, ch, keys: keys.map(([t, v, e]) => [Math.max(0, +t.toFixed(4)), v, e ?? 'inOut'] as Key) });
const hold = (part: string, ch: Track['ch'], v: number, total: number) => tr(part, ch, [[0, v], [total, v, 'hold']]);

/** Blinks every `every` seconds on top of a lid level, plus one punctuating blink after the keyword. */
function blinks(lids: number, every: number, total: number, extra: number[] = []): Track {
  const at = new Set<number>();
  for (let t = 0.55; t < total - 0.3; t += every) at.add(+t.toFixed(3));
  for (const e of extra) if (e > 0.2 && e < total - 0.3) at.add(+e.toFixed(3));
  const times = [...at].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.3);
  const keys: K[] = [[0, -lids]];
  for (const t of times) keys.push([t, -lids, 'hold'], [t + 0.05, -0.95, 'in'], [t + 0.09, -0.95, 'hold'], [t + 0.16, -lids, 'out']);
  keys.push([total, -lids, 'hold']);
  return tr('eyes', 'sy', keys);
}

/** Voice energy (0..1) from the delivery: how big the beat on “great” is. */
const ENERGY: Record<TakeId, number> = { neutral: 0.25, excited: 1, sarcastic: 0.45, nervous: 0.35, frustrated: 0.9, disappointed: 0.15 };

export function bramClip(voice: TakeId, faceId: FaceId, stagingId: StagingId, s: Schedule, rate: number): Clip {
  const f = face(faceId), st = staging(stagingId), total = s.total;
  const jaw: K[] = [[0, 0]];
  for (let t = Math.max(0, s.lineStart - 0.04); t <= s.audioEnd + 0.05; t += 1 / 30) jaw.push([t, mouthOpen(envelopeAt(voice, s, rate, t), f.mouth), 'linear']);
  jaw.push([total, 0, 'inOut']);
  const beat = 2 + 6 * ENERGY[voice];
  const head = f.head + (stagingId === 'shrinkBack' ? 4 : 0);
  const tracks: Track[] = [
    ...restArms(total, stagingId === 'shrinkBack' ? { swing: -16, elbow: -44 } : stagingId === 'leanIn' ? { swing: -9, elbow: -22 } : {}),
    hold('torso', 'rx', st.lean, total),
    hold('head', 'ry', st.headYaw, total),
    tr('head', 'rx', [[0, head], [s.keyStart - 0.08, head, 'hold'], [s.keyStart + 0.1, head + beat, 'out'], [s.keyEnd + 0.25, head, 'inOut'], [total, head, 'hold']]),
    hold('shoulderL', 'rz', 9 * st.shoulders, total),
    hold('shoulderR', 'rz', -9 * st.shoulders, total),
    hold('brows', 'py', f.brows, total),
    hold('brows', 'rz', f.tilt, total),
    hold('mouth', 'py', f.smile, total),
    hold('eyes', 'py', f.wide, total),
    blinks(f.lids, f.blinkEvery, total, [s.keyEnd + 0.12]),
    tr('mouth', 'sy', jaw),
  ];
  return { character: 'bram', tracks };
}

/** Pip's reaction to each read: face channels, head and body, as targets eased in over a quarter second. */
interface React { smile: number; brows: number; tilt: number; wide: number; lids: number; jaw: number; headRx: number; headRz: number; lean: number; step: number; hop: number; arms: number }
const NONE: React = { smile: 0, brows: 0, tilt: 0, wide: 0, lids: 0, jaw: 0, headRx: 0, headRz: 0, lean: 0, step: 0, hop: 0, arms: 0 };
export type ReactionId = Family | 'mixed';
export const REACTIONS: Record<ReactionId, { label: string; r: React }> = {
  joy: { label: 'lights up', r: { ...NONE, smile: 1, brows: 0.75, wide: 0.45, jaw: 0.35, headRx: -6, hop: 0.05, arms: 1 } },
  irony: { label: 'deflates', r: { ...NONE, brows: 0.25, tilt: 0.6, lids: 0.25, headRx: 12, lean: -4, step: -0.06 } },
  anger: { label: 'flinches', r: { ...NONE, brows: 0.55, tilt: 0.35, wide: 0.75, jaw: 0.15, headRx: -4, lean: -9, step: -0.12 } },
  fear: { label: 'catches the worry', r: { ...NONE, brows: 0.65, tilt: 0.55, wide: 0.5, headRz: 9, lean: -3 } },
  sorrow: { label: 'softens, steps in', r: { ...NONE, brows: 0.35, tilt: 0.5, headRz: 13, headRx: 5, lean: 4, step: 0.08 } },
  flat: { label: 'waits for more', r: { ...NONE, brows: 0.35, headRz: 7 } },
  mixed: { label: 'is puzzled', r: { ...NONE, brows: 0.6, tilt: 0.15, wide: 0.2, jaw: 0.18, headRz: 17, headRx: -3 } },
};

export function pipClip(reaction: ReactionId, s: Schedule): Clip {
  const r = REACTIONS[reaction].r, total = s.total, t0 = s.reactionStart, t1 = t0 + 0.24;
  /** Listening level → reaction level. */
  const ramp = (part: string, ch: Track['ch'], listen: number, to: number, e: Ease = 'out') => tr(part, ch, [[0, listen], [t0, listen, 'hold'], [t1, to, e], [total, to, 'hold']]);
  const tracks: Track[] = [
    ...restArms(total, { elbow: -12 }),
    ramp('upperArmL', 'rz', 0, 14 * r.arms), ramp('upperArmR', 'rz', 0, -14 * r.arms),
    ramp('forearmL', 'rx', 0, -30 * r.arms), ramp('forearmR', 'rx', 0, -30 * r.arms),
    hold('head', 'ry', -10, total),
    ramp('head', 'rz', 5, 5 + r.headRz),
    ramp('head', 'rx', 0, r.headRx),
    ramp('torso', 'rx', 0, r.lean),
    ramp('root', 'pz', 0, r.step, 'inOut'),
    tr('root', 'py', r.hop ? [[0, 0], [t0 + 0.08, 0, 'hold'], [t0 + 0.2, r.hop, 'out'], [t0 + 0.34, 0, 'in'], [total, 0, 'hold']] : [[0, 0], [total, 0, 'hold']]),
    ramp('brows', 'py', 0.18, r.brows), ramp('brows', 'rz', 0, r.tilt),
    ramp('eyes', 'py', 0.08, r.wide), ramp('mouth', 'py', 0.15, r.smile), ramp('mouth', 'sy', 0, r.jaw),
    blinks(0, 2.4, total, [t0 + 0.02, ...(reaction === 'mixed' ? [t0 + 0.42] : [])]),
  ];
  // Lids lower only after the reaction: re-key the blink track's level.
  if (r.lids) {
    const b = tracks[tracks.length - 1];
    tracks[tracks.length - 1] = { ...b, keys: b.keys.map(([t, v, e]) => [t, t > t1 && v === 0 ? -r.lids : v, e] as Key) };
  }
  return { character: 'pip', tracks };
}
