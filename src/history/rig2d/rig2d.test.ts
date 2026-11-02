import { describe, expect, it } from "vitest";
import { cadenceTime, movingParts, poseAt, projectGround, FPS } from "./pose";
import { bodyYaw, scarfAnglesAt, simulatedAngles, SCARF } from "./scarf";

describe("cadence sampling", () => {
  it("on ones gives a new pose every frame", () => {
    const ts = Array.from({ length: 6 }, (_, f) => cadenceTime(f / FPS, "ones"));
    expect(new Set(ts).size).toBe(6);
  });
  it("on twos holds each pose for exactly two frames of a 24 fps clock", () => {
    const ts = Array.from({ length: 8 }, (_, f) => cadenceTime(f / FPS, "twos"));
    expect(ts).toEqual([0, 0, 2, 2, 4, 4, 6, 6].map((f) => f / FPS));
  });
  it("is robust to float error at frame boundaries", () => {
    expect(cadenceTime(3 / 24 - 1e-9, "ones")).toBeCloseTo(3 / 24);
  });
});

describe("authored performance sampling", () => {
  it("matches the lab's key values", () => {
    expect(poseAt(4).bram.torso.ry).toBeCloseTo(42);
    expect(poseAt(0).pip.root.pz).toBeCloseTo(-0.8);
  });
  it("detects moving vs held parts from the keyframes", () => {
    const m = movingParts("pip", 3.3);
    expect(m.has("forearmL")).toBe(true); // waving
    expect(movingParts("bram", 4.0).has("torso")).toBe(false); // torso held at 42° from 3.3 to 4.6
  });
});

describe("lab camera projection", () => {
  it("puts Bram on the frame centre line and Pip right of him", () => {
    const b = projectGround(-0.35, -3.0);
    const p = projectGround(0.72, -4.7);
    expect(b.x).toBeCloseTo(960);
    expect(p.x).toBeGreaterThan(1200);
    expect(p.y).toBeLessThan(1080); // Pip's feet are in frame
  });
});

describe("scarf secondary motion", () => {
  it("is deterministic and one entry per frame", () => {
    const a = simulatedAngles();
    expect(a.length).toBe(6 * FPS);
    expect(a[0].length).toBe(SCARF.segments);
  });
  it("lags behind the body turn and settles by the loop end", () => {
    // body turns between ~2.55 s and 3.35 s
    expect(bodyYaw(3.4)).toBeGreaterThan(1);
    const rest = simulatedAngles()[0][SCARF.segments - 1];
    const swing = Math.max(...simulatedAngles().map((s) => Math.abs(s[SCARF.segments - 1] - rest)));
    expect(swing).toBeGreaterThan(0.05);
    const end = scarfAnglesAt(5.99, true);
    const start = scarfAnglesAt(0, true);
    end.forEach((v, i) => expect(Math.abs(v - start[i])).toBeLessThan(0.05));
  });
  it("body-only mode is the rigid rest shape", () => {
    expect(scarfAnglesAt(3, false)).toEqual(scarfAnglesAt(0, true));
  });
});

import { armFK } from "./pose";
describe("arm forward kinematics", () => {
  it("a side raise (rz) keeps full length and swings the arm out", () => {
    const { upper } = armFK({ upperArmL: { rz: 90 } }, "L");
    expect(upper.angle).toBeCloseTo(90);
    expect(upper.len).toBeCloseTo(1);
  });
  it("a forward raise (rx) foreshortens the upper arm and a bent forearm points up", () => {
    const { upper, fore } = armFK({ upperArmR: { rx: -96 }, forearmR: { rx: -82 } }, "R");
    expect(upper.len).toBeLessThan(0.2);
    expect(upper.depth).toBeGreaterThan(0.9); // toward the camera
    expect(Math.abs(fore.angle)).toBeGreaterThan(170); // pointing up
    expect(fore.len).toBeGreaterThan(0.95);
  });
  it("Bram's wave back is visible in the current doorway performance", () => {
    const fk = armFK(poseAt(4.0).bram, "L"); // Pip-side hand, shared with the 3D performance
    expect(Math.abs(fk.fore.angle)).toBeGreaterThan(120);
  });
});
