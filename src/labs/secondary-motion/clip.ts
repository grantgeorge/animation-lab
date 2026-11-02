import type { Channel, Clip, Ease, Key, Track } from '@/scene/animation/dsl';

/**
 * "Hop and stop": Pip's primary action. He turns to his right, crouches, bounds 1.8 m across the
 * stage and stops dead on landing, holds, then does the same back to the left. Every appendage is
 * a passenger: whatever it does after each stop is secondary motion.
 */
export const DURATION = 6;
const HOP = 2.3; // the return hop is the first one, shifted and mirrored
export const TRAVEL = 0.9;

/** Seconds of each move, for measuring: take-off, the stop on landing, and the end of the hold. */
export const MOVES = [
  { id: 'right', start: 1.0, stop: 1.6, end: 2.85 },
  { id: 'left', start: 1.0 + HOP, stop: 1.6 + HOP, end: 2.85 + HOP },
] as const;

type K = [number, number, Ease?];
const tr = (part: string, ch: Channel, keys: K[]): Track => ({ part, ch, keys: keys as Key[] });
const end = (v = 0): K => [DURATION, v, 'inOut'];

/** One hop's keys starting at t0, travelling `dir` (+1 right, −1 left). */
function hop(t0: number): Record<string, K[]> {
  const t = (s: number) => t0 + s;
  return {
    py: [[t(-0.05), 0, 'hold'], [t(0.1), -0.05, 'inOut'], [t(0.33), 0.24, 'out'], [t(0.56), 0, 'in'], [t(0.66), -0.07, 'out'], [t(0.98), 0, 'inOut']],
    thigh: [[t(-0.05), 0, 'hold'], [t(0.1), -32, 'inOut'], [t(0.22), 6, 'out'], [t(0.4), -24, 'inOut'], [t(0.56), -10, 'inOut'], [t(0.66), -34, 'out'], [t(0.98), 0, 'inOut']],
    shin: [[t(-0.05), 0, 'hold'], [t(0.1), 55, 'inOut'], [t(0.22), 4, 'out'], [t(0.4), 40, 'inOut'], [t(0.56), 18, 'inOut'], [t(0.66), 60, 'out'], [t(0.98), 0, 'inOut']],
    torso: [[t(-0.05), 0, 'hold'], [t(0.1), 16, 'inOut'], [t(0.25), -8, 'out'], [t(0.56), 4, 'inOut'], [t(0.66), 14, 'out'], [t(0.98), 0, 'inOut']],
    head: [[t(-0.05), 0, 'hold'], [t(0.1), -8, 'inOut'], [t(0.3), 4, 'out'], [t(0.66), -6, 'out'], [t(0.98), 0, 'inOut']],
    arm: [[t(-0.05), 0, 'hold'], [t(0.1), 32, 'inOut'], [t(0.3), -55, 'out'], [t(0.56), -30, 'inOut'], [t(0.7), -12, 'out'], [t(1.0), 0, 'inOut']],
    fore: [[t(-0.05), -10, 'hold'], [t(0.1), -20, 'inOut'], [t(0.3), -40, 'out'], [t(0.7), -18, 'out'], [t(1.0), -10, 'inOut']],
  };
}

const h1 = hop(1.0), h2 = hop(1.0 + HOP);
const join = (a: K[], b: K[], first: K, last: K): K[] => [first, ...a, ...b, last];

export const hopClip: Clip = {
  character: 'pip',
  tracks: [
    // Facing: front, then his right for the first hop, his left for the return, then front again.
    tr('root', 'ry', [[0, 0], [0.55, 0, 'hold'], [0.9, 80, 'inOut'], [2.85, 80, 'hold'], [3.2, -80, 'inOut'], [5.15, -80, 'hold'], [5.6, 0, 'inOut'], end()]),
    // Travel: a fast bound and a dead stop on landing.
    tr('root', 'px', [[0, -TRAVEL], [1.1, -TRAVEL, 'hold'], [1.18, -TRAVEL + 0.12, 'in'], [1.5, TRAVEL - 0.12, 'linear'], [1.58, TRAVEL, 'out'],
      [1.1 + HOP, TRAVEL, 'hold'], [1.18 + HOP, TRAVEL - 0.12, 'in'], [1.5 + HOP, -TRAVEL + 0.12, 'linear'], [1.58 + HOP, -TRAVEL, 'out'], end(-TRAVEL)]),
    tr('root', 'py', join(h1.py, h2.py, [0, 0], end())),
    tr('thighL', 'rx', join(h1.thigh, h2.thigh, [0, 0], end())),
    tr('thighR', 'rx', join(h1.thigh, h2.thigh, [0, 0], end())),
    tr('shinL', 'rx', join(h1.shin, h2.shin, [0, 0], end())),
    tr('shinR', 'rx', join(h1.shin, h2.shin, [0, 0], end())),
    tr('torso', 'rx', join(h1.torso, h2.torso, [0, 0], end())),
    tr('head', 'rx', join(h1.head, h2.head, [0, 0], end())),
    tr('upperArmL', 'rx', join(h1.arm, h2.arm, [0, 0], end())),
    tr('upperArmR', 'rx', join(h1.arm, h2.arm, [0, 0], end())),
    tr('forearmL', 'rx', join(h1.fore, h2.fore, [0, -10], end(-10))),
    tr('forearmR', 'rx', join(h1.fore, h2.fore, [0, -10], end(-10))),
    // A look toward camera while he waits, and a blink in each hold.
    tr('head', 'ry', [[0, 0], [2.0, 0, 'hold'], [2.3, -22, 'inOut'], [2.75, 0, 'inOut'], [4.3, 0, 'hold'], [4.6, 22, 'inOut'], [5.05, 0, 'inOut'], end()]),
    tr('eyes', 'sy', [[0, 0], [0.3, 0, 'hold'], [0.35, -0.92, 'in'], [0.38, -0.92, 'hold'], [0.44, 0, 'out'], [2.1, 0, 'hold'], [2.15, -0.92, 'in'], [2.18, -0.92, 'hold'], [2.24, 0, 'out'], end()]),
    tr('mouth', 'py', [[0, 0.35], end(0.35)]),
  ],
};

/** Standing still for the drag mode: only breath and a blink, so the hand on the mouse is the primary. */
export const idleClip: Clip = {
  character: 'pip',
  tracks: [
    tr('torso', 'rx', [[0, 0], [1.5, 1.5, 'inOut'], [3, 0, 'inOut'], [4.5, 1.5, 'inOut'], end()]),
    tr('forearmL', 'rx', [[0, -10], end(-10)]),
    tr('forearmR', 'rx', [[0, -10], end(-10)]),
    tr('eyes', 'sy', [[0, 0], [2.4, 0, 'hold'], [2.45, -0.92, 'in'], [2.48, -0.92, 'hold'], [2.54, 0, 'out'], end()]),
    tr('mouth', 'py', [[0, 0.35], end(0.35)]),
  ],
};
