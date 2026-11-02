// Screenshots of the Animation Camera lab (one per experiment state). Usage:
//   node scripts/animation-camera/shots.mjs [outDir] [filter]
// BASE_URL defaults to the dev server on :3123. Uses the GPU so DoF / motion blur render at full quality.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "docs/screenshots/animation-camera";
const filter = process.argv[3] ?? "";
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3123";
const W = Number(process.env.W ?? 1440), H = Number(process.env.H ?? 900);
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 240)); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

// [name, query, freeze time]
const shots = [
  ["01-projection-perspective", "exp=1&mode=experiment&proj=persp", 3.4],
  ["02-projection-wipe", "exp=1&mode=experiment&compare=wipe", 3.4],
  ["03-projection-isometric", "exp=1&mode=experiment&proj=iso", 3.4],
  ["04-projection-inspect", "exp=1&mode=inspect&proj=ortho", 3.4],
  ["05-lens-24", "exp=2&mode=experiment&focal=24", 1.0],
  ["06-lens-100", "exp=2&mode=experiment&focal=100", 1.0],
  ["07-lens-inspect", "exp=2&mode=inspect&focal=50", 1.0],
  ["08-move-2d-orbit", "exp=3&mode=experiment&move=2d&kind=orbit", 0.6],
  ["09-move-25d-track", "exp=3&mode=experiment&move=2.5d", 0.6],
  ["09b-move-25d-orbit", "exp=3&mode=experiment&move=2.5d&kind=orbit", 0.6],
  ["10-move-25d-inspect", "exp=3&mode=inspect&move=2.5d", 4.6],
  ["11-move-3d-orbit", "exp=3&mode=experiment&move=3d", 0.6],
  ["12-style-split", "exp=4&mode=experiment&style=split", 1.4],
  ["13-style-photoreal-watch", "exp=4&mode=watch&style=photoreal", 2.72],
  ["14-style-anime-inspect", "exp=4&mode=inspect&style=anime", 2.7],
  ["15-impossible-cheat", "exp=5&mode=experiment&demo=cheat", 1.2],
  ["16-impossible-push", "exp=5&mode=experiment&demo=push", 3.9],
  ["17-impossible-scale", "exp=5&mode=experiment&demo=scale", 4.4],
  ["18-impossible-wall", "exp=5&mode=experiment&demo=wall", 3.25],
  ["19-impossible-whip", "exp=5&mode=experiment&demo=whip", 3.12],
  ["20-impossible-inspect", "exp=5&mode=inspect&demo=whip", 3.12],
  ["21-watch-multiplane", "exp=3&mode=watch&move=2.5d", 1.5],
  ["22-style-anime-cel", "exp=4&mode=experiment&style=anime&cel=1", 2.7],
  ["25-style-anime-cel-wide", "exp=4&mode=experiment&style=anime&cel=1", 4.0],
  ["24-style-split-whip", "exp=4&mode=experiment&style=split", 2.7],
  ["23-watch-projection-wipe", "exp=1&mode=watch&compare=wipe", 1.0],
];
for (const [name, q, t] of shots) {
  if (filter && !name.includes(filter)) continue;
  await page.goto(`${base}/labs/animation-camera?${q}&freeze=${t}${process.env.E2E ? "&e2e=1" : ""}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lab-root][data-ready='1']", { timeout: 60000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
}
console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 20) }, null, 1));
await browser.close();
