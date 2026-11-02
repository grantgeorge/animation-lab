// Screenshots of the Shot Coverage & Editing lab. Usage: node scripts/shots-coverage.mjs [outDir]
// Runs against a dev server (BASE_URL, default http://localhost:3123).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "docs/screenshots/shot-coverage";
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const errors = [];
// [name, width, height, query, t, setup(page)]
const shots = [
  ["01-experiment", 1440, 900, "scene=doorway", 3.6, null],
  ["02-watch", 1440, 900, "scene=doorway&mode=watch", 3.0, null],
  ["03-inspect", 1440, 900, "scene=doorway&mode=inspect", 3.6, null],
  ["04-crossed-the-line", 1440, 900, "scene=doorway", 3.6, async (p) => p.getByTestId("edit-crossing").click()],
  [
    "05-continuity-flags",
    1440,
    900,
    "scene=doorway",
    5.0,
    async (p) => {
      await p.getByTestId("edit-crossing").click();
      await p.evaluate(() => window.__coverageLab.setEdit([{ t: 0, cam: "A" }, { t: 2.45, cam: "B" }, { t: 3.35, cam: "C" }, { t: 4.65, cam: "A" }, { t: 5.3, cam: "A" }]));
    },
  ],
  ["06-alley-1280", 1280, 800, "scene=alley", 4.2, null],
  ["07-workshop-1920", 1920, 1080, "scene=workshop", 3.6, null],
];
for (const [name, W, H, q, t, setup] of shots) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text().slice(0, 240)}`); });
  page.on("pageerror", (e) => errors.push(`${name}: pageerror: ${e.message}`));
  await page.goto(`${base}/labs/shot-coverage?e2e=1&${q}&freeze=${t}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__coverageLab, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  if (setup) { await setup(page); await page.waitForTimeout(300); }
  await page.evaluate((t) => { window.__coverageLab.pause(); window.__coverageLab.seek(t); }, t);
  await page.evaluate(() => window.__coverageLab.frames(4));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}
console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 12) }, null, 1));
await browser.close();
