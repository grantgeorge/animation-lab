import type { Channel, Ease, Key, Track } from "../dsl";

/**
 * Arm gestures as ordinary DSL tracks. Channels are deltas in the arms-down rest frame of a
 * character facing +Z (see BoneMapping in RiggedCharacter):
 * - upperArm rx < 0 swings the arm forward; rz abducts (L: +, R: −); ry twists the humerus about the
 *   hanging arm (L: + external, R: − external). Shoulder Euler order XZY: twist, raise, swing.
 * - forearm rx < 0 bends the elbow; hand rx/rz flex and tilt the wrist.
 * Every gesture track starts and ends at 0, so gestures layer on top of `restArms`.
 */
export type Side = "L" | "R";
type K = [number, number, Ease?];

const track = (part: string, ch: Channel, keys: K[]): Track => ({ part, ch, keys: keys.map(([t, v, e]) => [Number(t.toFixed(4)), v, e ?? "inOut"] as Key) });
const sgn = (side: Side) => (side === "L" ? 1 : -1);

/** A relaxed rest: arms a touch forward, elbows soft. Constant for the whole loop. */
export function restArms(durationS: number, o: { swing?: number; elbow?: number; out?: number } = {}): Track[] {
  const swing = o.swing ?? -5;
  const elbow = o.elbow ?? -14;
  const out = o.out ?? 0;
  const c = (part: string, ch: Channel, v: number) => track(part, ch, [[0, v], [durationS, v, "hold"]]);
  return [c("upperArmL", "rx", swing), c("upperArmR", "rx", swing), c("forearmL", "rx", elbow), c("forearmR", "rx", elbow), c("upperArmL", "rz", out), c("upperArmR", "rz", -out)];
}

/**
 * A friendly side wave: the arm turns outward and lifts until the elbow is a little below the
 * shoulder, the forearm angles up and out beside the face and wipes side to side (elbow flex in the
 * frontal plane), the wrist trails each change of direction. Sized for big-headed characters: an
 * overhead wave would put the hand in Pip's hat brim. `cycles` back-and-forths.
 */
/** Uneven beat lengths and swing sizes, so a wave never ticks like a metronome. */
const BEATS = [1.0, 1.25, 0.85, 1.15, 0.95, 1.1, 0.9, 1.2];
const SWING = [1.0, 0.85, 0.95, 0.75, 0.9, 0.8, 1.0, 0.85];

export function wave(side: Side, t0: number, t1: number, o: { cycles?: number; forward?: number; height?: number; turnOut?: number; inner?: number; outer?: number } = {}): Track[] {
  const s = sgn(side);
  const a = `upperArm${side}`;
  const f = `forearm${side}`;
  const h = `hand${side}`;
  const c = `shoulder${side}`;
  const cycles = o.cycles ?? 3;
  // Raise over ~0.45 s with the elbow leading and the forearm unfolding upward a beat later;
  // lower over ~0.55 s with the shoulder dropping first and the forearm unfolding after it.
  const up = t0 + 0.45;
  const down = t1 - 0.55;
  const raise = o.height ?? 76;
  const fwd = o.forward ?? -25;
  const turn = o.turnOut ?? 70;
  const elbowKeys: K[] = [[t0, 0], [t0 + 0.12, -12, "in"], [up, -60, "back"]];
  const wristKeys: K[] = [[t0, 0], [up - 0.12, 22 * s, "out"]];
  const flopKeys: K[] = [[t0, 0], [t0 + 0.2, 25, "out"], [up, 0]];
  const n = cycles * 2;
  const inner = o.inner ?? -84;
  const outer = o.outer ?? -36;
  const mid = (inner + outer) / 2;
  const beats = BEATS.slice(0, n);
  const total = beats.reduce((x, y) => x + y, 0);
  let t = up;
  for (let i = 1; i <= n; i++) {
    const seg = ((down - 0.1 - up) * beats[i - 1]) / total;
    t += seg;
    const inward = i % 2 === 1;
    const amp = SWING[i - 1];
    elbowKeys.push([t, mid + ((inward ? inner : outer) - mid) * amp]);
    // the hand lags: it tips the opposite way from the forearm's travel, peaking just before each reversal
    wristKeys.push([t - seg * 0.3, (inward ? -26 : 26) * amp * s, "out"]);
  }
  elbowKeys.push([down, -60], [down + 0.2, -55], [t1, 0]);
  wristKeys.push([down, 0], [t1 + 0.1, 0]);
  flopKeys.push([down, 0], [down + 0.28, -22, "out"], [t1 + 0.15, 0]);
  return [
    track(a, "ry", [[t0, 0], [up, turn * s, "out"], [down, turn * s, "hold"], [t1, 0]]),
    track(a, "rz", [[t0, 0], [t0 + 0.08, -5 * s, "in"], [up - 0.05, raise * s, "back"], [down, raise * s, "hold"], [t1 - 0.15, 0]]),
    track(a, "rx", [[t0, 0], [up, fwd, "out"], [down, fwd, "hold"], [t1 - 0.1, 0]]),
    // the clavicle lifts with a high arm so the shoulder doesn't pinch
    track(c, "rz", [[t0, 0], [up, Math.max(0, raise - 70) * 0.35 * s, "out"], [down, Math.max(0, raise - 70) * 0.35 * s, "hold"], [t1 - 0.2, 0]]),
    track(f, "rx", elbowKeys),
    track(h, "rz", wristKeys),
    track(h, "rx", flopKeys),
  ];
}

