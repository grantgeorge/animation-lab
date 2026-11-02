// Capture the film camera's shot (monitor) at given times. Usage:
//   node scripts/review/capture-shot.mjs <outDir> <scene> <keys,comma> <t1,t2,...>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const [out, scene = "doorway", keys = "", times = "3.8"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:3123/labs/lens-and-framing?e2e=1&quality=high&scene=${scene}&freeze=0`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__animationLab, null, { timeout: 30000 });
await page.waitForTimeout(1200);
for (const k of keys.split(",").filter(Boolean)) { await page.keyboard.press(k); await page.waitForTimeout(250); }
await page.keyboard.press("KeyV");
await page.waitForTimeout(800);
for (const t of times.split(",").map(Number)) {
  await page.evaluate((t) => window.__animationLab.getState().seek(t), t);
  await page.evaluate(() => window.__animationLab.settle());
  await page.getByTestId("monitor-window").screenshot({ path: `${out}/${scene}-t${t.toFixed(2)}.png` });
}
await browser.close();
