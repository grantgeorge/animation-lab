// Ask a vision LLM (default Gemini 4 Argon via fal's OpenRouter vision router) to critique
// animation contact sheets. Usage:
//   node --env-file=.env.local scripts/review/gemini-review.mjs <out.md> <sheet.jpg> [sheet2.jpg ...]
// Spend is logged in scripts/characters/ledger.json (estimate per call), under the $100 cap.
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { runJob, upload } from "../characters/fal.mjs";

const [out, ...sheets] = process.argv.slice(2);
if (!out || !sheets.length) throw new Error("usage: gemini-review.mjs <out.md> <sheet.jpg>...");
const model = process.env.REVIEW_MODEL ?? "google/gemini-4-argon";
const defaultPrompt = `You are a senior character animator reviewing a stylized 3D animated short (Pixar/Aardman-like puppets).
Each image is a contact sheet of frames sampled left-to-right, top-to-bottom from one shot of a looping performance.
Sheets: ${sheets.map((s) => basename(s)).join(", ")}.
Focus ONLY on the arms, hands and shoulders. For each sheet list concrete problems (which frame index, which arm,
what reads as uncanny: impossible elbow bends, hands intersecting the head/body, stiff straight arms, arms pointing
at nothing, robotic timing, missing wrist overlap, gestures hidden from camera) and give a specific fix in animator
terms (shoulder flexion/abduction/rotation degrees, elbow bend, wrist lag, arcs, timing). Be terse: bullets only.
End with an overall 1-10 score for arm naturalness per sheet.`;
// PROMPT_FILE swaps in another critique brief (e.g. lighting); the file names are appended.
const prompt = process.env.PROMPT_FILE ? `${readFileSync(process.env.PROMPT_FILE, "utf8")}\nImages in order: ${sheets.map((s) => basename(s)).join(", ")}.` : defaultPrompt;

const urls = [];
for (const s of sheets) urls.push(await upload(s, "image/jpeg"));
const data = await runJob("openrouter/router/vision", { model, prompt, image_urls: urls, reasoning: true, max_tokens: 6000 }, 0.05, `${process.env.PROMPT_FILE ? "review" : "arm review"} ${sheets.map((s) => basename(s)).join("+")}`);
if (!data) process.exit(0);
const text = data.output ?? data.text ?? JSON.stringify(data);
writeFileSync(out, `# Review (${model})\n\n${text}\n`);
console.log(text);
