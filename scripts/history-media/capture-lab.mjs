// Captures camera-only frames of the Lens & Framing set (the canonical scene for Animation History).
// Usage:
//   node scripts/history-media/capture-lab.mjs stills <outDir> <focalMm> <t1,t2,...>
//   node scripts/history-media/capture-lab.mjs animatic <outDir> <focalMm> [fps=24]
// Needs the dev server (BASE_URL, default http://localhost:3123).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [mode = "stills", out = "media-work/refs", focalArg = "24", extra] = process.argv.slice(2);
const focal = Number(focalArg);
const base = process.env.BASE_URL ?? "http://localhost:3123";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
await page.goto(`${base}/labs/lens-and-framing?e2e=1&quality=high&freeze=0&ui=0`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__animationLab, null, { timeout: 30000 });
await page.evaluate((f) => {
  const h = window.__animationLab;
  const s = h.getState();
  h.setState({
    camera: { ...s.camera, rig: { ...s.camera.rig, focalMm: f }, version: s.camera.version + 1, lastSource: "reset" },
    viz: { ...s.viz, shotVignette: false, thirds: false, safeAreas: false },
    ui: { ...s.ui, fullscreenShot: true, uiHidden: true },
  });
}, focal);
// Hide every DOM overlay; keep only the WebGL canvas.
await page.addStyleTag({ content: "*{visibility:hidden!important} canvas{visibility:visible!important} nextjs-portal{display:none!important}" });
await page.waitForTimeout(6000);

async function shoot(t, file) {
  await page.evaluate((tt) => window.__animationLab.getState().seek(tt), t);
  await page.evaluate(() => window.__animationLab.settle());
  await page.screenshot({ path: file });
}

if (mode === "animatic") {
  const fps = Number(extra ?? 24);
  for (let i = 0; i < 6 * fps; i++) await shoot(i / fps, `${out}/f${String(i).padStart(4, "0")}.png`);
  console.log(`wrote ${6 * fps} frames to ${out}`);
} else {
  for (const t of (extra ?? "0").split(",").map(Number)) {
    const file = `${out}/lab-f${focal}-t${t.toFixed(2)}.png`;
    await shoot(t, file);
    console.log(file);
  }
}
await browser.close();
