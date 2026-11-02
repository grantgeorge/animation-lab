// Screenshots of the Environment & Depth lab. Usage:
//   node scripts/environment-depth/shots.mjs [outDir] [filter]
// BASE_URL defaults to the dev server on :3123. GPU by default; E2E=1 uses the software (?e2e=1) path.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "docs/screenshots/environment-depth";
const filter = process.argv[3] ?? "";
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3123";
const W = Number(process.env.W ?? 1440), H = Number(process.env.H ?? 900);
const gpu = !process.env.E2E;
const browser = await chromium.launch({ args: gpu ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

// [name, query]
const shots = [
  ["01-experiment-3d", "mode=experiment&construct=3d&move=track&u=0"],
  ["02-watch-3d-track", "mode=watch&construct=3d&move=track&u=0.55"],
  ["03-flat", "mode=experiment&cue=flat&u=0"],
  ["04-step-3", "mode=experiment&step=3&u=0"],
  ["05-25d-arc-holes", "mode=experiment&construct=25d&move=arc&u=1&overlay=reveal"],
  ["06-3d-arc-reveal", "mode=experiment&construct=3d&move=arc&u=1&overlay=reveal"],
  ["07-2d-track", "mode=experiment&construct=2d&move=track&u=1"],
  ["08-inspect-bands", "mode=inspect&construct=25d&move=track&u=0.6&overlay=bands"],
  ["09-scale-tiny", "mode=experiment&story=tiny&refs=pip,cabin,deer&u=0"],
  ["10-tele-guides", "mode=experiment&focal=135&guides=1&u=0"],
  ["11-25d-clean-track", "mode=experiment&construct=25d&clean=1&move=track&size=1.6&u=1"],
  ["12-occlusion-isolated", "mode=experiment&cue=occlusion&u=0"],
  ["13-inspect-3d-arc-reveal", "mode=inspect&construct=3d&move=arc&u=0.7&overlay=reveal"],
  ["14-scale-cabin-deer", "mode=experiment&refs=pip,cabin,deer,fence&u=0"],
  ["15-watch-25d-arc", "mode=watch&construct=25d&move=arc&u=0.85"],
];
for (const [name, q] of shots) {
  if (filter && !name.includes(filter)) continue;
  await page.goto(`${base}/labs/environment-depth?${q}${process.env.E2E ? "&e2e=1" : ""}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lab-root][data-ready='1']", { timeout: 90000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
}
console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 20) }, null, 1));
await browser.close();
