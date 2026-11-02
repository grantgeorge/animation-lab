/** Copy and the AI take's metadata. The AI notes were written after watching the published clip. */

export const PROMISE = 'One small move, Pip hopping down off a crate, made four ways: posed by an animator, thrown by physics, written by rules, and invented by a video model. Change the crate and see which ones keep up, then decide what a director should control.';

export const NOTES = {
  key: 'Every pose is a decision: the look down, the wind-up, the ta-da. It is perfect for the crate it was keyed on and wrong for any other until an animator re-keys it.',
  phys: 'Nobody poses anything. Give the body a push and gravity, springs and dampers do the rest: exact contacts for any crate, and no idea why Pip is jumping.',
  proc: 'A handful of rules read the scene and write the pose. Change the crate and every number re-derives; change the seed and you get another valid take for free.',
  ai: 'A video model invents the whole shot from a first frame and a sentence. Fast and often charming, but you direct it with words, not frames.',
};

export const AI = {
  src: '/labs/procedural-vs-keyframe/ai-hop.mp4',
  poster: '/labs/procedural-vs-keyframe/ai-hop.webp',
  model: 'MiniMax H3 Max · image-to-video · draft tier',
  /** Seconds into the clip that line up with t = 0 on the lab's playhead (aligned by hand on contact). */
  offset: 0,
  cost: '$0.38',
  prompt: '',
  /** Filled in after watching the take. */
  right: [] as string[],
  wrong: [] as string[],
  available: false,
};

export const CHANGE_COST = {
  key: 'Re-key the four heights by hand. The timing and acting survive; the numbers don’t.',
  phys: 'Re-simulated instantly. Nothing to redo.',
  proc: 'Re-derived instantly: deeper crouch, longer look, farther landing.',
  ai: 'Re-prompt and regenerate: about a minute and a few dimes per take, and a different performance each time.',
};
