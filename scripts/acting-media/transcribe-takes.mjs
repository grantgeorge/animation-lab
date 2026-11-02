// Transcribe each generated take's soundtrack (Scribe v2) and measure whether a pinned voice was kept,
// by cross-correlating its loudness envelope with the supplied voice take.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { runBatch, upload } from "../history-media/fal.mjs";

const W = "media-work/acting";
const ids = readdirSync(`${W}/raw`)
  .filter((f) => /^act-.*\.mp4$/.test(f))
  .map((f) => f.replace(".mp4", ""));

function loudness(file) {
  const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 26 });
  const hop = 80;
  const out = [];
  for (let s = 0; s + hop <= pcm.length / 2; s += hop) {
    let e = 0;
    for (let i = 0; i < hop; i++) e += (pcm.readInt16LE((s + i) * 2) / 32768) ** 2;
    out.push(Math.sqrt(e / hop));
  }
  return out;
}

const ref = loudness("public/labs/character-acting/voice/sarcastic.mp3");
function correlate(x) {
  let best = { r: -1, lag: 0 };
  for (let lag = 0; lag < x.length - ref.length; lag++) {
    let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < ref.length; i++) {
      const a = x[i + lag], b = ref[i];
      sxy += a * b; sx += a; sy += b; sxx += a * a; syy += b * b;
    }
    const n = ref.length;
    const r = (n * sxy - sx * sy) / (Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy)) || 1);
    if (r > best.r) best = { r, lag };
  }
  return { r: +best.r.toFixed(2), offsetS: +(best.lag / 100).toFixed(2) };
}

const jobs = [];
const match = {};
for (const id of ids) {
  const a = `${W}/raw/${id}.m4a`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${W}/raw/${id}.mp4`, "-vn", "-c:a", "aac", a]);
  match[id] = correlate(loudness(a));
  jobs.push({
    id: `stt-${id}`,
    endpointId: "fal-ai/elevenlabs/speech-to-text/scribe-v2",
    input: { audio_url: await upload(a), diarize: true, tag_audio_events: true, language_code: "en" },
    meta: { of: id },
    estimatedCost: 0.01,
  });
}
const res = await runBatch(jobs, 8);
const out = {};
for (const r of res) {
  const id = r.meta.of;
  out[id] = {
    transcript: r.output?.text ?? null,
    words: (r.output?.words ?? []).filter((w) => w.type === "word").map((w) => ({ text: w.text, start: w.start, end: w.end, speaker: w.speaker_id })),
    voiceMatch: match[id],
  };
}
writeFileSync(`${W}/takes-audio.json`, JSON.stringify(out, null, 1));
for (const id of ids.sort()) console.log(id.padEnd(18), JSON.stringify(out[id].transcript), "voice r =", out[id].voiceMatch.r, "@", out[id].voiceMatch.offsetS, "s");
