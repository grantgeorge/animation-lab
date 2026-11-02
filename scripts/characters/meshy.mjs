// Concept image → textured, auto-rigged humanoid with Meshy 7.1 on fal. Raw outputs go to assets-src/ (gitignored).
// Usage: node --env-file=.env.local scripts/characters/meshy.mjs <bram|pip> <concept.png>
// Env: POLY (default 30000), PBR=1 (normal/roughness/metallic maps), OUT_SUFFIX (e.g. "-hd" → assets-src/characters/bram-hd/).
import { mkdirSync, writeFileSync } from "node:fs";
import { runJob, download, upload, spent } from "./fal.mjs";

const HEIGHTS = { bram: 1.78, pip: 1.05 };
const [name, concept] = process.argv.slice(2);
if (!HEIGHTS[name] || !concept) throw new Error("usage: meshy.mjs <bram|pip> <concept.png>");

console.log(`spent so far: $${spent().toFixed(2)}`);
const imageUrl = await upload(concept, "image/png");
const data = await runJob(
  "meshy/v7.1/image-to-3d",
  {
    image_url: imageUrl,
    model_type: "standard",
    topology: "triangle",
    target_polycount: Number(process.env.POLY ?? 30000),
    symmetry_mode: "auto",
    should_remesh: true,
    should_texture: true,
    enable_pbr: process.env.PBR === "1",
    pose_mode: "a-pose",
    enable_rigging: true,
    rigging_height_meters: HEIGHTS[name],
  },
  process.env.PBR === "1" ? 2.0 : 1.4,
  `meshy:${name}${process.env.OUT_SUFFIX ?? ""} poly=${process.env.POLY ?? 30000} pbr=${process.env.PBR ?? 0}`,
);
if (data) {
  const dir = `assets-src/characters/${name}${process.env.OUT_SUFFIX ?? ""}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}-result.json`, JSON.stringify(data, null, 2));
  for (const [k, v] of Object.entries(data.texture_urls?.[0] ?? {})) if (typeof v === "string") await download(v, `${dir}/tex-${k}.png`).catch(() => undefined);
  if (data.model_glb?.url) await download(data.model_glb.url, `${dir}/model.glb`);
  if (data.rigged_character_glb?.url) await download(data.rigged_character_glb.url, `${dir}/rigged.glb`);
  if (data.thumbnail?.url) await download(data.thumbnail.url, `${dir}/thumbnail.png`);
  for (const [k, a] of Object.entries(data.basic_animations ?? {})) {
    const url = a?.url ?? a?.glb?.url;
    if (typeof url === "string" && url.endsWith(".glb")) await download(url, `${dir}/anim-${k}.glb`);
  }
  console.log(Object.keys(data), "rig:", !!data.rigged_character_glb);
}
console.log(`spent now: $${spent().toFixed(2)}`);
