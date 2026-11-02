import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "../../node_modules/.pnpm/meshoptimizer@1.2.0/node_modules/meshoptimizer/index.js";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const r = doc.getRoot();
  let tris = 0, verts = 0;
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { verts += p.getAttribute("POSITION").getCount(); tris += (p.getIndices()?.getCount() ?? 0) / 3; }
  const tex = r.listTextures().map((t) => `${t.getMimeType()} ${t.getSize()?.join("x")}`);
  const mats = r.listMaterials().map((m) => [m.getName(), !!m.getBaseColorTexture(), !!m.getNormalTexture(), !!m.getMetallicRoughnessTexture()].join(":"));
  console.log(f, { verts, tris, tex, mats, bones: r.listSkins()[0]?.listJoints().length });
}
