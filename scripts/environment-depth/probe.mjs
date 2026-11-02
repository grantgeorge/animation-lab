// Probe: open with debug hook, apply patches, screenshot the main monitor. Usage: node probe.mjs name 'query' '{"cues":{...}}'
import { chromium } from "@playwright/test";
const [name, q = "", patch = "{}"] = process.argv.slice(2);
const dir = process.env.OUT ?? "/private/tmp/claude-501/-Users-gg-w-animation-lab/e3e90776-3bbd-40e5-9b44-f6376336aec9/scratchpad/env-depth";
const browser = await chromium.launch({ args: process.env.E2E ? [] : ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:3123/labs/environment-depth?debug=1&${q}${process.env.E2E ? "&e2e=1" : ""}`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=lab-root][data-ready='1']", { timeout: 90000 });
await page.evaluate(async (p) => { const h = window.__envLab; h.set(JSON.parse(p)); await h.frames(4); }, patch);
await page.waitForTimeout(Number(process.env.WAIT ?? 1500));
const el = process.env.FULL ? page : page.getByTestId("monitor-main");
await el.screenshot({ path: `${dir}/${name}.png` });
const live = await page.evaluate(() => { const l = window.__envLab.live(); return { reveal: l.reveal, end: l.revealEnd, cons: l.construction, cam: l.cam, layers: l.layers.map((x) => [x.depth.toFixed(1), x.shiftX.toFixed(3)]), probes: l.probes, haze: l.haze }; });
console.log(JSON.stringify(live));
console.log("errors", errors);
await browser.close();
