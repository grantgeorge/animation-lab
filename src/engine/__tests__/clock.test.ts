import { describe, expect, it } from "vitest";
import { MasterClock } from "../timeline/clock";

describe("MasterClock", () => {
  it("maps wall time absolutely, wraps, pauses and seeks", () => {
    let now = 0;
    const c = new MasterClock({ durationS: 6, now: () => now });
    expect(c.tick()).toBe(0);
    c.play();
    now = 1500;
    expect(c.tick()).toBeCloseTo(1.5, 9);
    now = 7000;
    expect(c.tick()).toBeCloseTo(1.0, 9); // 7 s wraps to 1 s
    c.pause();
    now = 9000;
    expect(c.tick()).toBeCloseTo(1.0, 9);
    c.seek(-0.5);
    expect(c.tick()).toBeCloseTo(5.5, 9);
    c.setSpeed(0.5);
    c.play();
    now = 10000;
    expect(c.tick()).toBeCloseTo(0.0, 9);
  });

  it("starts paused at a frozen time", () => {
    const c = new MasterClock({ durationS: 6, startAt: 3.35, now: () => 0 });
    expect(c.tick()).toBeCloseTo(3.35, 9);
    expect(c.isPlaying).toBe(false);
  });
});
