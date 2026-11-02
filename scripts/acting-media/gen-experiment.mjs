// "Directing a generated performance": the same sarcastic direction, four kinds of input, two takes each.
// Every condition opens on the same neutral frame of Bram except B, whose opening frame is the expressive
// variant derived from it. Draft tier: MiniMax H3 Max on fal, prompt expansion disabled.
import { runBatch, upload } from "../history-media/fal.mjs";

export const DIRECTION = `Medium close-up of Bram, the lamplighter (charcoal flat cap, thick handlebar moustache, cream knitted scarf, deep-red wool coat), standing by a lamplit doorway at night. He is talking to Pip, a small child just out of frame to the right.
Bram says one line, sarcastically: "Oh, that's just great."
Sarcastic acting: heavy-lidded eyes, a beat of stillness, an eye-roll just before the last word, a lopsided smirk, and a small flat hand gesture on "great".
One continuous shot, fixed camera, no cuts. Only Bram speaks; no music and no other dialogue.`;

export const CONDITIONS = {
  prompt: { title: "Prompt only", add: "" },
  expression: { title: "Prompt + expressive reference image", add: "He starts in the sarcastic expression shown in the opening frame." },
  voice: { title: "Prompt + selected voice performance", add: "He speaks the line using exactly the provided voice track, with accurate lip sync." },
  acting: {
    title: "Prompt + voice + acting references",
    add: "Image 1 shows his sarcastic expression. Follow the acting in Video 1, a 2D animation reference: its timing, eye-roll, smirk and hand gesture, but keep the 3D animated look of the opening frame. He speaks the line with the exact voice performance in Audio 1.",
  },
};

const neutral = await upload("media-work/acting/approved/frame-neutral.png");
const sarcastic = await upload("media-work/acting/approved/frame-sarcastic.png");
const voice = await upload("public/labs/character-acting/voice/sarcastic.mp3");
const actingRef = await upload("media-work/acting/refs/ref-sarcastic.mp4");
const common = { duration: 5, resolution: "768P", prompt_expansion_mode: "disabled" };
const prompt = (k) => [DIRECTION, CONDITIONS[k].add].filter(Boolean).join("\n");
const I2V = "minimax/h3-max/image-to-video";

const jobs = [];
for (const take of ["a", "b"]) {
  jobs.push({ id: `act-prompt-${take}`, endpointId: I2V, input: { prompt: prompt("prompt"), image_url: neutral, ...common }, meta: { condition: "prompt", take, inputs: ["neutral frame"] }, estimatedCost: 5.7 * 0.056 });
  jobs.push({ id: `act-expression-${take}`, endpointId: I2V, input: { prompt: prompt("expression"), image_url: sarcastic, ...common }, meta: { condition: "expression", take, inputs: ["sarcastic expression frame"] }, estimatedCost: 5.7 * 0.056 });
  jobs.push({ id: `act-voice-${take}`, endpointId: I2V, input: { prompt: prompt("voice"), image_url: neutral, target_audio_url: voice, ...common }, meta: { condition: "voice", take, inputs: ["neutral frame", "sarcastic voice take (pinned)"] }, estimatedCost: 5.7 * 0.056 });
  jobs.push({
    id: `act-acting-${take}`,
    endpointId: "minimax/h3-max/reference-to-video",
    input: { prompt: prompt("acting"), image_url: neutral, reference_image_urls: [sarcastic], reference_video_urls: [actingRef], reference_audio_urls: [voice], aspect_ratio: "16:9", ...common },
    meta: { condition: "acting", take, inputs: ["neutral frame", "sarcastic expression (Image 1)", "authored 2D performance (Video 1)", "sarcastic voice take (Audio 1)"] },
    estimatedCost: 5.7 * 0.056,
  });
}
const res = await runBatch(jobs, 8);
for (const r of res) console.log(r.id, r.state, r.error ?? "");
