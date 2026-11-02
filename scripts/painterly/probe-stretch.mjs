// Print projection stretch vs camera swing: node scripts/painterly/probe-stretch.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${process.env.BASE_URL ?? "http://localhost:3123"}/labs/painterly-textures?e2e=1&freeze=2&mode=experiment`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__painterlyLab, null, { timeout: 30000 });
for (const yaw of [0, 5, 10, 20, 32, 40]) {
  await page.evaluate((y) => window.__painterlyLab.set({ projYaw: y }), yaw);
  await page.evaluate(() => window.__painterlyLab.frames(2));
  console.log(`${yaw}°`, (await page.evaluate(() => window.__painterlyLab.stretch())).toFixed(3));
}
await browser.close();
