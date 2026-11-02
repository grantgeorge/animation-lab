// Close-ups of the characters' faces at expression beats. Usage: node scripts/review/capture-faces.mjs <outDir>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "assets-src/review/faces";
mkdirSync(out, { recursive: true });
const SHOTS = [
  // scene, label, t, camera position, target
  ["doorway", "bram-neutral", 0.5, [-0.25, 1.62, -2.1], [-0.35, 1.6, -3]],
  ["doorway", "bram-blink", 0.98, [-0.25, 1.62, -2.1], [-0.35, 1.6, -3]],
  ["doorway", "bram-curious", 1.9, [-0.25, 1.62, -2.1], [-0.35, 1.6, -3]],
  ["doorway", "bram-warm", 3.9, [0.2, 1.62, -2.4], [-0.35, 1.6, -3]],
  ["doorway", "pip-grin", 3.5, [0.62, 0.86, -3.9], [0.72, 0.8, -4.7]],
  ["doorway", "pip-hop", 4.66, [0.62, 0.9, -3.9], [0.72, 0.85, -4.7]],
  ["workshop", "bram-focus", 1.0, [-0.3, 1.6, -2.2], [-0.35, 1.5, -3]],
  ["workshop", "bram-startle", 3.12, [-0.1, 1.75, -2.2], [-0.3, 1.65, -3]],
  ["workshop", "bram-relief", 4.6, [0.0, 1.62, -2.2], [-0.3, 1.55, -3]],
  ["workshop", "bram-relief-wide", 4.6, [0.6, 1.5, -1.0], [-0.3, 1.25, -3]],
  ["workshop", "pip-boo", 3.05, [0.6, 1.4, -2.9], [0.35, 1.35, -3.75]],
  ["workshop", "pip-laugh", 4.2, [0.6, 1.4, -2.9], [0.35, 1.35, -3.75]],
  ["alley", "pip-sprint", 2.0, [0.6, 0.95, -6.6], [0.15, 0.85, -9.4]],
];
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
let current = "";
for (const [scene, label, t, p, q] of SHOTS) {
  if (scene !== current) {
    await page.goto(`http://localhost:3123/labs/lens-and-framing?e2e=1&quality=high&ui=0&tech=0&scene=${scene}&freeze=0`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.__animationLab && !!window.__r3f?.get?.().controls, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    current = scene;
  }
  await page.evaluate(([p, q]) => window.__r3f.get().controls.setLookAt(p[0], p[1], p[2], q[0], q[1], q[2], false), [p, q]);
  await page.evaluate((t) => window.__animationLab.getState().seek(t), t);
  await page.evaluate(() => window.__animationLab.settle());
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${scene}-${label}.png`, clip: { x: 80, y: 40, width: 480, height: 400 } });
}
await browser.close();
console.log("done");
