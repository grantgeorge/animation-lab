// Paint the matte: send the clean plate (capture-plate.mjs) to an image-edit model and ask for a
// pixel-aligned gouache repaint. Spend is logged in scripts/characters/ledger.json.
// node --env-file=.env.local scripts/painterly/paint-matte.mjs <plate.png> <outDir> [n]
import { runJob, upload, download } from "../characters/fal.mjs";

const [plate, outDir, nRaw] = process.argv.slice(2);
if (!plate || !outDir) throw new Error("usage: paint-matte.mjs <plate.png> <outDir> [n]");
const n = Number(nRaw ?? 2);
const prompt = `Repaint this exact image as a hand-painted gouache matte painting for a painterly 3D animated film, in the style of Arcane by Fortiche: visible confident brushstrokes, colour broken into painted patches, simplified detail, graphic shadow shapes with cool blue-violet shadows and warm amber lamplight, a soft moonlit glow from the round window, textured plaster walls and painted wood grain.
Keep the camera, perspective, framing and the position, size and outline of every object exactly as in the input image, pixel-aligned: the round window, the beams, the shelves of jars, the pegboard, the grandfather clock, the workbench with its lamp and objects, the loft riser and steps, the floorboards and the boxes. Do not add or remove any object, people or text. This is an empty set: no characters.`;
const url = await upload(plate, "image/png");
const data = await runJob(
  "openai/gpt-image-2.5/sunburst/edit",
  { prompt, image_urls: [url], image_size: { width: 1536, height: 864 }, quality: "high", num_images: n, output_format: "png" },
  n * 0.0395 + 0.01,
  `painterly matte x${n}`,
);
if (!data) process.exit(0);
let i = 0;
for (const img of data.images ?? []) await download(img.url, `${outDir}/matte-${++i}.png`).then((p) => console.log("saved", p));
