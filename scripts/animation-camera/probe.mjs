// Load one lab URL with the GPU, print console errors and warnings, save a screenshot.
// Usage: node scripts/animation-camera/probe.mjs <url> [out.png]
import { chromium } from "@playwright/test";
const url = process.argv[2];
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(m.type(), m.text().slice(0, 400)); });
page.on("pageerror", (e) => console.log("pageerror", e.message, e.stack?.slice(0, 600)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
console.log(await page.evaluate(() => document.querySelector("[data-testid=lab-root]")?.dataset.ready));
await page.screenshot({ path: process.argv[3] ?? "/tmp/x.png" });
await browser.close();
