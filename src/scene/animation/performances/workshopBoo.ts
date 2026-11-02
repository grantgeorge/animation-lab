import type { Key, Performance, Track } from "../dsl";
import { hold, restArms } from "./arms";

/**
 * "workshop-boo", 6.000 s seamless loop. A comic startle in four beats:
 * 1. Bram is hunched over his bench, hammer tapping. 2. The floor hatch behind him creaks open and
 * Pip's head rises into view (the peek). 3. Pip springs up, arms high: BOO. Bram jumps: anticipation
 * squash, a hop, arms fly up, head whips round. 4. Pip laughs; Bram, hand on heart, slumps back to work
 * as Pip sinks out of sight and the hatch shuts.
 * Bram's base pose (head down, arms on the bench) is the start AND end value of his tracks.
 * Pip's root deltas are from his mark on the riser (0.35, 0.55, −3.75); −1.2 m hides him inside it.
 */
const blink = (t: number) =>
  [
    [t, 0, "hold"],
    [t + 0.05, -0.92, "in"],
    [t + 0.08, -0.92, "hold"],
    [t + 0.14, 0, "out"],
  ] as const;

const c = (part: string, ch: Track["ch"], v: number): Track => ({ part, ch, keys: [[0, v], [6, v, "hold"]] });

/** Bram's working pose at the bench, held all loop: arms forward and turned in, elbows bent over the work. */
const benchPose: Track[] = [c("upperArmL", "rx", -25), c("upperArmR", "rx", -25), c("upperArmL", "ry", -25), c("upperArmR", "ry", 25), c("forearmL", "rx", -52), c("forearmR", "rx", -52)];

/** Hammer taps: the right forearm lifts and strikes every `every` s between t0 and t1 (deltas from the bench pose). */
function taps(t0: number, t1: number, every = 0.3): Track[] {
  const f: Key[] = [[t0, 0]];
  const h: Key[] = [[t0, 0]];
  for (let t = t0; t + every <= t1 + 1e-6; t += every) {
    const lift = Number((t + every * 0.6).toFixed(3));
    const hit = Number((t + every).toFixed(3));
    f.push([lift, -26, "out"], [hit, 0, "in"]);
    h.push([lift, -14, "out"], [Number((hit + 0.04).toFixed(3)), 10, "in"], [Number((hit + every * 0.3).toFixed(3)), 0, "out"]);
  }
  return [
    { part: "forearmR", ch: "rx", keys: f },
    { part: "handR", ch: "rx", keys: h.filter(([t]) => t <= t1 + 0.1) },
  ];
}

type FK = [number, number, ("inOut" | "in" | "out" | "hold")?];
/** A face channel track (parts: eyes sy = −blink, eyes py = wide, brows py = up, brows rz = +sad/−angry, mouth py = smile, mouth sy = open). */
const f = (part: "eyes" | "brows" | "mouth", ch: "sy" | "py" | "rz", keys: FK[]) => ({ part, ch, keys: keys.map(([t, v, e]) => [t, v, e ?? "inOut"] as const) });

