// Voice takes for the Character Acting lab: one line, six deliveries, two takes each.
// ElevenLabs v4 on fal (voice "George"), audio tags direct the emotion; the WORDS are identical in every take.
// Each take is then transcribed with ElevenLabs Scribe v2 to verify the words and get word timings.
// Usage: HISTORY_MEDIA_DIR=media-work/acting node --env-file=.env.local scripts/acting-media/gen-voices.mjs
import { runBatch, upload } from "../history-media/fal.mjs";

export const LINE = "Oh, that's just great.";
export const DELIVERIES = {
  neutral: { text: "Oh, that's just great.", stability: 0.5 },
  excited: { text: "[excited] Oh! That's just great!", stability: 0.3 },
  sarcastic: { text: "[sarcastic] Oh, that's just... great.", stability: 0.3 },
  nervous: { text: "[nervous] Oh... that's... just great?", stability: 0.3 },
  frustrated: { text: "[frustrated] Oh, that's JUST great.", stability: 0.3 },
  disappointed: { text: "[sighs] [sad] Oh. That's just great.", stability: 0.3 },
};
const VOICE = "George";
const takes = (process.argv[2] ?? "a,b").split(",");

const tts = [];
for (const [emotion, d] of Object.entries(DELIVERIES))
  for (const take of takes)
    tts.push({
      id: `voice-${emotion}-${take}`,
      endpointId: "elevenlabs/tts/eleven-v4",
      input: { text: d.text, voice: VOICE, stability: d.stability, timestamps: true, output_format: "mp3_44100_128" },
      meta: { role: "voice", emotion, take },
      estimatedCost: (d.text.length / 1000) * 0.08,
    });
const done = await runBatch(tts, 6);
const stt = [];
for (const r of done) {
  if (r.state !== "needs_review") continue;
  stt.push({
    id: `stt-${r.id}`,
    endpointId: "fal-ai/elevenlabs/speech-to-text/scribe-v2",
    input: { audio_url: await upload(r.rawOutputs[0].file), diarize: false, tag_audio_events: true, language_code: "en" },
    meta: { role: "transcript", of: r.id },
    estimatedCost: 0.01,
  });
}
// Transcripts return JSON only (no media), so runJob records them with no raw outputs.
const tr = await runBatch(stt, 6);
for (const r of tr) console.log(r.id, r.state, r.output?.text ?? r.error ?? "");
