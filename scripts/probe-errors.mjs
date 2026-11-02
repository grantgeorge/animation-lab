import { chromium } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let n = 0;
page.on("console", (m) => { if (m.type() === "error") { n++; if (n <= 3) console.log("ERR", m.text().slice(0, 300)); } });
await page.goto(`${base}/labs/lens-and-framing?e2e=1`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
console.log("after load:", n);
for (const k of ["Digit2", "KeyM", "Digit5", "KeyT"]) { await page.keyboard.press(k); await page.waitForTimeout(400); console.log("after", k, n); }
await page.keyboard.press("KeyV"); await page.waitForTimeout(800); console.log("after V:", n);
await page.keyboard.press("KeyV"); await page.waitForTimeout(800); console.log("after V again:", n);
await browser.close();
