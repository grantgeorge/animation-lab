// Software-WebGL (?e2e=1) smoke: load time, frame time, readiness. Usage: node scripts/environment-depth/perf.mjs [query]
import { chromium } from "@playwright/test";
const q = process.argv[2] ?? "";
const browser = await chromium.launch({ args: process.env.GPU ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const t0 = Date.now();
await page.goto(`${process.env.BASE_URL ?? "http://localhost:3123"}/labs/environment-depth?${process.env.GPU ? "debug=1" : "e2e=1"}&${q}`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=lab-root][data-ready='1']", { timeout: 120000 });
const ready = Date.now() - t0;
const fps = await page.evaluate(async () => {
  const h = window.__envLab;
  h.play();
  const a = performance.now();
  await h.frames(20);
  return 20 / ((performance.now() - a) / 1000);
});
const stepMs = await page.evaluate(async () => {
  const h = window.__envLab;
  h.pause();
  const a = performance.now();
  h.setU(0.7);
  await h.frames(3);
  return (performance.now() - a) / 3;
});
await page.screenshot({ path: (process.env.OUT ?? "/private/tmp/claude-501/-Users-gg-w-animation-lab/e3e90776-3bbd-40e5-9b44-f6376336aec9/scratchpad/env-depth") + "/e2e-smoke.png" });
console.log(JSON.stringify({ ready, fps: fps.toFixed(2), stepMs: stepMs.toFixed(0), errors }));
await browser.close();
