// Screenshots of the VFX & Simulation lab. Usage:
//   node scripts/vfx-simulation/shots.mjs [outDir] [filter]
// BASE_URL defaults to the dev server on :3123. GPU by default; E2E=1 uses the software (?e2e=1) path.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "docs/screenshots/vfx-simulation";
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
  ["01-compare-crown", "mode=experiment&exp=bucket&compare=1&tr=cartoon&t=1.55"],
  ["03-realistic-sheet", "mode=experiment&exp=bucket&compare=0&tr=real&t=1.3"],
  ["04-drawn-key", "mode=experiment&exp=bucket&compare=0&tr=drawn&t=1.6"],
  ["05-drawn-impact-frame", "mode=experiment&exp=bucket&compare=0&tr=drawn&t=1.333"],
  ["06-cartoon-anticipation", "mode=experiment&exp=bucket&compare=0&tr=cartoon&t=1.0"],
  ["07-inspect-curves", "mode=inspect&exp=bucket&compare=1&tr=real&t=1.4&raster=1"],
  ["08-watch-compare", "mode=watch&exp=bucket&compare=1&t=1.62"],
  ["09-sync-early", "mode=experiment&exp=sync&offset=-6&t=1.3"],
  ["10-fire-real-sim", "mode=experiment&exp=fire&look=real&motion=sim&t=1.2"],
  ["11-fire-stylized-keyed", "mode=experiment&exp=fire&look=stylized&motion=keyed&t=1.2"],
  ["12-water-split", "mode=experiment&exp=water&split=1&t=1.5"],
  ["13-rigid-split", "mode=experiment&exp=rigid&split=1&t=1.6"],
  ["14-cloth-split", "mode=experiment&exp=cloth&split=1&t=1.1"],
  ["15-magic-split", "mode=experiment&exp=magic&split=1&t=1.7"],
  ["16-drawn-fx-smear", "mode=experiment&exp=drawn&look=stylized&motion=keyed&t=0.79"],
  ["17-realistic-retimed-low-g", "mode=experiment&exp=bucket&compare=1&tr=real&g=0.5&styl=1&t=1.6"],
  ["18-kick-contact", "mode=experiment&exp=bucket&compare=0&tr=cartoon&t=0.84"],
  ["19-drawn-fx-impact-flash", "mode=experiment&exp=drawn&look=stylized&motion=keyed&split=1&t=0.835"],
];
for (const [name, q] of shots) {
  if (filter && !filter.split(",").some((f) => name.includes(f))) continue;
  await page.goto(`${base}/labs/vfx-simulation?${q}${process.env.E2E ? "&e2e=1" : ""}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lab-root][data-ready='1']", { timeout: 120000 });
  if (q.includes("exp=bucket")) await page.waitForSelector("[data-testid=lab-root][data-baked='1']", { timeout: 120000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 1500));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
}
console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 20) }, null, 1));
await browser.close();
