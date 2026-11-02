// Front-view point splat of a head, coloured from the base texture, with a metre grid: for locating
// painted features by eye. Usage: node scripts/characters/face-splat.mjs <raw.glb> <out.png> <y0> <y1> <halfW>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const [file, out, a, b, w] = process.argv.slice(2);
const y0 = +a, y1 = +b, hw = +w;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute("POSITION").getArray();
const uv = prim.getAttribute("TEXCOORD_0").getArray();
const t = prim.getMaterial().getBaseColorTexture();
const tex = PNG.sync.read(execFileSync("magick", ["-", "png:-"], { input: Buffer.from(t.getImage()), maxBuffer: 1 << 28 }));
const S = Number(process.env.S ?? 3000); // px per metre
const W = Math.round(hw * 2 * S), H = Math.round((y1 - y0) * S);
const img = new PNG({ width: W, height: H });
const zbuf = new Float32Array(W * H).fill(-Infinity);
for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 30; img.data[i + 1] = 30; img.data[i + 2] = 36; img.data[i + 3] = 255; }
for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
  const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
  if (y < y0 || y > y1 || Math.abs(x) > hw) continue;
  const px = Math.round((x + hw) * S), py = Math.round((y1 - y) * S);
  const tx = Math.round(uv[j] * (tex.width - 1)), ty = Math.round(uv[j + 1] * (tex.height - 1));
  const ti = (ty * tex.width + tx) * 4;
  const R = Number(process.env.R ?? 2);
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
    const X = px + dx, Y = py + dy;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const k = Y * W + X;
    if (z <= zbuf[k]) continue;
    zbuf[k] = z;
    img.data[k * 4] = tex.data[ti]; img.data[k * 4 + 1] = tex.data[ti + 1]; img.data[k * 4 + 2] = tex.data[ti + 2];
  }
}
// grid every 2 cm, labelled lines every 10 cm drawn brighter
for (let gx = Math.ceil(-hw * 50) / 50; gx <= hw; gx += 0.02) { const X = Math.round((gx + hw) * S); const major = Math.abs(Math.round(gx * 100) % 10) === 0; for (let Y = 0; Y < H; Y++) if (X >= 0 && X < W) { const k = (Y * W + X) * 4; img.data[k + 1] = Math.min(255, img.data[k + 1] + (major ? 120 : 40)); } }
for (let gy = Math.ceil(y0 * 50) / 50; gy <= y1; gy += 0.02) { const Y = Math.round((y1 - gy) * S); const major = Math.abs(Math.round(gy * 100) % 10) === 0; for (let X = 0; X < W; X++) if (Y >= 0 && Y < H) { const k = (Y * W + X) * 4; img.data[k + 1] = Math.min(255, img.data[k + 1] + (major ? 120 : 40)); } }
writeFileSync(out, PNG.sync.write(img));
console.log(`${W}x${H}: x ${-hw}..${hw}, y ${y0}..${y1}, 2 cm grid (green), 10 cm major`);
