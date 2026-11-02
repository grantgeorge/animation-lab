// Era still candidates: GPT Image 2.5 Sunburst edit (x2) and Nano Banana 2.1 edit (x1) per era,
// each from the SAME approved master frame + identity crops (never chained era-to-era).
// Usage: node --env-file=.env.local scripts/history-media/gen-stills.mjs [era,era...]
import { runBatch, upload } from "./fal.mjs";
import { ERA_STYLES, eraStillPrompt } from "./prompts.mjs";

const eras = process.argv[2] && process.argv[2] !== "all" ? process.argv[2].split(",") : Object.keys(ERA_STYLES);
const round = process.argv[3] ?? "r1";
const refs = await Promise.all(["master-frame.png", "ref-bram.png", "ref-pip.png"].map((f) => upload(`media-work/refs/${f}`)));
const jobs = [];
for (const era of eras) {
  const prompt = eraStillPrompt(era);
  jobs.push({
    id: `still-${era}-${round}`,
    endpointId: "openai/gpt-image-2.5/sunburst/edit",
    input: { prompt, image_urls: refs, image_size: { width: 1920, height: 1072 }, quality: "high", num_images: 3, output_format: "png" },
    meta: { role: "era-still", era, refs: ["master-frame@t2.40", "ref-bram", "ref-pip"] },
    estimatedCost: 3 * 0.0395 + 3 * 0.008,
  });
}
const res = await runBatch(jobs, 6);
for (const r of res) console.log(r.id, r.state, r.error ?? "");
