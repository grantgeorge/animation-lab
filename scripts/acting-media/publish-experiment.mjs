// Publish the generative acting comparison: delivery videos + posters + reference media in
// public/labs/character-acting/ai/, and src/labs/character-acting/experiment.json (sanitized; no provider URLs).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const W = "media-work/acting";
const OUT = "public/labs/character-acting/ai";
mkdirSync(OUT, { recursive: true });
const job = (id) => JSON.parse(readFileSync(`${W}/jobs/${id}.json`, "utf8"));
const audio = JSON.parse(readFileSync(`${W}/takes-audio.json`, "utf8"));
const review = JSON.parse(readFileSync("scripts/acting-media/review.json", "utf8"));
const run = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);

const webp = (src, dest) => execFileSync("magick", [src, "-resize", "1280x>", "-quality", "84", dest]);
webp(`${W}/approved/frame-neutral.png`, `${OUT}/frame-neutral.webp`);
webp(`${W}/approved/frame-sarcastic.png`, `${OUT}/frame-sarcastic.webp`);
run(["-i", `${W}/refs/ref-sarcastic.mp4`, "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", `${OUT}/ref-sarcastic.mp4`]);

const CONDITIONS = [
  { id: "prompt", title: "Prompt only", short: "Prompt", inputs: ["Neutral opening frame", "Text direction"] },
  { id: "expression", title: "Prompt + expressive reference image", short: "+ Expression", inputs: ["Sarcastic opening frame", "Text direction"] },
  { id: "voice", title: "Prompt + selected voice performance", short: "+ Voice", inputs: ["Neutral opening frame", "Text direction", "Cast voice take (pinned soundtrack)"] },
  { id: "acting", title: "Prompt + voice + acting references", short: "+ Voice + acting", inputs: ["Neutral opening frame", "Text direction", "Expression image", "Authored 2D performance (video)", "Cast voice take (reference)"] },
];

const DIRECTION = job("act-prompt-a").input.prompt;
const conditions = CONDITIONS.map((c) => {
  const j = job(`act-${c.id}-a`);
  const params = Object.fromEntries(Object.entries(j.input).filter(([k, v]) => k !== "prompt" && !/url/.test(k) && typeof v !== "object"));
  return {
    ...c,
    endpointId: j.endpointId,
    parameters: params,
    addendum: j.input.prompt.slice(DIRECTION.length).trim(),
    takes: ["a", "b"].map((take) => {
      const id = `act-${c.id}-${take}`;
      const tj = job(id);
      run(["-i", tj.rawOutputs[0].file, "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", `${OUT}/${id}.mp4`]);
      run(["-ss", "0", "-i", `${OUT}/${id}.mp4`, "-frames:v", "1", `${W}/tmp-poster.png`]);
      webp(`${W}/tmp-poster.png`, `${OUT}/${id}.webp`);
      return {
        id,
        take,
        url: `/labs/character-acting/ai/${id}.mp4`,
        posterUrl: `/labs/character-acting/ai/${id}.webp`,
        transcript: audio[id].transcript,
        words: audio[id].words.map(({ text, start, end }) => ({ text, start, end })),
        voiceMatch: audio[id].voiceMatch,
        observations: review.takes[id] ?? [],
        date: tj.completedAt.slice(0, 10),
      };
    }),
  };
});

writeFileSync(
  "src/labs/character-acting/experiment.json",
  JSON.stringify(
    {
      line: "Oh, that's just great.",
      emotion: "sarcastic",
      direction: DIRECTION,
      references: {
        neutralFrame: "/labs/character-acting/ai/frame-neutral.webp",
        expressionFrame: "/labs/character-acting/ai/frame-sarcastic.webp",
        actingVideo: "/labs/character-acting/ai/ref-sarcastic.mp4",
        voice: "/labs/character-acting/voice/sarcastic.mp3",
      },
      about:
        "Draft tier: MiniMax H3 Max on fal, 2026-11-01, 5 s at 768P, prompt expansion disabled, two takes per condition, every take shown. All conditions open on the same frame of Bram except “expressive reference”, which opens on a variant derived from it, so identity isn't the variable. Opening frames: GPT Image 2.5 Sunburst from a lab render. Voice: ElevenLabs v4 (George). Transcripts: ElevenLabs Scribe v2. The image-to-video and reference-to-video endpoints differ, so this is a workflow comparison, not a controlled benchmark.",
      reviewStatus: review.reviewStatus,
      summary: review.summary,
      conditions,
    },
    null,
    1,
  ),
);
console.log(`published ${conditions.length * 2} takes`);
