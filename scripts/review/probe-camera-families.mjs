// Load the Camera Families lab, print console output and live frame stats, save a screenshot.
// Usage: node scripts/review/probe-camera-families.mjs ["&query"] [out.png]
import { chromium } from "@playwright/test";
const browser = await chromium.launch(process.env.NOGPU ? {} : { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror", e.stack?.slice(0, 900)));
const t0 = Date.now();
await page.goto(`http://localhost:3123/labs/camera-families?e2e=1&quality=high${process.argv[2] ?? ""}`, { waitUntil: "domcontentloaded", timeout: 90000 });
console.log("loaded", Date.now() - t0);
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => window.__cameraFamilies ? window.__cameraFamilies.live() : null);
  console.log(i, r ? JSON.stringify({ f: r.frameId, renders: r.renders, w: r.renderW, h: r.renderH, hfov: r.hfov, sf: r.subjectFraction }) : "no hook");
  if (r && r.frameId > 10) break;
}
if (process.env.EVAL) { await page.evaluate(process.env.EVAL); await page.waitForTimeout(1500); }
await page.screenshot({ path: process.argv[3] ?? "/private/tmp/claude-501/-Users-gg-w-animation-lab/e3e90776-3bbd-40e5-9b44-f6376336aec9/scratchpad/probe.png" });
await browser.close();
