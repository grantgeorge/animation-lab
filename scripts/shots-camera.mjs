// Screenshots of the Camera Movement lab. Usage: node scripts/shots-camera.mjs [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "docs/screenshots/camera-movement";
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3123";
const W = Number(process.env.W ?? 1440), H = Number(process.env.H ?? 900);
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 240)); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const shots = [
  ["doorway", 3.0, "01-dolly-in", []],
  ["doorway", 5.2, "02-dolly-vs-zoom-end", ["exp-dolly-vs-zoom"]],
  ["doorway", 5.2, "03-dolly-zoom-end", ["exp-dolly-zoom"]],
  ["doorway", 3.0, "04-orbit", ["move-orbit"]],
  ["doorway", 3.0, "05-truck", ["move-truck"]],
  ["doorway", 3.0, "06-crane", ["move-crane"]],
  ["alley", 1.8, "07-alley-tracking", ["move-tracking"]],
  ["workshop", 3.2, "08-workshop-pan", ["move-pan"]],
];
for (const [scene, t, name, clicks] of shots) {
  await page.goto(`${base}/labs/camera-movement?e2e=1&scene=${scene}&freeze=${t}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__cameraLab, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  for (const id of clicks) { await page.getByTestId(id).click(); await page.waitForTimeout(300); }
  await page.evaluate((t) => { window.__cameraLab.getState().seek(t); }, t);
  await page.evaluate(() => window.__cameraLab.frames(4));
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${name}.png` });
}
const live = await page.evaluate(() => window.__cameraLab.live());
console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 12), live }, null, 1));
await browser.close();
