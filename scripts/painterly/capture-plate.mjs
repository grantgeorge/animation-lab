// Capture the matte painter's plate: the clean, empty Workshop set from the shot camera.
// node scripts/painterly/capture-plate.mjs <out.png>
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const out = process.argv[2] ?? "plate.png";
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/labs/painterly-textures?e2e=1&quality=high&freeze=0.4&layer=clean`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__painterlyLab, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const url = await page.evaluate(() => window.__painterlyLab.plate());
writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
console.log("wrote", out);
await browser.close();
