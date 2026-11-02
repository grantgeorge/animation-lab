// Painterly Textures screenshots: node scripts/painterly/shots.mjs [outDir] [WxH]
// ONLY=name1,name2 to filter. GPU Chromium (Metal) for real-quality frames.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "docs/screenshots/painterly-textures";
const [w, h] = (process.argv[3] ?? "1440x900").split("x").map(Number);
const base = process.env.BASE_URL ?? "http://localhost:3123";
const only = process.env.ONLY?.split(",");
const quality = process.env.QUALITY ?? "high";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

/** [name, url params, optional hook patch, optional freeze time] */
const shots = [
  ["01-watch-painted", "mode=watch", null, 2.0],
  ["02-experiment-wipe", "mode=experiment", null, 2.0],
  ["03-layer-0-clean", "mode=experiment&layer=clean", { wipe: 0 }, 2.0],
  ["04-layer-1-texture", "mode=experiment&layer=texture", { wipe: 0 }, 2.0],
  ["05-layer-2-shading", "mode=experiment&layer=shading", { wipe: 0 }, 2.0],
  ["06-layer-3-projection", "mode=experiment&layer=projection", { wipe: 0 }, 2.0],
  ["07-layer-4-overlays", "mode=experiment&layer=overlays", { wipe: 0 }, 2.0],
  ["08-layer-5-composite", "mode=experiment", { wipe: 0 }, 2.0],
  ["09-char-only", "mode=experiment", { paintEnv: false, wipe: 0 }, 2.0],
  ["10-env-only", "mode=experiment", { paintChar: false, wipe: 0 }, 2.0],
  ["11-projection-swing", "mode=experiment", { projYaw: 32, wipe: 0 }, 2.0],
  ["12-inspect-texture", "mode=inspect&layer=texture", { layers: { texture: true, shading: true, projection: true, overlays: true, composite: true } }, 2.0],
  ["13-inspect-shading", "mode=inspect&layer=shading", { layers: { texture: true, shading: true, projection: true, overlays: true, composite: true } }, 2.0],
  ["14-inspect-projection", "mode=inspect&layer=projection", { projYaw: 28, layers: { texture: true, shading: true, projection: true, overlays: true, composite: true } }, 2.0],
  ["15-inspect-overlays", "mode=inspect&layer=overlays", { layers: { texture: true, shading: true, projection: true, overlays: true, composite: true } }, 2.0],
  ["16-inspect-stack", "mode=inspect&layer=composite", null, 2.0],
  ["17-test-watch", "mode=watch&test=surface", null, "live"],
  ["18-test-inspect", "mode=inspect&test=screen", null, "live"],
  ["19-test-experiment-orbit", "mode=experiment&test=boil", { testMotion: "orbit" }, "live"],
];

for (const [name, params, patch, freeze] of shots) {
  if (only && !only.some((o) => name.includes(o))) continue;
  const live = freeze === "live";
  await page.goto(`${base}/labs/painterly-textures?e2e=1&quality=${quality}${live ? "" : `&freeze=${freeze}`}&${params}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__painterlyLab, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  if (patch) await page.evaluate((p) => window.__painterlyLab.set(p), patch);
  if (live) {
    // let the head turn play: the readouts fill one film frame at a time; stop mid-turn
    await page.evaluate(() => window.__painterlyLab.seek(0));
    await page.waitForTimeout(4400);
    await page.evaluate(() => window.__painterlyLab.pause());
  }
  await page.evaluate(() => window.__painterlyLab.frames(4));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("wrote", name);
}
if (errors.length) console.log("console:\n" + [...new Set(errors)].join("\n"));
await browser.close();
