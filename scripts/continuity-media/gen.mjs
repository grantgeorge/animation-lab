// AI Shot Continuity lab: one scene's coverage (5 shots) generated two ways with GPT Image 2.5 on fal.
//  A "prompt only": each shot is generated independently from the same text description of the cast and set.
//  B "with references": the same shot prompts plus the approved painted master shot and the two character sheets.
// Draft-tier stills only (no video). Durable job records via the /history FAL client:
//   node --env-file=.env.local scripts/continuity-media/gen.mjs
import { runBatch, upload } from "../history-media/fal.mjs";
import { CAST } from "../history-media/prompts.mjs";

const STYLE = "A late-1930s painted-cel animated film still: characters with inked contour lines and flat opaque gouache-like paint with one soft shadow tone, over a rich watercolor-and-gouache background painting with warm glowing lamplight.";
const SCENE = `The scene is ${CAST.set}. The characters are ${CAST.bram}; and ${CAST.pip}. Bram stands on the street; Pip has just stepped out of the arched doorway, which is to Bram's right.`;

export const SHOTS = [
  { id: "wide", label: "Wide", text: "Wide establishing shot at eye level: Bram stands in the middle of the frame by the lamplit doorway, facing us; Pip stands just outside the doorway to the right of him, looking up at Bram." },
  { id: "pip", label: "Pip close", text: "Medium close-up of Pip in the doorway, from the chest up, looking up and toward the left of the frame at Bram, who is out of shot on the left. The door frame and the warm plaster wall behind Pip." },
  { id: "bram", label: "Bram close", text: "Medium close-up of Bram, from the chest up, looking down and toward the right of the frame at Pip, who is out of shot on the right. The glowing wall lamp above the doorway is off to the right, lighting the right side of his face." },
  { id: "ots", label: "Over the shoulder", text: "Over-the-shoulder shot from behind Bram's right shoulder: the back of his flat cap, his shoulder and his scarf soft and dark in the left foreground; Pip in the doorway in the middle distance, looking up at him." },
  { id: "boots", label: "Insert", text: "Close-up insert at ground level: Pip's teal rain boots stepping out of the doorway onto the wet, lamplit cobblestones, the hem of the yellow raincoat just visible at the top of the frame." },
];

const NO_EXTRA = "No other characters, no text, no captions, no borders, no watermark.";
const size = { width: 1536, height: 864 };

const master = await upload("media-work/approved/still-multiplane.png");
const bram = await upload("media-work/refs/paint-bram.png");
const pip = await upload("media-work/refs/paint-pip.png");

const jobs = [];
for (const s of SHOTS) {
  jobs.push({
    id: `ac-text-${s.id}`,
    endpointId: "openai/gpt-image-2.5/sunburst/text-to-image",
    input: { prompt: `${STYLE}\n${SCENE}\n${s.text}\n${NO_EXTRA}`, image_size: size, quality: "high", output_format: "png", num_images: 1 },
    meta: { role: "continuity", condition: "text", shot: s.id, tier: "draft" },
    estimatedCost: 0.05,
  });
  jobs.push({
    id: `ac-refs-${s.id}`,
    endpointId: "openai/gpt-image-2.5/sunburst/edit",
    input: {
      image_urls: [master, bram, pip],
      prompt: `${STYLE}\n${SCENE}\nImage 1 is the approved master shot of this scene: match its art style, its set, its lighting (the wall lamp above the doorway is the key light) and its screen positions (Bram on the left, Pip at the doorway on the right). Image 2 is Bram and Image 3 is Pip: match their faces, proportions, costumes and colours exactly.\nNow draw a new shot from the same scene: ${s.text}\n${NO_EXTRA}`,
      image_size: size, quality: "high", output_format: "png", num_images: 1,
    },
    meta: { role: "continuity", condition: "references", shot: s.id, tier: "draft", refs: ["still-multiplane (master)", "paint-bram", "paint-pip"] },
    estimatedCost: 0.06,
  });
}
const total = jobs.reduce((a, j) => a + j.estimatedCost, 0);
console.log(`${jobs.length} jobs, estimated $${total.toFixed(2)}`);
const res = await runBatch(jobs, 5);
for (const r of res) console.log(r.id, r.state, r.error ?? "", r.rawOutputs?.[0]?.file ?? "");
