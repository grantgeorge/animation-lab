// Concept art for Bram and Pip with GPT Image 2.5 Sunburst, framed for image-to-3D:
// full body, front view, A-pose, plain background, even light.
// Usage: node --env-file=.env.local scripts/characters/concepts.mjs [bram|pip|all] [variants]
import { runJob, download, spent } from "./fal.mjs";

const ENDPOINT = "openai/gpt-image-2.5/sunburst/text-to-image";
const EST_PER_IMAGE = 0.3; // conservative estimate for quality "high"

const FRAMING =
  "Full-body character design sheet, single character, centred, orthographic front view, standing in a relaxed A-pose with both arms angled about 40 degrees down and away from the body, hands open and empty, feet slightly apart and fully visible, mouth closed, looking straight at the viewer. Plain light grey seamless background, soft even studio lighting, no cast shadows, no text, no props, no ground plane. Stylized 3D animated feature-film character, appealing chunky proportions, clean sculpted shapes, smooth matte painted materials, crisp readable silhouette.";

const CHARACTERS = {
  bram: `${FRAMING} The character: Bram, a stout, warm-hearted middle-aged town lamplighter, about 1.78 m tall. Big round bulbous nose that protrudes far from the face (the most prominent facial feature), rosy cheeks, bushy dark-brown handlebar mustache, heavy expressive dark eyebrows, small kind eyes. Dark charcoal flat cap with a short brim. Rust-red knee-length wool work coat with three brass buttons, cream knitted scarf wrapped once around the neck with one end hanging down the chest, dark slate-blue trousers, sturdy brown leather boots. Warm earthy palette.`,
  pip: `${FRAMING} The character: Pip, a cheerful small child about 6 years old and 1.05 m tall, big round head, large bright eyes, small button nose, rosy blushing cheeks, a happy closed-mouth smile, a few auburn hair tufts poking out at the forehead. Bright mustard-yellow sou'wester rain hat with a wide brim and a darker yellow band, matching bright yellow A-line raincoat with toggle buttons, dark slate trousers, teal rubber rain boots. Bright friendly palette.`,
};

const which = process.argv[2] ?? "all";
const variants = Number(process.argv[3] ?? 2);
const names = which === "all" ? Object.keys(CHARACTERS) : [which];
console.log(`spent so far: $${spent().toFixed(2)}`);
for (const name of names) {
  const data = await runJob(
    ENDPOINT,
    { prompt: CHARACTERS[name], image_size: { width: 1024, height: 1536 }, quality: "high", output_format: "png", background: "opaque", num_images: variants },
    EST_PER_IMAGE * variants,
    `concept:${name}`,
  );
  if (!data) continue;
  for (const [k, img] of data.images.entries()) {
    const out = await download(img.url, `assets-src/characters/concepts/${name}-${k + 1}.png`);
    console.log("  saved", out, img.url);
  }
}
console.log(`spent now: $${spent().toFixed(2)}`);
