// Inspect a GLB: skeleton bones (name, parent, world position) and mesh bounds.
// Usage: node scripts/characters/inspect.mjs <file.glb>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const world = new Map();
const walk = (node, parentM, depth, parentName) => {
  const m = mul(parentM, node.getMatrix());
  world.set(node, m);
  const p = [m[12], m[13], m[14]].map((v) => v.toFixed(3));
  const isJoint = root.listSkins().some((s) => s.listJoints().includes(node));
  console.log(`${"  ".repeat(depth)}${node.getName() || "(unnamed)"}${isJoint ? " [joint]" : ""}${node.getMesh() ? " [mesh]" : ""}  world (${p.join(", ")})  parent=${parentName}`);
  for (const c of node.listChildren()) walk(c, m, depth + 1, node.getName());
};
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const scene of root.listScenes()) for (const n of scene.listChildren()) walk(n, I, 0, "-");
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    console.log(`mesh ${mesh.getName()} verts ${pos.getCount()} min ${pos.getMin([]).map((v) => v.toFixed(3))} max ${pos.getMax([]).map((v) => v.toFixed(3))}`);
  }
}
console.log("textures", root.listTextures().map((t) => `${t.getName()} ${t.getMimeType()} ${t.getSize()}`));
console.log("animations", root.listAnimations().map((a) => a.getName()));
