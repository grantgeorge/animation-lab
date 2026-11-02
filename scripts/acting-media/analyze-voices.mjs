// Objective prosody measurements for each voice take (I can't listen; these guide take selection).
// F0 via autocorrelation on 16 kHz mono PCM; loudness via RMS in dBFS; timing from Scribe word stamps.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const W = "media-work/acting";
const job = (id) => JSON.parse(readFileSync(`${W}/jobs/${id}.json`, "utf8"));
const out = {};
for (const f of readdirSync(`${W}/jobs`).filter((f) => f.startsWith("voice-"))) {
  const id = f.replace(".json", "");
  const j = job(id);
  const file = j.rawOutputs[0].file;
  const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 1 << 26 });
  const x = new Float32Array(pcm.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
  const sr = 16000, win = 640, hop = 160;
  const f0 = [], rms = [];
  for (let s = 0; s + win < x.length; s += hop) {
    let e = 0;
    for (let i = 0; i < win; i++) e += x[s + i] ** 2;
    const r = Math.sqrt(e / win);
    rms.push(r);
    if (r < 0.02) { f0.push(0); continue; }
    let best = 0, lag = 0;
    for (let L = Math.floor(sr / 400); L <= Math.floor(sr / 60); L++) {
      let c = 0;
      for (let i = 0; i < win - L; i++) c += x[s + i] * x[s + i + L];
      if (c > best) { best = c; lag = L; }
    }
    f0.push(best / e > 0.3 ? sr / lag : 0);
  }
  const voiced = f0.filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => voiced[Math.floor(p * (voiced.length - 1))] ?? 0;
  const words = (job(`stt-${id}`).output.words ?? []).filter((w) => w.type === "word");
  const great = words.find((w) => /great/i.test(w.text));
  const prev = words[words.indexOf(great) - 1];
  const db = (v) => (20 * Math.log10(v + 1e-9)).toFixed(1);
  out[id] = {
    duration: +(x.length / sr).toFixed(2),
    speechStart: words[0]?.start, speechEnd: words.at(-1)?.end,
    f0Median: Math.round(q(0.5)), f0Range: Math.round(q(0.95) - q(0.05)),
    loudnessP90dB: +db([...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.9)]),
    pauseBeforeGreat: great && prev ? +(great.start - prev.end).toFixed(2) : null,
    greatF0Trend: (() => {
      if (!great) return null;
      const a = Math.floor((great.start * sr) / hop), b = Math.floor((great.end * sr) / hop);
      const seg = f0.slice(a, b).filter((v) => v > 0);
      if (seg.length < 4) return null;
      const h = Math.floor(seg.length / 2);
      const m = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
      return Math.round(m(seg.slice(h)) - m(seg.slice(0, h)));
    })(),
    words: words.map((w) => ({ text: w.text, start: w.start, end: w.end })),
    transcript: job(`stt-${id}`).output.text,
  };
}
writeFileSync(`${W}/analysis.json`, JSON.stringify(out, null, 1));
console.log("take".padEnd(22), "dur  f0med f0rng loud  pause→great  great-f0-trend");
for (const [id, a] of Object.entries(out).sort()) console.log(id.padEnd(22), String(a.duration).padEnd(5), String(a.f0Median).padEnd(5), String(a.f0Range).padEnd(5), String(a.loudnessP90dB).padEnd(6), String(a.pauseBeforeGreat).padEnd(12), a.greatF0Trend);
