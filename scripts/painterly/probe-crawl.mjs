// Print the crawl metric at a few moments of the head turn: node scripts/painterly/probe-crawl.mjs
import { chromium } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://localhost:3123";
const gpu = process.env.SOFT ? [] : ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ args: gpu });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/labs/painterly-textures?e2e=1&freeze=1.5&test=surface${process.env.Q ? `&quality=${process.env.Q}` : ""}${process.env.EXTRA ?? ""}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__painterlyLab, null, { timeout: 30000 });
await page.waitForTimeout(2500);
for (const t of (process.env.TIMES ?? "0.2,1.0,1.5,2.0,3.0,4.5").split(",").map(Number)) {
  await page.evaluate((x) => window.__painterlyLab.seek(x), t);
  const t0 = Date.now();
  const r = await page.evaluate(() => window.__painterlyLab.crawl());
  const d = await page.evaluate(() => window.__painterlyLab.lastMeasure());
  console.log(`t=${t}`, Object.entries(r).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(" "), "| raw", Object.entries(d).map(([k, v]) => `${k}:${v.raw.toFixed(2)}/${v.moving}of${v.cells}`).join(" "), `${Date.now() - t0}ms`);
}
await browser.close();
