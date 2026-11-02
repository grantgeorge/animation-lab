// Render real preset previews: node scripts/shots-lighting-previews.mjs [outDir]
// Run against the dev server on :3123, or pass BASE_URL. No generated artwork is used.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "public/labs/lighting-studio/previews";
const base = process.env.BASE_URL ?? "http://localhost:3123";
const presets = ["three-point", "flat", "storybook", "dramatic", "noir", "sunset"];
const browser = await chromium.launch({
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});

try {
  await mkdir(out, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${base}/labs/lighting-studio?e2e=1&quality=high&freeze=1.6&nomotion=1&shot=close`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => !!window.__lightingStudio, null, { timeout: 30_000 });
  await page.addStyleTag({ content: `
    body { visibility: hidden !important; }
    .ls-picture {
      visibility: visible !important;
      position: fixed !important;
      inset: 0 auto auto 0 !important;
      width: 320px !important;
      height: 180px !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      transform: none !important;
      aspect-ratio: auto !important;
      overflow: hidden !important;
    }
    .ls-picture > :not([data-testid="canvas-wrap"]) { display: none !important; }
    .ls-picture [data-testid="canvas-wrap"] { position: absolute !important; inset: 0 !important; }
    .ls-picture canvas { visibility: visible !important; }
  ` });
  const canvas = page.locator(".ls-picture canvas");
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".ls-picture canvas");
    return canvas?.getBoundingClientRect().width === 320 && canvas?.getBoundingClientRect().height === 180;
  });
  for (const preset of presets) {
    await page.evaluate((id) => window.__lightingStudio.applyPreset(id, { instant: true }), preset);
    await page.evaluate(() => window.__lightingStudio.settle({ timeoutMs: 30_000 }));
    await canvas.screenshot({ path: join(out, `${preset}.png`) });
    console.log(`wrote ${preset}.png`);
  }
  if (errors.length) throw new Error(`Preview render errors:\n${errors.join("\n")}`);
  console.log(`Rendered ${presets.length} previews at 640×360.`);
} finally {
  await browser.close();
}
