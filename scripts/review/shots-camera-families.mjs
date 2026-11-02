// Screenshots of the Cinema Camera Families lab at 1440×900. Usage:
//   node scripts/review/shots-camera-families.mjs [outDir] [only-name-substring]
// Runs against a dev server (BASE_URL, default http://localhost:3123). Uses the GPU-backed Chromium.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const out = process.argv[2] ?? "docs/screenshots/camera-families";
const only = process.argv[3] ?? "";
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const errors = [];
const act = (fn) => async (p) => p.evaluate(fn);
// [name, query, t, setup]
const shots = [
  ["01-sensor", "step=sensor", 3.4, null],
  ["02-sensor-same-framing-265", "step=sensor", 3.4, async (p) => { await p.getByTestId("framing-framing").click(); await p.getByTestId("camera-alexa265").click(); }],
  ["03-focal", "step=focal", 3.4, null],
  ["04-aperture-shallow", "step=aperture", 3.4, async (p) => { await p.getByTestId("tstop-1.4").click(); await p.evaluate(() => window.__cameraFamilies.getState().setFocal(60)); }],
  ["05-aperture-band", "step=aperture", 3.4, async (p) => { await p.getByTestId("tstop-1.4").click(); await p.getByTestId("show-band").check(); }],
  ["06-shutter-pan-360", "step=shutter", 1.0, async (p) => { await p.getByTestId("move-pan").click(); await p.getByTestId("shutter-360").click(); }],
  ["07-shutter-rolling-alexa", "step=shutter&camera=alexa35", 1.0, async (p) => { await p.getByTestId("rolling-test").check(); await p.getByTestId("shutter-45").click(); }],
  ["08-shutter-global-vraptor", "step=shutter&camera=alexa35", 1.0, async (p) => { await p.getByTestId("rolling-test").check(); await p.getByTestId("shutter-45").click(); await p.getByTestId("compare-global").click(); }],
  ["09-response-highlight-naturalistic", "step=response", 3.4, async (p) => { await p.getByTestId("look-naturalistic").click(); await p.getByTestId("highlight-test").click(); }],
  ["10-response-highlight-doc", "step=response", 3.4, async (p) => { await p.getByTestId("look-doc").click(); await p.getByTestId("highlight-test").click(); }],
  ["11-response-film35", "step=response&camera=film35", 3.4, null],
  ["12-blind", "step=blind", 3.4, null],
  ["13-blind-revealed", "step=blind", 3.4, async (p) => {
    const looks = await p.evaluate(() => window.__cameraFamilies.getState().blind.looks);
    for (let i = 0; i < 3; i++) await p.getByTestId(`guess-${i}-${looks[(i + 1) % 3]}`).click();
    await p.getByTestId("blind-reveal").click();
  }],
  ["14-watch", "mode=watch&camera=alexa265", 3.4, null],
  ["15-inspect", "mode=inspect", 3.4, null],
];
void act;
for (const [name, q, t, setup] of shots) {
  if (only && !name.includes(only)) continue;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text().slice(0, 240)}`); });
  page.on("pageerror", (e) => errors.push(`${name}: pageerror: ${e.message}`));
  await page.goto(`${base}/labs/camera-families?e2e=1&quality=high&${q}&freeze=${t}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__cameraFamilies, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  if (setup) { await setup(page); await page.waitForTimeout(300); }
  await page.evaluate((t) => { const h = window.__cameraFamilies; h.getState().pause(); h.getState().seek(t); }, t);
  await page.evaluate(() => window.__cameraFamilies.frames(4));
  await page.waitForTimeout(1900);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
  await page.close();
}
await browser.close();
if (errors.length) { console.log("ERRORS:\n" + errors.join("\n")); process.exitCode = 1; }
