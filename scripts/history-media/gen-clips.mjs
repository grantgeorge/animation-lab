// Era clips (draft tier): MiniMax H3 Max image-to-video from each APPROVED era still.
// Prompt expansion is disabled so the reviewed prompt is used verbatim.
// Usage: node --env-file=.env.local scripts/history-media/gen-clips.mjs [all|era,...] [takes=a,b]
import { runBatch, upload } from "./fal.mjs";
import { ERA_CLIP_STYLE, eraClipPrompt } from "./prompts.mjs";

const eras = process.argv[2] && process.argv[2] !== "all" ? process.argv[2].split(",") : Object.keys(ERA_CLIP_STYLE);
const takes = (process.argv[3] ?? "a,b").split(",");
const jobs = [];
for (const era of eras) {
  const image_url = await upload(`media-work/approved/still-${era}.png`);
  for (const take of takes)
    jobs.push({
      id: `clip-${era}-${take}`,
      endpointId: "minimax/h3-max/image-to-video",
      input: { image_url, prompt: eraClipPrompt(ERA_CLIP_STYLE[era]), duration: 6, resolution: "768P", prompt_expansion_mode: "disabled" },
      meta: { role: "era-clip", era, startFrame: `still-${era}`, tier: "draft" },
      estimatedCost: 6.7 * 0.056,
    });
}
const res = await runBatch(jobs, 8);
for (const r of res) console.log(r.id, r.state, r.error ?? "");
