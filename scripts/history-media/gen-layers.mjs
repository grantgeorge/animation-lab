// Multiplane layers + blue-scarf cel revisions, all derived from APPROVED stills (one edit step each).
import { runBatch, upload } from "./fal.mjs";

const mp = await upload("media-work/approved/still-multiplane.png");
const tv = await upload("media-work/approved/still-television.png");
const SB = "openai/gpt-image-2.5/sunburst/edit";
const size = { width: 1920, height: 1072 };
const keep = "Keep the camera, framing, scale and the position of everything that remains exactly as in the input image, pixel-aligned.";
const jobs = [
  {
    id: "layer-multiplane-bg",
    endpointId: SB,
    input: {
      image_urls: [mp], image_size: size, quality: "high", output_format: "png",
      prompt: `Remove the two characters (the tall man in the red coat and the small child in yellow) and the black iron street lantern in the right foreground. Repaint the plaster wall, the doorway and green door, the pavement, the brick wall and the night sky that were behind them in exactly the same painted watercolor-and-gouache style, so this becomes an empty background painting of the street. ${keep}`,
    },
    meta: { role: "layer", layer: "background-clean-plate", source: "still-multiplane" },
    estimatedCost: 0.048,
  },
  {
    id: "layer-multiplane-fg",
    endpointId: SB,
    input: {
      image_urls: [mp], image_size: size, quality: "high", output_format: "png", background: "transparent",
      prompt: `Output only the black iron street lantern and its post from the right foreground, with the same painted style, size, shape and position in the frame, on a fully transparent background. Remove everything else, including the characters, wall, sky and ground. ${keep}`,
    },
    meta: { role: "layer", layer: "foreground", source: "still-multiplane" },
    estimatedCost: 0.048,
  },
  {
    id: "layer-multiplane-chars",
    endpointId: SB,
    input: {
      image_urls: [mp], image_size: size, quality: "high", output_format: "png", background: "transparent",
      prompt: `Output only the two painted characters, the tall man in the red coat and the small child in yellow, with the same style, size, pose and position in the frame, on a fully transparent background. Remove everything else: wall, doorway, lantern, sky and ground. No cast shadows. ${keep}`,
    },
    meta: { role: "layer", layer: "characters", source: "still-multiplane" },
    estimatedCost: 0.048,
  },
  {
    id: "layer-multiplane-chars-birefnet",
    endpointId: "fal-ai/birefnet/v2",
    input: { image_url: mp, model: "General Use (Heavy)", operating_resolution: "2048x2048", output_mask: true, output_format: "png" },
    meta: { role: "layer", layer: "characters-matte-fallback", source: "still-multiplane" },
    estimatedCost: 0.01,
  },
  {
    id: "note-multiplane-blue-scarf",
    endpointId: SB,
    input: {
      image_urls: [mp], image_size: size, quality: "high", output_format: "png",
      prompt: `Change only the color of the tall man's cream scarf to a clear medium blue, painted in the same flat cel style. Keep everything else identical: his coat, face, pose, the child, the background, lighting and composition. ${keep}`,
    },
    meta: { role: "director-note", chapter: "multiplane", note: "blue-scarf", source: "still-multiplane" },
    estimatedCost: 0.048,
  },
  {
    id: "note-television-blue-scarf",
    endpointId: SB,
    input: {
      image_urls: [tv], image_size: size, quality: "high", output_format: "png",
      prompt: `Change only the color of the tall man's cream scarf to a clear medium blue flat color. Keep everything else identical: outlines, his coat, face, pose, the child, the background and composition. ${keep}`,
    },
    meta: { role: "director-note", chapter: "television", note: "blue-scarf", source: "still-television" },
    estimatedCost: 0.048,
  },
];
const res = await runBatch(jobs, 6);
for (const r of res) console.log(r.id, r.state, r.error ?? "");
