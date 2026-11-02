// Grading & Finishing: open the lab (e2e hook on), wait, optionally evaluate EVAL, screenshot, print console errors.
// Usage: node scripts/review/gf-peek.mjs "<extra query>" <out.png> [waitMs] [gpu=1]
import { chromium } from "@playwright/test";
const [,, query = "", out = "peek.png", waitMs = "4000", gpu = "1"] = process.argv;
const browser = await chromium.launch({ args: gpu === "1" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 400)}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:3123/labs/grading-finishing?${process.env.NOE2E ? "" : "e2e=1"}${query}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(waitMs));
if (process.env.EVAL) console.log(await page.evaluate(process.env.EVAL));
await page.screenshot({ path: out });
console.log(JSON.stringify(errors.slice(0, 20), null, 1));
await browser.close();
