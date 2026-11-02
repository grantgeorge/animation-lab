import { arcCharacter } from "./bezier";
import { type MotionParams, impliedGravity } from "./params";
import { buildTimeline } from "./timeline";

const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

export function weightClause(p: MotionParams): string {
  const g = impliedGravity(p.height, p.airFrames);
  const speed = g >= 1.4 ? "a fast, snappy" : g >= 0.75 ? "real-world" : g >= 0.4 ? "slow, hanging" : "very slow, moon-like";
  const noun =
    p.weight === "bowling"
      ? "heavy bowling-ball bounce"
      : p.weight === "rubber"
        ? "springy rubber-ball bounce"
        : p.weight === "beach"
          ? "light, floaty beach-ball bounce"
          : p.weight === "balloon"
            ? "weightless balloon-like bounce"
            : g >= 1.3 && p.restitution < 0.45
              ? "heavy, dense bounce"
              : g < 0.4
                ? "weightless, drifting bounce"
                : g < 0.7
                  ? "light, floaty bounce"
                  : p.restitution >= 0.6
                    ? "springy bounce"
                    : "solid bounce";
  return `${noun} with ${speed} timing`;
}

export function curveClause(p: MotionParams): string {
  const { apex, contact } = arcCharacter(p.rise, p.fall);
  if (apex < 0.35 && contact > 1.5) return "natural arcs that hang at the top and accelerate into each impact";
  if (apex < 0.45 && contact < 0.5) return "eases into every landing as if cushioned";
  if (Math.abs(apex - 1) < 0.25 && Math.abs(contact - 1) < 0.25) return "constant-speed, mechanical V-shaped bounces";
  if (apex > 1.3 && contact < 0.6) return "lingers on the floor and snaps at the top of each arc";
  const top = apex < 0.5 ? "slow at the top" : apex > 1.3 ? "sharp at the top" : "even through the top";
  const floor = contact > 1.3 ? "fast into each impact" : contact < 0.6 ? "soft into each impact" : "steady into each impact";
  return `${top}, ${floor}`;
}

export function reboundClause(p: MotionParams): string {
  const n = Math.max(0, buildTimeline(p).arcs.length - 1);
  if (n === 0) return "lands and stays down";
  const low = p.restitution < 0.45;
  const noun = `${NUM[Math.min(8, n)]} ${low ? "short, low" : "shrinking"} ${n === 1 ? "rebound" : "rebounds"}`;
  const stop = low ? (n === 1 ? " that stops dead" : " that stop dead") : "";
  return `${noun}${stop}${p.physicalTiming ? "" : ", each taking the same time"}`;
}

export function squashClause(p: MotionParams): string {
  if (p.squash < 0.03) return "rigid, no squash or stretch";
  if (p.squash < 0.25) return "barely deforms on impact";
  if (p.squash < 0.6) return "soft squash on landings and slight stretch on fast falls";
  if (p.squash < 0.85) return "strong squash and stretch";
  return "exaggerated cartoon squash on every landing and long stretch on fast frames";
}

export function anticipationClause(p: MotionParams): string {
  if (p.anticipation <= 0 || p.anticipationFrames <= 0) return "launches with no windup";
  if (p.anticipation >= 0.75 || p.anticipationFrames >= 12) return "deep, held crouch before the jump";
  return "quick crouch before the jump";
}

/**
 * A deterministic, comma-separated motion phrase for a video model prompt.
 * Same parameters → same words; ordered weight, spacing, rebounds, squash, anticipation, extras.
 */
export function motionPrompt(p: MotionParams): string {
  const parts = [weightClause(p), curveClause(p), reboundClause(p), squashClause(p), anticipationClause(p)];
  if (p.followThrough >= 0.4) parts.push("antenna whips through with follow-through");
  if (p.onTwos) parts.push("animated on twos");
  return parts.join(", ");
}
