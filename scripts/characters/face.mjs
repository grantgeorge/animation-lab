// Measure face landmarks from a GLB mesh (rest pose): nose tip (max z in the head band) and head extents.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const [file, y0, y1] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives()) {
    const a = prim.getAttribute("POSITION").getArray();
    let nose = null, minZ = Infinity, maxX = -Infinity, top = -Infinity;
    for (let i = 0; i < a.length; i += 3) {
      const [x, y, z] = [a[i], a[i + 1], a[i + 2]];
      if (y > top) top = y;
      if (y < y0 || y > y1) continue;
      if (Math.abs(x) < 0.06 && (!nose || z > nose[2])) nose = [x, y, z];
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
    }
    console.log(JSON.stringify({ nose: nose?.map((v) => +v.toFixed(3)), backOfHead: +minZ.toFixed(3), halfWidth: +maxX.toFixed(3), top: +top.toFixed(3) }));
  }
