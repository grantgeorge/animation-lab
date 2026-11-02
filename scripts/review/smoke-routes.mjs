import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const r of ["/", "/labs/lens-and-framing", "/labs/lens-and-framing?scene=workshop", "/labs/camera-movement", "/labs/lighting-studio", "/labs/timing-and-spacing", "/labs/character-acting", "/labs/shot-coverage"]) {
  const errs = [];
  const h = (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); };
  page.on("console", h); page.on("pageerror", (e) => errs.push("pageerror " + e.message.slice(0, 160)));
  const res = await page.goto("http://localhost:3123" + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  console.log(res.status(), r, errs.length ? JSON.stringify([...new Set(errs)].slice(0, 3)) : "ok");
  page.removeAllListeners("console"); page.removeAllListeners("pageerror");
}
await page.goto("http://localhost:3123/labs/lighting-studio", { waitUntil: "networkidle" }); await page.waitForTimeout(3000);
await page.screenshot({ path: "/private/tmp/claude-501/-Users-gg-w-animation-lab/e3e90776-3bbd-40e5-9b44-f6376336aec9/scratchpad/lighting-hd.png" });
await browser.close();
