// Lighting Studio screenshots: node scripts/shots-lighting.mjs [outDir] [WxH]
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "docs/screenshots/lighting-studio";
const [w, h] = (process.argv[3] ?? "1440x900").split("x").map(Number);
const base = process.env.BASE_URL ?? "http://localhost:3123";
const only = process.env.ONLY?.split(",");
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${base}/labs/lighting-studio?e2e=1&quality=high&freeze=${process.env.FREEZE ?? 1.6}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__lightingStudio, null, { timeout: 30000 });
await page.evaluate(() => window.__lightingStudio.settle());
await page.waitForTimeout(1200);
const settle = () => page.evaluate(() => window.__lightingStudio.settle());
const shot = async (name) => { if (only && !only.some((o) => name.includes(o))) return; await settle(); await page.screenshot({ path: `${out}/${name}.png` }); console.log("wrote", name); };
await shot("00-default-three-point");
const looks = ["flat", "storybook", "dramatic", "noir", "sunset"];
for (let i = 0; i < looks.length; i++) {
  await page.keyboard.press(`Digit${i + 1}`);
  await page.waitForTimeout(1800);
  await shot(`0${i + 1}-${looks[i]}`);
}
// take apart the dramatic look, step 1 (key only) and 2 (key + fill)
await page.keyboard.press("Digit3"); await page.waitForTimeout(1800);
await page.keyboard.press("KeyT"); await page.waitForTimeout(500);
await shot("06-take-apart-key-only");
await page.keyboard.press("BracketRight"); await page.waitForTimeout(500);
await shot("07-take-apart-key-fill");
await page.keyboard.press("KeyT");
// inspect view on the sunset look
await page.keyboard.press("Digit5"); await page.waitForTimeout(1800);
await page.keyboard.press("KeyV"); await page.waitForTimeout(600);
await shot("08-inspect-sunset");
await page.keyboard.press("Digit4"); await page.waitForTimeout(1800);
await shot("09-inspect-noir");
// full shot: the sunset's long shadow toward camera, the storybook's soft shadow
await page.keyboard.press("KeyV"); await page.waitForTimeout(400);
await page.selectOption('[data-testid="shot-size"]', "wide"); await page.locator('[data-testid="shot-size"]').blur(); await page.keyboard.press("Digit5"); await page.waitForTimeout(1800);
await shot("10-sunset-full-shot");
await page.keyboard.press("Digit2"); await page.waitForTimeout(1800);
await shot("11-storybook-full-shot");
await page.selectOption('[data-testid="shot-size"]', "close"); await page.locator('[data-testid="shot-size"]').blur(); await page.keyboard.press("Digit3"); await page.waitForTimeout(1800);
await shot("12-cinematic-close-up");
if (w <= 900) {
  await page.getByTestId("light-panel").scrollIntoViewIfNeeded();
  await shot("13-mobile-controls");
  await page.getByTestId("look-card").scrollIntoViewIfNeeded();
  await shot("14-mobile-study");
}
const state = await page.evaluate(() => { const s = window.__lightingStudio.getState(); return { preset: s.presetId, ratio: s.ratio, prompt: s.prompt, frames: s.frames }; });
console.log(JSON.stringify({ errors: errors.slice(0, 20), state }, null, 1));
await browser.close();
