// Publish the selected voice takes for the Character Acting lab:
// public/labs/character-acting/voice/<emotion>.mp3 + src/labs/character-acting/takes.json
// (Scribe word timings, a viseme track from ElevenLabs character timings, a 60 Hz loudness envelope).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const W = "media-work/acting";
const OUT = "public/labs/character-acting/voice";
mkdirSync(OUT, { recursive: true });
const job = (id) => JSON.parse(readFileSync(`${W}/jobs/${id}.json`, "utf8"));
const analysis = JSON.parse(readFileSync(`${W}/analysis.json`, "utf8"));

/** Selections from the prosody measurements (see analyze-voices.mjs). A human should still listen. */
export const PICKS = { neutral: "b", excited: "b", sarcastic: "b", nervous: "b", frustrated: "a", disappointed: "a" };
const WHY = {
  neutral: "flattest pitch contour of the two takes",
  excited: "highest pitch and among the loudest",
  sarcastic: "~0.5 s pause before “great”, flat deadpan pitch on it",
  nervous: "slow, hesitant, with a rising question on “great”",
  frustrated: "loud and fast with the widest emphasis range",
  disappointed: "lowest pitch, quietest and slowest, with the directed sigh",
};

const V = (c) => (/[mbp]/.test(c) ? "M" : /[fv]/.test(c) ? "F" : /[ouw]/.test(c) ? "O" : /[eiy]/.test(c) ? "E" : /a/.test(c) ? "A" : /[a-z]/.test(c) ? "L" : "rest");

const takes = {};
for (const [emotion, take] of Object.entries(PICKS)) {
  const id = `voice-${emotion}-${take}`;
  const j = job(id);
  const a = analysis[id];
  copyFileSync(j.rawOutputs[0].file, `${OUT}/${emotion}.mp3`);
  // Flatten ElevenLabs character timings, drop [audio tags], then align to the real audio via Scribe's first word.
  const chars = [];
  for (const blk of j.output.timestamps ?? []) blk.characters.forEach((c, i) => chars.push({ c, t0: blk.character_start_times_seconds[i], t1: blk.character_end_times_seconds[i] }));
  let inTag = false;
  const spoken = chars.filter((x) => {
    if (x.c === "[") inTag = true;
    const keep = !inTag;
    if (x.c === "]") inTag = false;
    return keep;
  });
  const firstLetter = spoken.find((x) => /[a-z]/i.test(x.c));
  const shift = (a.words[0]?.start ?? firstLetter.t0) - firstLetter.t0;
  const visemes = [];
  for (const x of spoken) {
    const v = V(x.c.toLowerCase());
    const t = +(x.t0 + shift).toFixed(3);
    if (visemes.at(-1)?.v !== v) visemes.push({ t, v });
  }
  const last = spoken.at(-1);
  visemes.push({ t: +(last.t1 + shift).toFixed(3), v: "rest" });
  // 60 Hz RMS envelope, normalised 0..1.
  const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-i", j.rawOutputs[0].file, "-ac", "1", "-ar", "12000", "-f", "s16le", "-"], { maxBuffer: 1 << 26 });
  const hop = 200;
  const env = [];
  for (let s = 0; s + hop <= pcm.length / 2; s += hop) {
    let e = 0;
    for (let i = 0; i < hop; i++) e += (pcm.readInt16LE((s + i) * 2) / 32768) ** 2;
    env.push(Math.sqrt(e / hop));
  }
  const peak = Math.max(...env);
  takes[emotion] = {
    url: `/labs/character-acting/voice/${emotion}.mp3`,
    duration: a.duration,
    words: a.words,
    visemes,
    envelope: { hz: 60, values: env.map((v) => +(v / peak).toFixed(3)) },
    transcript: a.transcript,
    provenance: { endpointId: j.endpointId, model: "ElevenLabs v4 (fal)", voice: j.input.voice, text: j.input.text, stability: j.input.stability, date: j.completedAt.slice(0, 10), take, chosenBecause: WHY[emotion], transcriptModel: "ElevenLabs Scribe v2 (fal)" },
  };
}
writeFileSync("src/labs/character-acting/takes.json", JSON.stringify({ line: "Oh, that's just great.", takes }, null, 1));
console.log(Object.entries(takes).map(([e, t]) => `${e}: ${t.duration}s, ${t.words.length} words, ${t.visemes.length} visemes`).join("\n"));
