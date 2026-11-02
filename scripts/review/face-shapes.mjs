// Force each face shape on a character and capture it, for tuning the procedural face rig.
// Usage: node scripts/review/face-shapes.mjs <outDir> <Pip|Bram>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const [out = "assets-src/review/shapes", who = "Pip"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const cam = who === "Pip" ? [[0.72, 0.84, -3.95], [0.72, 0.8, -4.7], 3.35] : [[-0.35, 1.62, -2.3], [-0.35, 1.6, -3], 0.5];
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
await page.goto(`http://localhost:3123/labs/lens-and-framing?e2e=1&quality=high&ui=0&tech=0&freeze=${cam[2]}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__animationLab && !!window.__r3f?.get?.().controls, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(([p, q]) => window.__r3f.get().controls.setLookAt(p[0], p[1], p[2], q[0], q[1], q[2], false), cam);
const zero = { blink: 0, wide: 0, browUp: 0, browAngry: 0, browSad: 0, smile: 0, mouthOpen: 0 };
for (const shape of ["neutral", "blink", "wide", "browUp", "browAngry", "browSad", "smile", "mouthOpen"]) {
  await page.evaluate(([who, shape, zero]) => { window.__faceOverride = { [who]: shape === "neutral" ? zero : { ...zero, [shape]: 1 } }; }, [who, shape, zero]);
  await page.evaluate(() => window.__animationLab.settle());
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${who}-${shape}.png`, clip: { x: 120, y: 80, width: 400, height: 360 } });
}
await browser.close();