/** Bram: furrowed concentration, a wide-eyed startle, relief, then back to work. */
const bramFace = [
  f("brows", "rz", [[0, -0.45], [2.85, -0.45, "hold"], [3.0, 0, "out"], [3.6, 0, "hold"], [4.2, 0.6], [5.2, 0.6, "hold"], [5.8, -0.45], [6, -0.45, "hold"]]),
  f("brows", "py", [[0, 0], [2.92, 0, "hold"], [3.05, 1, "out"], [3.6, 0.8], [4.2, 0.35], [5.3, 0.35, "hold"], [5.8, 0], [6, 0, "hold"]]),
  f("eyes", "py", [[0, 0], [2.92, 0, "hold"], [3.05, 1, "out"], [3.6, 0.6], [4.1, 0], [6, 0, "hold"]]),
  f("eyes", "sy", [[0, -0.15], [2.85, -0.15, "hold"], [2.95, 0, "out"], [4.2, 0, "hold"], [4.4, -0.35], [5.1, -0.35, "hold"], [5.6, -0.15], [6, -0.15, "hold"]]),
];
/** Pip: scheming at the peek, an open-mouthed BOO, then a squeezed-eye laugh. */
const pipFace = [
  f("brows", "rz", [[0, -0.6], [2.7, -0.6, "hold"], [2.9, 0, "out"], [3.4, 0, "hold"], [3.7, 0.3], [4.9, 0.3, "hold"], [5.5, -0.6], [6, -0.6, "hold"]]),
  f("brows", "py", [[0, 0], [2.72, 0, "hold"], [2.9, 0.85, "out"], [3.4, 0.6], [3.8, 0.2], [5.2, 0], [6, 0, "hold"]]),
  f("mouth", "py", [[0, 0.6], [2.72, 0.6, "hold"], [2.9, 0.3, "out"], [3.4, 0.3, "hold"], [3.7, 1], [4.9, 1, "hold"], [5.5, 0.6], [6, 0.6, "hold"]]),
  f("mouth", "sy", [[0, 0], [2.72, 0, "hold"], [2.88, 1, "out"], [3.35, 0.9], [3.6, 0.7], [3.8, 0.4], [4.0, 0.7], [4.2, 0.4], [4.4, 0.65], [4.9, 0.3], [5.3, 0], [6, 0, "hold"]]),
  f("eyes", "py", [[0, 0], [2.72, 0, "hold"], [2.9, 0.75, "out"], [3.4, 0.4], [3.6, 0], [6, 0, "hold"]]),
  f("eyes", "sy", [[0, -0.2], [2.7, -0.2, "hold"], [2.85, 0, "out"], [3.45, 0, "hold"], [3.7, -0.6], [4.9, -0.6, "hold"], [5.4, -0.2], [6, -0.2, "hold"]]),
];
export const workshopBoo: Performance = {
  id: "workshop-boo-v1",
  durationS: 6,
  clips: [
    {
      character: "door",
      // the hatch lid, hinged on its far edge: negative rx lifts it toward the back wall
      tracks: [{ part: "leaf", ch: "rx", keys: [[0, 0], [1.3, 0, "hold"], [1.42, -4, "in"], [1.8, -108, "out"], [5.45, -108, "hold"], [5.9, 0, "in"], [6, 0, "hold"]] }],
    },
    {
      character: "bram",
      tracks: [
        { part: "head", ch: "rx", keys: [[0, 20], [2.65, 20, "hold"], [2.85, 26, "in"], [3.08, -10, "out"], [4.3, -6, "inOut"], [5.35, 20, "inOut"], [6, 20, "hold"]] },
        { part: "head", ch: "ry", keys: [[0, 0], [2.1, 0, "hold"], [2.3, 5, "out"], [2.85, 5, "hold"], [3.08, 72, "out"], [4.5, 72, "hold"], [5.3, 0, "inOut"], [6, 0, "hold"]] },
        { part: "torso", ch: "rx", keys: [[0, 10], [2.7, 10, "hold"], [2.9, 18, "in"], [3.1, -12, "out"], [4.4, -4, "inOut"], [5.4, 10, "inOut"], [6, 10, "hold"]] },
        { part: "torso", ch: "ry", keys: [[0, 0], [2.95, 0, "hold"], [3.15, 32, "out"], [4.5, 32, "hold"], [5.35, 0, "inOut"], [6, 0, "hold"]] },
        { part: "root", ch: "py", keys: [[0, 0], [2.88, 0, "hold"], [3.0, -0.04, "in"], [3.16, 0.15, "out"], [3.36, 0, "in"], [3.46, -0.02, "out"], [3.6, 0, "inOut"], [6, 0, "hold"]] },
        { part: "root", ch: "pz", keys: [[0, 0], [2.95, 0, "hold"], [3.2, 0.08, "out"], [5.3, 0.08, "hold"], [5.8, 0, "inOut"], [6, 0, "hold"]] },
        { part: "eyes", ch: "sy", keys: [[0, 0], ...blink(1.1), ...blink(3.6), ...blink(5.1), [6, 0, "hold"]] },
        ...benchPose,
        ...taps(0.3, 2.4),
        ...bramFace,
        // Startle: hands beside the shoulders, palms out. A moderate shoulder lift and twist keep
        // the broad coat's underarms open; the head snap and hop carry the surprise. Then the left
        // hand settles on his chest. All values are deltas from the bench pose.
        { part: "upperArmL", ch: "rz", keys: [[0, 0], [2.95, 0, "hold"], [3.15, 25, "out"], [3.55, 22, "inOut"], [4.0, 5, "inOut"], [5.15, 5, "hold"], [5.75, 0, "inOut"], [6, 0, "hold"]] },
        { part: "upperArmL", ch: "rx", keys: [[0, 0], [2.95, 0, "hold"], [3.15, -10, "out"], [3.55, -8, "inOut"], [4.0, 5, "inOut"], [5.15, 5, "hold"], [5.75, 0, "inOut"], [6, 0, "hold"]] },
        { part: "upperArmL", ch: "ry", keys: [[0, 0], [2.95, 0, "hold"], [3.15, 45, "out"], [3.55, 40, "inOut"], [4.0, -45, "inOut"], [5.15, -45, "hold"], [5.75, 0, "inOut"], [6, 0, "hold"]] },
        { part: "forearmL", ch: "rx", keys: [[0, 0], [2.95, 0, "hold"], [3.15, -45, "out"], [3.55, -40, "inOut"], [4.0, -53, "inOut"], [5.15, -53, "hold"], [5.75, 0, "inOut"], [6, 0, "hold"]] },
        { part: "upperArmR", ch: "rz", keys: [[0, 0], [2.95, 0, "hold"], [3.15, -25, "out"], [3.55, -22, "inOut"], [4.2, -4, "inOut"], [5.2, -4, "hold"], [5.8, 0, "inOut"], [6, 0, "hold"]] },
        { part: "upperArmR", ch: "rx", keys: [[0, 0], [2.95, 0, "hold"], [3.15, -10, "out"], [3.55, -8, "inOut"], [4.2, 22, "inOut"], [5.2, 22, "hold"], [5.8, 0, "inOut"], [6, 0, "hold"]] },
        { part: "upperArmR", ch: "ry", keys: [[0, 0], [2.95, 0, "hold"], [3.15, -45, "out"], [3.55, -40, "inOut"], [4.2, -25, "inOut"], [5.2, -25, "hold"], [5.8, 0, "inOut"], [6, 0, "hold"]] },
        { part: "forearmR", ch: "rx", keys: [[0, 0], [2.95, 0, "hold"], [3.15, -45, "out"], [3.55, -40, "inOut"], [4.2, 38, "inOut"], [5.2, 38, "hold"], [5.8, 0, "inOut"], [6, 0, "hold"]] },
        { part: "handL", ch: "rx", keys: [[0, 0], [2.95, 0, "hold"], [3.1, 25, "out"], [3.35, -10, "inOut"], [3.6, 0, "inOut"], [6, 0, "hold"]] },
      ],
    },
    {
      character: "pip",
      tracks: [
        {
          part: "root",
          ch: "py",
          keys: [[0, -1.2], [1.5, -1.2, "hold"], [2.05, -0.8, "out"], [2.6, -0.8, "hold"], [2.75, -0.86, "in"], [2.95, 0.08, "out"], [3.1, 0, "inOut"], [3.5, 0.035, "out"], [3.7, 0, "in"], [3.9, 0.035, "out"], [4.1, 0, "in"], [4.3, 0.03, "out"], [4.5, 0, "in"], [4.95, 0, "hold"], [5.08, 0.05, "out"], [5.55, -1.2, "in"], [6, -1.2, "hold"]],
        },
        { part: "head", ch: "rx", keys: [[0, -12], [2.6, -12, "hold"], [2.9, 0, "inOut"], [5.0, 0, "hold"], [5.4, -12, "inOut"], [6, -12, "hold"]] },
        { part: "head", ch: "rz", keys: [[0, 0], [3.3, 0, "hold"], [3.5, 12, "inOut"], [3.75, -10, "inOut"], [4.0, 10, "inOut"], [4.25, -6, "inOut"], [4.5, 0, "inOut"], [6, 0, "hold"]] },
        { part: "hat", ch: "py", keys: [[0, 0], [2.95, 0, "hold"], [3.02, 0.04, "out"], [3.2, 0, "back"], [6, 0, "hold"]] },
        { part: "eyes", ch: "sy", keys: [[0, 0], ...blink(2.2), ...blink(2.45), ...blink(4.6), [6, 0, "hold"]] },
        ...restArms(6, { elbow: -12 }),
        ...pipFace,
        // BOO: claws up over his head, wrists drooping (2.72–3.4), then hands to his belly to laugh
        ...hold(2.7, 2.95, 3.35, 3.7, {
          upperArmL: { rz: 120, rx: -35, ry: 40 },
          upperArmR: { rz: -120, rx: -35, ry: -40 },
          forearmL: { rx: -55 },
          forearmR: { rx: -55 },
          handL: { rx: -35 },
          handR: { rx: -35 },
        }),
        ...hold(3.4, 3.8, 4.8, 5.2, {
          upperArmL: { rx: -28, ry: -45, rz: 6 },
          upperArmR: { rx: -28, ry: 45, rz: -6 },
          forearmL: { rx: -88 },
          forearmR: { rx: -88 },
        }),
      ],
    },
  ],
};
