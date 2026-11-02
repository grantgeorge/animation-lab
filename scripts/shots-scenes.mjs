// Screenshots of the alternate Lens & Framing scenes. Usage: node scripts/shots-scenes.mjs <outDir>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "docs/screenshots/scenes";
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const shots = [
  // scene, freeze time, steps: keys pressed before the shot
  ["alley", 1.8, "a-01-default-50mm", []],
  ["alley", 1.8, "a-02-pip-match-24mm", ["KeyT", "KeyM", "Digit2"]],
  ["alley", 1.8, "a-03-pip-match-85mm", ["KeyT", "KeyM", "Digit5"]],
  ["alley", 3.8, "a-04-wave-fixed-18mm", ["Digit1"]],
  ["workshop", 3.3, "w-01-default-50mm", []],
  ["workshop", 3.3, "w-02-both-24mm", ["KeyT", "KeyT", "Digit2"]],
  ["workshop", 3.3, "w-03-match-24mm", ["KeyM", "Digit2"]],
  ["workshop", 3.3, "w-04-match-85mm", ["KeyM", "Digit5"]],
  ["workshop", 2.3, "w-05-peek-35mm", ["Digit3"]],
];
for (const [scene, t, name, keys] of shots) {
  await page.goto(`${base}/labs/lens-and-framing?e2e=1&quality=high&scene=${scene}&freeze=${t}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__animationLab, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(250); }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__animationLab.settle());
  await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 12) }, null, 1));
await browser.close();
