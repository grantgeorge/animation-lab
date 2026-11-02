// Render the lab's authored performance (body + voice) to an MP4 acting reference.
// Usage: node scripts/acting-media/render-reference.mjs <emotion> <outDir>
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const [emotion = "sarcastic", out = "media-work/acting/refs"] = process.argv.slice(2);
const frames = `${out}/ref-${emotion}`;
mkdirSync(frames, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await p.goto(`${process.env.BASE_URL ?? "http://localhost:3123"}/labs/character-acting`, { waitUntil: "networkidle" });
await p.getByTestId(`emotion-${emotion}`).click();
const scrub = p.getByTestId("perf-scrub");
const max = Number(await scrub.getAttribute("max"));
const n = Math.floor(max * 24);
await p.addStyleTag({ content: "[data-testid=acting-stage] > *:not(svg){display:none!important}" });
const skip = process.env.SKIP_FRAMES === "1";
for (let i = 0; i < n && !skip; i++) {
  await scrub.fill(String(+(i / 24).toFixed(4)));
  await p.getByTestId("acting-stage").screenshot({ path: `${frames}/f${String(i).padStart(4, "0")}.png` });
}
await b.close();
const mp4 = `${out}/ref-${emotion}.mp4`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "24", "-i", `${frames}/f%04d.png`, "-itsoffset", "0.8", "-i", `public/labs/character-acting/voice/${emotion}.mp3`, "-map", "0:v", "-map", "1:a", "-vf", "scale=1280:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-af", "apad", "-t", (n / 24).toFixed(3), mp4]);
console.log(`${mp4} · ${n} frames · ${(n / 24).toFixed(2)} s`);
