// Quick capture of one Editing & Rhythm state at 1440×900 (GPU Chromium).
// Usage: node scripts/editing-rhythm/shot.mjs <out.png> "<query>" [seekSeconds] [jsToEval]
import { chromium } from "@playwright/test";
const [out, query = "", seek = "", js = ""] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${base}/labs/editing-rhythm?e2e=1&quality=${process.env.Q ?? "high"}${query ? `&${query}` : ""}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__editLab, null, { timeout: 60000 });
await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
if (js) await page.evaluate(js);
if (seek !== "") await page.evaluate(async (t) => { const h = window.__editLab; h.pause(); h.seek(Number(t)); await h.frames(4); }, seek);
await page.waitForTimeout(400);
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({ live: window.__editLab.live(), ex: window.__editLab.explanation().headline }));
console.log(JSON.stringify({ errors: errors.slice(0, 12), info }, null, 1));
await browser.close();
