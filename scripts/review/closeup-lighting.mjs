// Close-up of Bram in the Lighting Studio (storybook look) for model A/B. Usage: node scripts/review/closeup-lighting.mjs out.png
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3123/labs/lighting-studio?e2e=1&quality=high&freeze=1.6", { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__lightingStudio, null, { timeout: 30000 });
await page.keyboard.press("Digit2"); await page.waitForTimeout(1800);
await page.evaluate(() => window.__lightingStudio.settle());
await page.screenshot({ path: process.argv[2], clip: { x: 500, y: 120, width: 440, height: 440 } });
await browser.close();
