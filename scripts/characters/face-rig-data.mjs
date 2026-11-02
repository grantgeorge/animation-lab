// Face landmarks for the procedural face rig, located by eye on front-view texture splats
// (scripts/characters/face-splat.mjs) of the raw Meshy meshes. Metres, raw model space (+Z = face).
// This script adds surface depth from the mesh and the bounding box, and writes src/scene/characters/faces/<name>.json.
// Usage: node scripts/characters/face-rig-data.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { writeFileSync } from "node:fs";

const SPEC = {
  bram: {
    file: "assets-src/characters/bram-uhd/rigged.glb",
    // eyes: centre (x, y) and half-size (rx, ry); brows: centre and half-length; mouth hidden by the mustache
    eyes: [{ c: [0.052, 1.622], r: [0.02, 0.014] }, { c: [-0.05, 1.623], r: [0.02, 0.014] }],
    brows: [{ c: [0.055, 1.672], r: [0.036, 0.012] }, { c: [-0.053, 1.67], r: [0.036, 0.012] }],
    mouth: null,
    skin: "#E9A28A",
  },
  pip: {
    file: "assets-src/characters/pip-uhd/rigged.glb",
    eyes: [{ c: [0.056, 0.797], r: [0.024, 0.024] }, { c: [-0.059, 0.794], r: [0.024, 0.024] }],
    // brows sit high, just under the fringe; the mouth is a short painted smile under the nose
    brows: [{ c: [0.058, 0.857], r: [0.028, 0.008] }, { c: [-0.06, 0.853], r: [0.028, 0.008] }],
    mouth: { c: [0.0, 0.748], r: [0.028, 0.01] },
    skin: "#F2B49A",
  },
};

for (const [name, s] of Object.entries(SPEC)) {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(s.file);
  const pos = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute("POSITION").getArray();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
  // surface z at (x, y): the front-most vertex within 12 mm
  const surfZ = ([x, y], zMax = Infinity) => {
    let z = -Infinity;
    for (let i = 0; i < pos.length; i += 3) if (pos[i + 2] < zMax && Math.hypot(pos[i] - x, pos[i + 1] - y) < 0.012) z = Math.max(z, pos[i + 2]);
    if (!Number.isFinite(z)) throw new Error(`${name}: no surface at ${x},${y}`);
    return +z.toFixed(4);
  };
  const feat = (f, zMax) => (f ? { c: [f.c[0], f.c[1], surfZ(f.c, zMax)], r: f.r } : null);
  const eyes = s.eyes.map((f) => feat(f));
  // brows: ignore anything more than 3 cm in front of the eyes (cap brims, hat brims)
  const browZMax = Math.max(...eyes.map((e) => e.c[2])) + 0.03;
  const out = { name, bbox: { min: min.map((v) => +v.toFixed(4)), max: max.map((v) => +v.toFixed(4)) }, eyes, brows: s.brows.map((f) => feat(f, browZMax)), mouth: feat(s.mouth), skin: s.skin };
  writeFileSync(`src/scene/characters/faces/${name}.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(name, JSON.stringify({ eyes: out.eyes.map((e) => e.c), brows: out.brows.map((e) => e.c), mouth: out.mouth?.c }));
}
