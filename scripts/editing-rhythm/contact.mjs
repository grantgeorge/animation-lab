// Contact sheet: render given (shot, sourceIn) pairs on the program monitor and capture each.
// Usage: node scripts/editing-rhythm/contact.mjs <outDir> shot:t [shot:t ...]
import { chromium } from "@playwright/test";
const [dir, ...pairs] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`${base}/labs/editing-rhythm?e2e=1&quality=${process.env.Q ?? "high"}&mode=watch`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__editLab, null, { timeout: 60000 });
await page.waitForTimeout(2500);
for (const p of pairs) {
  const [shot, t] = p.split(":");
  await page.evaluate(async ([shot, t]) => {
    const h = window.__editLab;
    h.pause();
    h.getState().setEdit([{ id: "q", shot, sourceIn: Number(t), duration: 2 }]);
    h.seek(0.001);
    await h.frames(4);
  }, [shot, t]);
  await page.waitForTimeout(250);
  await page.locator("[data-testid=monitor-W]").screenshot({ path: `${dir}/${shot}-${t}.png` });
}
console.log(JSON.stringify(errors));
await browser.close();
