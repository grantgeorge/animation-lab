// Grading & Finishing: capture the gallery stills for the show-look exercise from the live scenes.
// Each is the clean "develop" output (no grade, no finishing) at 960×540, full-quality characters.
// Usage (dev server running): node scripts/review/capture-gf-plates.mjs
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3123";
const out = "public/labs/grading-finishing/plates";
// Keep the moments in step with engine/shots.ts (plateT).
const plates = [
  { id: "doorway", shot: "doorway", t: 3.4, capture: "plate" },
  { id: "alley", shot: "alley", t: 1.6, capture: "plate" },
  { id: "workshop", shot: "workshop", t: 2.2, capture: "plate" },
  { id: "doorway-flipped", shot: "doorway", t: 3.4, capture: "flipped" },
];
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const p of plates) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/labs/grading-finishing?quality=high&shot=${p.shot}&freeze=${p.t}&capture=${p.capture}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__gradingLab, null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.__gradingLab.frames(10));
  const url = await page.evaluate(() => window.__gradingLab.capturePlate(960, 540));
  writeFileSync(`${out}/${p.id}.jpg`, Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", p.id);
  await page.close();
}
await browser.close();
