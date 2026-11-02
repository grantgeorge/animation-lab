// Start frames for the generative acting comparison. Every condition opens on the SAME neutral frame
// (so identity isn't the variable); one condition uses an expressive variant derived from it.
import { runBatch, runJob, upload } from "../history-media/fal.mjs";

const SB = "openai/gpt-image-2.5/sunburst/edit";
const step = process.argv[2] ?? "neutral";
if (step === "neutral") {
  const src = await upload("media-work/acting/refs/lab-f85-t0.00.png");
  const r = await runJob({
    id: "frame-neutral",
    endpointId: SB,
    input: {
      image_urls: [src], image_size: { width: 1920, height: 1072 }, quality: "high", output_format: "png", num_images: 2,
      prompt: `Re-render this exact frame as a polished frame from a contemporary 3D animated feature film. Same character, same pose, same neutral expression, same framing and camera, same plaster wall and arched green door behind him.
Bram: charcoal flat cap, brown hair, big round nose, thick curled handlebar moustache, cream knitted scarf, deep-red wool coat with brass buttons over a dark sweater.
Clean up the low-polygon faceting and texture seams: smooth skin with soft subsurface shading, crisp knit and wool textures, warm lamplight from the upper right, soft shadows.
He is calm and attentive, mouth closed, eyes looking slightly to the right of camera at someone just out of frame. No text, no extra characters.`,
    },
    meta: { role: "acting-start-frame", variant: "neutral" },
    estimatedCost: 2 * 0.0395 + 0.008,
  });
  console.log(r.id, r.state, r.rawOutputs.map((o) => o.file).join(", "));
} else {
  const src = await upload(`media-work/acting/approved/frame-neutral.png`);
  const r = await runJob({
    id: "frame-sarcastic",
    endpointId: SB,
    input: {
      image_urls: [src], image_size: "auto", quality: "high", output_format: "png", num_images: 2,
      prompt: `Change only Bram's facial expression and head angle to a clearly sarcastic look: heavy half-closed eyelids, his left eyebrow raised higher than the right, a lopsided smirk pulling one corner of the mouth up under the moustache, head tilted slightly to his right, eyes on someone just out of frame to the right.
Keep everything else identical: his design, cap, moustache, scarf, coat, the framing, the lighting and the background.`,
    },
    meta: { role: "acting-expression-reference", variant: "sarcastic" },
    estimatedCost: 2 * 0.0395 + 0.008,
  });
  console.log(r.id, r.state, r.rawOutputs.map((o) => o.file).join(", "));
}
