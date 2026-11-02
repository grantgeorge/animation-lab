// The published workflow comparison (draft tier, MiniMax H3 Max on fal):
// 4 takes "description only" (text-to-video) vs 4 takes "with references" (reference-to-video).
// Same brief, look, duration, resolution and aspect. Different endpoints (documented on the page).
// Prompt expansion disabled in both so the reviewed brief is used verbatim. Every take is kept.
import { runBatch, upload } from "./fal.mjs";
import { CAST } from "./prompts.mjs";

export const BRIEF = `A late-1930s painted-cel animated film: characters with inked contour lines and flat opaque gouache-like paint with one soft shadow tone, over a rich watercolor-and-gouache background painting with warm glowing lamplight and atmospheric depth.
The scene: ${CAST.set}.
The characters: ${CAST.bram}; and ${CAST.pip}.
One continuous six-second shot with a completely fixed, wide camera. Bram stands in the middle of the frame facing us; the arched doorway is just to his right.
0-1s: Bram waits by the lamplit doorway and the green door swings open.
1-2s: Pip peeks out around the door frame and steps out beside it; Bram hears something.
2-4s: Bram turns toward Pip and waves back with his right hand raised in front of him; Pip waves eagerly with one arm out to the side.
4-6s: Pip gives a happy hop and heads back inside; Bram settles, smiling. Bram's scarf stays wrapped around his neck and its end sways slightly.
No other characters, no cuts, no text, no dialogue, no music.`;

export const REF_ADDENDUM = `Use Image 1 for the art style, the set, the lighting and the camera composition. Image 2 shows Bram and Image 3 shows Pip: match their designs, proportions and colors exactly.
Follow the staging and timing of the actions in Video 1, a simple 3D animatic of the same scene, but do not copy its 3D rendering style: keep the painted-cel look of Image 1.`;

const common = { duration: 6, resolution: "768P", prompt_expansion_mode: "disabled" };
const refs = await Promise.all(["approved/still-multiplane.png", "refs/paint-bram.png", "refs/paint-pip.png"].map((f) => upload(`media-work/${f}`)));
const animatic = await upload("media-work/refs/lab-animatic-24mm.mp4");

const jobs = [];
for (let i = 1; i <= 4; i++) {
  jobs.push({
    id: `exp-text-${i}`,
    endpointId: "minimax/h3-max/text-to-video",
    input: { prompt: BRIEF, aspect_ratio: "16:9", ...common },
    meta: { role: "experiment", condition: "text", index: i, tier: "draft" },
    estimatedCost: 6.7 * 0.056,
  });
  jobs.push({
    id: `exp-refs-${i}`,
    endpointId: "minimax/h3-max/reference-to-video",
    input: { prompt: `${BRIEF}\n\n${REF_ADDENDUM}`, reference_image_urls: refs, reference_video_urls: [animatic], aspect_ratio: "16:9", ...common },
    meta: { role: "experiment", condition: "references", index: i, tier: "draft", refs: ["still-multiplane (key frame)", "paint-bram", "paint-pip", "lab-animatic-24mm (motion guide)"] },
    estimatedCost: 6.7 * 0.056,
  });
}
const res = await runBatch(jobs, 8);
for (const r of res) console.log(r.id, r.state, r.error ?? "");
