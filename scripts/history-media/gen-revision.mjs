// The director's note as a real generative revision (draft tier).
// H3 Max has no video-edit mode, so the operation is: (1) edit the source take's first frame
// (GPT Image 2.5 Sunburst, scarf → blue), then (2) regenerate with H3 Max reference-to-video,
// opening on the edited frame and following the source take as the motion reference.
// Published whether clean or not.
import { runJob, upload } from "./fal.mjs";

const SOURCE = process.argv[2] ?? "exp-refs-2";
const frame = await upload("media-work/refs/rev-source-frame0.png");
const k = await runJob({
  id: `rev-keyframe-${SOURCE}`,
  endpointId: "openai/gpt-image-2.5/sunburst/edit",
  input: {
    image_urls: [frame], image_size: "auto", quality: "high", output_format: "png",
    prompt: "Change only the color of the tall man's cream scarf to a clear medium blue, in the same painted style. Keep everything else identical: his coat, face, pose, the child, the background, lighting and composition, pixel-aligned.",
  },
  meta: { role: "revision-keyframe", source: SOURCE },
  estimatedCost: 0.05,
});
if (k.state !== "needs_review") throw new Error(`keyframe ${k.state}`);
const keyUrl = await upload(k.rawOutputs[0].file);
const video = await upload(`media-work/raw/${SOURCE}.mp4`);
export const INSTRUCTION = `Recreate Video 1 shot for shot: the same characters, the same performance and timing, the same fixed camera, background and lighting.
The only change: Bram's scarf is now blue, exactly as in the opening frame. Keep it blue in every frame.`;
const r = await runJob({
  id: `exp-revision-${SOURCE}`,
  endpointId: "minimax/h3-max/reference-to-video",
  input: { prompt: INSTRUCTION, image_url: keyUrl, reference_video_urls: [video], duration: 6, resolution: "768P", aspect_ratio: "16:9", prompt_expansion_mode: "disabled" },
  meta: { role: "revision", source: SOURCE, operation: "keyframe edit + reference-guided regeneration" },
  estimatedCost: 6.7 * 0.056,
});
console.log(r.id, r.state, r.error ?? "");
