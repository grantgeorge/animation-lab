import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { addFaceMorphs, faceInfluences, type FaceData } from "./faceRig";

/** A flat "face" grid at z = 0.1 (front) plus a back layer at z = −0.1, 1 cm spacing. */
function grid(): BufferGeometry {
  const p: number[] = [];
  for (let x = -0.1; x <= 0.1001; x += 0.01) for (let y = 1.5; y <= 1.7001; y += 0.01) p.push(x, y, 0.1, x, y, -0.1);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  return g;
}

const face: FaceData = {
  name: "test",
  bbox: { min: [-0.1, 1.5, -0.1], max: [0.1, 1.7, 0.1] },
  eyes: [{ c: [0.05, 1.6, 0.1], r: [0.02, 0.015] }, { c: [-0.05, 1.6, 0.1], r: [0.02, 0.015] }],
  brows: [{ c: [0.05, 1.65, 0.1], r: [0.03, 0.01] }, { c: [-0.05, 1.65, 0.1], r: [0.03, 0.01] }],
  mouth: { c: [0, 1.53, 0.1], r: [0.03, 0.01] },
};

const at = (g: BufferGeometry, target: number, x: number, y: number, z: number) => {
  const pos = g.getAttribute("position");
  const m = g.morphAttributes.position![target];
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i) - x) < 1e-4 && Math.abs(pos.getY(i) - y) < 1e-4 && Math.abs(pos.getZ(i) - z) < 1e-4) return [m.getX(i), m.getY(i), m.getZ(i)];
  throw new Error("vertex not found");
};

describe("procedural face rig", () => {
  it("builds every target for a face with a mouth", () => {
    const g = grid();
    const idx = addFaceMorphs(g, face);
    expect(Object.keys(idx).sort()).toEqual(["blink", "browAngry", "browSad", "browUp", "mouthOpen", "smile", "wide"]);
    expect(g.morphTargetsRelative).toBe(true);
  });

  it("blink pulls the upper eye region down onto the lid line and leaves the brows and cheeks alone", () => {
    const g = grid();
    const idx = addFaceMorphs(g, face);
    expect(at(g, idx.blink!, 0.05, 1.61, 0.1)[1]).toBeLessThan(-0.01);
    expect(Math.abs(at(g, idx.blink!, 0.05, 1.66, 0.1)[1])).toBeLessThan(1e-6);
    expect(Math.abs(at(g, idx.blink!, 0.0, 1.53, 0.1)[1])).toBeLessThan(1e-6);
  });

  it("only touches the front surface (the depth gate protects the back of the head and brims)", () => {
    const g = grid();
    const idx = addFaceMorphs(g, face);
    for (const t of Object.values(idx)) expect(at(g, t!, 0.05, 1.6, -0.1)).toEqual([0, 0, 0]);
  });

  it("angry brows drop at the inner end, sad brows lift it", () => {
    const g = grid();
    const idx = addFaceMorphs(g, face);
    // inner end of the +x brow is toward x = 0
    expect(at(g, idx.browAngry!, 0.03, 1.65, 0.1)[1]).toBeLessThan(0);
    expect(at(g, idx.browSad!, 0.03, 1.65, 0.1)[1]).toBeGreaterThan(0);
    expect(at(g, idx.browUp!, 0.05, 1.65, 0.1)[1]).toBeGreaterThan(0);
  });

  it("omits mouth targets when the face has no visible mouth", () => {
    const idx = addFaceMorphs(grid(), { ...face, mouth: null });
    expect(idx.smile).toBeUndefined();
    expect(idx.mouthOpen).toBeUndefined();
  });

  it("maps clip channels to clamped influences", () => {
    const inf = faceInfluences({ sy: -0.92, py: 1.4 }, { py: 0.5, rz: -0.6 }, { py: 0.3, sy: 2 });
    expect(inf).toEqual({ blink: 0.92, wide: 1, browUp: 0.5, browAngry: 0.6, browSad: 0, smile: 0.3, mouthOpen: 1 });
  });
});