/**
 * A small forward greeting with the elbow below the shoulder and the forearm upright.
 * The side-to-side motion comes from twisting the upper arm about its own axis (humeral rotation),
 * not from bending the elbow sideways. Elbow leads the raise; the hand trails on the way down.
 */
export function waveForward(side: Side, t0: number, t1: number, o: { cycles?: number; lift?: number } = {}): Track[] {
  const s = sgn(side);
  const a = `upperArm${side}`;
  const f = `forearm${side}`;
  const h = `hand${side}`;
  const c = `shoulder${side}`;
  const cycles = o.cycles ?? 2;
  // These are additive deltas: restArms contributes -5° at the shoulder and -14° at the
  // elbow, and the Meshy bind pose already bends the elbow. An overhead lift plus a deep
  // elbow fold sends the hand behind the head. Keep the complete chain open instead.
  const lift = o.lift ?? -50;
  const up = t0 + 0.45;
  const down = t1 - 0.55;
  const n = cycles * 2;
  const beats = BEATS.slice(0, n);
  const total = beats.reduce((x, y) => x + y, 0);
  const twist: K[] = [[t0, 0], [up, 0]];
  const wrist: K[] = [[t0, 0], [up - 0.1, 5 * s, "out"]];
  let t = up;
  for (let i = 1; i <= n; i++) {
    const seg = ((down - 0.1 - up) * beats[i - 1]) / total;
    t += seg;
    const outward = i % 2 === 1;
    twist.push([t, (outward ? 12 : -9) * SWING[i - 1] * s]);
    wrist.push([t - seg * 0.3, (outward ? -8 : 8) * SWING[i - 1] * s, "out"]);
  }
  twist.push([down, 0], [t1, 0]);
  wrist.push([down, 0], [t1 + 0.1, 0]);
  return [
    track(a, "rx", [[t0, 0], [t0 + 0.12, 2, "out"], [up, lift, "inOut"], [down, lift, "hold"], [down + 0.25, lift * 0.55], [t1, 0]]),
    // on the way down the elbow swings out so the hand arcs around the face instead of through it
    track(a, "rz", [[t0, 0], [up, 36 * s, "out"], [down, 36 * s, "hold"], [down + 0.25, 40 * s, "out"], [t1, 0]]),
    track(a, "ry", twist),
    track(c, "rx", [[t0, 0], [up, -3, "out"], [down, -3, "hold"], [t1 - 0.2, 0]]),
    track(f, "rx", [[t0, 0], [t0 + 0.14, -12, "in"], [up + 0.05, -62, "inOut"], [down, -62, "hold"], [down + 0.3, -36], [t1, 0]]),
    track(h, "rz", wrist),
    track(h, "rx", [[t0, 0], [t0 + 0.22, 6, "out"], [up + 0.1, 0], [down, 0], [down + 0.3, -6, "out"], [t1 + 0.15, 0]]),
  ];
}

/** Arms counter-swing with the legs for a few walking steps (contact times, starting leg). */
export function walkSwing(contacts: number[], firstLeg: Side, amount = 18): Track[] {
  const L: K[] = [[contacts[0] - 0.12, 0]];
  const R: K[] = [[contacts[0] - 0.12, 0]];
  contacts.forEach((t, i) => {
    // left leg forward ⇒ right arm forward (rx < 0)
    const leftLegFwd = (i % 2 === 0) === (firstLeg === "L");
    L.push([t, leftLegFwd ? amount : -amount]);
    R.push([t, leftLegFwd ? -amount : amount]);
  });
  const end = contacts[contacts.length - 1] + 0.22;
  L.push([end, 0]);
  R.push([end, 0]);
  return [track("upperArmL", "rx", L), track("upperArmR", "rx", R), track("forearmL", "rx", [[L[0][0], 0], [contacts[0], -12], [end - 0.1, -12], [end, 0]]), track("forearmR", "rx", [[R[0][0], 0], [contacts[0], -12], [end - 0.1, -12], [end, 0]])];
}

/** Both arms lift a little on a hop (anticipation down, lift on take-off, settle on landing). */
export function hopArms(takeoff: number, land: number): Track[] {
  const keys: K[] = [[takeoff - 0.18, 0], [takeoff - 0.04, 12, "out"], [takeoff + 0.08, -38, "out"], [land, -10], [land + 0.25, 0]];
  // the right arm trails the left by a couple of frames and swings a little less: no twin motion
  const late = keys.map(([t, v, e]) => [t + 0.07, v * 0.8, e] as K);
  return [track("upperArmL", "rx", keys), track("upperArmR", "rx", late), track("forearmL", "rx", keys.map(([t, v]) => [t, v * 0.8] as K)), track("forearmR", "rx", late.map(([t, v]) => [t, v * 0.8] as K))];
}

/** Hold a pose (part/channel → value) from tIn to tOut with ease-in/ease-out ramps. */
export function hold(t0: number, tIn: number, tOut: number, t1: number, pose: Partial<Record<string, Partial<Record<Channel, number>>>>): Track[] {
  const out: Track[] = [];
  for (const [part, chans] of Object.entries(pose)) {
    for (const [ch, v] of Object.entries(chans ?? {})) {
      out.push(track(part, ch as Channel, [[t0, 0], [tIn, v as number, "out"], [tOut, v as number, "hold"], [t1, 0]]));
    }
  }
  return out;
}
